/**
 * Decodes every generated QR file and asserts its raw contents are exactly
 * QR_TARGET — proving the code points straight at the site, with no redirect
 * or tracking URL baked in. Reads the files as they are on disk; it never
 * regenerates them.
 *
 * Run from anywhere:  node qr/verify-qr.mjs
 * Exits 1 on any mismatch.
 */
import jsQR from 'jsqr'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { QR_TARGET } from './qr-target.mjs'

const QR_DIR = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(QR_DIR, '..', 'public')

const FILES = [
  path.join(QR_DIR, 'delivery-qr.png'),
  path.join(QR_DIR, 'delivery-qr.svg'),
  path.join(QR_DIR, 'delivery-qr-card.png'),
  path.join(QR_DIR, 'delivery-qr-card.svg'),
  path.join(QR_DIR, 'delivery-qr-card-white.png'),
  path.join(QR_DIR, 'delivery-qr-card-white.svg'),
  path.join(PUBLIC_DIR, 'delivery-qr.png'),
  path.join(PUBLIC_DIR, 'delivery-qr.svg'),
]

async function decode(file) {
  // Rasterise (the SVG too) to raw RGBA, which is what jsQR consumes.
  const { data, info } = await sharp(file)
    .flatten({ background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height)
  if (!result) throw new Error(`${file}: could not decode a QR code`)
  return result.data
}

let failed = false
for (const file of FILES) {
  const decoded = await decode(file)
  const exact = decoded === QR_TARGET
  if (!exact) failed = true
  console.log(path.relative(path.join(QR_DIR, '..'), file).replace(/\\/g, '/'))
  console.log(`  decoded : ${JSON.stringify(decoded)}`)
  console.log(`  expected: ${JSON.stringify(QR_TARGET)}`)
  console.log(`  exact match: ${exact ? 'YES' : 'NO'}`)
}

if (failed) {
  console.error('\nMISMATCH — do not print these files.')
  process.exit(1)
}
console.log('\nAll files decode to exactly the target URL.')
