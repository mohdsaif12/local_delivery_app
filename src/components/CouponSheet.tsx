'use client'

import { X, Tag, CheckCircle2, Lock } from 'lucide-react'
import { couponLabel, type CouponOffer } from '@/lib/coupons'

/**
 * The full coupon list, opened from the checkout banner. Offers the cart has
 * already qualified for come with an APPLY button; the rest stay visible but
 * locked, so the customer can see what a slightly bigger order would unlock.
 */
export default function CouponSheet({
  offers,
  appliedCode,
  onApply,
  onClose,
}: {
  offers: CouponOffer[]
  appliedCode: string | null
  onApply: (offer: CouponOffer | null) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close coupons"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div className="relative bg-[#f8f9fa] rounded-t-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 h-14 border-b border-[#e1e3e4] bg-white rounded-t-2xl">
          <h2 className="text-base font-bold text-[#191c1d]">Available Coupons</h2>
          <button type="button" onClick={onClose} className="p-1 -mr-1">
            <X className="size-5 text-[#586062]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {offers.length === 0 && (
            <p className="text-sm text-[#586062] text-center py-10">
              No coupons available right now. Check back soon!
            </p>
          )}

          {offers.map(({ coupon, discount, available, reason }) => {
            const applied = appliedCode === coupon.code
            return (
              <div
                key={coupon.code}
                className={`bg-white rounded-xl p-3.5 border ${
                  applied ? 'border-emerald-500' : 'border-[#e1e3e4]'
                } ${available ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#ffe2c2] flex items-center justify-center flex-shrink-0">
                      {available ? (
                        <Tag className="size-4 text-[#9c5a1f]" />
                      ) : (
                        <Lock className="size-3.5 text-[#9c5a1f]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[#191c1d] tracking-wide">
                        {coupon.code}
                      </p>
                      <p className="text-xs text-[#586062] mt-0.5">{couponLabel(coupon)}</p>
                      <p className="text-[11px] text-[#9ea3a5] mt-1">
                        {reason ?? `Saves ₹${discount} on this order`}
                      </p>
                    </div>
                  </div>

                  {available && (
                    <button
                      type="button"
                      onClick={() => onApply(applied ? null : { coupon, discount, available, reason })}
                      className={`px-3.5 h-8 text-xs font-bold rounded-lg flex-shrink-0 flex items-center gap-1 ${
                        applied ? 'bg-emerald-600 text-white' : 'bg-[#4a3b1e] text-white'
                      }`}
                    >
                      {applied && <CheckCircle2 className="size-3.5" />}
                      {applied ? 'APPLIED' : 'APPLY'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-4 py-3 bg-white border-t border-[#e1e3e4]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-[#b51c00] text-white text-sm font-bold rounded-xl"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
