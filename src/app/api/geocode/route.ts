import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!address && (!lat || !lng)) {
    return NextResponse.json({ error: 'Either address or lat/lng query parameters are required' }, { status: 400 })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps key is not configured' }, { status: 500 })
  }

  try {
    let url = ''
    if (lat && lng) {
      url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    } else {
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address!)}&key=${apiKey}`
    }
    const response = await fetch(url)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in geocoding route handler:', error)
    return NextResponse.json({ error: 'Internal server error during geocoding' }, { status: 500 })
  }
}

