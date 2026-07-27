'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { Navigation, Loader2, ChevronLeft, MapPin } from 'lucide-react'

interface Coords {
  lat: number
  lng: number
}

interface MapLocationPickerProps {
  initialCoords: Coords | null
  onClose: () => void
  onConfirm: (coords: Coords, addressText: string, pincode: string) => void
}

let mapsOptionsSet = false
function ensureMapsOptions(apiKey: string) {
  if (mapsOptionsSet) return
  setOptions({ key: apiKey, v: 'weekly' })
  mapsOptionsSet = true
}

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

export default function MapLocationPicker({
  initialCoords,
  onClose,
  onConfirm,
}: MapLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)

  const [locating, setLocating] = useState(false)
  const [reverseGeocoding, setReverseGeocoding] = useState(false)
  const [isMapMoving, setIsMapMoving] = useState(false)
  const [error, setError] = useState('')

  const [centerCoords, setCenterCoords] = useState<Coords | null>(null)
  const [geocodedAddress, setGeocodedAddress] = useState('')
  const [geocodedPincode, setGeocodedPincode] = useState('')

  async function handleReverseGeocode(lat: number, lng: number) {
    setReverseGeocoding(true)
    setError('')
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0]
        setGeocodedAddress(result.formatted_address)

        let pin = ''
        for (const comp of result.address_components) {
          if (comp.types.includes('postal_code')) {
            pin = comp.long_name
            break
          }
        }
        setGeocodedPincode(pin)
      } else {
        setGeocodedAddress('Unknown location')
        setGeocodedPincode('')
      }
    } catch (err) {
      console.error('Error reverse geocoding:', err)
      setError('Could not fetch address for this location.')
    } finally {
      setReverseGeocoding(false)
    }
  }

  function handleCenterOnCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser.')
      return
    }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(pos)
          mapInstanceRef.current.setZoom(17) // Zoom in closer on current location
        }
        setLocating(false)
      },
      (err) => {
        console.error(err)
        setError('Access to location denied or unavailable.')
        setLocating(false)
      }
    )
  }

  useEffect(() => {
    let isMounted = true
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    if (!apiKey) return

    ensureMapsOptions(apiKey)

    Promise.all([importLibrary('maps'), importLibrary('core')]).then(
      async ([{ Map }]) => {
        if (!isMounted || !mapRef.current) return

        let startCoords = initialCoords || { lat: 26.4499, lng: 80.3319 } // Kanpur default

        // If no coordinates provided, try to geolocate immediately to save user effort
        if (!initialCoords && navigator.geolocation) {
          setLocating(true)
          try {
            const position = await new Promise<GeolocationPosition>(
              (resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  timeout: 6000,
                  enableHighAccuracy: true,
                })
              }
            )
            startCoords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
          } catch (e) {
            console.warn('Geolocation check on init failed or timed out:', e)
          } finally {
            setLocating(false)
          }
        }

        if (!isMounted) return

        const map = new Map(mapRef.current, {
          center: startCoords,
          zoom: 17,
          disableDefaultUI: true,
          zoomControl: true, // Google Maps built-in zoom controls
          gestureHandling: 'greedy',
          styles: MAP_STYLE,
        })

        mapInstanceRef.current = map

        map.addListener('dragstart', () => {
          setIsMapMoving(true)
        })

        map.addListener('idle', () => {
          setIsMapMoving(false)
          const center = map.getCenter()
          if (center) {
            const latVal = center.lat()
            const lngVal = center.lng()
            setCenterCoords({ lat: latVal, lng: lngVal })
            handleReverseGeocode(latVal, lngVal)
          }
        })
      }
    )

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!apiKey) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
        <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center gap-3 border-b border-[#e1e3e4]">
          <button onClick={onClose} className="p-1 -ml-1">
            <ChevronLeft className="size-5 text-[#191c1d]" />
          </button>
          <h1 className="text-base font-bold text-[#191c1d]">Select Location</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-gray-500 text-sm">Google Maps API key is not configured.</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 h-11 bg-[#b51c00] text-white font-bold rounded-xl text-xs"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa] relative select-none">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center gap-3 border-b border-[#e1e3e4]">
        <button onClick={onClose} className="p-1 -ml-1" aria-label="Go back">
          <ChevronLeft className="size-5 text-[#191c1d]" />
        </button>
        <h1 className="text-base font-bold text-[#191c1d]">Select delivery location</h1>
      </header>

      {/* Error SnackBar if any */}
      {error && (
        <div className="absolute top-16 inset-x-4 z-50 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3 shadow-md">
          {error}
        </div>
      )}

      {/* Map Area */}
      <div className="relative flex-1 w-full bg-gray-100 overflow-hidden">
        {/* Map */}
        <div ref={mapRef} className="absolute inset-0 w-full h-full" />

        {/* Floating animated center pin indicator */}
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{ transform: 'translateY(-16px)' }}
        >
          <div
            className={`flex flex-col items-center transition-all duration-200 ease-out ${
              isMapMoving ? 'translate-y-[-12px]' : 'translate-y-0'
            }`}
          >
            {/* Pin head */}
            <div className="bg-[#b51c00] text-white p-2 rounded-full shadow-lg flex items-center justify-center border-2 border-white">
              <MapPin className="size-6 text-white fill-white" />
            </div>
            {/* Pin tip */}
            <div className="w-1 h-3 bg-[#b51c00] -mt-1 shadow-md shadow-black/25" />
            {/* Shadow underneath */}
            <div
              className={`w-3.5 h-1 bg-black/25 rounded-full blur-[1px] transition-all duration-200 ease-out mt-0.5 ${
                isMapMoving ? 'scale-[0.4] opacity-30' : 'scale-100 opacity-100'
              }`}
            />
          </div>
        </div>

        {/* floating locate button */}
        <button
          onClick={handleCenterOnCurrentLocation}
          disabled={locating}
          className="absolute bottom-4 right-4 bg-white p-3.5 rounded-full shadow-lg border border-gray-200/80 text-[#191c1d] active:scale-95 transition-all z-10 disabled:opacity-60"
          title="Center on my location"
        >
          {locating ? (
            <Loader2 className="size-5 animate-spin text-[#b51c00]" />
          ) : (
            <Navigation className="size-5 text-[#b51c00] fill-[#b51c00]" />
          )}
        </button>
      </div>

      {/* Bottom Panel */}
      <div className="bg-white p-5 border-t border-gray-100 flex flex-col gap-4 shadow-xl z-20">
        <div>
          <p className="text-[10px] font-bold text-[#b51c00] uppercase tracking-wide mb-1.5">
            Selected Location Address
          </p>
          {reverseGeocoding ? (
            <div className="flex items-center gap-2 text-gray-500 py-1">
              <Loader2 className="size-4 animate-spin text-[#b51c00] flex-shrink-0" />
              <span className="text-sm font-semibold animate-pulse">Locating address...</span>
            </div>
          ) : (
            <div className="flex gap-2 items-start py-0.5">
              <MapPin className="size-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-gray-900 leading-snug">
                {geocodedAddress || 'Drag map to select location'}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            if (centerCoords) {
              onConfirm(centerCoords, geocodedAddress, geocodedPincode)
            }
          }}
          disabled={reverseGeocoding || !geocodedAddress}
          className="w-full h-14 bg-[#b51c00] hover:bg-[#a01700] disabled:bg-gray-300 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-75 disabled:pointer-events-none shadow-lg shadow-[#b51c00]/10"
        >
          Confirm Location
        </button>
      </div>
    </div>
  )
}
