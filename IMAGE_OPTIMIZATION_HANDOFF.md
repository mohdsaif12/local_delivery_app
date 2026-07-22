# Image Optimization Handoff — Wali Baba Foods

**Goal:** cut Supabase Storage egress by serving small WebP images instead of raw
multi-MB phone photos. This doc covers (1) what has already been converted, and
(2) how to make **every admin upload auto-convert to WebP** so we never re-bloat.

---

## 1. What has already been done

### Storage backlog converted (one-time)
The `menu-photos` bucket, folder `dishes` (all product photos), was converted
in place to WebP with a 1-year cache header:

| | |
|---|---|
| Images converted | **99 of 100** |
| Before | **349.04 MB** |
| After | **12.55 MB** |
| Saved | **336.48 MB (−96%)** |

- **URLs did not change.** The files keep their original names (e.g. `...abc.jpg`)
  but now contain WebP bytes and are served with `Content-Type: image/webp`.
  Browsers render by content-type, not extension, so **no DB update and no
  redeploy were needed** — the app already serves the smaller files.
- **1 file failed** on a transient upload error and was left untouched (still the
  original ~1.8 MB): `1784201205630-ajf1aoq6gw.jpg`. Harmless. To convert just
  that one without re-degrading the other 99, see §4.
- **Not yet done:** the hero folder `dishes/hero section photos`. Convert it the
  same way when ready (see §4).

### Bundled app images converted
The static PNGs in `public/` that the app references were converted to WebP and
the code references updated:

| File | Before | After |
|------|--------|-------|
| `public/hero/hero-1.webp` … `hero-4.webp` | ~3.2 MB total (PNG) | ~0.4 MB total |
| `public/location-hero.webp` | 651 KB (PNG) | 46 KB |

Old `.png` originals are still in `public/` (harmless deploy weight) — delete when
confident. `logo.png` and the PWA icons were **intentionally kept as PNG**
(transparency / manifest icons must stay PNG).

### The converter utility (already WebP)
`src/lib/compressImage.ts` — resizes to **1200px max**, encodes **WebP q0.8**
(JPEG fallback on ancient browsers), and skips re-encoding if it wouldn't help.
This is the function every upload should call.

### Reference upload (already wired correctly)
`src/components/HeroImagesManager.tsx` (banner uploads) is the working example:
it compresses before upload **and** sets the 1-year cache header. Copy this
pattern for product photos.

---

## 2. What you need to do: auto-convert admin uploads

Wherever the admin picks a file to set a product's `photo_url` (the menu-item
add/edit form), wrap the upload so it (a) compresses to WebP first and (b) sets a
long cache header. The `compressImage` helper already exists — just call it.

### The pattern (mirror of HeroImagesManager)

```ts
import { compressImage, formatBytes } from '@/lib/compressImage'
import { createClient } from '@/lib/supabase/client'

const BUCKET = 'menu-photos'
const supabase = createClient()

async function handleUpload(file: File) {
  // 1. Compress in the browser BEFORE it ever reaches Storage.
  //    A 17 MB camera photo becomes ~150–250 KB WebP with no visible loss.
  const compressed = await compressImage(file)          // -> WebP File
  console.log(`${formatBytes(file.size)} -> ${formatBytes(compressed.size)}`)

  // 2. Optional guard: reject anything still too big after compression.
  const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
  if (compressed.size > MAX_BYTES) {
    throw new Error(`Still too large (${formatBytes(compressed.size)}). Use a smaller photo.`)
  }

  // 3. Upload with the correct content type + a 1-YEAR immutable cache header.
  //    UUID filenames are immutable, so long caching is safe and cuts egress.
  const ext = compressed.name.split('.').pop() || 'webp'
  const path = `dishes/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, {
      contentType: compressed.type,   // 'image/webp'
      upsert: false,
      cacheControl: '31536000',       // 1 year — THIS is what stops re-downloads
    })
  if (upErr) throw upErr

  // 4. Save the public URL on the product row.
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  // await supabase.from('products').update({ photo_url: pub.publicUrl }).eq('id', productId)
  return pub.publicUrl
}
```

### The three things that matter
1. **`await compressImage(file)`** before upload — turns 10–30 MB originals into
   ~150–250 KB WebP. This is 95%+ of the win.
2. **`cacheControl: '31536000'`** on `.upload()` — without it Supabase defaults to
   1 hour, so images re-download every hour. With it, repeat views are free.
3. **`contentType: compressed.type`** — so it's served as `image/webp`.

> ⚠️ If the product upload UI lives in a **separate dashboard project** (not this
> repo), copy `src/lib/compressImage.ts` into that project and apply the same
> three points. The function has no dependencies — it's pure browser canvas API.

---

## 3. Checklist for the dashboard

- [ ] Product add/edit photo upload → calls `compressImage()` before `.upload()`
- [ ] That `.upload()` sets `cacheControl: '31536000'` and `contentType`
- [ ] (Optional) reject > 2 MB after compression, with a friendly message
- [ ] Banner upload (`HeroImagesManager.tsx`) — ✅ already done in this repo
- [ ] Show admins the before→after size (`formatBytes`) so they trust it

---

## 4. Re-running the backlog script (for other folders / the 1 failure)

Script: `scripts/compress-storage-images.mjs`. It downloads each image in a
folder, converts to WebP@1200 q72, and re-uploads to the **same path** with a
1-year cache header. Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

```bash
cd restaurant-direct

# ALWAYS dry-run first (read-only, shows savings, changes nothing):
node --env-file=.env.local scripts/compress-storage-images.mjs menu-photos "dishes/hero section photos" --dry-run

# Apply for real:
node --env-file=.env.local scripts/compress-storage-images.mjs menu-photos "dishes/hero section photos"
```

**Rules:**
- **Run a folder only ONCE.** Re-encoding is lossy — running twice degrades
  quality. The `dishes` folder is already done; do **not** run it again.
- It overwrites in place (`upsert`). Consider downloading a backup of a folder
  from the Supabase Storage UI before applying.
- It's not recursive — run once per folder/subfolder.
- The 1 failed file above can be re-fetched by re-running the `dishes` folder,
  but that would re-compress the other 99. Not worth it for one ~1.8 MB file;
  easiest is to just re-upload that single dish's photo from the dashboard once
  the auto-converter (§2) is in place.

---

## 5. Why this matters (context)

The Storage was full of raw camera uploads — several were **30–38 MB each**.
Every customer menu load pulled full-size originals, which was almost certainly
the #1 Supabase egress cost. WebP + 1200px + 1-year cache brings a typical food
photo from ~2–4 MB to ~150 KB and makes repeat views free. The auto-converter in
§2 is what keeps it that way going forward.
