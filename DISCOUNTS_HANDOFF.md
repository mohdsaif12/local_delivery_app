# Discounts / Coupons Handoff

How offers work today, and what still needs building so the admin can create
them from the dashboard instead of asking a developer to write SQL.

---

## 1. Run these migrations first

In Supabase → SQL Editor, run in order (both are safe to re-run):

```
supabase/migrations/024_percent_coupons.sql
supabase/migrations/025_once_per_customer_coupons.sql
```

`024` adds percentage offers (`discount_percent`, `max_discount`) and the
`first_order_only` flag. `025` adds `once_per_customer`, a `description` field,
the redemption index, seeds the two live welcome offers, and — importantly —
gives the `restaurant` role full read/write on `coupons` so the dashboard UI can
manage them.

---

## 2. The `coupons` table

| Column | Meaning |
|---|---|
| `code` | Unique code, e.g. `WELCOME10`. Shown to the customer. |
| `discount_amount` | Flat rupees off. Use `0` for percentage offers. |
| `discount_percent` | `1`–`100`, or `NULL` for flat offers. |
| `max_discount` | Rupee cap on a percentage offer. Required when `discount_percent` is set. |
| `min_order_value` | Minimum food subtotal (delivery fee excluded) for the offer to appear. |
| `first_order_only` | `true` = only on the customer's very first order, ever. |
| `once_per_customer` | `true` = each customer may redeem this code exactly once. |
| `is_active` | The on/off switch. `false` hides it from every customer instantly. |
| `description` | Optional banner text. If empty the app generates one, e.g. "10% off up to ₹100". |

A row is either **flat** (`discount_amount > 0`, `discount_percent NULL`) or
**percentage** (`discount_percent` 1–100 **and** `max_discount > 0`). The
`coupons_shape_check` constraint rejects anything else, so a half-filled form
fails loudly rather than silently discounting ₹0.

### Currently live

| Code | Offer | Rule |
|---|---|---|
| `WELCOME10` | 10% off, capped at ₹100, min order ₹100 | once per customer |
| `SAVE50` | Flat ₹50 off, min order ₹299 | once per customer |
| `FLAT50` | old flat ₹50 | deactivated by `024` |

A brand-new customer therefore gets **both** offers — one per order, best-value
first — and after both are spent they see nothing until the admin runs a new one.
Example journey: ₹400 order → `SAVE50` −₹50; ₹1200 order → `WELCOME10` −₹100;
every order after → no offer.

---

## 3. How the customer app picks an offer

All the logic is in [src/lib/coupons.ts](src/lib/coupons.ts) — the dashboard
should not duplicate it.

1. `loadCouponState(supabase, customerId)` — one query over the customer's
   orders returning `{ firstOrder, usedCodes }`. **Redemptions are read from
   `orders.coupon_code`**; there is no separate ledger table.
2. `bestCoupon(supabase, subtotal, state)` — fetches active coupons where
   `min_order_value <= subtotal`, drops the ones this customer has used up
   (`isCouponEligible`), prices each with `couponDiscount()`, returns the one
   that saves the most.
3. `couponDiscount(coupon, subtotal)` — percentage offers are floored and capped
   at `max_discount`; no offer ever exceeds the subtotal.

Consumed by [checkout/page.tsx](src/app/checkout/page.tsx) (the banner and the
Apply button) and [checkout/payment/page.tsx](src/app/checkout/payment/page.tsx),
which re-validates before writing `coupon_code` and `discount_amount` onto the
order — a customer pasting `?coupon=SAVE50` a second time gets ₹0.

**Only one coupon applies per order.** Offers do not stack.

Because the customer app reads `coupons` on every checkout, anything the admin
saves is live immediately — no deploy, no cache to clear.

---

## 4. What to build: the dashboard Offers tab

Add an **Offers** tab to
[src/components/DashboardClient.tsx](src/components/DashboardClient.tsx),
alongside the existing order-management tabs. It is plain CRUD on `coupons`;
RLS already permits it for `role = 'restaurant'`.

### List view
Every coupon, active first. Per row: code, a human summary of the offer
(reuse `couponLabel()` from `src/lib/coupons.ts`), min order, the usage rule,
an active/inactive toggle, and Edit / Delete.

The toggle should write `is_active` directly — that is the admin's fastest lever
for stopping an offer that is costing too much.

### Create / Edit form
```
Code                    text, uppercase, unique          → code
Offer type              [ Flat ₹ off | % off ]
  if Flat:  Amount ₹    number > 0                       → discount_amount
  if %:     Percent     number 1–100                     → discount_percent
            Max ₹ off   number > 0                       → max_discount
Minimum order ₹         number ≥ 0                       → min_order_value
Who can use it          [ Everyone, every order
                        | New customers only (first order)   → first_order_only
                        | Once per customer ]                → once_per_customer
Banner text (optional)  text                             → description
Active                  toggle                           → is_active
```

Validation to enforce in the form, matching the DB constraint:
- flat → `discount_amount > 0`, send `discount_percent` and `max_discount` as `NULL`
- percent → `discount_percent` 1–100 **and** `max_discount > 0`, send `discount_amount` as `0`
- code must be unique — surface the Postgres `23505` unique-violation as
  "That code already exists" rather than a raw error toast.

### Usage stats (nice to have)
`orders.coupon_code` already carries every redemption, so a per-coupon
redemption count and total rupees discounted is one grouped query — worth
showing next to each row so the admin can see what an offer actually cost.

```sql
SELECT coupon_code, COUNT(*) AS redemptions, SUM(discount_amount) AS total_off
FROM public.orders
WHERE coupon_code IS NOT NULL
GROUP BY coupon_code
ORDER BY total_off DESC;
```

---

## 5. Known gaps

- **Cancelled orders still consume a one-time coupon.** Redemption is read from
  `orders.coupon_code` regardless of status. If a refunded customer should get
  their code back, filter `status <> 'cancelled'` in `loadCouponState()`.
- **No expiry dates.** Offers are switched off by hand via `is_active`. If
  scheduled offers are wanted, add `starts_at` / `ends_at` columns and filter on
  them in `bestCoupon()` as well as in the dashboard list.
- **No global redemption budget.** There is no "first 100 customers only" cap;
  an offer runs until the admin turns it off.
- **Offers never stack** — by design, but worth confirming with the owner.
