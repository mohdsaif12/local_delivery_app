# Wali Baba Foods — QR code

Everything for the printable QR code lives in this folder.

## Download the QR

| File | Use it for |
|---|---|
| [`delivery-qr-card.svg`](delivery-qr-card.svg) | **The finished card, for the printer.** Vector — prints at any size, A4 to full banner, with no loss of quality |
| [`delivery-qr-card.png`](delivery-qr-card.png) | Same card as a picture, A4 at 300dpi — for WhatsApp, previews and everyday printing |
| [`delivery-qr.png`](delivery-qr.png) | Just the QR, 1024×1024 — WhatsApp, slides, stickers |
| [`delivery-qr.svg`](delivery-qr.svg) | Just the QR, vector — posters, banners, flex boards, anything large |

The QR carries the Wali Baba logo in its centre. That is safe: the code is built
with enough spare data that the badge cannot stop it scanning (see below).

Use the **SVG** for anything printed bigger than a sheet of paper: it is
resolution-independent and stays razor sharp at any size. The PNG is fine for
screens, stickers and small prints.

On GitHub, open the file and click **Download raw file**.

## What the QR contains

```
https://www.walibabafoods.com/
```

That URL is encoded **directly into the QR pattern**. Scanning it opens the site
straight away — there is no short link, no redirect, no tracking service and no
third-party account behind it.

This means the code **cannot expire and cannot be switched off by anyone**. Once
printed it works forever, as long as the domain stays ours. Nothing needs to be
renewed or paid for.

The code is generated at error-correction level **H**: it still scans reliably
with up to ~30% of its surface scratched, smudged or covered by a logo.

## Regenerate the QR

Only needed if the website address changes.

```bash
cd restaurant-direct
npm install          # first time only, installs the qrcode library
node qr/generate-qr.mjs     # the QR itself
node qr/generate-card.mjs   # the printable card (run after the line above)
```

This rewrites `qr/delivery-qr.png`, `qr/delivery-qr.svg`, and copies both into
`public/` so the website serves the same image at
`https://www.walibabafoods.com/delivery-qr.png`.

To change the address, edit the single line in [`qr-target.mjs`](qr-target.mjs)
and run the command above.

## Verify a QR before printing

```bash
node qr/verify-qr.mjs
```

It decodes all four files and prints what each one actually contains, confirming
the contents are exactly the URL above and nothing else. It exits with an error
if anything does not match — so if it passes, the files are safe to send to the
printer.

## Files here

| File | What it is |
|---|---|
| `delivery-qr-card.svg` / `.png` | The finished printable card, vector and picture |
| `delivery-qr.png` / `delivery-qr.svg` | The QR on its own |
| `qr-target.mjs` | The encoded URL, in one place |
| `generate-qr.mjs` | Creates the QR images |
| `generate-card.mjs` | Creates the card around the QR |
| `prepare-rider.mjs` | Trims and green-tints the delivery rider artwork |
| `delivery-rider.png` | The rider graphic used on the card, ready to place |
| `verify-qr.mjs` | Decodes everything and checks the contents |

## Which file do I send to the printer?

Send the **SVG**. It is vector: the QR, all the wording and the border are stored
as shapes, not pixels, so it prints identically at A5, A4, A3 or a six-foot
banner. The wording is stored as outlines, so the print shop does not need our
fonts and nothing can shift or reflow on their machine.

The PNG is a picture, fixed at 2480×3508. That is a true A4 at 300dpi and prints
beautifully up to A4 — it is only if someone blows it up to poster size that the
edges soften. PNG never loses quality to compression the way a JPEG does; the
only limit is its size.

## Why does the SVG look soft when I zoom right in?

The QR pattern itself is vector and stays perfectly sharp at any size — blow it
up to a hoarding and the squares stay razor edged.

The **logo in the middle** is a photo-type image (`public/logo.png`), so it has a
fixed amount of detail. Zoom far enough on screen and its edges soften, while the
squares around it stay crisp. This does not affect printing: on an A4 card the
logo prints at roughly 1000 dpi, about three times sharper than a printer can
reproduce. It would only ever be a problem on something the size of a wall.

The `qrcode` and `jsqr` libraries are dev dependencies used only by these
scripts. They are not part of the app and ship nothing to customers.
