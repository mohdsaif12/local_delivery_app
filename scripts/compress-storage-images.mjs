// Compress images already sitting in a Supabase Storage folder, in place.
//
// Downloads each image, resizes it to a sane display size, re-encodes it as
// JPEG, and re-uploads it under the SAME name — so every existing public URL
// keeps working and nothing else needs to change.
//
// Setup:
//   npm i -D sharp
//   add SUPABASE_SERVICE_ROLE_KEY to .env.local
//     (Dashboard -> Project Settings -> API -> service_role secret)
//
// Run (defaults to the hero folder):
//   node --env-file=.env.local scripts/compress-storage-images.mjs
//
// Or target any bucket/folder:
//   node --env-file=.env.local scripts/compress-storage-images.mjs menu-photos dishes
//
// Add --dry-run to preview the savings without changing anything.

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
const DRY_RUN = process.argv.includes('--dry-run')
const BUCKET = args[0] ?? 'menu-photos'
const FOLDER = args[1] ?? 'dishes/hero section photos'

const MAX_WIDTH = 1600 // plenty for a full-bleed phone banner
const QUALITY = 80

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
const isImage = (name) => /\.(jpe?g|png|webp|avif)$/i.test(name)
const mb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`

async function main() {
  console.log(`Bucket : ${BUCKET}`)
  console.log(`Folder : ${FOLDER}`)
  console.log(DRY_RUN ? 'Mode   : DRY RUN (no changes)\n' : 'Mode   : LIVE (files will be replaced)\n')

  const { data: list, error } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw error

  const files = list.filter((o) => o.id && isImage(o.name))
  if (files.length === 0) {
    console.log('No images found.')
    return
  }
  console.log(`Found ${files.length} images.\n`)

  let before = 0
  let after = 0
  let changed = 0

  for (const f of files) {
    const path = `${FOLDER}/${f.name}`
    const originalSize = f.metadata?.size ?? 0
    before += originalSize

    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path)
      if (dlErr) throw dlErr

      const input = Buffer.from(await blob.arrayBuffer())
      const output = await sharp(input)
        .rotate() // honour EXIF orientation
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toBuffer()

      if (output.length >= input.length) {
        console.log(`  = ${f.name} — already small (${mb(input.length)}), skipped`)
        after += input.length
        continue
      }

      if (!DRY_RUN) {
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, output, { contentType: 'image/jpeg', upsert: true })
        if (upErr) throw upErr
      }

      after += output.length
      changed++
      const saved = (100 * (1 - output.length / input.length)).toFixed(0)
      console.log(`  ✓ ${f.name} — ${mb(input.length)} -> ${mb(output.length)}  (-${saved}%)`)
    } catch (e) {
      after += originalSize
      console.error(`  ✗ ${f.name} — ${e.message}`)
    }
  }

  console.log('\n' + '-'.repeat(52))
  console.log(`Before : ${mb(before)}`)
  console.log(`After  : ${mb(after)}`)
  console.log(`Saved  : ${mb(before - after)} across ${changed} images`)
  if (DRY_RUN) console.log('\nDry run — nothing was changed. Re-run without --dry-run to apply.')
}

main().catch((e) => {
  console.error('\nAborted:', e.message)
  process.exit(1)
})
