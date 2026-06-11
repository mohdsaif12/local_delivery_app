'use client'

import { Product } from '@/lib/types'
import { useCartStore } from '@/store/cart'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

interface Props {
  product: Product
}

export default function ProductCard({ product }: Props) {
  const addItem = useCartStore((s) => s.addItem)

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    addItem(product)
    toast.success(`${product.name} added to cart`)
  }

  return (
    <Link href={`/menu/${product.id}`} className="block">
      <div
        className="bg-white rounded-xl flex items-center gap-3 p-3 active:scale-[0.98] transition-transform"
        style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}
      >
        {/* Text — left side */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#191c1d] text-sm leading-snug mb-1">
            {product.name}
          </h3>
          <p className="text-xs text-[#586062] line-clamp-2 leading-relaxed mb-2">
            {product.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#b51c00] text-base">₹{product.price}</span>
            {product.is_available && (
              <button
                onClick={handleAdd}
                className="w-8 h-8 bg-[#b51c00] text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm"
              >
                <Plus className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Image — right side */}
        <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-[#f3f4f5] relative">
          {product.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.photo_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-3xl">🍽️</div>
          )}
          {!product.is_available && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">Unavailable</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}