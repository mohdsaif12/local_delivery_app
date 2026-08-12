import { haversineKm, deliveryFeeFromKm } from './distance'

/**
 * An outlet is a row in `restaurants`. The menu is shared across all of them —
 * only distance, delivery fee and opening hours differ.
 */
export interface Outlet {
  id: string
  name: string
  area_name: string | null
  address: string | null
  phone: string | null
  upi_id: string | null
  delivery_fee: number
  delivery_radius_km: number
  is_open: boolean
  closed_reason: string | null
  opening_time: string | null
  closing_time: string | null
  latitude: number | null
  longitude: number | null
  sort_order: number
}

/** Every column the customer side needs. Keep queries consistent. */
export const OUTLET_COLUMNS =
  'id, name, area_name, address, phone, upi_id, delivery_fee, delivery_radius_km, ' +
  'is_open, closed_reason, opening_time, closing_time, latitude, longitude, sort_order'

/** Short label for the picker — the area if set, otherwise the outlet name. */
export function outletLabel(outlet: Pick<Outlet, 'name' | 'area_name'>): string {
  return outlet.area_name?.trim() || outlet.name
}

// ── Opening hours ───────────────────────────────────────────────────────────
//   'manual' — staff switched the outlet off
//   'hours'  — outside opening hours
//   null     — open
export type ClosedReason = 'manual' | 'hours' | null

type HoursFields = Pick<Outlet, 'is_open' | 'opening_time' | 'closing_time'>

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function isWithinHours(s: HoursFields, now: Date): boolean {
  if (!s.opening_time || !s.closing_time) return true
  const mins = now.getHours() * 60 + now.getMinutes()
  const open = toMinutes(s.opening_time)
  const close = toMinutes(s.closing_time)
  // Overnight window (e.g. 18:00 → 02:00) wraps past midnight
  return close > open ? mins >= open && mins < close : mins >= open || mins < close
}

/**
 * Nothing in the database closes a shop on a schedule, so the app enforces
 * opening hours itself. Order matters: the clock wins, then the manual switch.
 */
export function getClosedReason(s: HoursFields | null, now: Date): ClosedReason {
  if (!s) return null
  if (!isWithinHours(s, now)) return 'hours'
  if (!s.is_open) return 'manual'
  return null
}

export function isOutletOpen(outlet: HoursFields | null, now: Date): boolean {
  return getClosedReason(outlet, now) === null
}

// ── Distance, fee and coverage ──────────────────────────────────────────────

/**
 * Estimated road distance from an outlet to a point, in km. Straight-line
 * distance is scaled by 1.3 to account for road winding — the same factor the
 * checkout has always used.
 */
export function outletRoadKm(
  outlet: Pick<Outlet, 'latitude' | 'longitude'>,
  lat: number,
  lng: number
): number | null {
  if (outlet.latitude == null || outlet.longitude == null) return null
  return haversineKm(outlet.latitude, outlet.longitude, lat, lng) * 1.3
}

export interface OutletDelivery {
  /** Estimated road distance in km, or null if either side has no coordinates. */
  roadKm: number | null
  /** Delivery fee in rupees, or null when the address is out of range. */
  fee: number | null
  /** False when the address is beyond this outlet's delivery radius. */
  inRange: boolean
}

/**
 * What this outlet would charge to deliver to a point, and whether it covers it
 * at all. An outlet with no coordinates falls back to its flat delivery_fee.
 */
export function outletDelivery(outlet: Outlet, lat: number, lng: number): OutletDelivery {
  const roadKm = outletRoadKm(outlet, lat, lng)
  if (roadKm == null) {
    return { roadKm: null, fee: outlet.delivery_fee ?? 66, inRange: true }
  }
  if (roadKm > outlet.delivery_radius_km) {
    return { roadKm, fee: null, inRange: false }
  }
  const fee = deliveryFeeFromKm(roadKm)
  return { roadKm, fee, inRange: fee !== null }
}

/** Outlets sorted by how far they are from a point, nearest first. */
export function outletsByDistance(outlets: Outlet[], lat: number, lng: number): Outlet[] {
  return [...outlets].sort((a, b) => {
    const da = outletRoadKm(a, lat, lng)
    const db = outletRoadKm(b, lat, lng)
    // Outlets without coordinates sink to the bottom rather than winning by 0.
    if (da == null) return db == null ? 0 : 1
    if (db == null) return -1
    return da - db
  })
}

/**
 * The outlet a customer should get by default: the closest one that actually
 * delivers to them and is open, else the closest that delivers, else the
 * closest of all. Falls back to display order when we have no address yet.
 */
export function pickDefaultOutlet(
  outlets: Outlet[],
  point: { lat: number; lng: number } | null,
  now: Date = new Date()
): Outlet | null {
  if (outlets.length === 0) return null
  if (!point) return outlets[0]

  const byDistance = outletsByDistance(outlets, point.lat, point.lng)
  const covering = byDistance.filter((o) => outletDelivery(o, point.lat, point.lng).inRange)

  return covering.find((o) => isOutletOpen(o, now)) ?? covering[0] ?? byDistance[0]
}

/**
 * When the chosen outlet cannot reach an address, the nearest one that can —
 * so checkout can offer a switch instead of a dead end.
 */
export function nearestCoveringOutlet(
  outlets: Outlet[],
  exclude: string,
  point: { lat: number; lng: number }
): Outlet | null {
  return (
    outletsByDistance(outlets, point.lat, point.lng).find(
      (o) => o.id !== exclude && outletDelivery(o, point.lat, point.lng).inRange
    ) ?? null
  )
}

/** Rough delivery estimate shown next to an outlet: prep time plus travel. */
export function etaMinutesFromKm(roadKm: number | null): { min: number; max: number } {
  if (roadKm == null) return { min: 25, max: 35 }
  const travel = Math.round(roadKm * 3)
  return { min: 20 + travel, max: 30 + travel }
}
