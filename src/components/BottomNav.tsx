'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingBag, User } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const tabs = [
    { href: '/menu', icon: Home, label: 'Home' },
    { href: '/orders', icon: ShoppingBag, label: 'Orders' },
    { href: '/profile', icon: User, label: 'Profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-[#e5beb6]/30 z-40">
      <div className="flex pb-safe">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                active ? 'text-[#b51c00]' : 'text-[#586062]'
              }`}
            >
              <Icon className={`size-5 ${active ? 'fill-[#ffdad3]' : ''}`} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-semibold`}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}