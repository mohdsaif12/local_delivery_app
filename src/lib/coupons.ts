import type { SupabaseClient } from '@supabase/supabase-js'

export interface Coupon {
  code: string
  discount_amount: number
  discount_percent: number | null
  max_discount: number | null
  min_order_value: number
  first_order_only: boolean
  once_per_customer: boolean
  /** Optional admin-written banner text; falls back to a generated label. */
  description: string | null
}

export const COUPON_FIELDS =
  'code, discount_amount, discount_percent, max_discount, min_order_value, first_order_only, once_per_customer, description'

/** What this customer has already used up — decides which offers still apply. */
export interface CouponState {
  /** True when they have never placed an order (welcome offers). */
  firstOrder: boolean
  /** Codes they have already redeemed (one-time offers). */
  usedCodes: string[]
}

/** Nothing available — the safe default while the check is still loading. */
export const NO_OFFERS: CouponState = { firstOrder: false, usedCodes: [] }

/**
 * What a coupon actually takes off this subtotal. Percentage coupons are
 * rounded down and never exceed max_discount; flat coupons never exceed the
 * subtotal itself. Returns 0 when the cart is below the minimum order value.
 */
export function couponDiscount(coupon: Coupon | null, subtotal: number): number {
  if (!coupon || subtotal < coupon.min_order_value) return 0

  if (coupon.discount_percent) {
    const raw = Math.floor((subtotal * coupon.discount_percent) / 100)
    const cap = coupon.max_discount ?? raw
    return Math.max(0, Math.min(raw, cap, subtotal))
  }

  return Math.max(0, Math.min(coupon.discount_amount, subtotal))
}

/**
 * The customer's order history, reduced to the two facts offers depend on.
 * One query serves both — redemptions are read off orders.coupon_code rather
 * than a separate ledger, so an order that carried a code has consumed it.
 */
export async function loadCouponState(
  supabase: SupabaseClient,
  customerId: string
): Promise<CouponState> {
  const { data, error } = await supabase
    .from('orders')
    .select('coupon_code')
    .eq('customer_id', customerId)

  // On error assume everything is spent, so an offer is never given away twice.
  if (error || !data) return NO_OFFERS

  return {
    firstOrder: data.length === 0,
    usedCodes: data.map((o) => o.coupon_code).filter((c): c is string => !!c),
  }
}

/** Whether this customer may still use this coupon at all. */
export function isCouponEligible(coupon: Coupon, state: CouponState): boolean {
  if (coupon.first_order_only && !state.firstOrder) return false
  if (coupon.once_per_customer && state.usedCodes.includes(coupon.code)) return false
  return true
}

/**
 * The best offer this customer can use right now. Coupons they have used up —
 * a welcome offer after their first order, a one-time offer after redeeming it
 * — are filtered out, leaving only what the admin still has running for them.
 */
export async function bestCoupon(
  supabase: SupabaseClient,
  subtotal: number,
  state: CouponState
): Promise<{ coupon: Coupon; discount: number } | null> {
  const { data } = await supabase
    .from('coupons')
    .select(COUPON_FIELDS)
    .eq('is_active', true)
    .lte('min_order_value', subtotal)

  return (
    ((data ?? []) as Coupon[])
      .filter((c) => isCouponEligible(c, state))
      .map((coupon) => ({ coupon, discount: couponDiscount(coupon, subtotal) }))
      .filter((c) => c.discount > 0)
      .sort((a, b) => b.discount - a.discount)[0] ?? null
  )
}

/** Human label for the banner, e.g. "10% off up to ₹100" or "Flat ₹50 off". */
export function couponLabel(coupon: Coupon): string {
  if (coupon.description) return coupon.description
  if (coupon.discount_percent) {
    return coupon.max_discount
      ? `${coupon.discount_percent}% off up to ₹${coupon.max_discount}`
      : `${coupon.discount_percent}% off`
  }
  return `Flat ₹${coupon.discount_amount} off`
}
