/**
 * Straight-line distance between two GPS points in km (Haversine formula).
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

/**
 * Delivery fee tiers based on estimated road distance.
 * Pass in (haversineKm * 1.3) as roadKm to account for road winding.
 * Returns null if outside delivery zone (> 10 km).
 */
export function deliveryFeeFromKm(roadKm: number): number | null {
  if (roadKm > 25) return null
  if (roadKm <= 3.0) return 30
  return 30 + Math.round((roadKm - 3.0) * 10)
}
