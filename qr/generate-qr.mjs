/**
 * Generates the permanent delivery QR code, branded with the Wali Baba logo
 * in the centre.
 *
 * The URL is encoded directly into the QR matrix — no redirect, no shortener,
 * no tracking service, no runtime dependency. The output files are inert static
 * images that cannot expire.
 *
 * The centre logo is safe because the code is generated at error-correction
 * level H (~30% of the code may be obscured). The badge covers far less than
 * that, and verify-qr.mjs re-decodes the finished files to prove it still scans.
 *
 * Writes two copies of each file:
 *   qr/      — the shareable/printable copies people download from this folder
 *   public/  — the same image served by the site at /delivery-qr.png
 *
 * Run from anywhere:  node qr/generate-qr.mjs
 */
import QRCode from 'qrcode'
import sharp from 'sharp'
import { writeFile, copyFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { QR_TARGET } from './qr-target.mjs'

// Paths resolve from this file, not the shell's working directory, so the
// script behaves the same no matter where it is run from.
const QR_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(QR_DIR, '..')
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public')
const LOGO = path.join(PUBLIC_DIR, 'logo.png')

const PNG = 'delivery-qr.png'
const SVG = 'delivery-qr.svg'
const PX = 1024

// 'H' = highest error correction: still scans with ~30% of the code damaged or
// covered, which is what makes the centre logo (and printed wear) safe.
const OPTIONS = {
  errorCorrectionLevel: 'H',
  margin: 4,
  color: { dark: '#000000ff', light: '#ffffffff' },
}

/** Logo height as a fraction of the whole image. Keep well under level H's ~30% budget. */
const LOGO_HEIGHT_RATIO = 0.24
/** White breathing room around the logo, as a fraction of the image. */
const PAD_RATIO = 0.022

const logoMeta = await sharp(LOGO).metadata()
const logoAspect = logoMeta.width / logoMeta.height

// ── PNG ──────────────────────────────────────────────────────────────────────
const baseQr = await QRCode.toBuffer(QR_TARGET, { ...OPTIONS, type: 'png', width: PX })

const logoH = Math.round(PX * LOGO_HEIGHT_RATIO)
const logoW = Math.round(logoH * logoAspect)
const pad = Math.round(PX * PAD_RATIO)
const badgeW = logoW + pad * 2
const badgeH = logoH + pad * 2
const radius = Math.round(pad * 1.6)

const badgePlate = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeW}" height="${badgeH}">
     <rect width="${badgeW}" height="${badgeH}" rx="${radius}" ry="${radius}" fill="#ffffff"/>
   </svg>`
)

const logoResized = await sharp(LOGO).resize(logoW, logoH, { fit: 'contain' }).png().toBuffer()
const badge = await sharp(badgePlate)
  .composite([{ input: logoResized, gravity: 'center' }])
  .png()
  .toBuffer()

await sharp(baseQr)
  .composite([{ input: badge, gravity: 'center' }])
  .png()
  .toFile(path.join(QR_DIR, PNG))

// ── SVG ──────────────────────────────────────────────────────────────────────
// The logo is embedded as a base64 data URI so the SVG stays a single
// self-contained file with no external references.
const baseSvg = await QRCode.toString(QR_TARGET, { ...OPTIONS, type: 'svg' })
const viewBox = baseSvg.match(/viewBox="0 0 (\d+) (\d+)"/)
if (!viewBox) throw new Error('Could not read viewBox from generated SVG')

const units = Number(viewBox[2]) // QR modules incl. margin; the SVG is square
const uLogoH = units * LOGO_HEIGHT_RATIO
const uLogoW = uLogoH * logoAspect
const uPad = units * PAD_RATIO
const uBadgeW = uLogoW + uPad * 2
const uBadgeH = uLogoH + uPad * 2
const uRadius = uPad * 1.6
const centre = units / 2
const r = (n) => Number(n.toFixed(3))

const logoDataUri = `data:image/png;base64,${(await readFile(LOGO)).toString('base64')}`

const overlay =
  `<rect x="${r(centre - uBadgeW / 2)}" y="${r(centre - uBadgeH / 2)}" ` +
  `width="${r(uBadgeW)}" height="${r(uBadgeH)}" rx="${r(uRadius)}" ry="${r(uRadius)}" fill="#ffffff"/>` +
  `<image x="${r(centre - uLogoW / 2)}" y="${r(centre - uLogoH / 2)}" ` +
  `width="${r(uLogoW)}" height="${r(uLogoH)}" href="${logoDataUri}"/>`

await writeFile(path.join(QR_DIR, SVG), baseSvg.replace('</svg>', `${overlay}</svg>`), 'utf8')

// Keep the site's served copy identical to the one in this folder.
await copyFile(path.join(QR_DIR, PNG), path.join(PUBLIC_DIR, PNG))
await copyFile(path.join(QR_DIR, SVG), path.join(PUBLIC_DIR, SVG))

const coverage = ((badgeW * badgeH) / (PX * PX)) * 100
console.log(`Encoded: ${QR_TARGET}`)
console.log(`Centre logo covers ${coverage.toFixed(1)}% of the image (level H allows ~30%)`)
console.log(`Wrote qr/${PNG}, qr/${SVG} and copied both to public/`)
