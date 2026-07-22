import { NextRequest, NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-webhook-secret',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.TWOFACTOR_API_KEY
    if (!apiKey) {
      console.error('[SMS Webhook] TWOFACTOR_API_KEY is missing')
      return NextResponse.json({ error: 'SMS API key missing' }, { status: 500, headers: CORS_HEADERS })
    }

    const payload = await req.json()
    console.log('[SMS Webhook] Received payload:', JSON.stringify(payload))

    // Handle Supabase Webhook payload format vs direct payload format
    let rawPhone = payload.sms?.phone || payload.phone || payload.user?.phone
    let otp = payload.sms?.otp || payload.otp

    if (!rawPhone || !otp) {
      return NextResponse.json({ error: 'Missing phone or OTP in payload' }, { status: 400, headers: CORS_HEADERS })
    }

    // Strip non-digits and normalise to 10-digit local number
    let cleanPhone = String(rawPhone).replace(/\D/g, '')
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10)

    // 2Factor AUTOGEN SMS endpoint requires international format with leading +
    const intlPhone = `+91${cleanPhone}`

    console.log(`[SMS Webhook] Sending AUTOGEN OTP to ${intlPhone} via 2Factor.in`)

    // Use AUTOGEN endpoint so 2Factor sends via SMS (not voice).
    // OTP_VERIFICATION = DLT-approved template with sender BBRYNI
    // Passing a raw numeric OTP in the path triggers voice fallback on 2Factor.
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/${intlPhone}/AUTOGEN/OTP_VERIFICATION`
    const res = await fetch(url, { method: 'GET' })
    const resData = await res.json()

    console.log('[SMS Webhook] 2Factor.in response:', resData)

    if (resData.Status === 'Success' || resData.status === 'Success') {
      return NextResponse.json({ ok: true, details: resData }, { headers: CORS_HEADERS })
    } else {
      return NextResponse.json(
        { ok: false, error: resData.Details || resData.details || '2Factor.in failed' },
        { status: 400, headers: CORS_HEADERS }
      )
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[SMS Webhook] Exception:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500, headers: CORS_HEADERS })
  }
}
