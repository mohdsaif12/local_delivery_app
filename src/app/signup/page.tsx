'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import Link from 'next/link'
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignup(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!agreed) { toast.error('Please agree to the Terms & Conditions'); return }
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: 'customer', full_name: name, phone } },
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr) {
      toast.success('Account created! Please check your email to confirm.')
      router.push('/login')
      return
    }

    toast.success('Welcome to DirectDine!')
    router.push('/menu')
    router.refresh()
  }

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      {/* Hero image header */}
      <div className="relative h-52 bg-[#b51c00] flex-shrink-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
            <span className="text-3xl">🍛</span>
          </div>
          <span className="text-xl font-bold tracking-tight">DirectDine</span>
        </div>
      </div>

      {/* Form card — overlaps hero */}
      <div className="flex-1 bg-white -mt-6 rounded-t-2xl px-5 pt-6 pb-8" style={{ boxShadow: '0 -4px 20px rgba(45,52,54,0.08)' }}>
        <h2 className="text-xl font-bold text-[#191c1d]">Create Account</h2>
        <p className="text-sm text-[#586062] mt-0.5 mb-5">Join the circle of authentic flavors.</p>

        <form onSubmit={handleSignup} className="space-y-3">
          {/* Full Name */}
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#586062]" />
            <Input
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-14 pl-12 rounded-lg bg-[#f3f4f5] border-none text-[#191c1d] placeholder:text-[#906f69]/60 focus-visible:ring-1 focus-visible:ring-[#b51c00]"
            />
          </div>

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#586062]" />
            <Input
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-14 pl-12 rounded-lg bg-[#f3f4f5] border-none text-[#191c1d] placeholder:text-[#906f69]/60 focus-visible:ring-1 focus-visible:ring-[#b51c00]"
            />
          </div>

          {/* Phone */}
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#586062]" />
            <Input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-14 pl-12 rounded-lg bg-[#f3f4f5] border-none text-[#191c1d] placeholder:text-[#906f69]/60 focus-visible:ring-1 focus-visible:ring-[#b51c00]"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#586062]" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-14 pl-12 pr-12 rounded-lg bg-[#f3f4f5] border-none text-[#191c1d] placeholder:text-[#906f69]/60 focus-visible:ring-1 focus-visible:ring-[#b51c00]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#586062]"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-[#b51c00]"
            />
            <span className="text-xs text-[#586062] leading-relaxed">
              I agree to the{' '}
              <span className="text-[#b51c00] font-semibold">Terms &amp; Conditions</span>{' '}
              and{' '}
              <span className="text-[#b51c00] font-semibold">Privacy Policy</span>
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-[#b51c00] text-white font-semibold rounded-lg flex items-center justify-center gap-2 mt-2 active:scale-95 transition-all disabled:opacity-70"
          >
            <span>{loading ? 'Creating account…' : 'Sign Up'}</span>
            {!loading && <ArrowRight className="size-5" />}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-5">
          <div className="flex-1 h-px bg-[#e5beb6]/30" />
          <span className="text-xs font-semibold text-[#906f69]/60">OR CONTINUE WITH</span>
          <div className="flex-1 h-px bg-[#e5beb6]/30" />
        </div>

        {/* Social */}
        <div className="grid grid-cols-2 gap-3">
          <button className="h-14 flex items-center justify-center gap-2 bg-[#f3f4f5] border border-[#e5beb6]/20 rounded-lg text-sm font-semibold text-[#191c1d]">
            <svg className="size-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </button>
          <button className="h-14 flex items-center justify-center gap-2 bg-[#f3f4f5] border border-[#e5beb6]/20 rounded-lg text-sm font-semibold text-[#191c1d]">
            <svg className="size-5 text-[#1877f2]" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-[#586062]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#b51c00] font-semibold">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  )
}