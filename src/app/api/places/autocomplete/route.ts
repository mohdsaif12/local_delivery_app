import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const input = searchParams.get('input')

  if (!input || !input.trim()) {
    return NextResponse.json({ predictions: [] })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps key is not configured' }, { status: 500 })
  }

  try {
    // Kanpur center bias (26.4499, 80.3319) with 25km radius
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input
    )}&components=country:in&location=26.4499,80.3319&radius=25000&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return NextResponse.json({ predictions: data.predictions || [] })
    }

    // Fallback if legacy Place Autocomplete is blocked on backend: use Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      input + ', Kanpur'
    )}&components=country:IN&key=${apiKey}`
    const geoRes = await fetch(geocodeUrl)
    const geoData = await geoRes.json()

    if (geoData.status === 'OK' && geoData.results) {
      const fallbackPredictions = geoData.results.map((item: any) => ({
        place_id: item.place_id,
        description: item.formatted_address,
        structured_formatting: {
          main_text: item.address_components?.[0]?.long_name || item.formatted_address.split(',')[0],
          secondary_text: item.formatted_address,
        },
        geometry: item.geometry,
      }))
      return NextResponse.json({ predictions: fallbackPredictions })
    }

    return NextResponse.json({ predictions: [], error: data.error_message || data.status })
  } catch (error) {
    console.error('Error in places autocomplete route handler:', error)
    return NextResponse.json({ error: 'Internal server error during places search' }, { status: 500 })
  }
}
