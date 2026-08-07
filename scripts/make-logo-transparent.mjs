/**
 * One-off: turn the white-background Baba Biryani JPEG into a trimmed,
 * transparent PNG so it can sit on any background without a white box.
 * Run: node scripts/make-logo-transparent.mjs
 */
import sharp from 'sharp'

const SRC = 'public/baba-biryani-logo.jpg'
const OUT = 'public/baba-biryani-logo.png'

// Pixels at/above OPAQUE_BELOW stay solid; at/above FULLY_CLEAR go fully
// transparent; in between they feather so anti-aliased edges stay smooth.
const FULLY_CLEAR = 246
const OPAQUE_BELOW = 205

const trimmed = await sharp(SRC).trim({ threshold: 12 }).toBuffer()
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
  .toFile(OUT)

console.log(`wrote ${OUT} (${info.width}x${info.height})`)
