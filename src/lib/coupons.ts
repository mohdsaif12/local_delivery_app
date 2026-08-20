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
  /** Position in the customer's coupon list. Lowest is shown — and applied — first. */
  sort_order: number
}

export const COUPON_FIELDS =
  'code, discount_amount, discount_percent, max_discount, min_order_value, first_order_only, once_per_customer, description, sort_order'

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

/** One row of the coupon sheet: the offer, what it saves, and whether it applies yet. */
export interface CouponOffer {
  coupon: Coupon
  /** What it would take off this cart — 0 while the cart is below its minimum. */
  discount: number
  /** True when it can be applied right now. */
  available: boolean
  /** Why it can't be applied yet, e.g. "Add ₹49 more to unlock". */
  reason: string | null
}

/**
 * Every offer this customer still owns, in the admin's sort_order — including
 * the ones their cart hasn't reached yet, which the sheet shows locked so they
 * can see what spending a little more would unlock.
 *
 * Offers they can never use again (a welcome offer after their first order, a
 * one-time offer already redeemed) are left out entirely.
 *
 * NOTE: every threshold is measured against the food subtotal. The delivery fee
 * is never discounted and never counts towards min_order_value.
 */
export async function listCoupons(
  supabase: SupabaseClient,
  subtotal: number,
  state: CouponState
): Promise<CouponOffer[]> {
  const { data } = await supabase
    .from('coupons')
    .select(COUPON_FIELDS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true })

  return ((data ?? []) as Coupon[])
    .filter((coupon) => isCouponEligible(coupon, state))
    .map((coupon) => {
      const discount = couponDiscount(coupon, subtotal)
      const short = coupon.min_order_value - subtotal
      return {
        coupon,
        discount,
        available: discount > 0,
        reason: short > 0 ? `Add ₹${short} more to unlock` : null,
      }
    })
}

/**
 * The offer applied by default — the first one in the admin's order that the
 * cart already qualifies for, not the largest. The 10% coupon sits at the top
 * of the list, so that is what a customer sees applied before they open the
 * sheet and pick something else.
 */
export function defaultOffer(offers: CouponOffer[]): CouponOffer | null {
  return offers.find((o) => o.available) ?? null
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
