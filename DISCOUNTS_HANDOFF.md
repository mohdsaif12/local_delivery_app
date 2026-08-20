# Discounts / Coupons Handoff

How offers work today, and what still needs building so the admin can create
them from the dashboard instead of asking a developer to write SQL.

---

## 1. Run these migrations first

In Supabase → SQL Editor, run in order (both are safe to re-run):

```
supabase/migrations/024_percent_coupons.sql
supabase/migrations/025_once_per_customer_coupons.sql
supabase/migrations/026_names_and_coupon_list.sql
```

`024` adds percentage offers (`discount_percent`, `max_discount`) and the
`first_order_only` flag. `025` adds `once_per_customer`, a `description` field,
the redemption index, and — importantly — gives the `restaurant` role full
read/write on `coupons` so the dashboard UI can manage them. `026` adds
`sort_order` (which drives the customer's coupon list) and seeds the live
line-up, plus `first_name` / `last_name` on `profiles`.

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
| `sort_order` | Position in the customer's coupon list. Lowest shows first — and is the one applied by default. |

A row is either **flat** (`discount_amount > 0`, `discount_percent NULL`) or
**percentage** (`discount_percent` 1–100 **and** `max_discount > 0`). The
`coupons_shape_check` constraint rejects anything else, so a half-filled form
fails loudly rather than silently discounting ₹0.

### Currently live

| Code | Offer | Min order | Rule | `sort_order` |
|---|---|---|---|---|
| `WELCOME10` | 10% off, capped at ₹100 | ₹100 | once per customer | 10 |
| `SAVE50` | Flat ₹50 off | ₹349 | once per customer | 20 |
| `SAVE100` | Flat ₹100 off | ₹699 | once per customer | 30 |
| `FLAT50` | old flat ₹50 | — | deactivated by `024` | — |

Every threshold is the **food subtotal**. The delivery fee is never discounted
and never counts towards `min_order_value`.

Each customer can use all three — one per order, each once. `WELCOME10` has the
lowest `sort_order`, so it is what shows applied before they open the coupon
sheet, exactly as asked. To make an offer repeatable, set
`once_per_customer = false` on its row.

---

## 3. How the customer app picks an offer

All the logic is in [src/lib/coupons.ts](src/lib/coupons.ts) — the dashboard
should not duplicate it.

1. `loadCouponState(supabase, customerId)` — one query over the customer's
   orders returning `{ firstOrder, usedCodes }`. **Redemptions are read from
   `orders.coupon_code`**; there is no separate ledger table.
2. `listCoupons(supabase, subtotal, state)` — every active coupon this customer
   still owns, in `sort_order`. Offers whose minimum the cart hasn't reached are
   included but marked `available: false` with a reason ("Add ₹49 more to
   unlock"), so the sheet can show them locked. Offers they can never use again
   are dropped entirely.
3. `defaultOffer(offers)` — the first *available* offer in list order, **not**
   the largest. That is what gets auto-applied until the customer picks
   something else from the sheet.
4. `couponDiscount(coupon, subtotal)` — percentage offers are floored and capped
   at `max_discount`; no offer ever exceeds the subtotal.

The UI is [CouponSheet.tsx](src/components/CouponSheet.tsx), opened from the
coupon row in [checkout/page.tsx](src/app/checkout/page.tsx).
[checkout/payment/page.tsx](src/app/checkout/payment/page.tsx) re-validates the
code before writing `coupon_code` and `discount_amount` onto the order — a
customer pasting `?coupon=SAVE50` a second time gets ₹0.

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
an active/inactive toggle, and Edit / Delete. Sort the list by `sort_order` —
that is the order customers see, and the top eligible row is the one applied by
default, so it is worth making obvious in the UI.

The toggle should write `is_active` directly — that is the admin's fastest lever
for stopping an offer that is costing too much.

### Create / Edit form
```
Code                    text, uppercase, unique          → code
Offer type              [ Flat ₹ off | % off ]
  if Flat:  Amount ₹    number > 0                       → discount_amount
  if %:     Percent     number 1–100                     → discount_percent
            Max ₹ off   number > 0                       → max_discount
Minimum order ₹         number ≥ 0 (food subtotal)       → min_order_value
List position           number, lowest shows first       → sort_order
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
