import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get('place_id')

  if (!placeId) {
    return NextResponse.json({ error: 'place_id parameter is required' }, { status: 400 })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps key is not configured' }, { status: 500 })
  }

  try {
    // Try Place Details API first
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&fields=geometry,formatted_address,address_components&key=${apiKey}`

    const response = await fetch(detailsUrl)
    const data = await response.json()

    if (data.status === 'OK' && data.result) {
      return NextResponse.json({ result: data.result })
    }

    // Fallback: Geocoding API by place_id
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(
      placeId
    )}&key=${apiKey}`
    const geoRes = await fetch(geocodeUrl)
    const geoData = await geoRes.json()

    if (geoData.status === 'OK' && geoData.results && geoData.results.length > 0) {
      return NextResponse.json({ result: geoData.results[0] })
    }

    return NextResponse.json({ error: data.error_message || 'Could not fetch place details' }, { status: 400 })
  } catch (error) {
    console.error('Error in place details route handler:', error)
    return NextResponse.json({ error: 'Internal server error during place details lookup' }, { status: 500 })
  }
}
