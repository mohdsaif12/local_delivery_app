'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cart'
import { ShoppingCart, LogOut, UtensilsCrossed, ChevronLeft, Search } from 'lucide-react'
import Link from 'next/link'

interface Props {
  role: 'customer' | 'restaurant'
  title?: string
  showBack?: boolean
}

export default function NavBar({ role, title, showBack }: Props) {
  const router = useRouter()
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(role === 'restaurant' ? '/restaurant/login' : '/login')
    router.refresh()
  }

  return (
    <nav className="bg-white sticky top-0 z-40 border-b border-[#e5beb6]/20">
      <div className="phone-screen px-4 h-14 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-2">
          {showBack ? (
            <button onClick={() => router.back()} className="p-1 -ml-1">
              <ChevronLeft className="size-5 text-[#191c1d]" />
            </button>
          ) : (
            <Link
              href={role === 'restaurant' ? '/restaurant/dashboard' : '/menu'}
              className="flex items-center gap-2"
            >
              <UtensilsCrossed className="size-5 text-[#b51c00]" />
              <span className="font-bold text-[#191c1d]">DirectDine</span>
            </Link>
          )}
          {title && (
            <span className="font-semibold text-[#b51c00] text-sm">{title}</span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          {role === 'customer' && !showBack && (
            <button className="p-2 text-[#586062]">
              <Search className="size-5" />
            </button>
          )}
          {role === 'customer' && (
            <Link href="/cart" className="p-2 relative">
              <ShoppingCart className="size-5 text-[#586062]" />
              {itemCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#b51c00] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
          )}
          <button onClick={handleLogout} className="p-2 text-[#586062]" title="Sign out">
            <LogOut className="size-4.5" />
          </button>
        </div>
      </div>
    </nav>
  )
}