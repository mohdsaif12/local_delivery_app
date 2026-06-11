import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, MapPin, Clock, ShoppingBag, ArrowRight } from 'lucide-react'

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(quantity, price_at_order, products(name))')
    .eq('id', id)
    .eq('customer_id', user.id)
    .single()

  if (!order) notFound()

  const shortId = `#${id.slice(0, 8).toUpperCase()}`
  const addr = order.delivery_address as { address?: string; name?: string; payment?: string } | null
  const paymentLabel = addr?.payment === 'card' ? 'Credit/Debit Card' : 'Cash on Delivery'

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      {/* Red hero */}
      <div className="bg-[#b51c00] px-5 pt-12 pb-20 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
            <CheckCircle className="size-9 text-[#b51c00]" fill="rgba(181,28,0,0.12)" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Order Placed Successfully!</h1>
        <p className="text-sm text-white/75">Your delicious food is being prepared</p>
      </div>

      {/* White card overlapping hero */}
      <div className="-mt-8 mx-4 bg-white rounded-2xl p-4 space-y-4" style={{ boxShadow: '0 8px 24px rgba(45,52,54,0.10)' }}>
        {/* Order ID */}
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-[#586062]">Order ID</span>
          <span className="text-sm font-bold text-[#191c1d] font-mono">{shortId}</span>
        </div>
        <div className="h-px bg-[#f3f4f5]" />

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#f8f9fa] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="size-4 text-[#b51c00]" />
              <span className="text-[10px] font-semibold text-[#586062] uppercase tracking-wide">ETA</span>
            </div>
            <p className="text-sm font-bold text-[#191c1d]">30–45 min</p>
          </div>
          <div className="bg-[#f8f9fa] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="size-4 text-[#b51c00]" />
              <span className="text-[10px] font-semibold text-[#586062] uppercase tracking-wide">Payment</span>
            </div>
            <p className="text-sm font-bold text-[#191c1d]">{paymentLabel}</p>
          </div>
        </div>

        {/* Address */}
        {addr?.address && (
          <div className="flex items-start gap-3 bg-[#f8f9fa] rounded-xl p-3">
            <MapPin className="size-4 text-[#b51c00] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-[#586062] uppercase tracking-wide mb-0.5">Delivery Address</p>
              <p className="text-sm font-medium text-[#191c1d]">{addr.address}</p>
            </div>
          </div>
        )}

        <div className="h-px bg-[#f3f4f5]" />

        {/* Items */}
        <div>
          <p className="text-xs font-semibold text-[#586062] uppercase tracking-wide mb-2">Items Ordered</p>
          <div className="space-y-1.5">
            {(order.order_items as { quantity: number; price_at_order: number; products?: { name: string } }[])?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-[#191c1d]">
                  {item.products?.name}
                  <span className="text-[#586062]"> × {item.quantity}</span>
                </span>
                <span className="font-semibold text-[#191c1d]">₹{item.price_at_order * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-sm mt-3 pt-3 border-t border-[#f3f4f5]">
            <span className="text-[#191c1d]">Total Paid</span>
            <span className="text-[#b51c00]">₹{order.total}</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-4 px-4 space-y-3">
        <Link
          href="/orders"
          className="w-full h-14 bg-[#b51c00] text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          Track Order <ArrowRight className="size-5" />
        </Link>
        <Link
          href="/menu"
          className="w-full h-12 border-2 border-[#b51c00] text-[#b51c00] font-semibold rounded-xl flex items-center justify-center active:scale-95 transition-transform"
        >
          Back to Menu
        </Link>
      </div>
    </div>
  )
}