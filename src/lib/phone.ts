/**
 * Phone numbers reach us in whatever shape they were typed — '+91-7619002121',
 * '076190 02121', or the bare 10 digits signup stores. These normalise them for
 * dialling and for display.
 */

/**
 * A `tel:` value the phone dialler will accept, or null if there is no usable
 * number. Bare 10-digit numbers get the +91 country code; anything longer is
 * assumed to already carry one.
 */
export function telHref(raw?: string | null): string | null {
  const digits = trunkStripped(raw)
  if (digits.length < 10) return null
  if (digits.length === 10) return `+91${digits}`
  return `+${digits}`
}

/**
 * Digits only, with the Indian trunk prefix removed — '076190 02121' is the
 * same number as '7619002121', and keeping the 0 produces a dead tel: link.
 */
function trunkStripped(raw?: string | null): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits
}

/** Human-readable form, e.g. '+91 76190 02121'. Falls back to the raw input. */
export function formatPhone(raw?: string | null): string {
  const digits = trunkStripped(raw)
  const local = digits.length > 10 ? digits.slice(-10) : digits
  if (local.length !== 10) return raw?.trim() ?? ''
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`
}
