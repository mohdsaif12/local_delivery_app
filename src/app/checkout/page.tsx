'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ChevronLeft, MapPin, CreditCard, ArrowRight, Banknote } from 'lucide-react'
import Link from 'next/link'

type PaymentMethod = 'cod' | 'card'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, clearCart } = useCartStore()
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  const deliveryFee = items.length > 0 ? 30 : 0
  const taxes = Math.round(subtotal * 0.05)
  const total = subtotal + deliveryFee + taxes

  const [loading, setLoading] = useState(false)
  const [payment, setPayment] = useState<PaymentMethod>('cod')
  const [form, setForm] = useState({ name: '', phone: '', address: '', pincode: '' })

  if (items.length === 0) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col items-center justify-center bg-[#f8f9fa] px-5">
        <span className="text-5xl mb-4">🛒</span>
        <p className="text-[#586062] mb-6">Your cart is empty</p>
        <Link href="/menu" className="h-12 px-8 bg-[#b51c00] text-white font-semibold rounded-lg flex items-center">
          Browse Menu
        </Link>
      </div>
    )
  }

  async function handlePlaceOrder(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Please sign in'); router.push('/login'); return }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ customer_id: user.id, status: 'pending', delivery_address: { ...form, payment }, total })
      .select().single()

    if (orderError || !order) {
      toast.error('Failed to place order. Please try again.')
      setLoading(false)
      return
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      items.map((item) => ({
        order_id: order.id, product_id: item.product.id,
        quantity: item.quantity, price_at_order: item.product.price,
      }))
    )

    if (itemsError) { toast.error('Failed to save order items.'); setLoading(false); return }

    clearCart()
    router.push(`/order-success/${order.id}`)
  }

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center gap-3 border-b border-[#e5beb6]/20">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ChevronLeft className="size-5 text-[#191c1d]" />
        </button>
        <h1 className="text-base font-bold text-[#b51c00]">Checkout</h1>
      </header>

      <form onSubmit={handlePlaceOrder} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-28">
        {/* Delivery address */}
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-[#191c1d]">Delivery Address</h2>
            <button type="button" className="text-xs font-semibold text-[#b51c00]">Edit</button>
          </div>
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#ffdad3] flex items-center justify-center flex-shrink-0">
              <MapPin className="size-4 text-[#b51c00]" />
            </div>
            <div className="flex-1 space-y-2">
              <Input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                className="h-11 rounded-lg bg-[#f3f4f5] border-none text-sm focus-visible:ring-1 focus-visible:ring-[#b51c00]" />
              <Input placeholder="Phone Number" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required
                className="h-11 rounded-lg bg-[#f3f4f5] border-none text-sm focus-visible:ring-1 focus-visible:ring-[#b51c00]" />
              <Input placeholder="Street address, area" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required
                className="h-11 rounded-lg bg-[#f3f4f5] border-none text-sm focus-visible:ring-1 focus-visible:ring-[#b51c00]" />
              <Input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} required
                className="h-11 rounded-lg bg-[#f3f4f5] border-none text-sm focus-visible:ring-1 focus-visible:ring-[#b51c00]" />
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
          <h2 className="text-sm font-bold text-[#191c1d] mb-3">Order Summary</h2>
          {items.map((item) => (
            <div key={item.product.id} className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#f3f4f5] overflow-hidden flex-shrink-0">
                {item.product.photo_url
                  ? <img src={item.product.photo_url} alt={item.product.name} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                  : <div className="h-full flex items-center justify-center text-lg">🍽️</div>}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#191c1d]">{item.product.name}</p>
                <p className="text-xs text-[#586062]">x{item.quantity}</p>
              </div>
              <span className="text-sm font-bold text-[#191c1d]">₹{item.product.price * item.quantity}</span>
            </div>
          ))}
          <div className="border-t border-[#e1e3e4] pt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-[#586062]"><span>Subtotal</span><span>₹{subtotal}</span></div>
            <div className="flex justify-between text-xs text-[#586062]"><span>Delivery Fee</span><span>₹{deliveryFee}</span></div>
            <div className="flex justify-between text-xs text-[#586062]"><span>Taxes</span><span>₹{taxes}</span></div>
            <div className="flex justify-between font-bold text-sm text-[#191c1d] pt-1">
              <span>Total</span><span className="text-[#b51c00]">₹{total}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
          <h2 className="text-sm font-bold text-[#191c1d] mb-3">Payment Method</h2>
          <div className="space-y-2">
            {[
              { id: 'card' as PaymentMethod, icon: CreditCard, label: 'Credit/Debit Card' },
              { id: 'cod' as PaymentMethod, icon: Banknote, label: 'Cash on Delivery' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPayment(id)}
                className={`w-full h-14 flex items-center gap-3 px-4 rounded-xl border-2 transition-colors ${
                  payment === id ? 'border-[#b51c00] bg-[#ffdad3]/20' : 'border-[#e1e3e4]'
                }`}
              >
                <Icon className={`size-5 ${payment === id ? 'text-[#b51c00]' : 'text-[#586062]'}`} />
                <span className={`text-sm font-semibold ${payment === id ? 'text-[#b51c00]' : 'text-[#191c1d]'}`}>{label}</span>
                {payment === id && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-[#b51c00] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Place order button */}
      <div className="px-4 py-4 bg-white border-t border-[#e1e3e4]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-[#586062]">Total Payment</span>
          <span className="font-bold text-[#b51c00]">₹{total}</span>
        </div>
        <button
          onClick={handlePlaceOrder as unknown as React.MouseEventHandler}
          disabled={loading}
          className="w-full h-14 bg-[#b51c00] text-white font-semibold rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70"
        >
          <span>{loading ? 'Placing Order…' : 'Place Order'}</span>
          {!loading && <ArrowRight className="size-5" />}
        </button>
      </div>
    </div>
  )
}