'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import Link from 'next/link'
import { UtensilsCrossed, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e?: React.SyntheticEvent) {
    e?.preventDefault()
    alert('Button tapped!')
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      alert('Login error: ' + authError.message)
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    router.push(profile?.role === 'restaurant' ? '/restaurant/dashboard' : '/menu')
    router.refresh()
  }

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      {/* Header — logo + branding */}
      <header className="flex flex-col items-center pt-12 pb-8 px-5 bg-[#f8f9fa]">
        <div className="w-20 h-20 rounded-full bg-[#ffdad3] flex items-center justify-center mb-4 shadow-sm">
          <UtensilsCrossed className="size-9 text-[#b51c00]" />
        </div>
        <h1 className="text-2xl font-bold text-[#b51c00] tracking-tight">DirectDine</h1>
        <p className="text-sm text-[#586062] mt-1">Authentic flavors, delivered to your doorstep.</p>
      </header>

      {/* Form card */}
      <main className="flex-1 px-5 pb-8">
        <div className="bg-white rounded-xl p-6" style={{ boxShadow: '0 8px 24px rgba(45,52,54,0.08)', border: '1px solid rgba(229,190,182,0.1)' }}>
          <h2 className="text-xl font-semibold text-[#191c1d] mb-5">Welcome Back</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[#5c403a] ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#586062]" />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 pl-12 rounded-lg bg-[#f3f4f5] border-none text-[#191c1d] placeholder:text-[#906f69]/60 focus-visible:ring-1 focus-visible:ring-[#b51c00]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-semibold text-[#5c403a]">Password</label>
                <button type="button" className="text-sm font-semibold text-[#b51c00]">
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#586062]" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
            </div>

            {/* Inline error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* Login button */}
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-14 bg-[#b51c00] text-white font-semibold rounded-lg flex items-center justify-center gap-2 mt-2 active:scale-95 transition-all disabled:opacity-70"
            >
              <span>{loading ? 'Signing in…' : 'Login'}</span>
              {!loading && <ArrowRight className="size-5" />}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#e5beb6]/30" />
            <span className="text-xs font-semibold text-[#906f69]/60">OR LOGIN WITH</span>
            <div className="flex-1 h-px bg-[#e5beb6]/30" />
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button className="h-14 flex items-center justify-center gap-2 bg-[#f3f4f5] border border-[#e5beb6]/20 rounded-lg text-sm font-semibold text-[#191c1d]">
              <svg className="size-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button className="h-14 flex items-center justify-center gap-2 bg-[#f3f4f5] border border-[#e5beb6]/20 rounded-lg text-sm font-semibold text-[#191c1d]">
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Apple
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-[#586062]">
          New to DirectDine?{' '}
          <Link href="/signup" className="text-[#b51c00] font-semibold">
            Create an Account
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-[#906f69]/60">
          Restaurant owner?{' '}
          <Link href="/restaurant/login" className="text-[#b51c00] font-semibold">
            Restaurant Login
          </Link>
        </p>
      </main>
    </div>
  )
}