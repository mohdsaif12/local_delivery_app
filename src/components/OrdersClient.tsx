'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderStatus } from '@/lib/types'
import Link from 'next/link'
import { CheckCircle, ChefHat, Bike, Package, Clock, ArrowRight } from 'lucide-react'

interface Props {
  initialOrders: Order[]
  userId: string
}

const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: 'pending', label: 'Order Received', icon: Package },
  { status: 'preparing', label: 'Preparing', icon: ChefHat },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Bike },
  { status: 'delivered', label: 'Arrived', icon: CheckCircle },
]

function statusIndex(status: OrderStatus) {
  return STATUS_STEPS.findIndex((s) => s.status === status)
}

function OrderStepper({ status }: { status: OrderStatus }) {
  const current = statusIndex(status)
  return (
    <div className="flex items-center justify-between mt-3 mb-1">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= current
        const active = i === current
        const Icon = step.icon
        return (
          <div key={step.status} className="flex-1 flex flex-col items-center relative">
            {i < STATUS_STEPS.length - 1 && (
              <div className={`absolute top-4 left-1/2 w-full h-0.5 ${i < current ? 'bg-[#b51c00]' : 'bg-[#e1e3e4]'}`} />
            )}
            <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
              done ? 'bg-[#b51c00] border-[#b51c00]' : 'bg-white border-[#e1e3e4]'
            }`}>
              <Icon className={`size-3.5 ${done ? 'text-white' : 'text-[#afafaf]'}`} strokeWidth={active ? 2.5 : 2} />
            </div>
            <span className={`text-[9px] font-semibold mt-1 text-center leading-tight ${done ? 'text-[#b51c00]' : 'text-[#afafaf]'}`}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function statusLabel(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    pending: 'Order Received',
    accepted: 'Accepted',
    preparing: 'Being Prepared',
    ready: 'Ready',
    out_for_delivery: 'On the Way',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  }
  return map[status] ?? status
}

export default function OrdersClient({ initialOrders, userId }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('customer-orders')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `customer_id=eq.${userId}`,
      }, (payload) => {
        setOrders((prev) =>
          prev.map((o) => o.id === payload.new.id ? { ...o, ...(payload.new as Partial<Order>) } : o)
        )
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-6xl mb-4">📋</span>
        <p className="font-bold text-[#191c1d] mb-1">No orders yet</p>
        <p className="text-sm text-[#586062] mb-6">Your order history will appear here</p>
        <Link
          href="/menu"
          className="h-12 px-8 bg-[#b51c00] text-white font-semibold rounded-lg flex items-center gap-2"
        >
          Browse Menu <ArrowRight className="size-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const isCancelled = order.status === 'cancelled'
        return (
          <div key={order.id} className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
            {/* Header */}
            <div className="px-4 pt-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-[#191c1d] font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-[10px] text-[#586062] mt-0.5 flex items-center gap-1">
                  <Clock className="size-3" />
                  {new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isCancelled ? 'bg-red-100 text-red-600' :
                order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                'bg-[#ffdad3] text-[#b51c00]'
              }`}>
                {statusLabel(order.status as OrderStatus)}
              </span>
            </div>

            {/* Stepper */}
            {!isCancelled && (
              <div className="px-4 pb-2">
                <OrderStepper status={order.status as OrderStatus} />
              </div>
            )}

            {/* Items */}
            <div className="px-4 pb-3 border-t border-[#f3f4f5] pt-3">
              <p className="text-xs text-[#586062] mb-1.5">
                {(order.order_items as { quantity: number; products?: { name: string } }[])
                  ?.map((item) => `${item.products?.name} ×${item.quantity}`)
                  .join(', ')}
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