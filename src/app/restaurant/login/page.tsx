'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Link from 'next/link'
import { UtensilsCrossed } from 'lucide-react'

export default function RestaurantLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    router.push('/restaurant/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-white overflow-hidden">
      {/* Dark header */}
      <div className="bg-gray-900 px-6 pt-14 pb-12 text-white flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-white/10 rounded-2xl p-3">
            <UtensilsCrossed className="size-7 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Restaurant Portal</h1>
            <p className="text-gray-400 text-sm">Manage your orders</p>
          </div>
        </div>
      </div>

      {/* White form card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-5 px-6 pt-7 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="restaurant@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-base font-semibold rounded-xl mt-2"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In to Dashboard'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Customer?{' '}
          <Link href="/login" className="text-orange-600 hover:underline font-medium">
            Customer Login
          </Link>
        </p>
      </div>
    </div>
  )
}