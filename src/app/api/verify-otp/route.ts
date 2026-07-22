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
    const { phone, otp, sessionId, name } = await req.json()
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

    // Ask Message Central to validate the OTP
    const result = await verifyOtp(cleanPhone, verificationId, String(otp).trim())
    console.log(`[MC Verify OTP] Result for +91${cleanPhone}:`, result)

    if (!result.success) {
      const friendly = result.message.toLowerCase().includes('expire')
        ? 'OTP has expired. Please request a new code.'
        : 'Incorrect OTP code. Please try again.'
      return NextResponse.json({ ok: false, error: friendly }, { status: 400, headers: CORS_HEADERS })
    }

    console.log(`[MC Verify OTP] Verification successful for +91${cleanPhone}`)

    // OTP verified — create or retrieve Supabase user via Admin SDK
    const admin = getSupabaseAdmin()
    const syntheticEmail = `${cleanPhone}@phone.walibaba.in`
    const syntheticPassword = `WaliBaba#${cleanPhone}!2026`

    let userId: string | null = null

    // 1. Check if user already exists in profiles table
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, full_name, phone')
      .eq('phone', cleanPhone)
      .maybeSingle()

    if (existingProfile) {
      userId = existingProfile.id
      if (name && !existingProfile.full_name) {
        await admin.from('profiles').update({ full_name: name }).eq('id', userId)
      }
    }

    // 2. If not found in profiles, try creating in Supabase Auth
    if (!userId) {
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: {
          full_name: name || 'Foodie',
          phone: cleanPhone,
          role: 'customer',
        },
      })

      if (newUser?.user) {
        userId = newUser.user.id
      } else if (createErr) {
        const errStr = (createErr.message || '').toLowerCase()
        const isAlreadyRegistered =
          createErr.code === 'email_exists' ||
          errStr.includes('already registered') ||
          errStr.includes('already been registered') ||
          createErr.status === 422

        if (!isAlreadyRegistered) {
          console.error('[Verify OTP] User creation error:', createErr)
          return NextResponse.json({ error: createErr.message }, { status: 400, headers: CORS_HEADERS })
        }
      }
    }

    // 3. If userId is still null (user existed in Auth but not in profiles table), find user in Auth
    if (!userId) {
      const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const foundUser = usersData?.users?.find((u) => u.email === syntheticEmail)
      if (foundUser) {
        userId = foundUser.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Failed to locate or create user account' }, { status: 500, headers: CORS_HEADERS })
    }

    // 4. Ensure password is set so client signInWithPassword will succeed
    await admin.auth.admin.updateUserById(userId, { password: syntheticPassword })

    // 5. Ensure profile row exists in database
    await admin.from('profiles').upsert({
      id: userId,
      full_name: name || 'Foodie',
      phone: cleanPhone,
      role: 'customer',
    })

    return NextResponse.json(
      { ok: true, email: syntheticEmail, password: syntheticPassword, userId },
      { headers: CORS_HEADERS }
    )
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[Verify OTP] Exception:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500, headers: CORS_HEADERS })
  }
}
