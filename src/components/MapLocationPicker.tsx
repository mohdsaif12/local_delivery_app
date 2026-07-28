'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { Navigation, Loader2, ChevronLeft, MapPin, Search, X } from 'lucide-react'

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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const skipNextGeocodeRef = useRef(false)
  const lastGeocodedCoordsRef = useRef<Coords | null>(null)

  const [locating, setLocating] = useState(false)
  const [reverseGeocoding, setReverseGeocoding] = useState(false)
  const [isMapMoving, setIsMapMoving] = useState(false)
  const [error, setError] = useState('')

  const [centerCoords, setCenterCoords] = useState<Coords | null>(null)
  const [geocodedAddress, setGeocodedAddress] = useState('')
  const [geocodedPincode, setGeocodedPincode] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([])

  async function handleReverseGeocode(lat: number, lng: number) {
    // If coordinate shift is negligible (less than ~5 meters), skip reverse geocoding to save API calls
    if (lastGeocodedCoordsRef.current) {
      const dLat = Math.abs(lastGeocodedCoordsRef.current.lat - lat)
      const dLng = Math.abs(lastGeocodedCoordsRef.current.lng - lng)
      if (dLat < 0.00005 && dLng < 0.00005) {
        return
      }
    }

    setReverseGeocoding(true)
    setError('')
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
      if (!res.ok) {
        throw new Error(`Reverse geocoding failed with status: ${res.status}`)
      }
      const data = await res.json()
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0]
        setGeocodedAddress(result.formatted_address)
        lastGeocodedCoordsRef.current = { lat, lng }

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

  function handleSearchInputChange(value: string) {
    setSearchQuery(value)

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)

    if (!value.trim()) {
      setSuggestions([])
      return
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(value)}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.predictions) {
          setSuggestions(data.predictions)
        } else {
          setSuggestions([])
        }
      } catch (err) {
        console.error('Error fetching autocomplete suggestions:', err)
        setSuggestions([])
      }
    }, 300)
  }

  async function handleSelectSuggestion(suggestion: any) {
    setSearchQuery(suggestion.description)
    setSuggestions([])

    if (!mapInstanceRef.current) return

    setReverseGeocoding(true)
    setError('')
    try {
      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(suggestion.place_id)}`)
      const data = await res.json()
      setReverseGeocoding(false)

      if (data.result && data.result.geometry?.location) {
        const loc = data.result.geometry.location
        const coords = { lat: loc.lat ?? loc.lat(), lng: loc.lng ?? loc.lng() }

        skipNextGeocodeRef.current = true
        mapInstanceRef.current?.panTo(coords)
        mapInstanceRef.current?.setZoom(17)
        setCenterCoords(coords)

        setGeocodedAddress(data.result.formatted_address || suggestion.description)
        lastGeocodedCoordsRef.current = coords

        let pin = ''
        if (data.result.address_components) {
          for (const comp of data.result.address_components) {
            if (comp.types.includes('postal_code')) {
              pin = comp.long_name
              break
            }
          }
        }
        setGeocodedPincode(pin)
      } else {
        setError('Could not retrieve details for the selected location.')
      }
    } catch (err) {
      console.error('Error fetching place details:', err)
      setReverseGeocoding(false)
      setError('Could not retrieve details for the selected location.')
    }
  }

  function handleClearSearch() {
    setSearchQuery('')
    setSuggestions([])
  }

  useEffect(() => {
    let isMounted = true
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    if (!apiKey) return

    ensureMapsOptions(apiKey)

    Promise.all([
      importLibrary('maps'),
      importLibrary('core'),
    ]).then(async ([{ Map }]) => {
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

          if (skipNextGeocodeRef.current) {
            skipNextGeocodeRef.current = false
            return
          }

          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
          }
          debounceTimerRef.current = setTimeout(() => {
            handleReverseGeocode(latVal, lngVal)
          }, 500)
        }
      })
    })

    return () => {
      isMounted = false
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
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

        {/* Search Address Overlay */}
        <div className="absolute top-4 inset-x-4 z-30 flex flex-col gap-2">
          <div className="relative flex items-center bg-white rounded-2xl shadow-xl border border-gray-100 px-3.5 h-12">
            <Search className="size-4 text-gray-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search area, locality or street…"
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none font-semibold"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 active:scale-95 transition-all"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Autocomplete suggestions overlay list */}
          {suggestions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden flex flex-col max-h-64 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left px-4 py-3 hover:bg-red-50/50 flex items-start gap-2.5 border-b border-gray-50 last:border-b-0 active:bg-red-50 transition-colors"
                >
                  <MapPin className="size-4 text-[#b51c00] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">
                      {suggestion.structured_formatting.main_text}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {suggestion.structured_formatting.secondary_text || suggestion.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Drag hint — shown only when no suggestions are open */}
          {suggestions.length === 0 && (
            <div className="flex items-center gap-1.5 bg-black/50 self-start rounded-full px-3 py-1.5 backdrop-blur-sm">
              <span className="text-base leading-none">👆</span>
              <p className="text-[11px] font-semibold text-white leading-none">
                Drag map to move pin
              </p>
            </div>
          )}
        </div>

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
