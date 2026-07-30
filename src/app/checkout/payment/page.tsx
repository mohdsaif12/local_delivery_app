'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/store/cart'
import { createClient } from '@/lib/supabase/client'
import { haversineKm, deliveryFeeFromKm } from '@/lib/distance'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ChevronLeft, Copy, CheckCircle2 } from 'lucide-react'

export default function PaymentOptionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] phone-screen flex items-center justify-center bg-[#f8f9fa]">
          <div className="w-10 h-10 border-4 border-[#b51c00] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PaymentOptionsContent />
    </Suspense>
  )
}

function PaymentOptionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const couponCode = searchParams.get('coupon')
  const { items, clearCart } = useCartStore()
  const submittingRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [utr, setUtr] = useState('')

  // Payment method. COD is unlocked only after the customer has 3 delivered
  // orders — until then UPI is the only option (prevents no-show abuse).
  const COD_MIN_ORDERS = 3
  const [method, setMethod] = useState<'upi' | 'cod'>('upi')
  const [deliveredCount, setDeliveredCount] = useState(0)
  const codUnlocked = deliveredCount >= COD_MIN_ORDERS

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [upiId, setUpiId] = useState('')
  const [deliveryFee, setDeliveryFee] = useState(66)
  const [discount, setDiscount] = useState(0)
  const [address, setAddress] = useState<{
    label: string
    address: string
    landmark: string | null
    pincode: string
    latitude: number | null
    longitude: number | null
  } | null>(null)

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  const total = Math.max(0, subtotal + deliveryFee - discount)
  const itemsCount = items.reduce((sum, i) => sum + i.quantity, 0)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const [{ data: addr }, { data: restaurant }] = await Promise.all([
        supabase
          .from('addresses')
          .select('label, address, landmark, pincode, latitude, longitude')
          .eq('customer_id', user.id)
          .eq('is_default', true)
          .maybeSingle(),
        supabase.from('restaurants').select('id, delivery_fee, upi_id, latitude, longitude').single(),
      ])

      if (!addr) {
        router.push('/location?from=checkout')
        return
      }
      setAddress(addr)

      let fee = 66
      if (restaurant) {
        setRestaurantId(restaurant.id)
        setUpiId(restaurant.upi_id ?? '')

        if (
          addr.latitude != null &&
          addr.longitude != null &&
          restaurant.latitude != null &&
          restaurant.longitude != null
        ) {
          const roadKm = haversineKm(restaurant.latitude, restaurant.longitude, addr.latitude, addr.longitude) * 1.3
          fee = deliveryFeeFromKm(roadKm) ?? restaurant.delivery_fee ?? 66
        } else {
          fee = restaurant.delivery_fee ?? 66
        }
        setDeliveryFee(fee)
      }

      if (couponCode) {
        const { data: coupon } = await supabase
          .from('coupons')
          .select('discount_amount, min_order_value')
          .eq('code', couponCode)
          .eq('is_active', true)
          .maybeSingle()

        if (coupon && subtotal >= coupon.min_order_value) {
          setDiscount(coupon.discount_amount)
        }
      }

      // How many orders has this customer had delivered? COD unlocks at 3.
      // head:true = count only, no rows transferred (no egress cost).
      const { count: delivered } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', user.id)
        .eq('status', 'delivered')
      setDeliveredCount(delivered ?? 0)

      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, couponCode])

  function copyUpiId() {
    if (!upiId) return
    navigator.clipboard.writeText(upiId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (submittingRef.current || !address) return

    // Guard: COD only allowed once unlocked (server also implied by trust rule)
    const isCod = method === 'cod' && codUnlocked

    if (!isCod && !utr.trim()) {
      toast.error('Please enter your UTR / Transaction ID')
      return
    }

    submittingRef.current = true
    setSubmitting(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Please sign in first')
      router.push('/login')
      submittingRef.current = false
      setSubmitting(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        restaurant_id: restaurantId,
        status: 'pending',
        // COD has no online payment to verify — mark verified and let the
        // restaurant collect cash on delivery. UPI stays pending_verification
        // until the UTR is checked.
        payment_status: isCod ? 'verified' : 'pending_verification',
        utr_number: isCod ? null : utr.trim(),
        order_type: 'delivery',
        delivery_address: {
          name: profile?.full_name ?? '',
          phone: profile?.phone ?? '',
          address: address.address,
          landmark: address.landmark ?? undefined,
          pincode: address.pincode,
          payment: isCod ? 'cod' : 'upi',
        },
        delivery_fee: deliveryFee,
        delivery_latitude: address.latitude,
        delivery_longitude: address.longitude,
        coupon_code: discount > 0 ? couponCode : null,
        discount_amount: discount,
        total,
      })
      .select()
      .single()

    if (orderError || !order) {
      toast.error('Failed to place order. Please try again.')
      submittingRef.current = false
      setSubmitting(false)
      return
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product.id.slice(0, 36),
      quantity: item.quantity,
      price_at_order: item.product.price,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

    if (itemsError) {
      toast.error('Failed to save order items.')
      submittingRef.current = false
      setSubmitting(false)
      return
    }

    clearCart()
    router.push(`/orders/${order.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] phone-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="w-10 h-10 border-4 border-[#b51c00] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (submitting) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col items-center justify-center bg-[#f7f8fa] px-5 text-center">
        <div className="w-12 h-12 border-4 border-[#b51c00] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-base font-extrabold text-gray-900">Placing your order...</p>
        <p className="text-xs text-gray-400 mt-1 font-semibold">Please do not close or refresh this page</p>
      </div>
    )
  }

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

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 h-16 flex items-center gap-3 border-b border-[#e1e3e4]">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ChevronLeft className="size-5 text-[#191c1d]" />
        </button>
        <div>
          <h1 className="text-base font-bold text-[#191c1d] leading-none">Payment Options</h1>
          <p className="text-xs text-[#586062] mt-1">
            {itemsCount} {itemsCount === 1 ? 'item' : 'items'} · Total ₹{total}
            {discount > 0 && <span className="text-emerald-600 font-semibold"> · Saved ₹{discount}</span>}
          </p>
        </div>
      </header>

      <form
        id="payment-form"
        onSubmit={handlePay}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-32"
      >
        {/* Order total breakdown */}
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[#586062]">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            <div className="flex justify-between text-xs text-[#586062]">
              <span>Delivery Fee</span>
              <span>₹{deliveryFee}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                <span>Coupon Discount ({couponCode})</span>
                <span>-₹{discount}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-[#191c1d] pt-1.5 border-t border-[#e1e3e4] mt-1.5">
              <span>Total</span>
              <span className="text-[#b51c00]">₹{total}</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] font-bold text-[#9ea3a5] uppercase tracking-wide">Preferred Payment</p>

        {/* ── UPI option ── */}
        <div
          onClick={() => setMethod('upi')}
          className={`bg-white rounded-xl p-4 border-2 cursor-pointer ${method === 'upi' ? 'border-[#b51c00]' : 'border-[#e1e3e4]'}`}
          style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#ffdad3] flex items-center justify-center">
                <span className="text-sm">💳</span>
              </div>
              <span className="text-sm font-bold text-[#191c1d]">Pay via UPI</span>
            </div>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${method === 'upi' ? 'bg-[#b51c00]' : 'border-2 border-[#cfd3d4]'}`}>
              {method === 'upi' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>

          {method === 'upi' && (
            <div className="mt-3">
              {/* UPI ID box */}
              <div className="bg-[#f3f4f5] rounded-xl px-4 py-3 flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-semibold text-[#586062] uppercase tracking-wide mb-0.5">UPI ID</p>
                  <p className="text-[15px] font-bold text-[#191c1d] font-mono">{upiId || '—'}</p>
                </div>
                {upiId && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); copyUpiId() }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#b51c00] active:opacity-60 transition-opacity"
                  >
                    {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              <p className="text-xs text-[#586062] mb-3 leading-relaxed">
                Open <strong className="text-[#191c1d]">GPay</strong> or{' '}
                <strong className="text-[#191c1d]">PhonePe</strong> → send{' '}
                <strong className="text-[#191c1d]">₹{total}</strong> to the UPI ID above → open
                transaction history → copy the <strong className="text-[#191c1d]">UTR / Transaction ID</strong>
              </p>

              <Input
                placeholder="Enter UTR / Transaction ID"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                required
                inputMode="numeric"
                onClick={(e) => e.stopPropagation()}
                className="h-11 rounded-lg bg-[#f3f4f5] border-none text-sm focus-visible:ring-1 focus-visible:ring-[#b51c00] font-mono tracking-wider"
              />
              <p className="text-[10px] text-[#586062] mt-2 leading-snug">
                Your order will be confirmed once we verify the payment — usually within 2 minutes.
              </p>
            </div>
          )}
        </div>

        {/* ── Cash on Delivery option (unlocks after 3 delivered orders) ── */}
        {codUnlocked ? (
          <div
            onClick={() => setMethod('cod')}
            className={`bg-white rounded-xl p-4 border-2 cursor-pointer ${method === 'cod' ? 'border-[#b51c00]' : 'border-[#e1e3e4]'}`}
            style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#ffe9c7] flex items-center justify-center">
                  <span className="text-sm">💵</span>
                </div>
                <div>
                  <span className="text-sm font-bold text-[#191c1d]">Cash on Delivery</span>
                  <p className="text-[10px] text-[#586062]">Pay ₹{total} in cash when your order arrives</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${method === 'cod' ? 'bg-[#b51c00]' : 'border-2 border-[#cfd3d4]'}`}>
                {method === 'cod' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#f3f4f5] rounded-xl p-4 border-2 border-dashed border-[#d5d8da]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#e1e3e4] flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🔒</span>
              </div>
              <div>
                <span className="text-sm font-bold text-[#586062]">Cash on Delivery</span>
                <p className="text-[10px] text-[#586062] leading-snug">
                  Unlocks after {COD_MIN_ORDERS} delivered orders · you have {deliveredCount}/{COD_MIN_ORDERS}
                </p>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Sticky bottom pay button */}
      <div className="sticky bottom-0 px-4 pt-3 pb-5 bg-white border-t border-[#e1e3e4]">
        <button
          type="submit"
          form="payment-form"
          className="w-full h-14 bg-[#b51c00] text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          {method === 'cod' && codUnlocked ? `Place Order · Pay ₹${total} on delivery` : `Pay ₹${total} via UPI`}
        </button>
      </div>
    </div>
  )
}
