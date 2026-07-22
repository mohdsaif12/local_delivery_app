'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderStatus, CancelReason } from '@/lib/types'
import Link from 'next/link'
import {
  CheckCircle, ChefHat, Bike, Package, Clock,
  ArrowRight, ThumbsUp, Loader2, Star,
} from 'lucide-react'

interface Props {
  initialOrders: Order[]
  userId: string
}

// ── 5-step stepper: Accepted → Preparing → Ready → Out for Delivery → Delivered ──
const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.ElementType; color: string }[] = [
  { status: 'accepted',         label: 'Accepted',         icon: ThumbsUp,    color: '#7c3aed' },
  { status: 'preparing',        label: 'Preparing',        icon: ChefHat,     color: '#f59e0b' },
  { status: 'ready',            label: 'Ready',            icon: Package,     color: '#16a34a' },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Bike,        color: '#2563eb' },
  { status: 'delivered',        label: 'Delivered',        icon: CheckCircle, color: '#15803d' },
]

function statusIndex(status: OrderStatus): number {
  const map: Record<OrderStatus, number> = {
    pending:          -1,   // nothing lit — waiting to be accepted
    accepted:          0,
    preparing:         1,
    ready:             2,
    out_for_delivery:  3,
    delivered:         4,
    cancelled:        -1,
  }
  return map[status] ?? -1
}

// ── Animated Stepper ─────────────────────────────────────────
// • Initial render: instantly lit up to current step (no animation)
// • When status advances via realtime: game-loading animation for NEW step only
function AnimatedOrderStepper({ status }: { status: OrderStatus }) {
  const current = statusIndex(status)
  const numLines = STATUS_STEPS.length - 1

  // Instantly show all steps up to current on mount
  const [lineProgress, setLineProgress] = useState<number[]>(() =>
    Array(numLines).fill(0).map((_, i) => (i < current ? 100 : 0))
  )
  const [unlocked, setUnlocked] = useState<boolean[]>(() =>
    STATUS_STEPS.map((_, i) => i <= current)
  )
  const [popping, setPopping] = useState<boolean[]>(Array(STATUS_STEPS.length).fill(false))

  // Track previous step to detect realtime advances
  const prevCurrentRef = useRef(current)

  useEffect(() => {
    const prevCurrent = prevCurrentRef.current
    prevCurrentRef.current = current

    // Same step = initial mount or no change — nothing to animate
    if (prevCurrent === current) return

    // Status moved forward — animate only the NEW line(s)
    let dead = false

    function animateLine(lineIdx: number) {
      if (dead || lineIdx >= current) return
      // Skip lines that were already done before this update
      if (lineIdx < prevCurrent) { animateLine(lineIdx + 1); return }

      let progress = lineIdx < prevCurrent ? 100 : 0

      const tick = setInterval(() => {
        if (dead) { clearInterval(tick); return }

        // Two-phase: fast 0-75%, dramatic crawl 75-100%
        const rate = progress < 75 ? 0.06 : 0.012
        const inc = Math.max((100 - progress) * rate, 0.04)
        progress = Math.min(progress + inc, 100)

        setLineProgress(prev => {
          const next = [...prev]
          next[lineIdx] = progress
          return next
        })

        if (progress >= 99.6) {
          clearInterval(tick)
          setLineProgress(prev => { const n = [...prev]; n[lineIdx] = 100; return n })

          const nextIdx = lineIdx + 1
          setUnlocked(prev => { const n = [...prev]; n[nextIdx] = true; return n })
          setPopping(prev => { const n = [...prev]; n[nextIdx] = true; return n })

          setTimeout(() => {
            if (dead) return
            setPopping(prev => { const n = [...prev]; n[nextIdx] = false; return n })
            setTimeout(() => animateLine(lineIdx + 1), 120)
          }, 450)
        }
      }, 16)
    }

    animateLine(prevCurrent)
    return () => { dead = true }
  }, [current])

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

      <div className="flex items-center justify-between mt-3 mb-1">
        {STATUS_STEPS.map((step, i) => {
          const isUnlocked = unlocked[i]
          const isPopping  = popping[i]
          const isActive   = i === current && isUnlocked
          const Icon = step.icon

          return (
            <div key={step.status} className="flex-1 flex flex-col items-center relative">
              {/* Connector line with progress fill */}
              {i < STATUS_STEPS.length - 1 && (
                <div className="absolute top-4 left-1/2 w-full h-0.5 bg-[#e1e3e4] overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${lineProgress[i]}%`,
                      backgroundColor: STATUS_STEPS[i + 1].color,
                    }}
                  />
                </div>
              )}

              {/* Step icon */}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isUnlocked
                    ? 'text-white'
                    : 'bg-white border-[#e1e3e4]'
                }`}
                style={{
                  backgroundColor: isUnlocked ? step.color : undefined,
                  borderColor: isUnlocked ? step.color : undefined,
                  boxShadow: isActive ? `0 2px 8px ${step.color}40` : undefined,
                  animation: isPopping
                    ? 'stepPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards'
                    : undefined,
                }}
              >
                <Icon
                  className={`size-3.5 ${isUnlocked ? 'text-white' : 'text-[#afafaf]'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>

              {/* Label */}
              <span
                className="text-[9px] font-semibold mt-1 text-center leading-tight transition-colors duration-300"
                style={{ color: isUnlocked ? step.color : '#afafaf' }}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Cancel reason labels ─────────────────────────────────────
const CANCEL_REASON_LABELS: Record<NonNullable<Exclude<CancelReason, 'customer_requested' | null>>, string> = {
  item_not_available: 'Item Not Available',
  too_busy:           'Restaurant Too Busy',
  customer_unreachable: 'Could Not Reach You',
  payment_issue:      'Payment Issue',
  other:              'Unable to Fulfill Order',
}

function statusLabel(status: OrderStatus, cancelReason: CancelReason) {
  if (status === 'cancelled') {
    if (cancelReason === 'customer_requested') return 'You Cancelled'
    if (cancelReason) return 'Cancelled by Restaurant'
    return 'Cancelled'
  }
  const map: Record<Exclude<OrderStatus, 'cancelled'>, string> = {
    pending: 'Order Received', accepted: 'Accepted', preparing: 'Being Prepared',
    ready: 'Ready', out_for_delivery: 'On the Way', delivered: 'Delivered',
  }
  return map[status as Exclude<OrderStatus, 'cancelled'>] ?? status
}

const ORDER_SELECT = 'id, order_number, status, cancellation_reason, cancelled_at, created_at, delivery_address, total, order_items(quantity, price_at_order, products(name))'

// ── Main component ───────────────────────────────────────────
export default function OrdersClient({ initialOrders, userId }: Props) {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

  const fetchAllOrders = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
    if (data) setOrders(data as unknown as Order[])
  }, [userId])

  useEffect(() => {
    const supabase = createClient()

    async function refetchOrder(id: string) {
      const { data } = await supabase
        .from('orders').select(ORDER_SELECT).eq('id', id).single()
      if (data) setOrders(prev => prev.map(o => o.id === id ? (data as unknown as Order) : o))
    }

    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `customer_id=eq.${userId}`,
      }, payload => refetchOrder(payload.new.id as string))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `customer_id=eq.${userId}`,
      }, async payload => {
        const { data } = await supabase
          .from('orders').select(ORDER_SELECT).eq('id', payload.new.id as string).single()
        if (data) setOrders(prev => [data as unknown as Order, ...prev])
      })
      // Realtime handles INSERT/UPDATE per-row; the page already seeds
      // initialOrders, so no full refetch on subscribe.
      .subscribe()

    // Safety net only: refetch when the user returns to the tab (covers any
    // events missed while the socket was backgrounded). No interval polling.
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAllOrders() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, fetchAllOrders])

  function handleOrderClick(e: React.MouseEvent, orderId: string) {
    e.preventDefault()
    if (navigatingId) return
    setNavigatingId(orderId)
    router.push(`/orders/${orderId}`)
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-6xl mb-4">📋</span>
        <p className="font-bold text-[#191c1d] mb-1">No orders yet</p>
        <p className="text-sm text-[#586062] mb-6">Your order history will appear here</p>
        <Link href="/menu" className="h-12 px-8 bg-[#b51c00] text-white font-semibold rounded-lg flex items-center gap-2">
          Browse Menu <ArrowRight className="size-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const isCancelled = order.status === 'cancelled'
        const cancelReason = order.cancellation_reason
        // Auto-cancelled by DB cron (10-min timeout) — treat same as no manual reason
        const isAutoCancelled =
          typeof cancelReason === 'string' && cancelReason.toLowerCase().includes('auto-cancel')
        const isRestaurantCancelled = isCancelled && !isAutoCancelled && cancelReason !== null && cancelReason !== 'customer_requested'
        const isCustomerCancelled   = isCancelled && cancelReason === 'customer_requested'
        const isNavigating = navigatingId === order.id

        return (
          <div
            key={order.id}
            onClick={e => handleOrderClick(e, order.id)}
            className={`block bg-white rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
              isNavigating ? 'scale-[0.98] opacity-80' : 'active:scale-[0.99]'
            }`}
            style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}
          >
            {/* Header */}
            <div className="px-4 pt-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-[#191c1d] font-mono">
                  {order.order_number ?? `#${order.id.slice(0, 8).toUpperCase()}`}
                </p>
                <p className="text-[10px] text-[#586062] mt-0.5 flex items-center gap-1">
                  <Clock className="size-3" />
                  {new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isNavigating && <Loader2 className="size-3.5 text-[#b51c00] animate-spin" />}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isRestaurantCancelled ? 'bg-orange-100 text-orange-700' :
                  isCustomerCancelled   ? 'bg-red-100 text-red-600' :
                  isCancelled           ? 'bg-red-100 text-red-600' :
                  order.status === 'delivered'        ? 'bg-green-100 text-green-700' :
                  order.status === 'accepted'         ? 'bg-purple-100 text-purple-700' :
                  'bg-[#ffdad3] text-[#b51c00]'
                }`}>
                  {statusLabel(order.status as OrderStatus, cancelReason)}
                </span>
              </div>
            </div>

            {/* Animated stepper — only for active orders */}
            {!isCancelled && (
              <div className="px-4 pb-2">
                <AnimatedOrderStepper
                  status={order.status as OrderStatus}
                />
              </div>
            )}

            {/* Cancelled banner */}
            {isCancelled && (
              <div className={`mx-4 mb-2 mt-2 rounded-lg px-3 py-2 ${
                isRestaurantCancelled ? 'bg-orange-50 border border-orange-100' :
                isCustomerCancelled   ? 'bg-red-50 border border-red-100' :
                'bg-amber-50 border border-amber-100'
              }`}>
                <p className={`text-[10px] font-semibold ${
                  isRestaurantCancelled ? 'text-orange-700' :
                  isCustomerCancelled   ? 'text-red-500' :
                  'text-amber-700'
                }`}>
                  {isRestaurantCancelled
                    ? '🏪 Cancelled by the Restaurant'
                    : isCustomerCancelled
                    ? '👤 You cancelled this order'
                    : '⚠️ Order could not be accepted'}
                </p>
                {/* No reason OR auto-cancelled by timeout = technical issue message */}
                {(!cancelReason || isAutoCancelled) && !isCustomerCancelled && (
                  <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                    This order could not be accepted due to a technical issue. Please re-order.
                  </p>
                )}
                {isRestaurantCancelled && cancelReason && cancelReason !== 'other' && (
                  <p className="text-[10px] text-orange-600 font-medium mt-0.5">
                    Reason: {CANCEL_REASON_LABELS[cancelReason as keyof typeof CANCEL_REASON_LABELS] ?? cancelReason}
                  </p>
                )}
                {order.cancelled_at && (
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                    🕐 Cancelled at {new Date(order.cancelled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                )}
              </div>
            )}

            {/* Items */}
            <div className="px-4 pb-3 border-t border-[#f3f4f5] pt-3">
              <p className="text-xs text-[#586062] mb-1.5">
                {((order.delivery_address as any)?.items)
                  ? ((order.delivery_address as any).items as { name: string; quantity: number }[])
                      .map(item => `${item.name} ×${item.quantity}`).join(', ')
                  : (order.order_items as { quantity: number; products?: { name: string } }[])
                      ?.map(item => `${item.products?.name} ×${item.quantity}`).join(', ')}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#586062]">Total Paid</span>
                <span className="font-bold text-[#b51c00] text-sm">₹{order.total}</span>
              </div>
            </div>
          </div>
        )
      })}

      <div className="pt-2 pb-4 text-center">
        <Link
          href="/menu"
          className="h-11 px-6 border-2 border-[#b51c00] text-[#b51c00] font-semibold rounded-xl inline-flex items-center gap-1 active:scale-95 transition-transform"
        >
          Order Again <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}