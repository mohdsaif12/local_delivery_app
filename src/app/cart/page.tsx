'use client'

import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { Minus, Plus, Trash2, MapPin, ArrowRight, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQuantity, removeItem } = useCartStore()
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  const deliveryFee = items.length > 0 ? 30 : 0
  const taxes = Math.round(subtotal * 0.05)
  const total = subtotal + deliveryFee + taxes

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center gap-3 border-b border-[#e5beb6]/20">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ChevronLeft className="size-5 text-[#191c1d]" />
        </button>
        <h1 className="text-base font-bold text-[#191c1d] flex-1">Your Cart</h1>
      </header>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          <span className="text-6xl mb-4">🛒</span>
          <p className="font-bold text-[#191c1d] mb-1">Your cart is empty</p>
          <p className="text-sm text-[#586062] mb-6">Add some delicious items to get started</p>
          <Link
            href="/menu"
            className="h-12 px-8 bg-[#b51c00] text-white font-semibold rounded-lg flex items-center gap-2"
          >
            Browse Menu <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Delivery address */}
            <div className="bg-white rounded-xl p-4 flex items-start gap-3" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
              <div className="w-8 h-8 rounded-full bg-[#ffdad3] flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="size-4 text-[#b51c00]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#586062] font-medium">Delivery to Home</p>
                <p className="text-sm font-semibold text-[#191c1d] mt-0.5">Enter address at checkout</p>
              </div>
              <Link href="/checkout" className="text-xs font-semibold text-[#b51c00]">Change</Link>
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
              <h2 className="text-sm font-bold text-[#191c1d] mb-4">Review Items</h2>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3">
                    {/* Image */}
                    <div className="w-16 h-16 rounded-xl bg-[#f3f4f5] overflow-hidden flex-shrink-0">
                      {item.product.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.product.photo_url} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="h-full flex items-center justify-center text-2xl">🍽️</div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#191c1d] truncate">{item.product.name}</p>
                      <p className="text-xs text-[#586062] mt-0.5">₹{item.product.price} each</p>
                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-full border border-[#e1e3e4] flex items-center justify-center text-[#586062]"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="text-sm font-bold text-[#191c1d] w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-7 h-7 rounded-full bg-[#b51c00] flex items-center justify-center text-white"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </div>
                    {/* Price + delete */}
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-bold text-[#191c1d]">₹{item.product.price * item.quantity}</span>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="text-[#906f69] p-1"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill summary */}
            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
              <h2 className="text-sm font-bold text-[#191c1d] mb-3">Bill Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-[#586062]">
                  <span>Subtotal</span><span>₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-sm text-[#586062]">
                  <span>Delivery Fee</span><span>₹{deliveryFee}</span>
                </div>
                <div className="flex justify-between text-sm text-[#586062]">
                  <span>Taxes &amp; Charges</span><span>₹{taxes}</span>
                </div>
                <div className="h-px bg-[#e1e3e4] my-1" />
                <div className="flex justify-between font-bold text-base text-[#191c1d]">
                  <span>Total Amount</span>
                  <span className="text-[#b51c00]">₹{total}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout button */}
          <div className="px-4 py-4 bg-white border-t border-[#e1e3e4]">
            <Link
              href="/checkout"
              className="w-full h-14 bg-[#b51c00] text-white font-semibold rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              Proceed to Checkout <ArrowRight className="size-5" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}