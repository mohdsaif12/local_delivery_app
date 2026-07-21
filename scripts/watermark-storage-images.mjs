// Bake a tiled diagonal watermark into images in a Supabase Storage folder.
//
// Why baked in, not "on screenshot": a screenshot is captured by the OS before
// any JS can react, so a watermark added on detection would never appear in the
// saved image. A watermark that is already part of the photo survives every
// screenshot, download and re-upload.
//
// Setup:  npm i -D sharp   +   SUPABASE_SERVICE_ROLE_KEY in .env.local
//
// Preview one image locally first (uploads nothing):
//   node --env-file=.env.local scripts/watermark-storage-images.mjs --preview
//
// Apply to the whole folder (REPLACES the files):
//   node --env-file=.env.local scripts/watermark-storage-images.mjs
//
// Other folders:
//   node --env-file=.env.local scripts/watermark-storage-images.mjs menu-photos dishes
//
// NOT idempotent — running it twice stacks a second watermark. Run once.

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import fs from 'node:fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const flags = process.argv.filter((a) => a.startsWith('--'))
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const PREVIEW = flags.includes('--preview')
const BUCKET = args[0] ?? 'menu-photos'
const FOLDER = args[1] ?? 'dishes/hero section photos'
const TEXT = process.env.WATERMARK_TEXT ?? 'WALI BABA FOODS'
const OPACITY = Number(process.env.WATERMARK_OPACITY ?? 0.28)

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
const isImage = (n) => /\.(jpe?g|png|webp|avif)$/i.test(n)
const mb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Full-size SVG of repeating diagonal text, to composite over the photo. */
function watermarkSvg(width, height, text) {
  const fontSize = Math.max(16, Math.round(width / 26))
  const tileW = Math.round(fontSize * text.length * 0.62 + fontSize * 3)
  const tileH = Math.round(fontSize * 4.5)
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" width="${tileW}" height="${tileH}"
                 patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <text x="0" y="${Math.round(tileH / 2)}"
                font-family="Arial, Helvetica, sans-serif"
                font-size="${fontSize}" font-weight="bold"
                fill="#ffffff" fill-opacity="${OPACITY}"
                stroke="#000000" stroke-opacity="${(OPACITY * 0.4).toFixed(3)}"
                stroke-width="1">${esc(text)}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)"/>
    </svg>`
  )
}

async function watermark(input) {
  const meta = await sharp(input).metadata()
  return sharp(input)
    .composite([{ input: watermarkSvg(meta.width, meta.height, TEXT), top: 0, left: 0 }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
}

async function main() {
  console.log(`Bucket : ${BUCKET}`)
  console.log(`Folder : ${FOLDER}`)
  console.log(`Text   : "${TEXT}"  (opacity ${OPACITY})`)
  console.log(PREVIEW ? 'Mode   : PREVIEW (nothing uploaded)\n' : 'Mode   : LIVE (files will be replaced)\n')

  const { data: list, error } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw error

  const files = list.filter((o) => o.id && isImage(o.name))
  if (files.length === 0) return console.log('No images found.')

  const targets = PREVIEW ? files.slice(0, 1) : files
  console.log(`${files.length} images found; processing ${targets.length}.\n`)

  for (const f of targets) {
    const path = `${FOLDER}/${f.name}`
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path)
      if (dlErr) throw dlErr

      const input = Buffer.from(await blob.arrayBuffer())
      const output = await watermark(input)

      if (PREVIEW) {
        const dest = './watermark-preview.jpg'
        fs.writeFileSync(dest, output)
        console.log(`  Preview written to ${dest}  (${f.name}, ${mb(output.length)})`)
        console.log('  Open it and check how it looks, then re-run without --preview.')
        return
      }

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, output, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr

      console.log(`  ✓ ${f.name} — ${mb(input.length)} -> ${mb(output.length)}`)
    } catch (e) {
      console.error(`  ✗ ${f.name} — ${e.message}`)
    }
  }

  if (!PREVIEW) console.log('\nDone. Watermarks are permanent — re-running would stack another layer.')
}

main().catch((e) => {
  console.error('\nAborted:', e.message)
  process.exit(1)
})
