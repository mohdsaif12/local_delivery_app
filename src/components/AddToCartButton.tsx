'use client'

import { Product } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { toast } from 'sonner'
import { Minus, Plus } from 'lucide-react'

export default function AddToCartButton({ product }: { product: Product }) {
  const { items, addItem, updateQuantity } = useCartStore()
  const cartItem = items.find((i) => i.product.id === product.id)

  if (cartItem) {
    return (
      <div className="flex items-center justify-between bg-orange-50 rounded-2xl px-4 py-3">
        <button
          className="w-10 h-10 rounded-full border border-orange-200 flex items-center justify-center text-orange-600 active:bg-orange-100 transition-colors"
          onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
        >
          <Minus className="size-4" />
        </button>
        <span className="text-xl font-bold text-gray-900 w-10 text-center">{cartItem.quantity}</span>
        <button
          className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white active:bg-orange-700 transition-colors"
          onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
        >
          <Plus className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <Button
      className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-base font-semibold rounded-xl"
      size="lg"
      onClick={() => {
        addItem(product)
        toast.success('Added to cart')
      }}
    >
      Add to Cart — ₹{product.price}
    </Button>
  )
}