'use client'

import { useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { createClient } from '@/lib/supabase/client'

interface Coords {
  lat: number
  lng: number
}

interface LiveMapProps {
  orderId: string
  riderId: string | null
  restaurantCoords: Coords | null
  customerCoords: Coords | null
}

// setOptions must only be called once, before the first importLibrary call
let mapsOptionsSet = false
function ensureMapsOptions(apiKey: string) {
  if (mapsOptionsSet) return
  setOptions({ key: apiKey, v: 'weekly' })
  mapsOptionsSet = true
}

// Muted, low-clutter theme — closer to a food-delivery tracking map than raw Google Maps
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f4f4f4' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe7f5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fde4dc' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffcfc0' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e3e3e3' }] },
]

export default function LiveMap({ orderId, riderId, restaurantCoords, customerCoords }: LiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const riderMarkerRef = useRef<any>(null)

  // Serialize coords to strings so the effect only re-runs when values actually change,
  // not every time the parent re-renders and creates new object references.
  const restaurantKey = restaurantCoords ? `${restaurantCoords.lat},${restaurantCoords.lng}` : 'null'
  const customerKey = customerCoords ? `${customerCoords.lat},${customerCoords.lng}` : 'null'

  useEffect(() => {
    let isMounted = true
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    if (!apiKey) return

    ensureMapsOptions(apiKey)

    // Re-parse coords from keys so closure captures stable values
    const rCoords = restaurantKey !== 'null'
      ? { lat: parseFloat(restaurantKey.split(',')[0]), lng: parseFloat(restaurantKey.split(',')[1]) }
      : null
    const cCoords = customerKey !== 'null'
      ? { lat: parseFloat(customerKey.split(',')[0]), lng: parseFloat(customerKey.split(',')[1]) }
      : null

    Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('core'),
    ]).then(async ([{ Map, Polyline }, { Marker }, { LatLngBounds, SymbolPath }]) => {
      if (!isMounted || !mapRef.current) return

      // White circular badge with an emoji glyph — the "Swiggy style" pin
      const badgeIcon = (borderColor: string, scale: number): google.maps.Symbol => ({
        path: SymbolPath.CIRCLE,
        scale,
        fillColor: '#ffffff',
        fillOpacity: 1,
        strokeColor: borderColor,
        strokeWeight: 3,
      })

      const fallbackCenter = { lat: 26.4499, lng: 80.3319 } // Kanpur
      const center = rCoords ?? cCoords ?? fallbackCenter

      const map = new Map(mapRef.current, {
        center,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: 'greedy',
        styles: MAP_STYLE,
      })

      const bounds = new LatLngBounds()

      // Dashed reference route between restaurant and customer
      if (rCoords && cCoords) {
        new Polyline({
          path: [rCoords, cCoords],
          map,
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#b51c00', scale: 3 },
              offset: '0',
              repeat: '14px',
            },
          ],
        })
      }

      if (rCoords) {
        new Marker({
          position: rCoords,
          map,
          icon: badgeIcon('#b51c00', 15),
          label: { text: '🍴', fontSize: '13px' },
          title: 'Restaurant',
          zIndex: 10,
        })
        bounds.extend(rCoords)
      }

      if (cCoords) {
        new Marker({
          position: cCoords,
          map,
          icon: badgeIcon('#191c1d', 15),
          label: { text: '🏠', fontSize: '13px' },
          title: 'Delivery address',
          zIndex: 10,
        })
        bounds.extend(cCoords)
      }

      if (rCoords && cCoords) {
        map.fitBounds(bounds, 50)
      }

      const riderMarker = new Marker({
        map,
        visible: false,
        icon: badgeIcon('#2563eb', 15),
        label: { text: '🛵', fontSize: '13px' },
        title: 'Rider',
        zIndex: 999,
      })
      riderMarkerRef.current = riderMarker

      // rider_locations is keyed one-row-per-rider (rider_id UNIQUE), not
      // per-order — a rider keeps reporting position while idle/between
      // deliveries too, with `order_id` set to whichever order (if any)
      // they're currently on. Filtering on rider_id is what's actually
      // unique; order_id is an extra check so the marker hides itself once
      // this rider has moved on to a different delivery.
      if (riderId) {
        const { data } = await supabase
          .from('rider_locations')
          .select('latitude, longitude, order_id')
          .eq('rider_id', riderId)
          .maybeSingle()

        if (data && data.order_id === orderId && isMounted) {
          const pos = { lat: data.latitude, lng: data.longitude }
          riderMarker.setPosition(pos)
          riderMarker.setVisible(true)
          bounds.extend(pos)
          map.fitBounds(bounds, 50)
        }

        if (!isMounted) return

        channel = supabase
          .channel(`rider-location-${riderId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'rider_locations',
              filter: `rider_id=eq.${riderId}`,
            },
            (payload) => {
              const row = payload.new as { latitude?: number; longitude?: number; order_id?: string | null } | null
              if (!row?.latitude || !row?.longitude) return
              if (row.order_id !== orderId) {
                // Rider has moved on to a different delivery (or gone idle) —
                // their position is no longer relevant to this order.
                riderMarker.setVisible(false)
                return
              }
              riderMarker.setPosition({ lat: row.latitude, lng: row.longitude })
              riderMarker.setVisible(true)
            }
          )
          .subscribe()
      }
    })

    return () => {
      isMounted = false
      if (channel) supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, riderId, restaurantKey, customerKey])

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) {
    return (
      <div className="w-full h-52 bg-gray-800 flex items-center justify-center">
        <p className="text-white/60 text-xs font-semibold">Map unavailable — API key not set</p>
      </div>
    )
  }

  return <div ref={mapRef} className="w-full h-52" />
}
