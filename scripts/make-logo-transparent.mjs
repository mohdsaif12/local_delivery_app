/**
 * Prepares the Baba Biryani attribution logo used on the splash screens.
 *
 * The original artwork was a JPEG on a white background; the white was stripped
 * to alpha to produce public/baba-biryani-logo.png. That step still runs if the
 * source JPEG is present, otherwise the existing transparent PNG is the source.
 *
 * It then writes public/baba-biryani-logo-sm.png — the file the app actually
 * loads. The splash shows it 34px tall for about two seconds, so the full-size
 * 229KB image is far too heavy: on a slow phone it may not arrive before the
 * screen is gone.
 *
 * Run: node scripts/make-logo-transparent.mjs
 */
import sharp from 'sharp'
import { access, stat } from 'node:fs/promises'

const SRC_JPG = 'public/baba-biryani-logo.jpg'
const FULL = 'public/baba-biryani-logo.png'
const SMALL = 'public/baba-biryani-logo-sm.png'

/** Height in px. 3x the 34px display size, so it stays sharp on high-DPI screens. */
const SMALL_HEIGHT = 102

// Pixels at/above FULLY_CLEAR go transparent; at/below OPAQUE_BELOW stay solid;
// in between they feather so anti-aliased edges stay smooth.
const FULLY_CLEAR = 246
const OPAQUE_BELOW = 205

const hasJpg = await access(SRC_JPG).then(
  () => true,
  () => false
)

if (hasJpg) {
  const trimmed = await sharp(SRC_JPG).trim({ threshold: 12 }).toBuffer()
  const { data, info } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += info.channels) {
    const min = Math.min(data[i], data[i + 1], data[i + 2])
    if (min >= FULLY_CLEAR) {
      data[i + 3] = 0
    } else if (min > OPAQUE_BELOW) {
      data[i + 3] = Math.round(255 * (1 - (min - OPAQUE_BELOW) / (FULLY_CLEAR - OPAQUE_BELOW)))
    }
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toFile(FULL)
  console.log(`wrote ${FULL} (${info.width}x${info.height})`)
} else {
  console.log(`${SRC_JPG} not present — using existing ${FULL} as the source`)
}

await sharp(FULL)
  .resize({ height: SMALL_HEIGHT })
  .png({ compressionLevel: 9, palette: true })
  .toFile(SMALL)

const { width, height } = await sharp(SMALL).metadata()
const { size } = await stat(SMALL)
console.log(`wrote ${SMALL} (${width}x${height}, ${Math.round(size / 1024)}KB)`)
