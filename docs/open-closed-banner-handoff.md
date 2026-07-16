# Handoff — Restaurant Open/Closed logic & banner

**For:** whoever maintains the dashboard
**Why:** the customer app now decides "open vs closed" differently. The dashboard
currently disagrees with it, and should be brought in line.

---

## 1. The thing you need to know first

**There is no automatic open/close in the database.**

We assumed there was, and checked. There is exactly one cron job:

```
jobname  : auto-turn-on-dishes-job
schedule : * * * * *        (every minute)
command  : SELECT auto_turn_on_dishes();
```

…and that function only touches **products**, not the restaurant:

```sql
UPDATE products
SET is_available = true, next_available_at = null
WHERE is_available = false
  AND next_available_at IS NOT NULL
  AND next_available_at <= NOW();
```

It re-enables individual **dishes** whose "back in stock" time has passed.
**Nothing ever sets `restaurants.is_open = false` on a schedule.**

Consequence: if you trust `is_open` alone, the shop reads **Open at 5am** and
accepts orders all night. That's the bug this change fixes.

---

## 2. The rule

Open/closed is derived from **three** columns on `public.restaurants`:

| Column | Meaning |
|---|---|
| `opening_time` | e.g. `10:00:00` |
| `closing_time` | e.g. `02:00:00` (**note: wraps past midnight**) |
| `is_open` | the manual toggle staff flip in the dashboard |

**The clock wins, then the switch:**

```
if (now is OUTSIDE opening_time..closing_time)  -> CLOSED, reason = "hours"
else if (is_open == false)                      -> CLOSED, reason = "manual"
else                                            -> OPEN
```

The manual switch can only **close early**. It cannot extend past `closing_time`
— to trade later, change `closing_time`.

---

## 3. Banner wording (customer app)

| Reason | Message | Colour |
|---|---|---|
| `manual` (switched off during opening hours) | **Temporarily Closed · Back in 1–2 hrs** | amber |
| `hours` (outside opening hours) | **We're Closed · Opens at 10:00 AM** | red |
| open | *(no banner)* | — |

Rationale: a close *during* business hours can only be a human, so it reads as
"back soon". A close *outside* business hours is just the normal schedule.

---

## 4. Reference implementation

Framework-agnostic. **The overnight wrap is the part people get wrong** —
`10:00 → 02:00` means "after 10:00 **OR** before 02:00", not "between".

```ts
type ClosedReason = 'manual' | 'hours' | null

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function isWithinHours(s: RestaurantSettings, now: Date): boolean {
  if (!s.opening_time || !s.closing_time) return true
  const mins  = now.getHours() * 60 + now.getMinutes()
  const open  = toMinutes(s.opening_time)
  const close = toMinutes(s.closing_time)
  // close > open  -> normal same-day window
  // close < open  -> overnight window that wraps past midnight
  return close > open ? mins >= open && mins < close : mins >= open || mins < close
}

function getClosedReason(s: RestaurantSettings | null, now: Date): ClosedReason {
  if (!s) return null                          // not loaded yet — assume open
  if (!isWithinHours(s, now)) return 'hours'   // clock wins
  if (!s.is_open) return 'manual'
  return null
}
```

### Re-check the clock every minute

Otherwise a page left open at 01:59 still says "Open" at 02:30:

```ts
const [now, setNow] = useState(() => new Date())
useEffect(() => {
  const id = setInterval(() => setNow(new Date()), 60_000)
  return () => clearInterval(id)
}, [])
```

`is_open` changes arrive instantly via the existing realtime subscription on
`restaurants`; only the *clock* needs polling.

---

## 5. What to change in the dashboard

The status card currently renders straight off `is_open`:

```tsx
{restaurantStatus.is_open ? '🟢 Restaurant is Open' : '🔴 Restaurant is Closed'}
```

At 05:00 that shows **"🟢 Restaurant is Open"** while every customer sees
**"Closed"**. Staff will think they're trading when they aren't.

**Required change:** run the same `getClosedReason()` and show the effective state:

| State | Suggested card |
|---|---|
| open | 🟢 Restaurant is Open |
| `manual` | 🟠 Temporarily Closed — *you* switched this off |
| `hours` | 🔴 Closed — outside opening hours (opens 10:00 AM) |

**Keep the toggle bound to `is_open`** — don't try to make it override the
schedule. But when closed for `hours`, the toggle should be visibly inert (a
hint like *"Outside opening hours — change closing time to trade later"*),
otherwise staff will flip it and wonder why nothing happens.

---

## 6. Test cases

Real values: `opening_time = 10:00`, `closing_time = 02:00`.

| Time | `is_open` | Expected |
|---|---|---|
| 16:59 | true | OPEN |
| 23:00 | true | OPEN |
| 01:59 | true | OPEN |
| 02:00 | true | CLOSED — "Opens at 10:00 AM" |
| 05:00 | true | CLOSED — "Opens at 10:00 AM" ← the bug being fixed |
| 09:59 | true | CLOSED — "Opens at 10:00 AM" |
| 10:00 | true | OPEN |
| 16:59 | false | CLOSED — "Back in 1–2 hrs" |
| 05:00 | false | CLOSED — "Opens at 10:00 AM" |

### Testing without waiting for 2am

```sql
-- force the "hours" banner (assuming it's currently evening)
update public.restaurants set closing_time = '22:00:00';

-- force the "manual" banner
update public.restaurants set is_open = false;

-- restore
update public.restaurants set closing_time = '02:00:00', is_open = true;
```

---

## 7. Optional: do it in the database instead

If staff should be able to toggle the shop open *outside* scheduled hours, then
instead of the app enforcing hours, add a cron job (alongside the existing
dishes one) that flips `is_open` on schedule:

```sql
select cron.schedule('open-shop',  '0 10 * * *', $$update public.restaurants set is_open = true$$);
select cron.schedule('close-shop', '0 2  * * *', $$update public.restaurants set is_open = false$$);
```

Then `is_open` becomes the single source of truth and clients just read it.
**Trade-off:** if cron fails or is paused, the shop silently stays open all
night — which is exactly the failure we're fixing. The app-side check has no
such failure mode. Pick one; don't do both, or they'll fight.

---

## Files changed in the customer app

- `src/app/menu/page.tsx` — `isWithinHours`, `getClosedReason`, 60s tick, banner
- `src/components/NavBar.tsx` — `closedReason` prop, status line wording
