/**
 * Message Central VerifyNow - Server-side service module
 *
 * Handles:
 * - Token generation (GET /auth/v1/authentication/token)
 * - Token caching (7-day in-memory cache, auto-refresh on expiry)
 * - Send OTP     (POST /verification/v3/send)
 * - Verify OTP   (GET  /verification/v3/validateOtp)
 *
 * All credentials stay server-side. Nothing is exposed to the frontend.
 */

const BASE_URL = process.env.MESSAGE_CENTRAL_BASE_URL ?? 'https://cpaas.messagecentral.com'
const CUSTOMER_ID = process.env.MESSAGE_CENTRAL_CUSTOMER_ID!
const PASSWORD = process.env.MESSAGE_CENTRAL_PASSWORD!

// ── In-process token cache ────────────────────────────────────────────────────
// Next.js server-side module state persists between requests in the same
// process. This avoids a token API call on every OTP request.
let cachedToken: string | null = null
let tokenExpiresAt = 0 // epoch ms

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ── Token generation ──────────────────────────────────────────────────────────
async function generateToken(): Promise<string> {
  if (!CUSTOMER_ID || !PASSWORD) {
    throw new Error('MESSAGE_CENTRAL_CUSTOMER_ID or MESSAGE_CENTRAL_PASSWORD is not set')
  }

  // API requires Base64-encoded password
  const b64Password = Buffer.from(PASSWORD).toString('base64')

  const url = new URL(`${BASE_URL}/auth/v1/authentication/token`)
  url.searchParams.set('customerId', CUSTOMER_ID)
  url.searchParams.set('key', b64Password)
  url.searchParams.set('scope', 'NEW')

  console.log('[MC] Generating new auth token…')
  const res = await fetch(url.toString(), { method: 'GET' })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[MC] Token generation failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  console.log('[MC] Token response:', JSON.stringify(data))

  // Response shape: { token: "...", ... }
  const token: string = data?.token ?? data?.data?.token ?? data?.authToken

  if (!token) {
    throw new Error(`[MC] Token not found in response: ${JSON.stringify(data)}`)
  }

  return token
}

// ── Cached token getter (auto-refresh) ────────────────────────────────────────
async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  cachedToken = await generateToken()
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS
  console.log('[MC] Token cached, expires in 7 days')
  return cachedToken
}

// ── Send OTP ──────────────────────────────────────────────────────────────────
export interface SendOtpResult {
  verificationId: string
}

export async function sendOtp(mobileNumber: string): Promise<SendOtpResult> {
  // mobileNumber should be 10 digits (India)
  const token = await getToken()

  const url = new URL(`${BASE_URL}/verification/v3/send`)
  url.searchParams.set('countryCode', '91')
  url.searchParams.set('customerId', CUSTOMER_ID)
  url.searchParams.set('flowType', 'SMS')
  url.searchParams.set('mobileNumber', mobileNumber)
  url.searchParams.set('otpLength', '6')

  console.log(`[MC] Sending OTP to 91${mobileNumber}`)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { authToken: token },
  })

  const data = await res.json()
  console.log('[MC] Send OTP response:', JSON.stringify(data))

  if (!res.ok) {
    // Token may have expired server-side — invalidate cache and retry once
    if (res.status === 401) {
      console.warn('[MC] Token rejected (401), refreshing token and retrying…')
      cachedToken = null
      tokenExpiresAt = 0
      return sendOtp(mobileNumber) // one retry
    }
    throw new Error(data?.message ?? `Send OTP failed (${res.status})`)
  }

  // Response shape: { data: { verificationId: "..." }, ... }
  const verificationId: string =
    data?.data?.verificationId ?? data?.verificationId

  if (!verificationId) {
    throw new Error(`[MC] verificationId not found in response: ${JSON.stringify(data)}`)
  }

  return { verificationId }
}

// ── Verify OTP ────────────────────────────────────────────────────────────────
export interface VerifyOtpResult {
  success: boolean
  message: string
}

export async function verifyOtp(
  mobileNumber: string,
  verificationId: string,
  code: string
): Promise<VerifyOtpResult> {
  const token = await getToken()

  const url = new URL(`${BASE_URL}/verification/v3/validateOtp`)
  url.searchParams.set('countryCode', '91')
  url.searchParams.set('mobileNumber', mobileNumber)
  url.searchParams.set('verificationId', verificationId)
  url.searchParams.set('customerId', CUSTOMER_ID)
  url.searchParams.set('code', code)

  console.log(`[MC] Verifying OTP for 91${mobileNumber}, verificationId=${verificationId}`)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { authToken: token },
  })

  const data = await res.json()
  console.log('[MC] Verify OTP response:', JSON.stringify(data))

  if (res.status === 401) {
    // Stale token — refresh and retry once
    console.warn('[MC] Token rejected on verify (401), refreshing and retrying…')
    cachedToken = null
    tokenExpiresAt = 0
    return verifyOtp(mobileNumber, verificationId, code)
  }

  // Success check: responseCode 200 or type "success"
  const isSuccess =
    data?.responseCode === 200 ||
    data?.data?.verificationStatus === 'VERIFICATION_COMPLETED' ||
    String(data?.message ?? '').toLowerCase().includes('success')

  return {
    success: isSuccess,
    message: data?.message ?? (isSuccess ? 'Verified' : 'Verification failed'),
  }
}
