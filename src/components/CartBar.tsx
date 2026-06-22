'use client'

import Link from 'next/link'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import { useCartStore } from '@/store/cart'

export default function CartBar() {
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  if (itemCount === 0) return null

  return (
    <Link
      href="/checkout"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 8px)' }}
      className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[398px] h-14 bg-[#b51c00] text-white rounded-2xl flex items-center justify-between px-5 shadow-lg shadow-[#b51c00]/30 z-40 active:scale-[0.98] transition-transform"
    >
      <span className="text-sm font-bold flex items-center gap-2">
        <ShoppingBag className="size-4" />
        {itemCount} {itemCount === 1 ? 'item' : 'items'} added
      </span>
      <span className="text-sm font-bold flex items-center gap-1">
        View Cart
        <ChevronRight className="size-4" />
      </span>
    </Link>
  )
}
