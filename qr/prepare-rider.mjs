/**
 * Prepares the delivery rider artwork for the cards: trims the empty space and
 * recolours the black silhouette, keeping transparency.
 *
 * Produces one file per card theme:
 *   delivery-rider-cream.png — for the deep green card
 *   delivery-rider-green.png — for the white card
 *
 * Source is a licensed stock PNG (already transparent). Only needs re-running
 * if the source artwork is replaced.
 *
 * Run from anywhere:  node qr/prepare-rider.mjs
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { GREEN, CREAM } from './theme.mjs'

const QR_DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(QR_DIR, '—Pngtree—delivery bike black icon vector_9203267.png')

const trimmed = await sharp(SRC).trim().png().toBuffer()
const { width, height } = await sharp(trimmed).metadata()

// Recolour by keeping the artwork's alpha and swapping the colour underneath,
// so every edge stays as smooth as the original.
const alpha = await sharp(trimmed).extractChannel('alpha').toBuffer()

for (const [name, colour] of [
  ['delivery-rider-cream.png', CREAM],
  ['delivery-rider-green.png', GREEN],
]) {
  await sharp({ create: { width, height, channels: 3, background: colour } })
    .joinChannel(alpha)
    .png()
    .toFile(path.join(QR_DIR, name))
  console.log(`Wrote qr/${name} (${width}x${height}, tinted ${colour})`)
}
