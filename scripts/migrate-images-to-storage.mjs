// One-shot migration: move base64 images out of products.photo_url into
// Supabase Storage, and replace each photo_url with the public CDN URL.
//
// Why: products.photo_url currently holds ~64 MB of base64 image text across
// 52 rows, so every menu load ships the whole table. Moving images to Storage
// shrinks the table to a few KB and serves images from a CDN instead.
//
// Run:  node --env-file=.env.local scripts/migrate-images-to-storage.mjs
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (Dashboard -> Project
// Settings -> API -> service_role secret). This key bypasses RLS — never
// commit it or ship it to the browser.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'product-photos'

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function parseDataUri(dataUri) {
  // data:image/jpeg;base64,<payload>
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUri)
  if (!match) return null
  const mime = match[1].toLowerCase()
  const isBase64 = Boolean(match[2])
  const data = match[3]
  const buffer = isBase64 ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data))
  return { mime, buffer, ext: EXT_BY_MIME[mime] ?? 'bin' }
}

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw error
  if (buckets.some((b) => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" already exists.`)
    return
  }
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '25MB',
  })
  if (createErr) throw createErr
  console.log(`Created public bucket "${BUCKET}".`)
}

async function main() {
  await ensureBucket()

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, photo_url')
    .like('photo_url', 'data:%')

  if (error) throw error
  console.log(`Found ${products.length} products with embedded base64 images.\n`)

  let migrated = 0
  let failed = 0

  for (const p of products) {
    const parsed = parseDataUri(p.photo_url)
    if (!parsed) {
      console.warn(`  ! ${p.name} (${p.id}): could not parse data URI — skipped`)
      failed++
      continue
    }

    const path = `${p.id}.${parsed.ext}`
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, parsed.buffer, { contentType: parsed.mime, upsert: true })

    if (uploadErr) {
      console.error(`  ✗ ${p.name} (${p.id}): upload failed — ${uploadErr.message}`)
      failed++
      continue
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const { error: updateErr } = await supabase
      .from('products')
      .update({ photo_url: pub.publicUrl })
      .eq('id', p.id)

    if (updateErr) {
      console.error(`  ✗ ${p.name} (${p.id}): db update failed — ${updateErr.message}`)
      failed++
      continue
    }

    migrated++
    const kb = (parsed.buffer.length / 1024).toFixed(0)
    console.log(`  ✓ ${p.name} — ${kb} KB -> ${path}`)
  }

  console.log(`\nDone. Migrated ${migrated}, failed ${failed}.`)
  console.log('Next: run  VACUUM FULL public.products;  in the SQL Editor to reclaim disk space.')
}

main().catch((e) => {
  console.error('\nMigration aborted:', e.message)
  process.exit(1)
})
