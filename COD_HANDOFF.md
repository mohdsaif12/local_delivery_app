# Cash on Delivery (COD) — Handoff for Dashboard & Rider App

This explains how COD works so the **dashboard** and **rider app** display and handle it
correctly. The security rule ("COD only after 3 delivered orders") is **already enforced
in the database** — you do NOT need to re-build that logic. You just need to **show COD
and handle cash collection.**

---

## 1. The rule (already enforced — don't re-implement)

- A customer can only choose **Cash on Delivery after they have 3 delivered orders.**
- This is enforced **server-side by a Postgres trigger** (`migrations/019_cod_enforcement.sql`),
  so the database itself rejects any COD order from a customer with fewer than 3 delivered
  orders — no matter which app or method tries to create it.
- **Your apps do not need to check the "3 orders" rule.** Trust the database. Just read the
  order and display it. If a COD order exists in the DB, it's legitimately COD.

---

## 2. Data model — NO new table, NO schema change

COD reuses the existing `orders` table. An order is Cash-on-Delivery when:

```js
order.delivery_address.payment === 'cod'
```

| Field | COD order | UPI order |
|-------|-----------|-----------|
| `delivery_address.payment` | `'cod'` | `'upi'` |
| `payment_status` | `'verified'` (nothing to verify online) | `'pending_verification'` then `'verified'` |
| `utr_number` | `null` | the customer's UPI transaction ID |
| `total` | amount to collect in cash | already paid online |

> `delivery_address` is a JSON (JSONB) column. `payment` is a key inside it.
> Everything else about the order (items, status flow, addresses) is identical to UPI.

---

## 3. What the DASHBOARD needs to do

1. **Detect COD:** `order.delivery_address?.payment === 'cod'`
2. **Show a clear badge** on the order card, e.g.:
   `💵 Cash on Delivery — collect ₹{order.total} on delivery`
3. **Skip the UTR / payment-verification UI** for COD orders (there is no UTR).
4. **Accept / prepare flow is identical** to UPI — the restaurant still accepts the order
   and advances it (pending → preparing → ready → out_for_delivery → delivered).
5. (Optional polish) The accept button can say "Accept Order" instead of "Verify Payment
   & Accept" when it's COD.

> Reference: the in-repo restaurant dashboard (`src/components/DashboardClient.tsx`)
> already implements this badge — copy that pattern if your dashboard is separate.

---

## 4. What the RIDER APP needs to do

1. **Detect COD:** same check — `order.delivery_address?.payment === 'cod'`
2. **Show the rider a prominent "COLLECT CASH ₹{order.total}" banner** on the order /
   delivery screen, so they know to take money at the door.
3. For **UPI orders, show "PAID — do not collect cash"** so riders don't ask for money on
   already-paid orders.
4. Mark delivered as usual when the order is handed over. (No special payment field to
   update — cash handling is offline. If you later want to track "cash collected", add a
   boolean column, but it's not required for launch.)

---

## 5. Order status timestamps (bonus — already in the DB)

The `orders` table records the time each stage was reached (set automatically):
`created_at`, `accepted_at`, `ready_at`, `picked_up_at`, `delivered_at`, `cancelled_at`.
Use these if you want to show timelines in the dashboard / rider app.

---

## 6. Things NOT to do

- ❌ Don't create a new table or new columns for COD — it's all in `delivery_address.payment`.
- ❌ Don't re-implement the "3 delivered orders" check in the app — the database enforces it.
- ❌ Don't treat COD as "unpaid/failed" — it's a valid order; payment happens on delivery.
- ❌ Don't show a UTR field or "verify payment" step for COD orders.

---

## 7. Quick test

- A customer with **< 3 delivered orders** will only see UPI in the customer app, and the
  database will reject any COD order for them (a `check_violation` error).
- A customer with **≥ 3 delivered orders** can pick COD; the order appears with
  `delivery_address.payment = 'cod'`, `utr_number = null`, `payment_status = 'verified'`.
- Confirm your dashboard/rider app shows the "collect cash ₹{total}" badge for that order.

Questions on the data shape? Look at any COD order row in Supabase → Table Editor → `orders`,
and expand the `delivery_address` JSON to see the `payment` field.
