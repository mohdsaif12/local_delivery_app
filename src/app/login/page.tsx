'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { Phone, KeyRound, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [showSplash, setShowSplash] = useState(false)
  const [userName, setUserName] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => setResendCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  const cleanPhone = phone.replace(/\D/g, '')

  const [sessionId, setSessionId] = useState('')

  async function handleSendOtp(e: React.SyntheticEvent) {
    e.preventDefault()
    if (cleanPhone.length < 10) { toast.error('Please enter a valid 10-digit mobile number'); return }

    setLoading(true)

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone.slice(-10) }),
      })
      const data = await res.json()
      setLoading(false)

      if (!res.ok || !data.ok) {
        toast.error(data.error || 'Failed to send OTP via SMS')
        return
      }

      setSessionId(data.sessionId)
      toast.success(`OTP sent to +91 ${cleanPhone.slice(-10)}`)
      setStep('otp')
      setResendCountdown(30)
    } catch {
      setLoading(false)
      toast.error('Failed to send OTP. Please check your internet connection.')
    }
  }

  async function handleVerifyOtp(e: React.SyntheticEvent) {
    e.preventDefault()
    if (otp.length < 6) { toast.error('Please enter the full 6-digit OTP'); return }
    if (!sessionId) { toast.error('Session expired. Please resend OTP.'); return }

    setLoading(true)

    try {
      // 1. Verify OTP with 2Factor.in & create/get Supabase user via Vercel API
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone.slice(-10),
          otp: otp.trim(),
          sessionId,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        toast.error(data.error || 'Invalid OTP code')
        setLoading(false)
        return
      }

      // 2. Exchange the server-minted magic-link token for a real session
      const supabase = createClient()

      const { error: signInErr } = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: 'magiclink',
      })

      if (signInErr) {
        // Gracefully-handled errors don't throw, so Sentry won't auto-capture
        // this — report it explicitly so a broken login is never invisible.
        Sentry.captureMessage('OTP verified but session exchange failed', {
          level: 'error',
          extra: { message: signInErr.message, status: signInErr.status },
        })
        toast.error('Verification succeeded, but login failed. Please try again.')
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles').select('role, full_name').eq('id', user.id).single()

      const name = profile?.full_name || user.user_metadata?.full_name || 'Foodie'
      setUserName(name)

      // Decide destination before showing splash
      let destination = '/menu'
      if (profile?.role === 'restaurant') {
        destination = '/restaurant/dashboard'
      } else {
        const { count } = await supabase
          .from('addresses')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', user.id)
        destination = count && count > 0 ? '/menu' : '/location'
      }

      setShowSplash(true)
      setLoading(false)

      setTimeout(() => {
        router.push(destination)
        router.refresh()
      }, 2000)
    } catch {
      setLoading(false)
      toast.error('Verification failed. Please try again.')
    }
  }

  if (showSplash) {
    return (
      <div 
        className="min-h-[100dvh] phone-screen flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(170deg, #ffffff 0%, #fff8f7 40%, #fff3f0 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden>
          <span className="absolute top-1/4 left-1/4 text-4xl opacity-15 animate-bounce" style={{ animationDelay: '0.2s' }}>🍛</span>
          <span className="absolute top-1/3 right-1/4 text-4xl opacity-15 animate-bounce" style={{ animationDelay: '0.5s' }}>🍗</span>
          <span className="absolute bottom-1/3 left-1/3 text-4xl opacity-15 animate-bounce" style={{ animationDelay: '0.8s' }}>🫓</span>
          <span className="absolute bottom-1/4 right-1/3 text-4xl opacity-15 animate-bounce" style={{ animationDelay: '1.1s' }}>🍧</span>
        </div>

        <div className="flex flex-col items-center justify-center z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Wali Baba Foods" className="w-32 h-32 object-contain drop-shadow-xl animate-pulse" />
          </div>

          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Wali Baba Foods</h2>
          <p className="text-xs text-[#c0392b] mt-1 font-bold italic text-center">
            Taste of Kanpur
          </p>

          {/* Parent brand attribution — matches the welcome splash */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <span
              className="font-semibold text-gray-500 tracking-wide whitespace-nowrap"
              style={{ fontSize: '15px' }}
            >
              A Product of Baba Biryani
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/baba-biryani-logo.png"
              alt="Baba Biryani"
              /* Sizing inline to match the welcome splash, where utility
                 classes were not reaching the device. */
              style={{ height: '34px', width: 'auto', maxWidth: '60px', objectFit: 'contain' }}
            />
          </div>

          <div className="mt-8 bg-red-50/80 px-4 py-2 rounded-2xl border border-red-100/30 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#c0392b] animate-ping" />
            <span className="text-[11px] font-extrabold text-[#c0392b]">
              Welcome back, {userName}!
            </span>
          </div>

          <p className="text-[10px] text-gray-400 mt-3 font-semibold">
            Preparing your royal kitchen menu...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-[100dvh] phone-screen flex flex-col"
      style={{ background: 'linear-gradient(160deg, #fff5f5 0%, #fff9f0 50%, #ffffff 100%)' }}
    >
      {/* ── Brand Header ── */}
      <div className="flex flex-col items-center pt-12 pb-6 px-6">
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Wali Baba Foods" className="w-28 h-28 object-contain drop-shadow-lg" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#1a3d1a] tracking-tight">Wali Baba Foods</h1>
        <p className="text-sm text-gray-400 mt-1 text-center">Authentic flavors, delivered to your doorstep.</p>
      </div>

      {/* ── Form Card ── */}
      <div className="mx-5 flex-1">
        <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-gray-100 px-6 py-7">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome Back</h2>
          <p className="text-xs text-gray-400 mb-5">
            {step === 'phone' ? 'Enter your registered mobile number to receive an OTP' : `Enter the 6-digit OTP sent to +91 ${cleanPhone.slice(-10)}`}
          </p>

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mobile Number</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 h-12 focus-within:border-[#c0392b] transition-colors bg-white">
                  <Phone className="size-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-bold text-gray-700">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoFocus
                    className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-300 outline-none font-medium tracking-wide"
                  />
                </div>
              </div>

              {/* Login CTA */}
              <button
                type="submit"
                disabled={loading || cleanPhone.length < 10}
                className="w-full h-12 bg-[#c0392b] hover:bg-[#a93226] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 mt-2 active:scale-[0.98] transition-all disabled:opacity-60 shadow-md shadow-[#c0392b]/25 cursor-pointer"
              >
                <span>{loading ? 'Sending OTP…' : 'Send OTP'}</span>
                {!loading && <ArrowRight className="size-4" />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              {/* OTP Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-gray-500 tracking-wide">6-Digit OTP</label>
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    className="text-xs font-bold text-[#c0392b] hover:underline"
                  >
                    Change Number
                  </button>
                </div>
                <div className="relative flex items-center border-b-2 border-[#c0392b] pb-2">
                  <KeyRound className="size-5 text-[#c0392b] mr-3 flex-shrink-0" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="flex-1 bg-transparent text-2xl font-extrabold tracking-[0.4em] text-gray-900 placeholder:text-gray-300 outline-none text-center"
                  />
                </div>
              </div>

              {/* Resend button */}
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-gray-400">Didn&apos;t receive SMS?</span>
                <button
                  type="button"
                  disabled={resendCountdown > 0 || loading}
                  onClick={handleSendOtp}
                  className="text-xs font-bold text-[#c0392b] disabled:opacity-40 flex items-center gap-1"
                >
                  <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
                </button>
              </div>

              {/* Verify CTA */}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full h-12 bg-[#c0392b] hover:bg-[#a93226] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 mt-1 active:scale-[0.98] transition-all disabled:opacity-60 shadow-md shadow-[#c0392b]/25 cursor-pointer"
              >
                <span>{loading ? 'Verifying…' : 'Verify & Login'}</span>
                {!loading && <CheckCircle2 className="size-4" />}
              </button>
            </form>
          )}

          {/* Footer links */}
          <p className="mt-6 text-center text-sm text-gray-400">
            New to Wali Baba Foods?{' '}
            <Link href="/signup" className="text-[#c0392b] font-semibold hover:underline">
              Create an Account
            </Link>
          </p>

          <p className="mt-10 text-center text-[10px] text-gray-300 font-semibold tracking-widest uppercase">
            Wali Baba Foods &copy; 2026 &bull; Royal Mughlai Cuisine
          </p>
        </div>
      </div>

      {/* Restaurant owner link */}
      <div className="pb-8 text-center">
        <Link href="/restaurant/login" className="text-xs text-gray-400 hover:text-[#c0392b]">
          Restaurant owner? <span className="font-semibold text-[#c0392b]">Restaurant Login</span>
        </Link>
      </div>
    </div>
  )
}