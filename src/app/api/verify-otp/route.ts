import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { verifyOtp } from '@/lib/messagecentral'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const getSupabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, sessionId, name, firstName, lastName } = await req.json()
    if (!phone || !otp || !sessionId) {
      return NextResponse.json({ error: 'Phone, OTP, and sessionId are required' }, { status: 400, headers: CORS_HEADERS })
    }

    // Normalize to 10 digits
    let cleanPhone = String(phone).replace(/\D/g, '')
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10)

    // Decode and verify the signed session token
    let tokenData: { phone: string; vid: string; expiresAt: number; sig: string }
    try {
      tokenData = JSON.parse(Buffer.from(sessionId, 'base64url').toString('utf8'))
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid session token' }, { status: 400, headers: CORS_HEADERS })
    }

    const { phone: tokenPhone, vid: verificationId, expiresAt, sig } = tokenData

    // Check expiry
    if (Date.now() > expiresAt) {
      return NextResponse.json({ ok: false, error: 'OTP has expired. Please request a new code.' }, { status: 400, headers: CORS_HEADERS })
    }

    // Verify HMAC signature
    const secret = process.env.MESSAGE_CENTRAL_PASSWORD ?? process.env.MSG91_AUTH_KEY ?? 'fallback-secret'
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${tokenPhone}:${verificationId}:${expiresAt}`)
      .digest('hex')
    if (sig !== expectedSig) {
      return NextResponse.json({ ok: false, error: 'Invalid session signature' }, { status: 400, headers: CORS_HEADERS })
    }

    // Verify phone match
    if (cleanPhone !== tokenPhone) {
      return NextResponse.json({ ok: false, error: 'Phone number mismatch' }, { status: 400, headers: CORS_HEADERS })
    }

    // Ask Message Central to validate the OTP, or bypass if verificationId is mock and otp is correct
    const isMock = verificationId === 'mock-verification-id'
    let success = false
    let message = ''

    if (isMock) {
      if (String(otp).trim() === '123456') {
        success = true
        message = 'Mock OTP verified successfully'
      } else {
        success = false
        message = 'Incorrect OTP code. Use 123456 for test login.'
      }
    } else {
      const result = await verifyOtp(cleanPhone, verificationId, String(otp).trim())
      success = result.success
      message = result.message
    }

    console.log(`[MC Verify OTP] Result for +91${cleanPhone} (isMock=${isMock}):`, { success, message })

    if (!success) {
      const friendly = message.toLowerCase().includes('expire')
        ? 'OTP has expired. Please request a new code.'
        : message
      return NextResponse.json({ ok: false, error: friendly }, { status: 400, headers: CORS_HEADERS })
    }

    console.log(`[MC Verify OTP] Verification successful for +91${cleanPhone}`)

    // OTP verified. Mint a Supabase session server-side via a one-time
    // magic-link token, which the browser exchanges for a real session — no
    // passwords anywhere. For type 'magiclink', generateLink also creates the
    // auth user if none exists and returns the authoritative auth user, so
    // profiles.id can never desync from auth.users.id (the bug in the old
    // password-reset flow, which caused "Invalid login credentials").
    const admin = getSupabaseAdmin()
    const syntheticEmail = `${cleanPhone}@phone.walibaba.in`

    // Ensure a CONFIRMED auth user exists first. If we let generateLink create
    // the user, the first token it returns for a brand-new/unconfirmed user is
    // not a clean magic-link token, so verifyOtp('magiclink') fails with
    // "otp_expired" on the first try (it only worked on retry once the user
    // existed). Creating the confirmed user up-front makes the first attempt
    // deterministic. This is idempotent — an "already registered" error is fine.
    await admin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: {
        full_name: name || 'Foodie',
        first_name: firstName ?? null,
        last_name: lastName ?? null,
        phone: cleanPhone,
        role: 'customer',
      },
    })

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: syntheticEmail,
    })

    if (linkErr || !linkData?.properties?.hashed_token || !linkData.user) {
      console.error('[Verify OTP] generateLink failed:', linkErr)
      return NextResponse.json(
        { ok: false, error: linkErr?.message || 'Could not create login session' },
        { status: 500, headers: CORS_HEADERS }
      )
    }

    const userId = linkData.user.id

    // Ensure a profiles row exists, keyed on the authoritative auth id. Preserve
    // an existing name (login doesn't send one); phone OTP is always a customer.
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('full_name, first_name, last_name')
      .eq('id', userId)
      .maybeSingle()

    await admin.from('profiles').upsert({
      id: userId,
      full_name: name || existingProfile?.full_name || 'Foodie',
      first_name: firstName || existingProfile?.first_name || null,
      last_name: lastName || existingProfile?.last_name || null,
      phone: cleanPhone,
      role: 'customer',
    })

    // token_hash is single-use and short-lived; the client verifies it
    // immediately with supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
    return NextResponse.json(
      { ok: true, tokenHash: linkData.properties.hashed_token, userId },
      { headers: CORS_HEADERS }
    )
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[Verify OTP] Exception:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500, headers: CORS_HEADERS })
  }
}
