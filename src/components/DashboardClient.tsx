'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderStatus, CancelReason } from '@/lib/types'
import { Button } from '@/components/ui/button'
import OrderStatusBadge from './OrderStatusBadge'
import { toast } from 'sonner'
import { MapPin, Phone, Bike, CheckCircle2, XCircle, X, PackageX } from 'lucide-react'

const ORDER_SELECT = `*, order_items(quantity, price_at_order, products(name)),
  customer:profiles!orders_customer_id_fkey(full_name, phone),
  rider:profiles!orders_rider_id_fkey(full_name, phone)`

const statusBg: Record<OrderStatus, string> = {
  pending:          'border-l-gray-300',
  accepted:         'border-l-blue-500',
  preparing:        'border-l-yellow-500',
  ready:            'border-l-green-500',
  out_for_delivery: 'border-l-orange-500',
  delivered:        'border-l-green-600',
  cancelled:        'border-l-red-400',
}


type RestaurantCancelReason = 'item_not_available' | 'too_busy' | 'customer_unreachable' | 'payment_issue' | 'other'

const CANCEL_REASONS: { value: RestaurantCancelReason; label: string; desc: string; emoji: string }[] = [
  {
    value: 'item_not_available',
    emoji: '🥡',
    label: 'Item Not Available',
    desc: 'One or more ordered items are out of stock',
  },
  {
    value: 'too_busy',
    emoji: '⏳',
    label: 'Too Busy / High Volume',
    desc: 'Kitchen is at full capacity right now',
  },
  {
    value: 'customer_unreachable',
    emoji: '📵',
    label: 'Customer Unreachable',
    desc: 'Could not reach the customer to confirm',
  },
  {
    value: 'payment_issue',
    emoji: '💳',
    label: 'Payment Issue',
    desc: 'Payment could not be verified or is disputed',
  },
  {
    value: 'other',
    emoji: '📋',
    label: 'Other Reason',
    desc: 'Another reason not listed above',
  },
]


const CANCEL_REASON_LABELS: Record<RestaurantCancelReason, string> = {
  item_not_available: '🥡 Item Not Available',
  too_busy: '⏳ Too Busy',
  customer_unreachable: '📵 Customer Unreachable',
  payment_issue: '💳 Payment Issue',
  other: '📋 Other',
}


// Who cancelled this order?
function getCanceller(cancelReason: string | null | undefined): 'restaurant' | 'customer' | 'unknown' {
  if (!cancelReason) return 'unknown'
  if (cancelReason === 'customer_requested') return 'customer'
  return 'restaurant'
}

// ── Cancel Reason Modal ───────────────────────────────────────
function CancelReasonModal({
  onConfirm,
  onClose,
  isLoading,
}: {
  onConfirm: (reason: CancelReason) => void
  onClose: () => void
  isLoading: boolean
}) {
  const [selected, setSelected] = useState<CancelReason | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-extrabold text-gray-900">Cancel Order</h2>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              Select a reason — the customer will see this
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X className="size-4 text-gray-500" />
          </button>
        </div>

        {/* Reason list */}
        <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
          {CANCEL_REASONS.map((reason) => (
            <button
              key={reason.value}
              onClick={() => setSelected(reason.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                selected === reason.value
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-100 bg-gray-50 hover:border-gray-200'
              }`}
            >
              <span className="text-xl flex-shrink-0">{reason.emoji}</span>
              <div className="min-w-0">
                <p className={`text-xs font-bold ${selected === reason.value ? 'text-red-600' : 'text-gray-800'}`}>
                  {reason.label}
                </p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{reason.desc}</p>
              </div>
              {/* Radio dot */}
              <div className={`ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                selected === reason.value ? 'border-red-500' : 'border-gray-300'
              }`}>
                {selected === reason.value && (
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-2">
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || isLoading}
            className="w-full h-11 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 transition-colors"
          >
            {isLoading ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full h-10 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Accept Order Modal (item availability check) ─────────────
function AcceptOrderModal({
  order,
  onConfirmAll,
  onNotifyMissing,
  onClose,
  isLoading,
}: {
  order: Order
  onConfirmAll: () => void
  onNotifyMissing: (unavailableIds: string[], modifiedTotal: number) => void
  onClose: () => void
  isLoading: boolean
}) {
  const items = order.order_items ?? []
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setUnavailable((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const removedTotal = items
    .filter((i) => unavailable.has(i.id!))
    .reduce((sum, i) => sum + (i.price_at_order ?? 0) * (i.quantity ?? 1), 0)
  const modifiedTotal = order.total - removedTotal

  function handleConfirm() {
    if (unavailable.size === 0) {
      onConfirmAll()
    } else {
      onNotifyMissing(Array.from(unavailable), modifiedTotal)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl pb-safe">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-extrabold text-gray-900">Check Item Availability</h2>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              Uncheck any items that are not available
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="size-4 text-gray-500" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
          {items.map((item) => {
            const isUnavailable = unavailable.has(item.id!)
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id!)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                  isUnavailable
                    ? 'border-red-200 bg-red-50'
                    : 'border-green-200 bg-green-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isUnavailable ? 'border-red-400 bg-white' : 'border-green-500 bg-green-500'
                }`}>
                  {!isUnavailable && <span className="text-white text-[10px] font-black">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${isUnavailable ? 'text-red-600 line-through' : 'text-gray-800'}`}>
                    {item.products?.name ?? 'Item'}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    ×{item.quantity} · ₹{(item.price_at_order ?? 0) * (item.quantity ?? 1)}
                  </p>
                </div>
                {isUnavailable && (
                  <span className="text-[10px] font-bold text-red-500 flex-shrink-0">Not Available</span>
                )}
              </button>
            )
          })}
        </div>

        {unavailable.size > 0 && (
          <div className="mx-4 mb-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <p className="text-[11px] font-bold text-amber-700">
              {unavailable.size} item{unavailable.size > 1 ? 's' : ''} removed · New total: ₹{modifiedTotal}
            </p>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5">
              Customer will be asked to accept or cancel
            </p>
          </div>
        )}

        <div className="px-4 py-4 border-t border-gray-100 space-y-2">
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`w-full h-11 text-white font-bold rounded-xl text-sm disabled:opacity-40 transition-colors ${
              unavailable.size > 0
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isLoading
              ? 'Processing…'
              : unavailable.size > 0
              ? `Notify Customer (₹${modifiedTotal})`
              : 'Verify & Accept Order'}
          </button>
          <button onClick={onClose} disabled={isLoading} className="w-full h-10 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

async function sendPush(customerId: string, title: string, body: string, url: string, tag?: string) {
  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, title, body, url, tag }),
    })
    const data = await res.json()
    console.log('[Push]', data)
  } catch (e) {
    console.error('[Push] fetch failed', e)
  }
}

const STATUS_PUSH: Partial<Record<string, { title: string; body: string }>> = {
  preparing:        { title: '👨‍🍳 Order Confirmed!',     body: 'Your order is being prepared.' },
  ready:            { title: '📦 Order Ready!',           body: 'Your order is ready and waiting for pickup.' },
  out_for_delivery: { title: '🛵 On the Way!',            body: 'Your rider has picked up your order.' },
  delivered:        { title: '🎉 Delivered!',             body: 'Your order has been delivered. Enjoy!' },
  cancelled:        { title: '❌ Order Cancelled',        body: 'Your order was cancelled by the restaurant.' },
}

interface RestaurantStatus {
  id: string
  is_open: boolean
  opening_time: string
  closing_time: string
}

function fmtTime(t?: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

interface Props {
  initialOrders: Order[]
}

export default function DashboardClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [updating, setUpdating] = useState<string | null>(null)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null)
  const [restaurantStatus, setRestaurantStatus] = useState<RestaurantStatus | null>(null)
  const [togglingStatus, setTogglingStatus] = useState(false)

  // Fetch restaurant open/close status
  useEffect(() => {
    const supabase = createClient()
    supabase.from('restaurants').select('id, is_open, opening_time, closing_time').limit(1).single()
      .then(({ data }) => { if (data) setRestaurantStatus(data) })
  }, [])

  async function toggleRestaurantOpen() {
    if (!restaurantStatus) return
    setTogglingStatus(true)
    const supabase = createClient()
    const newVal = !restaurantStatus.is_open
    const { error } = await supabase.from('restaurants').update({ is_open: newVal }).eq('id', restaurantStatus.id)
    if (!error) {
      setRestaurantStatus({ ...restaurantStatus, is_open: newVal })
      toast.success(newVal ? '🟢 Restaurant is now Open' : '🔴 Restaurant is now Closed')
    } else {
      toast.error('Failed to update status')
    }
    setTogglingStatus(false)
  }

  useEffect(() => {
    const supabase = createClient()

    async function refetchOrder(id: string, onMissing?: () => void) {
      const { data } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).single()
      if (data) {
        setOrders((prev) =>
          prev.some((o) => o.id === id)
            ? prev.map((o) => (o.id === id ? (data as Order) : o))
            : (onMissing?.(), [data as Order, ...prev])
        )
      }
    }

    const channel = supabase
      .channel('restaurant-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => refetchOrder(payload.new.id as string, () => toast.success('New order received!'))
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => refetchOrder(payload.new.id as string)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function verifyAndAccept(orderId: string) {
    setUpdating(orderId)
    const supabase = createClient()
    const order = orders.find((o) => o.id === orderId)
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: 'verified', status: 'preparing' })
      .eq('id', orderId)
    if (error) {
      console.error('verifyAndAccept error:', error)
      toast.error(`Failed: ${error.message}`)
    } else {
      setAcceptingOrderId(null)
      // Optimistically update local state in case Realtime is slow
      setOrders((prev) =>
        prev.map((o) => o.id === orderId ? { ...o, status: 'preparing', payment_status: 'verified' } : o)
      )
      if (order?.customer_id) {
        sendPush(order.customer_id, '👨‍🍳 Order Confirmed!', 'Your order is being prepared.', `/orders/${orderId}`, 'order-update')
      }
    }
    setUpdating(null)
  }

  async function notifyMissingItems(orderId: string, unavailableIds: string[], modifiedTotal: number) {
    setUpdating(orderId)
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ unavailable_items: unavailableIds, modified_total: modifiedTotal })
      .eq('id', orderId)
    const order = orders.find((o) => o.id === orderId)
    if (error) {
      toast.error('Failed to notify customer')
    } else {
      toast.success('Customer notified — waiting for their response')
      setAcceptingOrderId(null)
      if (order?.customer_id) {
        sendPush(order.customer_id, '⚠️ Order Update', 'Some items are unavailable. Tap to review your order.', `/orders/${orderId}`, 'order-modification')
      }
    }
    setUpdating(null)
  }

  async function advanceStatus(orderId: string, next: OrderStatus) {
    setUpdating(orderId)
    const supabase = createClient()
    const order = orders.find((o) => o.id === orderId)
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', orderId)
    if (error) {
      console.error('advanceStatus error:', error)
      toast.error(`Failed: ${error.message}`)
    } else {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: next } : o))
      if (order?.customer_id) {
        const push = STATUS_PUSH[next]
        if (push) sendPush(order.customer_id, push.title, push.body, `/orders/${orderId}`, 'order-update')
      }
    }
    setUpdating(null)
  }

  async function cancelOrder(orderId: string, reason: CancelReason) {
    setUpdating(orderId)
    const supabase = createClient()
    const order = orders.find((o) => o.id === orderId)
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date().toISOString() })
      .eq('id', orderId)
    if (error) {
      console.error('cancelOrder error:', error)
      toast.error(`Failed: ${error.message}`)
    } else {
      toast.success('Order cancelled')
      setCancellingOrderId(null)
      setOrders((prev) =>
        prev.map((o) => o.id === orderId ? { ...o, status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date().toISOString() } : o)
      )
      if (order?.customer_id) {
        const isAutoCancel = !reason || reason === 'other' ||
          (typeof reason === 'string' && reason.toLowerCase().includes('auto-cancel'))
        sendPush(
          order.customer_id,
          isAutoCancel ? '⚠️ Order Could Not Be Accepted' : '❌ Order Cancelled',
          isAutoCancel
            ? 'Your order could not be accepted. Please re-order.'
            : 'Your order was cancelled by the restaurant.',
          `/orders/${orderId}`,
          'order-update'
        )
      }
    }
    setUpdating(null)
  }

  const statusCard = restaurantStatus && (
    <div className={`mb-4 rounded-2xl p-4 border-2 flex items-center justify-between ${restaurantStatus.is_open ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div>
        <p className={`text-sm font-extrabold ${restaurantStatus.is_open ? 'text-green-700' : 'text-red-700'}`}>
          {restaurantStatus.is_open ? '🟢 Restaurant is Open' : '🔴 Restaurant is Closed'}
        </p>
        <p className="text-[11px] text-gray-400 font-medium mt-0.5">
          Hours: {fmtTime(restaurantStatus.opening_time)} – {fmtTime(restaurantStatus.closing_time)}
        </p>
      </div>
      <button
        onClick={toggleRestaurantOpen}
        disabled={togglingStatus}
        className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 flex-shrink-0 ${restaurantStatus.is_open ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${restaurantStatus.is_open ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  )

  if (orders.length === 0) {
    return (
      <>
        {statusCard}
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">🍳</span>
          <p className="font-medium text-gray-900 mb-1">No orders yet</p>
          <p className="text-sm text-muted-foreground">Waiting for customers to place orders</p>
        </div>
      </>
    )
  }

  return (
    <>
      {statusCard}
      {/* Cancel Reason Modal */}
      {cancellingOrderId && (
        <CancelReasonModal
          isLoading={updating === cancellingOrderId}
          onConfirm={(reason) => cancelOrder(cancellingOrderId, reason)}
          onClose={() => setCancellingOrderId(null)}
        />
      )}

      {/* Accept Order Modal (item availability check) */}
      {acceptingOrderId && (() => {
        const order = orders.find((o) => o.id === acceptingOrderId)
        if (!order) return null
        return (
          <AcceptOrderModal
            order={order}
            isLoading={updating === acceptingOrderId}
            onConfirmAll={() => verifyAndAccept(acceptingOrderId)}
            onNotifyMissing={(ids, total) => notifyMissingItems(acceptingOrderId, ids, total)}
            onClose={() => setAcceptingOrderId(null)}
          />
        )
      })()}

      <div className="space-y-3">
        {orders.map((order) => {
          const borderClass = statusBg[order.status] ?? 'border-l-gray-300'
          const isBusy = updating === order.id
          const canCancel = ['pending', 'accepted', 'preparing'].includes(order.status)
          const cancelReason = (order as Order & { cancellation_reason?: CancelReason }).cancellation_reason

          return (
            <div key={order.id} className={`bg-white rounded-2xl shadow-sm border-l-4 ${borderClass} overflow-hidden`}>
              {/* Header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-mono font-semibold text-sm text-gray-900">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <span className="font-bold text-orange-600">₹{order.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleString('en-IN')}
                  </p>
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>

              {/* Items */}
              <div className="px-4 pb-3 space-y-0.5">
                {order.order_items?.map((item, i) => (
                  <p key={i} className="text-sm text-gray-700">
                    {item.products?.name}{' '}
                    <span className="text-muted-foreground">× {item.quantity}</span>
                  </p>
                ))}
              </div>

              {/* Customer info */}
              {(order.customer?.full_name || order.delivery_address?.address) && (
                <div className="px-4 pb-3 space-y-1">
                  {order.customer?.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="size-3" />
                      {order.customer.full_name} · {order.customer.phone}
                    </p>
                  )}
                  {order.delivery_address?.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3" />
                      {order.delivery_address.address}, {order.delivery_address.pincode}
                    </p>
                  )}
                </div>
              )}

              {/* Payment pending — show UTR for manual verification */}
              {order.status === 'pending' && order.payment_status === 'pending_verification' && (
                <div className="px-4 pb-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <p className="text-[11px] font-bold text-amber-700">UTR / Transaction ID</p>
                    <p className="text-sm font-mono font-semibold text-amber-800">
                      {order.utr_number || '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Rider info once assigned */}
              {order.rider?.full_name && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bike className="size-3" />
                    Rider: {order.rider.full_name} · {order.rider.phone}
                  </p>
                </div>
              )}

              {/* Cancel reason display (for cancelled orders) */}
              {order.status === 'cancelled' && (() => {
                const fullCancelReason = (order as Order & { cancellation_reason?: string }).cancellation_reason
                const canceller = getCanceller(fullCancelReason)
                const isRestaurant = canceller === 'restaurant'
                const isCustomer = canceller === 'customer'
                return (
                  <div className="px-4 pb-3 space-y-2">
                    {/* Who cancelled banner */}
                    <div className={`rounded-xl px-3 py-2 flex items-center gap-2 ${
                      isRestaurant
                        ? 'bg-orange-50 border border-orange-200'
                        : isCustomer
                        ? 'bg-gray-50 border border-gray-200'
                        : 'bg-red-50 border border-red-100'
                    }`}>
                      <span className="text-base flex-shrink-0">
                        {isRestaurant ? '🏪' : isCustomer ? '👤' : '❌'}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[11px] font-extrabold uppercase tracking-wide ${
                          isRestaurant ? 'text-orange-600' : isCustomer ? 'text-gray-500' : 'text-red-600'
                        }`}>
                          {isRestaurant ? 'Cancelled by Restaurant' : isCustomer ? 'Cancelled by Customer' : 'Order Cancelled'}
                        </p>
                        {cancelReason && cancelReason !== 'customer_requested' && (
                          <p className={`text-xs font-semibold mt-0.5 ${
                            isRestaurant ? 'text-orange-700' : 'text-gray-600'
                          }`}>
                            {CANCEL_REASON_LABELS[cancelReason as RestaurantCancelReason]}
                          </p>
                        )}
                        {isCustomer && (
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                            Customer cancelled within the 5-minute window
                          </p>
                        )}
                        {order.cancelled_at && (
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                            Cancelled at {new Date(order.cancelled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Actions */}
              <div className="px-4 pb-4 space-y-2">
                {order.status === 'pending' && !order.unavailable_items && (
                  <Button
                    className="w-full h-11 bg-orange-600 hover:bg-orange-700 rounded-xl font-semibold"
                    onClick={() => setAcceptingOrderId(order.id)}
                    disabled={isBusy}
                  >
                    {isBusy ? 'Verifying…' : 'Verify Payment & Accept'}
                  </Button>
                )}
                {order.status === 'pending' && order.unavailable_items && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <PackageX className="size-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">
                      Awaiting customer response…
                    </p>
                  </div>
                )}
                {order.status === 'accepted' && (
                  <Button
                    className="w-full h-11 bg-orange-600 hover:bg-orange-700 rounded-xl font-semibold"
                    onClick={() => advanceStatus(order.id, 'preparing')}
                    disabled={isBusy}
                  >
                    {isBusy ? 'Updating…' : 'Start Preparing'}
                  </Button>
                )}
                {order.status === 'preparing' && (
                  <Button
                    className="w-full h-11 bg-orange-600 hover:bg-orange-700 rounded-xl font-semibold"
                    onClick={() => advanceStatus(order.id, 'ready')}
                    disabled={isBusy}
                  >
                    {isBusy ? 'Updating…' : 'Mark Ready'}
                  </Button>
                )}
                {order.status === 'ready' && (
                  <div className="h-11 flex items-center justify-center bg-green-50 rounded-xl gap-1.5">
                    <CheckCircle2 className="size-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-600">
                      {order.rider_id
                        ? 'Rider is on the way to pick up'
                        : 'Ready — waiting for a rider to accept'}
                    </span>
                  </div>
                )}
                {order.status === 'out_for_delivery' && (
                  <div className="h-11 flex items-center justify-center bg-orange-50 rounded-xl gap-1.5">
                    <Bike className="size-4 text-orange-600" />
                    <span className="text-sm font-semibold text-orange-600">Out for delivery</span>
                  </div>
                )}
                {order.status === 'delivered' && (
                  <div className="h-11 flex items-center justify-center bg-green-50 rounded-xl gap-1.5">
                    <CheckCircle2 className="size-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-600">Delivered</span>
                  </div>
                )}
                {order.status === 'cancelled' && (() => {
                  const fullCancelReason = (order as Order & { cancellation_reason?: string }).cancellation_reason
                  const canceller = getCanceller(fullCancelReason)
                  return (
                    <div className={`h-11 flex items-center justify-center rounded-xl gap-1.5 ${
                      canceller === 'restaurant' ? 'bg-orange-50' : 'bg-red-50'
                    }`}>
                      <XCircle className={`size-4 ${canceller === 'restaurant' ? 'text-orange-500' : 'text-red-500'}`} />
                      <span className={`text-sm font-semibold ${
                        canceller === 'restaurant' ? 'text-orange-600' : 'text-red-500'
                      }`}>
                        {canceller === 'restaurant' ? 'Cancelled by Restaurant' : canceller === 'customer' ? 'Cancelled by Customer' : 'Cancelled'}
                      </span>
                    </div>
                  )
                })()}

                {canCancel && (
                  <button
                    onClick={() => setCancellingOrderId(order.id)}
                    disabled={isBusy}
                    className="w-full h-9 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
