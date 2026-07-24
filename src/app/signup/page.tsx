'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { User, Phone, KeyRound, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'details' | 'otp'>('details')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [showSplash, setShowSplash] = useState(false)
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
    if (!agreed) { toast.error('Please agree to the Terms & Conditions'); return }
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
          name,
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
        Sentry.captureMessage('Signup OTP verified but session exchange failed', {
          level: 'error',
          extra: { message: signInErr.message, status: signInErr.status },
        })
        toast.error('Verification succeeded, but login failed. Please try logging in.')
        setLoading(false)
        return
      }

      toast.success('Account created successfully!')
      setShowSplash(true)
      setLoading(false)

      setTimeout(() => {
        router.push('/location')
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
          <div className="w-36 h-36 rounded-full bg-white flex items-center justify-center mb-6 shadow-xl shadow-red-100/50 border border-red-50/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Wali Baba Foods" className="w-24 h-24 object-contain animate-pulse" />
          </div>

          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Wali Baba Foods</h2>
          <p className="text-xs text-gray-400 mt-1 font-semibold italic text-center">
            The Royal Taste of Tradition
          </p>

          <div className="mt-8 bg-red-50/80 px-4 py-2 rounded-2xl border border-red-100/30 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#c0392b] animate-ping" />
            <span className="text-[11px] font-extrabold text-[#c0392b]">
              Creating Account for {name || 'Foodie'}...
            </span>
          </div>

          <p className="text-[10px] text-gray-400 mt-3 font-semibold">
            Setting up your address profile...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-white">

      {/* ── Hero: food photo with brand overlay ── */}
      <div className="relative h-52 flex-shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Wali Baba Foods" className="w-24 h-24 object-contain drop-shadow-2xl" />
        </div>
      </div>

      {/* ── White form card ── */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-5 relative z-10 px-6 pt-6 pb-10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">

        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Create Account</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {step === 'details' ? 'Join the circle of authentic flavors.' : `Enter the 6-digit OTP sent to +91 ${cleanPhone.slice(-10)}`}
          </p>
        </div>

        {step === 'details' ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide">Full Name</label>
              <div className="relative flex items-center border-b border-gray-200 pb-2 focus-within:border-[#c0392b] transition-colors">
                <User className="size-4 text-gray-300 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-300 outline-none"
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide">Mobile Number</label>
              <div className="relative flex items-center border-b border-gray-200 pb-2 focus-within:border-[#c0392b] transition-colors">
                <Phone className="size-4 text-gray-300 mr-3 flex-shrink-0" />
                <span className="text-sm font-bold text-gray-700 mr-2">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-300 outline-none font-medium tracking-wide"
                />
              </div>
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[#c0392b] flex-shrink-0"
              />
              <span className="text-xs text-gray-400 leading-relaxed">
                I agree to the <span className="text-[#c0392b] font-semibold">Terms &amp; Conditions</span> and <span className="text-[#c0392b] font-semibold">Privacy Policy</span>
              </span>
            </label>

            {/* Send OTP CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 bg-[#c0392b] hover:bg-[#a93226] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 mt-2 active:scale-[0.98] transition-all disabled:opacity-60 shadow-md shadow-[#c0392b]/30 cursor-pointer"
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
                  onClick={() => setStep('details')}
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
              className="w-full h-13 bg-[#c0392b] hover:bg-[#a93226] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 mt-2 active:scale-[0.98] transition-all disabled:opacity-60 shadow-md shadow-[#c0392b]/30 cursor-pointer"
            >
              <span>{loading ? 'Verifying…' : 'Verify OTP & Create Account'}</span>
              {!loading && <CheckCircle2 className="size-4" />}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-[#c0392b] font-semibold hover:underline">
            Log in here
          </Link>
        </p>

        <p className="mt-10 text-center text-[10px] text-gray-300 font-semibold tracking-widest uppercase">
          Wali Baba Foods &copy; 2026 &bull; Royal Mughlai Cuisine
        </p>
      </div>
    </div>
  )
}