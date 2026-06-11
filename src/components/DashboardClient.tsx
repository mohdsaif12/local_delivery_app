'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import OrderStatusBadge from './OrderStatusBadge'
import { toast } from 'sonner'
import { MapPin, Phone } from 'lucide-react'

const TRANSITIONS: Record<OrderStatus, { next: OrderStatus; label: string } | null> = {
  pending:          { next: 'accepted',        label: 'Accept Order'    },
  accepted:         { next: 'preparing',       label: 'Start Preparing' },
  preparing:        { next: 'out_for_delivery', label: 'Mark Ready'     },
  ready:            { next: 'out_for_delivery', label: 'Out for Delivery' },
  out_for_delivery: { next: 'delivered',       label: 'Mark Delivered'  },
  delivered:        null,
  cancelled:        null,
}

const statusBg: Record<OrderStatus, string> = {
  pending:          'border-l-gray-300',
  accepted:         'border-l-blue-500',
  preparing:        'border-l-yellow-500',
  ready:            'border-l-yellow-400',
  out_for_delivery: 'border-l-orange-500',
  delivered:        'border-l-green-500',
  cancelled:        'border-l-red-400',
}

interface Props {
  initialOrders: Order[]
}

export default function DashboardClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('restaurant-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          const { data } = await supabase
            .from('orders')
            .select(
              '*, order_items(quantity, price_at_order, products(name)), profiles(full_name, phone)'
            )
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setOrders((prev) => [data as Order, ...prev])
            toast.success('New order received!')
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === payload.new.id ? { ...o, ...payload.new } : o))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function advanceStatus(orderId: string, next: OrderStatus) {
    setUpdating(orderId)
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: next })
      .eq('id', orderId)
    if (error) toast.error('Failed to update order status')
    setUpdating(null)
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-5xl mb-4">🍳</span>
        <p className="font-medium text-gray-900 mb-1">No orders yet</p>
        <p className="text-sm text-muted-foreground">Waiting for customers to place orders</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const transition = TRANSITIONS[order.status as OrderStatus]
        const borderClass = statusBg[order.status as OrderStatus] ?? 'border-l-gray-300'
        const address = (order as any).delivery_address

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
                <OrderStatusBadge status={order.status as OrderStatus} />
              </div>
            </div>

            {/* Items */}
            <div className="px-4 pb-3 space-y-0.5">
              {(order.order_items as any[])?.map((item, i) => (
                <p key={i} className="text-sm text-gray-700">
                  {item.products?.name}{' '}
                  <span className="text-muted-foreground">× {item.quantity}</span>
                </p>
              ))}
            </div>

            {/* Customer info */}
            {((order as any).profiles?.full_name || address?.address) && (
              <div className="px-4 pb-3 space-y-1">
                {(order as any).profiles?.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="size-3" />
                    {(order as any).profiles.full_name} · {(order as any).profiles.phone}
                  </p>
                )}
                {address?.address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3" />
                    {address.address}, {address.pincode}
                  </p>
                )}
              </div>
            )}

            {/* Action */}
            <div className="px-4 pb-4">
              {transition ? (
                <Button
                  className="w-full h-11 bg-orange-600 hover:bg-orange-700 rounded-xl font-semibold"
                  onClick={() => advanceStatus(order.id, transition.next)}
                  disabled={updating === order.id}
                >
                  {updating === order.id ? 'Updating…' : transition.label}
                </Button>
              ) : (
                <div className="h-11 flex items-center justify-center bg-green-50 rounded-xl">
                  <span className="text-sm font-semibold text-green-600">✓ Ready for pickup</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}