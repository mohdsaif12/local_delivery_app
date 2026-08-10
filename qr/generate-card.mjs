/**
 * Generates the print-ready "SCAN FOR HOME DELIVERY" card in two themes:
 *
 *   delivery-qr-card.svg / .png        deep green card, cream lettering
 *   delivery-qr-card-white.svg / .png  white card, everything in logo green
 *
 * Each theme is written as vector (SVG) and as an A4 300dpi picture (PNG)
 * rendered from that same SVG, so the pair can never disagree.
 *
 * All text is converted to outlines, so the SVG needs no fonts installed
 * anywhere else and cannot reflow at the print shop. The QR is vector too.
 * The only bitmaps are the restaurant logo and the rider, neither of which has
 * a vector source.
 *
 * The QR is never inverted: its modules always sit dark on light, which is what
 * scanners expect. On the green card it gets its own light panel.
 *
 * Run generate-qr.mjs and prepare-rider.mjs first.
 * Run from anywhere:  node qr/generate-card.mjs
 */
import sharp from 'sharp'
import opentype from 'opentype.js'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { QR_TARGET } from './qr-target.mjs'
import { GREEN, CREAM, MUTED_ON_GREEN, MUTED_ON_WHITE } from './theme.mjs'

const QR_DIR = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(QR_DIR, '..', 'public')
const LOGO = path.join(PUBLIC_DIR, 'logo.png')
const QR_SVG = path.join(QR_DIR, 'delivery-qr.svg')

// A4 at 300dpi. The SVG scales freely; this only fixes the PNG's pixel size.
const W = 2480
const H = 3508

const QR_SIZE = 1500
const QR_X = Math.round((W - QR_SIZE) / 2)
const QR_Y = 900
const LOGO_H = 380
const RIDER_H = 360
const RIDER_Y = 2450

/** The two looks. `panel` is the light plate behind the QR, or null if not needed. */
const THEMES = [
  {
    file: 'delivery-qr-card',
    background: GREEN,
    ink: CREAM,
    muted: MUTED_ON_GREEN,
    border: { colour: CREAM, opacity: 0.55 },
    rule: { colour: CREAM, opacity: 0.3 },
    qrModules: '#000000',
    panel: '#ffffff',
    rider: 'delivery-rider-cream.png',
  },
  {
    file: 'delivery-qr-card-white',
    background: '#ffffff',
    ink: GREEN,
    muted: MUTED_ON_WHITE,
    border: { colour: GREEN, opacity: 1 },
    rule: { colour: GREEN, opacity: 0.2 },
    qrModules: GREEN,
    panel: null,
    rider: 'delivery-rider-green.png',
  },
]

// ── Fonts (generation-time only; the output embeds outlines, not fonts) ──────
const FONT_DIR = path.join(process.env.WINDIR ?? 'C:/Windows', 'Fonts')
async function loadFont(file) {
  try {
    return opentype.parse((await readFile(path.join(FONT_DIR, file))).buffer)
  } catch {
    throw new Error(
      `Could not load font ${file} from ${FONT_DIR}. ` +
        `This script converts text to outlines and needs Arial installed locally.`
    )
  }
}
const black = await loadFont('ariblk.ttf')
const bold = await loadFont('arialbd.ttf')
const regular = await loadFont('arial.ttf')

/**
 * Centre-aligned text as SVG path data, with optional letter spacing.
 * Outlines mean the printer needs no fonts and nothing can shift.
 */
function centredText(font, text, size, cy, { letterSpacing = 0, fill }) {
  const widths = [...text].map((ch) => font.getAdvanceWidth(ch, size))
  const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * (text.length - 1)
  let x = W / 2 - total / 2
  let d = ''
  ;[...text].forEach((ch, i) => {
    d += font.getPath(ch, x, cy, size).toPathData(3) + ' '
    x += widths[i] + letterSpacing
  })
  return `<path d="${d.trim()}" fill="${fill}"/>`
}

// ── Shared assets ───────────────────────────────────────────────────────────
const qrSvgRaw = await readFile(QR_SVG, 'utf8')
const qrViewBox = qrSvgRaw.match(/viewBox="([^"]+)"/)?.[1]
if (!qrViewBox) throw new Error('Could not read viewBox from qr/delivery-qr.svg')
const qrInnerBlack = qrSvgRaw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

const logoMeta = await sharp(LOGO).metadata()
const LOGO_W = Math.round(LOGO_H * (logoMeta.width / logoMeta.height))
const logoDataUri = `data:image/png;base64,${(await readFile(LOGO)).toString('base64')}`

const site = QR_TARGET.replace(/^https:\/\//, '').replace(/\/$/, '')

for (const t of THEMES) {
  // Recolour the QR modules for this theme. Only the stroke colour changes —
  // the pattern itself is untouched, and verify-qr.mjs re-checks every file.
  const qrInner = qrInnerBlack.replace(/stroke="#000000"/g, `stroke="${t.qrModules}"`)
  const qrBlock = `<svg x="${QR_X}" y="${QR_Y}" width="${QR_SIZE}" height="${QR_SIZE}" viewBox="${qrViewBox}">${qrInner}</svg>`

  const TILE_PAD = 56
  const panel = t.panel
    ? `<rect x="${QR_X - TILE_PAD}" y="${QR_Y - TILE_PAD}" width="${QR_SIZE + TILE_PAD * 2}" ` +
      `height="${QR_SIZE + TILE_PAD * 2}" rx="48" fill="${t.panel}"/>`
    : ''

  const riderPath = path.join(QR_DIR, t.rider)
  const riderMeta = await sharp(riderPath).metadata()
  const RIDER_W = Math.round(RIDER_H * (riderMeta.width / riderMeta.height))
  const riderDataUri = `data:image/png;base64,${(await readFile(riderPath)).toString('base64')}`
  const rider =
    `<image x="${Math.round((W - RIDER_W) / 2)}" y="${RIDER_Y}" ` +
    `width="${RIDER_W}" height="${RIDER_H}" href="${riderDataUri}"/>`

  const cardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${t.background}"/>
  <rect x="60" y="60" width="${W - 120}" height="${H - 120}" rx="80"
        fill="none" stroke="${t.border.colour}" stroke-width="8" stroke-opacity="${t.border.opacity}"/>

  <image x="${Math.round((W - LOGO_W) / 2)}" y="180" width="${LOGO_W}" height="${LOGO_H}" href="${logoDataUri}"/>

  ${centredText(black, 'WALI BABA FOODS', 150, 690, { fill: t.ink })}
  ${centredText(regular, 'A FAMILY RESTAURANT', 54, 782, { letterSpacing: 18, fill: t.muted })}

  <line x1="620" y1="856" x2="${W - 620}" y2="856" stroke="${t.rule.colour}" stroke-width="3" stroke-opacity="${t.rule.opacity}"/>

  ${panel}
  ${qrBlock}

  ${rider}

  ${centredText(black, 'SCAN FOR', 132, 3000, { fill: t.ink })}
  ${centredText(black, 'HOME DELIVERY', 132, 3150, { fill: t.ink })}
  ${centredText(bold, site, 62, 3285, { fill: t.ink })}
  ${centredText(regular, 'A Product of Baba Biryani', 46, 3375, { fill: t.muted })}
</svg>`

  await writeFile(path.join(QR_DIR, `${t.file}.svg`), cardSvg, 'utf8')
  await sharp(Buffer.from(cardSvg)).resize(W, H).png().toFile(path.join(QR_DIR, `${t.file}.png`))
  console.log(`Wrote qr/${t.file}.svg and qr/${t.file}.png`)
}

console.log(`QR inside encodes: ${QR_TARGET}`)
