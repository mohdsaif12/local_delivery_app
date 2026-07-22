import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendOtp } from '@/lib/messagecentral'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400, headers: CORS_HEADERS })
    }

    // Normalize to exactly 10 digits
    let cleanPhone = String(phone).replace(/\D/g, '')
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10)
    if (cleanPhone.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit mobile number required' }, { status: 400, headers: CORS_HEADERS })
    }

    // Send OTP via Message Central — returns verificationId
    const { verificationId } = await sendOtp(cleanPhone)

    // Wrap verificationId in a signed token so the frontend can't tamper with it
    const secret = process.env.MESSAGE_CENTRAL_PASSWORD ?? process.env.MSG91_AUTH_KEY ?? 'fallback-secret'
    const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes
    const payload = `${cleanPhone}:${verificationId}:${expiresAt}`
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const sessionId = Buffer.from(
      JSON.stringify({ phone: cleanPhone, vid: verificationId, expiresAt, sig })
    ).toString('base64url')

    return NextResponse.json({ ok: true, sessionId }, { headers: CORS_HEADERS })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[MC Send OTP] Exception:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500, headers: CORS_HEADERS })
  }
}
