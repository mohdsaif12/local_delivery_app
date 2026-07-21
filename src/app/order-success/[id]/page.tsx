import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, MapPin, X, ChevronRight } from 'lucide-react'
import AndroidInstallPrompt from '@/components/AndroidInstallPrompt'
import PushSetup from '@/components/PushSetup'

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
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f7f8fa] text-gray-900 pb-safe">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2 text-[#c0392b]">
          <CheckCircle className="size-5" />
          <span className="font-extrabold text-sm text-gray-800">Order Placed</span>
        </div>
        <Link href="/menu" className="p-1 cursor-pointer text-gray-400 hover:text-gray-600">
          <X className="size-5" />
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Animated Circular Ring Illustration */}
        <div className="flex justify-center items-center py-10">
          <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Outer circles */}
            <div className="absolute inset-0 rounded-full border-4 border-red-50/60 scale-[0.85] animate-pulse" />
            <div className="absolute inset-0 rounded-full border border-red-100/30 scale-[0.98]" />
            
            {/* Central Success Circle */}
            <div className="relative w-28 h-28 rounded-full bg-white shadow-[0_8px_24px_rgba(192,57,43,0.08)] flex items-center justify-center z-10 border border-gray-50">
              <div className="w-20 h-20 rounded-full bg-[#c0392b] flex items-center justify-center shadow-lg shadow-[#c0392b]/20">
                <svg className="size-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Floating Burger Card */}
            <div className="absolute top-2 right-2 w-10 h-10 rounded-xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] flex items-center justify-center border border-gray-100/50 z-20">
              <span className="text-lg">🍔</span>
            </div>

            {/* Floating Cutlery Card */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] flex items-center justify-center border border-gray-100/50 z-20">
              <span className="text-lg text-[#c0392b]">🍴</span>
            </div>

            {/* Floating Diamond/Gift Card */}
            <div className="absolute bottom-2 right-6 w-10 h-10 rounded-xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] flex items-center justify-center border border-gray-100/50 z-20">
              <span className="text-lg">💎</span>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center px-6 mb-8">
          <h2 className="text-xl font-extrabold text-gray-900 leading-tight">Order Placed Successfully!</h2>
          <p className="text-xs text-gray-400 mt-2.5 leading-relaxed px-5 font-medium">
            Your delicious meal is now being prepared by our chefs and will be on its way shortly.
          </p>
        </div>

        {/* Information summary card */}
        <div className="bg-white rounded-3xl p-5 mx-4 space-y-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-gray-50">
          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="text-gray-400 font-bold tracking-wider uppercase block">Order ID</span>
              <span className="text-sm font-extrabold text-gray-900 font-mono mt-0.5 block">{shortId}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 font-bold tracking-wider uppercase block">Estimated Delivery</span>
              <span className="text-sm font-extrabold text-[#c0392b] mt-0.5 block">25 – 35 mins</span>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Courier & Payment fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f8f9fa] rounded-2xl p-3 flex flex-col gap-1 border border-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                🚚 Courier
              </span>
              <p className="text-xs font-extrabold text-gray-900">Alex Johnson</p>
            </div>
            <div className="bg-[#f8f9fa] rounded-2xl p-3 flex flex-col gap-1 border border-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                💳 Payment
              </span>
              <p className="text-xs font-extrabold text-gray-900 truncate">{paymentLabel}</p>
            </div>
          </div>

          {/* Delivery location address */}
          {addr?.address && (
            <div className="flex items-start gap-3 bg-[#fff0ee] rounded-2xl p-3.5 border border-red-50/40">
              <div className="w-8.5 h-8.5 rounded-xl bg-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm border border-red-100/20">
                <MapPin className="size-4.5 text-[#c0392b]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#c0392b] uppercase tracking-wider">Delivery Address</p>
                <p className="text-xs font-bold text-gray-800 leading-normal mt-0.5">{addr.address}</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation CTAs */}
        <div className="mt-8 px-4 space-y-3">
          <Link
            href={`/orders/${order.id}`}
            className="w-full h-13 bg-[#c0392b] hover:bg-[#a93226] text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#c0392b]/20 active:scale-[0.98] transition-all cursor-pointer text-sm"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L16 4m0 13V4m0 0L9 7" />
            </svg>
            <span>Track Order</span>
          </Link>
          <Link
            href="/menu"
            className="w-full h-13 border-2 border-gray-200 hover:border-[#c0392b] text-gray-700 font-extrabold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer text-sm bg-white shadow-sm"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
      <PushSetup variant="order" />
      <AndroidInstallPrompt variant="order" delay={2000} />
    </div>
  )
}