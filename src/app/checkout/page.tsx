'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/store/cart'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, MapPin, Minus, Plus, CreditCard, AlertTriangle, Tag, CheckCircle2 } from 'lucide-react'
import { useOutlets } from '@/hooks/useOutlets'
import OutletPicker from '@/components/OutletPicker'
import { outletDelivery, outletLabel, nearestCoveringOutlet } from '@/lib/outlets'
import {
  couponDiscount,
  couponLabel,
  defaultOffer,
  listCoupons,
  loadCouponState,
  type CouponOffer,
  type CouponState,
} from '@/lib/coupons'
import CouponSheet from '@/components/CouponSheet'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, updateQuantity } = useCartStore()

  const { outlets, outlet, point, selectOutlet } = useOutlets()

  const [loading, setLoading] = useState(true)
  const [addressLabel, setAddressLabel] = useState('')
  const [addressText, setAddressText] = useState('')
  // Fee, distance and coverage are derived from the chosen outlet, so switching
  // outlet re-prices the order on the spot with no state to keep in sync.
  const delivery = outlet && point ? outletDelivery(outlet, point.lat, point.lng) : null
  const deliveryFee = delivery?.fee ?? outlet?.delivery_fee ?? 66
  const distanceKm = delivery?.roadKm ?? null
  const outsideZone = delivery ? !delivery.inRange : false
  // Every offer this customer still owns, in the order the admin set.
  const [offers, setOffers] = useState<CouponOffer[]>([])
  // The applied code. Null before the list loads, then the first eligible offer
  // (the 10% one) unless the customer picks another from the sheet.
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [touchedCoupon, setTouchedCoupon] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Which offers this customer still has left; null until the check resolves.
  const [couponState, setCouponState] = useState<CouponState | null>(null)

  // When the chosen outlet can't reach the address, the nearest one that can.
  const switchTo =
    outsideZone && outlet && point ? nearestCoveringOutlet(outlets, outlet.id, point) : null
  const switchToFee = switchTo && point ? outletDelivery(switchTo, point.lat, point.lng).fee : null

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  const applied = offers.find((o) => o.coupon.code === appliedCode && o.available) ?? null
  // Priced off the live subtotal, so editing quantities re-prices the coupon —
  // and always off the food subtotal, never the delivery fee.
  const discount = applied ? couponDiscount(applied.coupon, subtotal) : 0
  const total = outsideZone ? 0 : Math.max(0, subtotal + deliveryFee - discount)

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

      const { data: address } = await supabase
        .from('addresses')
        .select('label, address, landmark, pincode, latitude, longitude')
        .eq('customer_id', user.id)
        .eq('is_default', true)
        .maybeSingle()

      if (!address) {
        router.push('/location?from=checkout')
        return
      }

      setCouponState(await loadCouponState(supabase, user.id))

      setAddressLabel(address.label)
      setAddressText(
        `${address.address}${address.landmark ? ', ' + address.landmark : ''} — ${address.pincode}`
      )

      setLoading(false)
    }

    load()
  }, [router])


  // Separate effect, keyed on subtotal — re-checks coupon eligibility once the
  // persisted cart store finishes hydrating (subtotal starts at 0 on first
  // render) and whenever quantities change afterwards.
  useEffect(() => {
    let cancelled = false
    const lookup =
      subtotal <= 0 || couponState === null
        ? Promise.resolve([] as CouponOffer[])
        : listCoupons(createClient(), subtotal, couponState)
    lookup.then((list) => {
      if (cancelled) return
      setOffers(list)
      // Auto-apply the top offer until the customer chooses for themselves,
      // then respect their pick — re-validating it as the cart changes.
      setAppliedCode((prev) => {
        if (!touchedCoupon) return defaultOffer(list)?.coupon.code ?? null
        return list.some((o) => o.coupon.code === prev && o.available) ? prev : null
      })
    })
    return () => {
      cancelled = true
    }
  }, [subtotal, couponState, touchedCoupon])

  if (loading) {
    return (
      <div className="min-h-[100dvh] phone-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="w-10 h-10 border-4 border-[#b51c00] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col items-center justify-center bg-[#f8f9fa] px-5">
        <span className="text-5xl mb-4">🛒</span>
        <p className="text-[#586062] mb-6">Your cart is empty</p>
        <Link
          href="/menu"
          className="h-12 px-8 bg-[#b51c00] text-white font-semibold rounded-lg flex items-center"
        >
          Browse Menu
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center gap-3 border-b border-[#e1e3e4]">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ChevronLeft className="size-5 text-[#191c1d]" />
        </button>
        <h1 className="text-base font-bold text-[#b51c00]">View Cart</h1>
      </header>

      {/* Address bar */}
      <Link
        href="/location?from=checkout"
        className="bg-white px-4 py-3 flex items-center gap-3 border-b border-[#e1e3e4]"
      >
        <div className="w-8 h-8 rounded-full bg-[#ffdad3] flex items-center justify-center flex-shrink-0">
          <MapPin className="size-4 text-[#b51c00]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#191c1d]">Delivering to {addressLabel}</p>
          <p className="text-xs text-[#586062] truncate">{addressText}</p>
        </div>
        <ChevronRight className="size-4 text-[#9ea3a5] flex-shrink-0" />
      </Link>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-4">
        {/* Which outlet is cooking this order */}
        {outlet && (
          <OutletPicker
            outlets={outlets}
            selected={outlet}
            point={point}
            onSelect={selectOutlet}
            variant="row"
          />
        )}

        {/* Coupon row — opens the full list, Swiggy-style */}
        {offers.length > 0 && !outsideZone && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="w-full bg-[#fff3ea] border border-[#ffd9b8] rounded-xl p-3.5 flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#ffe2c2] flex items-center justify-center flex-shrink-0">
                <Tag className="size-4 text-[#9c5a1f]" />
              </div>
              <span className="text-xs font-bold text-[#663c14] truncate">
                {applied
                  ? `${applied.coupon.code} applied — saved ₹${discount}`
                  : `${couponLabel(offers[0].coupon)} · ${offers.length} coupon${
                      offers.length > 1 ? 's' : ''
                    } available`}
              </span>
            </div>
            <span className="px-3 h-8 text-xs font-bold rounded-lg flex-shrink-0 flex items-center gap-1 bg-[#4a3b1e] text-white">
              {applied && <CheckCircle2 className="size-3.5" />}
              {applied ? 'Change' : 'View all'}
            </span>
          </button>
        )}

        {/* Cart items */}
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
          {items.map((item) => (
            <div key={item.product.id} className="flex items-center gap-3 py-2.5 border-b border-[#f3f4f5] last:border-0">
              <div className="w-12 h-12 rounded-lg bg-[#f3f4f5] overflow-hidden flex-shrink-0">
                {item.product.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.product.photo_url} alt={item.product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full flex items-center justify-center text-lg">🍽️</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#191c1d] truncate">{item.product.name}</p>
                <p className="text-xs text-[#586062]">₹{item.product.price}</p>
              </div>
              <div className="flex items-center gap-3 border border-[#e1e3e4] rounded-full px-1 h-8">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  className="w-6 h-6 flex items-center justify-center text-[#b51c00]"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="text-sm font-bold text-[#191c1d] w-4 text-center">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  className="w-6 h-6 flex items-center justify-center text-[#b51c00]"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
          <Link href="/menu" className="flex items-center justify-center gap-1.5 h-10 mt-1 text-sm font-semibold text-[#b51c00]">
            <Plus className="size-4" />
            Add more items
          </Link>
        </div>

        {/* Bill summary */}
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
          <h2 className="text-sm font-bold text-[#191c1d] mb-3">Bill Summary</h2>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[#586062]">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            <div className="flex justify-between text-xs text-[#586062]">
              <span>
                Delivery Fee
                {distanceKm != null && (
                  <span className="ml-1 text-[#b51c00] font-semibold">(~{distanceKm.toFixed(1)} km)</span>
                )}
              </span>
              <span className={outsideZone ? 'text-red-500 font-semibold' : ''}>
                {outsideZone ? 'N/A' : `₹${deliveryFee}`}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                <span>Coupon Discount</span>
                <span>-₹{discount}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-[#191c1d] pt-1.5 border-t border-[#e1e3e4] mt-1.5">
              <span>Total</span>
              <span className="text-[#b51c00]">{outsideZone ? '—' : `₹${total}`}</span>
            </div>
          </div>
        </div>

        {outsideZone && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-700">
                {outlet ? `${outletLabel(outlet)} doesn't deliver here` : 'Outside delivery zone'}
              </p>
              {/* Another outlet may well cover this address — offer the switch
                  rather than sending the customer away. */}
              {switchTo ? (
                <>
                  <p className="text-xs text-red-600 mt-0.5">
                    {outletLabel(switchTo)} delivers to your address
                    {switchToFee != null && ` for ₹${switchToFee}`}.
                  </p>
                  <button
                    onClick={() => selectOutlet(switchTo.id)}
                    className="mt-2 h-9 px-4 bg-[#b51c00] text-white text-xs font-bold rounded-lg"
                  >
                    Switch to {outletLabel(switchTo)}
                  </button>
                </>
              ) : (
                <p className="text-xs text-red-600 mt-0.5">
                  None of our outlets deliver this far. Please choose a closer address.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {sheetOpen && (
        <CouponSheet
          offers={offers}
          appliedCode={applied?.coupon.code ?? null}
          onApply={(offer) => {
            setTouchedCoupon(true)
            setAppliedCode(offer?.coupon.code ?? null)
            setSheetOpen(false)
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {/* Sticky bottom: payment options + pay button */}
      <div className="sticky bottom-0 bg-white border-t border-[#e1e3e4] px-4 py-3">
        {outsideZone ? (
          <Link
            href="/location?from=checkout"
            className="w-full h-14 bg-[#191c1d] text-white font-bold rounded-xl flex items-center justify-center"
          >
            Update Delivery Location
          </Link>
        ) : (
          <Link
            href={applied ? `/checkout/payment?coupon=${applied.coupon.code}` : '/checkout/payment'}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CreditCard className="size-4 text-[#b51c00] flex-shrink-0" />
              <span className="text-xs font-semibold text-[#586062] flex items-center gap-0.5">
                Pay via UPI
                <ChevronRight className="size-3.5" />
              </span>
            </div>
            <div className="px-6 h-12 bg-[#b51c00] text-white font-bold rounded-xl flex items-center flex-shrink-0">
              Pay ₹{total}
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
