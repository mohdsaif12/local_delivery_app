'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type OrderStatus, type PaymentStatus, type Complaint } from '@/lib/types'
import { toast } from 'sonner'
import BottomNav from '@/components/BottomNav'
import IOSInstallPrompt from '@/components/IOSInstallPrompt'
import AndroidInstallPrompt from '@/components/AndroidInstallPrompt'
import PushSetup from '@/components/PushSetup'
import LiveMap from '@/components/LiveMap'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import {
  ChevronLeft,
  HelpCircle,
  Check,
  ChefHat,
  Package,
  Bike,
  Compass,
  Phone,
  MessageSquare,
  Star,
  Clock,
  ThumbsUp,
  AlertCircle,
} from 'lucide-react'

const CANCEL_WINDOW_MS = 59 * 1000

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

type CancelReason =
  | 'item_not_available'
  | 'too_busy'
  | 'customer_unreachable'
  | 'payment_issue'
  | 'customer_requested'
  | 'other'
  | null

const CANCEL_REASON_LABELS: Record<NonNullable<CancelReason>, { label: string; desc: string; emoji: string }> = {
  item_not_available: {
    emoji: '🥡',
    label: 'Item Not Available',
    desc: 'One or more items you ordered were out of stock at the time.',
  },
  too_busy: {
    emoji: '⏳',
    label: 'Restaurant Too Busy',
    desc: "We were at full capacity and couldn't take on new orders right now.",
  },
  customer_unreachable: {
    emoji: '📵',
    label: 'Could Not Reach You',
    desc: 'We tried to contact you but were unable to reach you.',
  },
  payment_issue: {
    emoji: '💳',
    label: 'Payment Issue',
    desc: 'There was a problem verifying your payment. Please try again.',
  },
  customer_requested: {
    emoji: '👋',
    label: 'Cancelled by You',
    desc: 'You cancelled this order within the 1-minute window.',
  },
  other: {
    emoji: '📋',
    label: 'Other Reason',
    desc: 'We were unable to fulfill your order. We apologise for the inconvenience.',
  },
}

interface OrderItem {
  id: string
  quantity: number
  price_at_order: number
  products: { name: string } | null
}

interface OrderData {
  id: string
  order_number: string | null
  status: OrderStatus
  payment_status: PaymentStatus
  utr_number: string | null
  total: number
  delivery_fee: number
  cancellation_reason: CancelReason
  delivery_address: {
    name: string
    phone: string
    address: string
    landmark?: string
    pincode: string
  }
  delivery_latitude: number | null
  delivery_longitude: number | null
  created_at: string
  accepted_at: string | null
  ready_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  rider_id: string | null
  eta_minutes: number | null
  unavailable_items: string[] | null
  modified_total: number | null
  order_items: OrderItem[]
  restaurants: { latitude: number | null; longitude: number | null } | null
  rider: { full_name: string | null; phone: string | null } | null
}

const STATUS_ORDER: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
]

function currentStep(order: OrderData): number {
  if (order.status === 'pending' && order.payment_status === 'pending_verification') return 0
  if (order.status === 'pending') return 0
  if (order.status === 'accepted') return 1
  if (order.status === 'preparing') return 2
  if (order.status === 'ready') return 3
  if (order.status === 'out_for_delivery') return 4
  if (order.status === 'delivered') return 5
  return 0
}

// ── Animated Stepper ─────────────────────────────────────────
// • Initial render: instantly lit up to current step (no animation)
// • When status advances via realtime: game-loading animation for NEW step only
function AnimatedOrderStepper({ status, steps, currentStepIndex }: {
  status: OrderStatus
  steps: { label: string; desc: string; icon: React.ElementType; color: string }[]
  currentStepIndex: number
}) {
  const numLines = steps.length - 1

  // Instantly show all steps up to current on mount
  const [lineProgress, setLineProgress] = useState<number[]>(() =>
    Array(numLines).fill(0).map((_, i) => (i < currentStepIndex ? 100 : 0))
  )
  const [unlocked, setUnlocked] = useState<boolean[]>(() =>
    steps.map((_, i) => i <= currentStepIndex)
  )
  const [popping, setPopping] = useState<boolean[]>(Array(steps.length).fill(false))

  // Track previous step to detect realtime advances
  const prevCurrentRef = useRef(currentStepIndex)

  useEffect(() => {
    const prevCurrent = prevCurrentRef.current
    prevCurrentRef.current = currentStepIndex

    // Same step = initial mount or no change — nothing to animate
    if (prevCurrent === currentStepIndex) return

    // Status moved forward — animate only the NEW line(s)
    let dead = false

    function animateLine(lineIdx: number) {
      if (dead || lineIdx >= currentStepIndex) return
      // Skip lines that were already done before this update
      if (lineIdx < prevCurrent) { animateLine(lineIdx + 1); return }

      let progress = lineIdx < prevCurrent ? 100 : 0

      const tick = setInterval(() => {
        if (dead) { clearInterval(tick); return }

        // Smooth linear progression (e.g., 4% per frame) for single continuous movement
        progress = Math.min(progress + 4, 100)

        setLineProgress(prev => {
          const next = [...prev]
          next[lineIdx] = progress
          return next
        })

        if (progress >= 100) {
          clearInterval(tick)

          const nextIdx = lineIdx + 1
          setUnlocked(prev => { const n = [...prev]; n[nextIdx] = true; return n })
          setPopping(prev => { const n = [...prev]; n[nextIdx] = true; return n })

          setTimeout(() => {
            if (dead) return
            setPopping(prev => { const n = [...prev]; n[nextIdx] = false; return n })
            setTimeout(() => animateLine(lineIdx + 1), 50)
          }, 250)
        }
      }, 16)
    }

    animateLine(prevCurrent)
    return () => { dead = true }
  }, [currentStepIndex])

  return (
    <>
      <style>{`
        @keyframes stepPop {
          0%   { transform: scale(0.45); opacity: 0.4; }
          55%  { transform: scale(1.28); opacity: 1; }
          75%  { transform: scale(0.92); }
          90%  { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div className="relative space-y-6 pl-8">
        {steps.map((s, i) => {
          const isUnlocked = unlocked[i]
          const isPopping  = popping[i]
          const isActive   = i === currentStepIndex && isUnlocked
          const Icon = s.icon

          return (
            <div
              key={i}
              className="relative flex items-start"
            >
              {/* Connector line with progress fill */}
              {i < steps.length - 1 && (
                <div
                  className="absolute left-[-20px] top-[32px] bottom-[-24px] w-0.5 bg-[#f3f4f6]"
                  style={{ zIndex: 1 }}
                >
                  <div
                    className="w-full"
                    style={{
                      height: `${lineProgress[i]}%`,
                      backgroundColor: steps[i + 1].color,
                    }}
                  />
                </div>
              )}

              {/* Step icon */}
              <div
                className={`absolute -left-[38px] top-0 w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                  isUnlocked ? 'text-white' : 'bg-white border-gray-200 text-gray-300'
                }`}
                style={{
                  backgroundColor: isUnlocked ? s.color : undefined,
                  borderColor: isUnlocked ? s.color : undefined,
                  boxShadow: isActive ? `0 2px 8px ${s.color}40` : undefined,
                  zIndex: 2,
                  animation: isPopping
                    ? 'stepPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards'
                    : undefined,
                }}
              >
                <Icon className="size-4" strokeWidth={isUnlocked ? 2.5 : 2} />
              </div>

              {/* Step text */}
              <div className="pl-3.5 min-w-0">
                <h4
                  className="text-xs font-bold transition-colors duration-300"
                  style={{ color: isUnlocked ? 'inherit' : '#afafaf' }}
                >
                  {s.label}
                </h4>
                <p
                  className="text-[10px] leading-relaxed mt-0.5 transition-colors duration-300"
                  style={{ color: isUnlocked ? 'inherit' : '#d1d5db' }}
                >
                  {s.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}



// ── Skeleton loader ──────────────────────────────────────────
function OrderSkeleton() {
  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f7f8fa] text-gray-900 animate-pulse">
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded-full" />
          <div className="w-24 h-4 bg-gray-200 rounded" />
        </div>
        <div className="w-7 h-7 bg-gray-200 rounded-full" />
      </header>
      <div className="w-full h-52 bg-gray-200 flex-shrink-0" />
      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-3xl p-5 space-y-2">
          <div className="h-3 w-28 bg-gray-200 rounded mx-auto" />
          <div className="h-8 w-20 bg-gray-200 rounded mx-auto" />
          <div className="h-3 w-40 bg-gray-200 rounded mx-auto" />
        </div>
        <div className="bg-white rounded-3xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-2.5 w-16 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 space-y-5">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="flex items-start gap-3 pl-8">
              <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0 -ml-8" />
              <div className="flex-1 space-y-1.5 pt-1">
                <div className="h-3 w-28 bg-gray-200 rounded" />
                <div className="h-2.5 w-40 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  usePushSubscription()
  const [order, setOrder] = useState<OrderData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [cancelling, setCancelling] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const cancelDeadlineRef = useRef<number | null>(null)
  // Latest status, readable from the polling closure without re-running the effect
  const statusRef = useRef<OrderStatus | null>(null)
  statusRef.current = order?.status ?? null

  const fetchOrder = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, order_number, status, payment_status, utr_number, total, delivery_fee,
         cancellation_reason, delivery_address, delivery_latitude, delivery_longitude,
         created_at, accepted_at, ready_at, picked_up_at, delivered_at,
         rider_id, eta_minutes, unavailable_items, modified_total,
         restaurants(latitude, longitude),
         rider:profiles!rider_id(full_name, phone),
         order_items(id, quantity, price_at_order, products(name))`
      )
      .eq('id', id)
      .single()

    if (error) console.error('fetchOrder failed:', error)
    if (error || !data) { setNotFound(true); return }
    setOrder(data as unknown as OrderData)
  }, [id])

  const fetchComplaints = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('complaints')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
    setComplaints(data ?? [])
  }, [id])

  useEffect(() => {
    fetchOrder()
    fetchComplaints()
    const supabase = createClient()

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => fetchOrder()
      )
      .subscribe((status) => {
        // If the channel drops and reconnects, re-fetch immediately
        if (status === 'SUBSCRIBED') fetchOrder()
      })

    // Realtime is the primary source of truth. Keep only a slow 60s fallback
    // that fires when the tab is visible and the order isn't in a terminal
    // state — so a dropped socket still recovers without polling every 10s.
    const timer = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        statusRef.current !== 'delivered' &&
        statusRef.current !== 'cancelled'
      ) {
        fetchOrder()
      }
    }, 60_000)
    const clock = setInterval(() => setNow(Date.now()), 1000)

    // Re-fetch instantly when user returns to this tab
    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchOrder()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
      clearInterval(clock)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [id, fetchOrder, fetchComplaints])

  async function handleAcceptModification() {
    if (!order?.modified_total) return
    setCancelling(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: 'preparing', payment_status: 'verified', unavailable_items: null })
      .eq('id', order.id)
    if (error) toast.error('Could not accept — please try again.')
    else { toast.success('Order accepted!'); fetchOrder() }
    setCancelling(false)
  }

  async function handleCancel() {
    if (!order) return
    if (!confirm('Cancel this order? This cannot be undone.')) return
    setCancelling(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', cancellation_reason: 'customer_requested' })
      .eq('id', order.id)

    if (error) {
      toast.error('Could not cancel — the 5-minute window may have just expired.')
    } else {
      toast.success('Order cancelled')
      fetchOrder()
    }
    setCancelling(false)
  }

  if (notFound) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col items-center justify-center bg-[#f7f8fa] px-5 text-center">
        <span className="text-5xl mb-3">📍</span>
        <h2 className="text-sm font-extrabold text-gray-900 mb-1">Order Not Found</h2>
        <p className="text-xs text-gray-400 mb-6 font-medium">
          This order might not exist or belongs to another user.
        </p>
        <button
          onClick={() => router.push('/menu')}
          className="px-6 py-2.5 bg-[#b51c00] text-white font-bold rounded-xl"
        >
          Go to Menu
        </button>
      </div>
    )
  }

  if (!order) return <OrderSkeleton />

  const isCancelled = order.status === 'cancelled'
  const isDelivered = order.status === 'delivered'
  // Set client-side deadline once so server/client clock skew doesn't affect the countdown
  if (cancelDeadlineRef.current === null) {
    const rawRemaining = new Date(order.created_at).getTime() + CANCEL_WINDOW_MS - Date.now()
    cancelDeadlineRef.current = Date.now() + Math.min(CANCEL_WINDOW_MS, Math.max(0, rawRemaining))
  }
  const cancelRemainingMs = Math.max(0, cancelDeadlineRef.current - now)
  const canCancel = !isCancelled && !isDelivered && cancelRemainingMs > 0
  const showCantCancel = !isCancelled && !isDelivered && cancelRemainingMs === 0
  const step = currentStep(order)
  const statusIdx = STATUS_ORDER.indexOf(order.status)
  const showRider = !!order.rider_id

  const isRestaurantCancelled =
    isCancelled &&
    order.cancellation_reason !== 'customer_requested'

  const cancelReasonInfo = order.cancellation_reason
    ? (CANCEL_REASON_LABELS[order.cancellation_reason] ?? {
        emoji: '📋',
        label: order.cancellation_reason,
        desc: '',
      })
    : null

  const restaurantCoords =
    order.restaurants?.latitude != null && order.restaurants?.longitude != null
      ? { lat: order.restaurants.latitude, lng: order.restaurants.longitude }
      : null
  const customerCoords =
    order.delivery_latitude != null && order.delivery_longitude != null
      ? { lat: order.delivery_latitude, lng: order.delivery_longitude }
      : null
  const hasMapData = !isCancelled && (restaurantCoords || customerCoords)

  const createdDate = new Date(order.created_at)
  const etaMinutes = (order.eta_minutes || 30) + 10
  const etaDate = new Date(createdDate.getTime() + etaMinutes * 60 * 1000)
  const etaStr = etaDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const createdStr = createdDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  // Actual status-change times recorded by the DB (blank until each stage is reached)
  const fmtClock = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : ''
  const acceptedStr = fmtClock(order.accepted_at)
  const readyStr = fmtClock(order.ready_at)
  const pickedStr = fmtClock(order.picked_up_at)
  const deliveredStr = fmtClock(order.delivered_at)

  const statusMessage = isCancelled
    ? order.cancellation_reason === 'customer_requested'
      ? 'You cancelled this order.'
      : 'This order was cancelled by the restaurant.'
    : isDelivered
    ? 'Your order has arrived. Enjoy your meal!'
    : order.status === 'out_for_delivery'
    ? 'Rider is on the way to you!'
    : order.status === 'ready'
    ? 'Food is packed and ready for pickup'
    : order.status === 'accepted'
    ? 'Great news! Your order has been accepted 🎉'
    : order.status === 'preparing'
    ? 'Your biryani is being prepared with love!'
    : order.payment_status === 'pending_verification'
    ? 'Verifying your UPI payment...'
    : 'We have received your order'

  const steps = [
    {
      label: 'Order Sent',
      desc:
        step > 0
          ? `${createdStr} · We've received your order`
          : "We've received your order",
      icon: Check,
      color: '#b51c00',
    },
    {
      label: 'Order Accepted',
      desc: acceptedStr
        ? `${acceptedStr} · Restaurant confirmed your order`
        : 'Restaurant has confirmed and accepted your order',
      icon: ThumbsUp,
      color: '#7c3aed',
    },
    {
      label: 'Preparing your food',
      desc:
        order.payment_status === 'pending_verification' && step <= 0
          ? 'Waiting for payment verification'
          : 'The chef is adding the final touches to your Biryani',
      icon: ChefHat,
      color: '#f59e0b',
    },
    {
      label: 'Ready for Pickup',
      desc: readyStr
        ? `${readyStr} · Food is packed and ready`
        : 'Food is packed and waiting for the rider',
      icon: Package,
      color: '#16a34a',
    },
    {
      label: 'Out for Delivery',
      desc: pickedStr
        ? `${pickedStr} · Rider picked up your order`
        : 'Rider will pick up soon',
      icon: Bike,
      color: '#2563eb',
    },
    {
      label: 'Arrived at Home',
      desc: deliveredStr
        ? `${deliveredStr} · Delivered — enjoy your meal!`
        : `Expected by ${etaStr}`,
      icon: Compass,
      color: '#15803d',
    },
  ]

  const itemsCount = order.order_items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f7f8fa] text-gray-900">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ChevronLeft className="size-6 text-[#b51c00]" />
          </button>
          <h1 className="text-base font-extrabold text-[#b51c00]">Track Order</h1>
        </div>
        <button className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
          <HelpCircle className="size-5 text-gray-500" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-28">

        {/* ── Live Map ── */}
        {hasMapData ? (
          <div className="relative w-full h-52 overflow-hidden flex-shrink-0">
            <LiveMap
              orderId={order.id}
              restaurantCoords={restaurantCoords}
              customerCoords={customerCoords}
            />
          </div>
        ) : (
          <div className="w-full h-24 bg-gray-800 flex items-center justify-center flex-shrink-0">
            <p className="text-white/50 text-xs font-semibold">
              {isCancelled ? 'Order cancelled' : 'Location not available for this order'}
            </p>
          </div>
        )}

        <div className="px-4 py-4 space-y-4">

          {/* ── ETA Card ── */}
          <div
            className="bg-white rounded-3xl p-5 text-center"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
          >
            {!isDelivered && !isCancelled && (
              <>
                <p className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">
                  Estimated Arrival
                </p>
                <h2 className="text-3xl font-black text-[#b51c00] mt-1.5 tracking-tight">{etaStr}</h2>
              </>
            )}
            {isCancelled && (
              <p className="text-sm font-bold text-red-500">❌ Order Cancelled</p>
            )}
            <p className="text-xs text-gray-500 font-bold mt-2">{statusMessage}</p>
            {order.payment_status === 'pending_verification' && !isCancelled && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-left">
                <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                  <Clock className="size-3" /> Verifying UPI payment
                </p>
                <p className="text-[10px] text-amber-600 mt-0.5 font-mono">
                  UTR: {order.utr_number}
                </p>
              </div>
            )}
          </div>

          {/* ── Modification Request Card ── */}
          {!isCancelled && order.unavailable_items && order.unavailable_items.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-4"
              style={{ boxShadow: '0 2px 12px rgba(245,158,11,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-xs font-extrabold text-amber-800">Restaurant Updated Your Order</p>
                  <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                    Some items are unavailable. Review and decide below.
                  </p>
                </div>
              </div>

              {/* Removed items list */}
              <div className="space-y-1.5 mb-3">
                {order.order_items
                  .filter((i) => order.unavailable_items!.includes(i.id))
                  .map((i) => (
                    <div key={i.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                      <span className="text-sm">❌</span>
                      <span className="text-xs font-semibold text-gray-700 line-through">
                        {i.products?.name ?? 'Item'} ×{i.quantity}
                      </span>
                      <span className="ml-auto text-xs font-bold text-red-500">
                        −₹{i.price_at_order * i.quantity}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Totals */}
              <div className="bg-white rounded-xl px-3 py-2 mb-3 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-gray-400 font-medium">New Total</p>
                  <p className="text-sm font-extrabold text-amber-700">₹{order.modified_total}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 font-medium">Original</p>
                  <p className="text-xs text-gray-400 line-through">₹{order.total}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptModification}
                  disabled={cancelling}
                  className="flex-1 h-10 bg-amber-500 text-white text-xs font-extrabold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {cancelling ? '…' : 'Accept Modified Order'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 h-10 bg-white border-2 border-red-300 text-red-500 text-xs font-extrabold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          )}

          {/* ── Cancel Reason Card ── */}
          {isCancelled && cancelReasonInfo && (
            <div
              className={`rounded-3xl p-4 ${
                isRestaurantCancelled
                  ? 'bg-red-50 border border-red-100'
                  : 'bg-gray-50 border border-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg ${
                  isRestaurantCancelled ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  {cancelReasonInfo.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-extrabold uppercase tracking-wider mb-0.5 ${
                    isRestaurantCancelled ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    Reason for Cancellation
                  </p>
                  <p className="text-xs font-bold text-gray-900">{cancelReasonInfo.label}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">
                    {cancelReasonInfo.desc}
                  </p>
                  {isRestaurantCancelled && (
                    <p className="text-[10px] text-red-400 font-semibold mt-2">
                      If you were charged, your refund will be processed within 3–5 business days.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Fallback: no cancel_reason */}
          {isCancelled && !cancelReasonInfo && isRestaurantCancelled && (
            <div className="bg-red-50 border border-red-100 rounded-3xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="size-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">Order could not be fulfilled</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">
                    We apologise for any inconvenience. If you were charged, your refund will be processed within 3–5 business days.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Cancel Order (1-minute window) ── */}
          {canCancel && (
            <div
              className="bg-white rounded-3xl p-4 flex items-center justify-between gap-3"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900">Need to cancel?</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                  You can cancel within {formatCountdown(cancelRemainingMs)}
                </p>
              </div>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="h-9 px-4 rounded-xl border-2 border-red-500 text-red-500 text-xs font-bold disabled:opacity-50 flex-shrink-0"
              >
                {cancelling ? 'Cancelling…' : 'Cancel Order'}
              </button>
            </div>
          )}

          {/* ── Can't cancel — window passed ── */}
          {showCantCancel && (
            <div
              className="bg-white rounded-3xl p-4"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertCircle className="size-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900">Order cannot be cancelled</p>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5 leading-relaxed">
                    Your order is already being prepared. Cancelling now will result in a cancellation charge on your next order.
                  </p>
                  <button
                    onClick={() => router.push(`/orders/${id}/complaint`)}
                    className="mt-2 text-[10px] font-bold text-orange-500 underline underline-offset-2"
                  >
                    Report an issue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Rider Card ── */}
          {showRider ? (
            <div
              className="bg-white rounded-3xl p-4 flex items-center justify-between"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#1B4332] flex-shrink-0 border border-gray-200 flex items-center justify-center text-white text-lg font-bold">
                  {order.rider?.full_name ? order.rider.full_name.charAt(0).toUpperCase() : '🛵'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">{order.rider?.full_name ?? 'Rider Assigned'}</h4>
                  <p className="text-[10px] text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    On the way to you
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-9 h-9 rounded-full bg-[#b51c00] text-white flex items-center justify-center shadow-md">
                  <Phone className="size-4 fill-white text-white" />
                </button>
                <button className="w-9 h-9 rounded-full bg-white text-gray-500 border border-gray-200 flex items-center justify-center shadow-sm">
                  <MessageSquare className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            !isCancelled && (
              <div
                className="bg-white rounded-3xl p-4 flex items-center gap-3"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">
                  🛵
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">Rider will be assigned soon</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                    You&apos;ll see their details here once assigned
                  </p>
                </div>
              </div>
            )
          )}

          {/* ── Delivery Status Stepper (active orders only) ── */}
          {!isCancelled && (
            <div
              className="bg-white rounded-3xl p-5"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <h3 className="text-sm font-extrabold text-gray-900 mb-5 px-0.5">Delivery Status</h3>
              <AnimatedOrderStepper
                status={order.status as OrderStatus}
                steps={steps}
                currentStepIndex={step}
              />
            </div>
          )}

          {/* ── Report an Issue ── */}
          <div
            className="bg-white rounded-3xl p-4"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900">Need help with this order?</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                  Report a missing item, quality issue, or anything else
                </p>
              </div>
              <button
                onClick={() => router.push(`/orders/${id}/complaint`)}
                className="h-9 px-4 rounded-xl bg-[#191c1d] text-white text-xs font-bold flex-shrink-0"
              >
                Report Issue
              </button>
            </div>

            {complaints.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                {complaints.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-gray-600 capitalize">
                      {c.category.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'resolved'
                          ? 'bg-green-100 text-green-700'
                          : c.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {c.status === 'in_progress' ? 'In Progress' : c.status === 'resolved' ? 'Resolved' : 'Open'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Order Receipt Badge ── */}
          <div className="bg-gray-100 rounded-3xl p-4 flex items-center justify-between border border-gray-200/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm text-lg flex-shrink-0">
                📄
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-gray-900">
                  Order {order.order_number ?? `#${id.slice(0, 8).toUpperCase()}`}
                </h4>
                <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                  {itemsCount} {itemsCount === 1 ? 'item' : 'items'} · ₹{order.total}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/menu')}
              className="text-xs font-extrabold text-[#b51c00] flex-shrink-0"
            >
              Order Again
            </button>
          </div>

        </div>
      </div>

      <BottomNav />
      <PushSetup variant="order" />
      <AndroidInstallPrompt variant="order" delay={2000} />
      <IOSInstallPrompt variant="order" delay={5000} />
    </div>
  )
}
