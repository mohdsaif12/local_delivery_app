# Handoff — Banners page is the **hero slideshow** manager

**To:** dashboard
**From:** customer app
**TL;DR:** the Banners page is wired up correctly, but it's presented as a
*promo/offer* tool. It only ever controls the **hero slideshow images** at the top
of the customer's menu screen. Title / subtitle / link are **not displayed
anywhere**. Below: what the app actually reads, and the UI changes that would make
the page match what it does.

---

## 1. What the customer app reads

Exactly one query, and it takes **`image_url` only**:

```sql
select image_url
from public.banners
where is_active = true
order by sort_order asc;
```

| Column | Used? | Notes |
|---|---|---|
| `image_url` | ✅ | the slideshow photo |
| `is_active` | ✅ | `false` = not shown |
| `sort_order` | ✅ | slide order, ascending |
| `title` | ❌ | **never rendered** |
| `subtitle` | ❌ | **never rendered** |
| `link_url` | ❌ | **not tappable** |

The hero has **fixed overlay text baked into the app** — a "★ Bestseller" pill and
the words "Authentic Awadhi Flavors". Those are hardcoded and are *not* driven by
`title`/`subtitle`. So a banner uploaded with the title *"Flat 20% off this
weekend"* shows the image, and the customer still reads "Authentic Awadhi Flavors"
over it.

---

## 2. ⚠️ The important bit: an all-or-nothing switch

Hero images resolve in priority order:

1. **Active rows in `banners`** — if there is **at least one**, these are the hero.
2. Otherwise: photos in Storage `menu-photos` → `dishes/hero section photos/`
   (currently **15 photos**, the ones live today).
3. Otherwise: 4 images bundled in the app.

**So the first banner anyone adds silently replaces all 15 current hero photos.**
Add one banner → the slideshow becomes that single image. Deactivate them all →
the 15 photos come back.

That's the single biggest thing the UI should communicate. Right now nothing warns
about it.

---

## 3. Requested UI changes

### a) Reframe the page
Call it **"Hero Slideshow"** (or "Home Banner"), not "Banners". Sub-label:
*"Photos that rotate at the top of the customer's menu screen."*

### b) Show what's currently live
The manager can't see what the hero looks like today. Please list the **current
hero images** on this page:

- If there are active `banners` rows → show those (already the case).
- If there are **none** → list the Storage folder and show them read-only, labelled
  something like *"Currently showing — 15 default photos"*:

```
bucket: menu-photos
path  : dishes/hero section photos/
```

```ts
const { data } = await supabase
  .storage.from('menu-photos')
  .list('dishes/hero section photos', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
// public URL:
supabase.storage.from('menu-photos').getPublicUrl(`dishes/hero section photos/${file.name}`)
```

### c) Warn before the first banner
When adding a banner while zero active rows exist:

> Adding a banner replaces the 15 default hero photos. Only your uploaded banners
> will show.

Optional but nicer: an **"Import current photos"** button that copies those 15 into
`banners` rows, so the manager edits from the existing set instead of starting
from an empty slideshow.

### d) Drop (or park) the unused fields
`title`, `subtitle`, `link_url` are dead weight and actively misleading — they
imply promo text that never appears. Either hide them, or label them *"not shown
in the app yet"*. **Keep the columns** (no migration needed); just remove them from
the form. If you'd rather keep the promo idea, tell us and we'll implement
title/subtitle/link on the customer side — but today they do nothing.

### e) Keep
- the **"Show in customer app"** toggle → `is_active` — works, maps correctly
- the **Add** button
- ordering via `sort_order` (drag-to-reorder would be ideal)

---

## 4. Image rules — please enforce on upload

This project already had a **171 MB** hero folder (one photo was **32 MB**), which
blew through egress and timed out queries. It's been compressed down to 4.33 MB.
Please don't let it regress:

| Rule | Value |
|---|---|
| Max width | **1600 px** |
| Format | JPEG, quality ~80 |
| Target size | **under 500 KB** (hard-reject over ~2 MB) |
| Shape | **Landscape / wide** |

**Landscape matters.** The hero is a short, full-width strip (~208 px tall) using
`object-cover`, so a portrait photo gets its top and bottom cropped off — faces and
garnish disappear. The current 15 photos are portrait and do crop; wide crops are
strongly preferred.

Bucket: **`banner-photos`** (public). Store the **public URL** in `image_url`.
Never base64 — the DB previously held 64 MB of base64 images and it caused
statement timeouts.

---

## 5. Behaviour notes

- The app loads the banner list **once on page load**. Realtime is enabled on the
  table, so we can make it live if you want instant updates — say the word.
- Slides crossfade every **4 seconds**, with dot indicators.
- Only the **current and next** slide are downloaded, so a long list doesn't cost
  the customer a huge download — but each individual image should still be small.
- A row with `is_active = false` is ignored entirely.

---

## 6. Quick test

1. With no active banners → hero shows the 15 Storage photos.
2. Add one banner, toggle on → hero becomes **only** that image.
3. Add two more, set `sort_order` 1/2/3 → they rotate in that order, 4s apart.
4. Toggle all off → the 15 photos return.
