'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type OrderStatus, type PaymentStatus } from '@/lib/types'
import BottomNav from '@/components/BottomNav'
import LiveMap from '@/components/LiveMap'
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
} from 'lucide-react'

interface OrderItem {
  id: string
  quantity: number
  price_at_order: number
  products: { name: string } | null
}

interface OrderData {
  id: string
  status: OrderStatus
  payment_status: PaymentStatus
  utr_number: string | null
  total: number
  delivery_fee: number
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
  rider_id: string | null
  order_items: OrderItem[]
  restaurants: { latitude: number | null; longitude: number | null } | null
}

const STATUS_ORDER: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
]

// Map DB status + payment_status → visual stepper step (0-based, 5 steps)
function currentStep(order: OrderData): number {
  if (order.status === 'pending' && order.payment_status === 'pending_verification') return 0
  if (order.status === 'pending' || order.status === 'accepted') return 1
  if (order.status === 'preparing') return 1
  if (order.status === 'ready') return 2
  if (order.status === 'out_for_delivery') return 3
  if (order.status === 'delivered') return 4
  return 0
}

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [order, setOrder] = useState<OrderData | null>(null)
  const [notFound, setNotFound] = useState(false)

  const fetchOrder = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, status, payment_status, utr_number, total, delivery_fee,
         delivery_address, delivery_latitude, delivery_longitude, created_at, rider_id,
         restaurants(latitude, longitude),
         order_items(id, quantity, price_at_order, products(name))`
      )
      .eq('id', id)
      .single()

    if (error || !data) { setNotFound(true); return }
    setOrder(data as unknown as OrderData)
  }, [id])

  useEffect(() => {
    fetchOrder()
    const supabase = createClient()

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => fetchOrder()
      )
      .subscribe()

    const timer = setInterval(fetchOrder, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [id, fetchOrder])

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

  if (!order) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col items-center justify-center bg-[#f7f8fa]">
        <div className="w-10 h-10 border-4 border-[#b51c00] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 mt-3 font-semibold">Loading tracking info...</p>
      </div>
    )
  }

  const isCancelled = order.status === 'cancelled'
  const isDelivered = order.status === 'delivered'
  const step = currentStep(order)
  const statusIdx = STATUS_ORDER.indexOf(order.status)
  const showRider = statusIdx >= 4 // out_for_delivery or delivered

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
  const etaDate = new Date(createdDate.getTime() + 30 * 60 * 1000)
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

  const statusMessage =
    isCancelled
      ? 'This order was cancelled'
      : isDelivered
      ? 'Your order has arrived. Enjoy your meal!'
      : order.status === 'out_for_delivery'
      ? 'Rider is on the way to you!'
      : order.status === 'ready'
      ? 'Food is packed and ready for pickup'
      : order.status === 'preparing' || order.status === 'accepted'
      ? 'Your biryani is being prepared with love!'
      : order.payment_status === 'pending_verification'
      ? 'Verifying your UPI payment...'
      : 'We have received your order'

  const steps = [
    {
      label: 'Order Received',
      desc:
        step > 0
          ? `${createdStr} · We've confirmed your order`
          : "We've confirmed your order",
      icon: Check,
    },
    {
      label: 'Preparing your food',
      desc:
        order.payment_status === 'pending_verification' && step <= 0
          ? 'Waiting for payment verification'
          : 'The chef is adding the final touches to your Biryani',
      icon: ChefHat,
    },
    {
      label: 'Ready for Pickup',
      desc: 'Food is packed and waiting for the rider',
      icon: Package,
    },
    {
      label: 'Out for Delivery',
      desc: 'Rider will pick up soon',
      icon: Bike,
    },
    {
      label: 'Arrived at Home',
      desc: `Expected by ${etaStr}`,
      icon: Compass,
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

          {/* ── Rider Card ── */}
          {showRider ? (
            <div
              className="bg-white rounded-3xl p-4 flex items-center justify-between"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80"
                    className="w-full h-full object-cover"
                    alt="Rider"
                  />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">Arjun Sharma</h4>
                  <p className="text-[10px] text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    4.9 · Valued Rider
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
            // Placeholder rider card when rider not yet assigned
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
          )}

          {/* ── Delivery Status Stepper ── */}
          <div
            className="bg-white rounded-3xl p-5"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
          >
            <h3 className="text-sm font-extrabold text-gray-900 mb-5 px-0.5">Delivery Status</h3>

            {isCancelled ? (
              <div className="py-4 text-center text-red-500 font-bold text-xs">
                ❌ This order has been cancelled.
              </div>
            ) : (
              <div className="relative space-y-6 pl-8">
                {steps.map((s, i) => {
                  const done = i <= step
                  const Icon = s.icon
                  return (
                    <div key={i} className="relative flex items-start">
                      {/* Connector line */}
                      {i < steps.length - 1 && (
                        <div
                          className={`absolute left-[-21px] top-9 w-0.5 h-7 -z-10 ${
                            i < step ? 'bg-[#b51c00]' : 'bg-gray-100'
                          }`}
                        />
                      )}
                      {/* Step icon */}
                      <div
                        className={`absolute -left-[38px] top-0 w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                          done
                            ? 'bg-[#b51c00] border-[#b51c00] text-white shadow-md shadow-[#b51c00]/25'
                            : 'bg-white border-gray-200 text-gray-300'
                        }`}
                      >
                        <Icon className="size-4" strokeWidth={done ? 2.5 : 2} />
                      </div>
                      {/* Step text */}
                      <div className="pl-3.5 min-w-0">
                        <h4
                          className={`text-xs font-bold transition-colors ${
                            done ? 'text-gray-900' : 'text-gray-400'
                          }`}
                        >
                          {s.label}
                        </h4>
                        <p
                          className={`text-[10px] leading-relaxed mt-0.5 transition-colors ${
                            done ? 'text-gray-500' : 'text-gray-300'
                          }`}
                        >
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  )
                })}
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
                  Order #{id.slice(0, 8).toUpperCase()}
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
    </div>
  )
}
