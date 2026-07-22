'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { Plus, Minus, Heart, Star, Clock, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Product } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

function getCategoryEmoji(category: string) {
  const cat = (category || '').toLowerCase()
  if (cat.includes('biryani')) return '🍛'
  if (cat.includes('gravy')) return '🍲'
  if (cat.includes('bread')) return '🫓'
  if (cat.includes('fry')) return '🍗'
  if (cat.includes('kebab')) return '🍢'
  if (cat.includes('tandoor')) return '🔥'
  if (cat.includes('dessert')) return '🍧'
  if (cat.includes('combo')) return '🍱'
  return '🍽'
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  const [quantity, setQuantity] = useState(1)
  const [selectedToppings, setSelectedToppings] = useState<string[]>([])
  const [isFavorite, setIsFavorite] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('products').select('id,name,description,price,photo_url,is_veg,category,variants').eq('id', id).single().then(({ data }) => {
      setProduct(data as Product)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col items-center justify-center bg-gray-50 px-5 text-center">
        <h1 className="text-lg font-bold text-gray-400 mb-2">Loading...</h1>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col items-center justify-center bg-gray-50 px-5 text-center">
        <span className="text-5xl mb-4">🍽️</span>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Item Not Found</h1>
        <button onClick={() => router.push('/menu')} className="px-6 py-2.5 bg-[#c0392b] text-white font-bold rounded-xl cursor-pointer">
          Back to Menu
        </button>
      </div>
    )
  }

  // Calculate dynamic price based on selected toppings
  const activeToppingsPrice = Array.isArray(product.variants) ? product.variants.reduce((sum, t) => {
    return selectedToppings.includes(t.name) ? sum + (Number(t.price) || 0) : sum
  }, 0) : 0

  const itemTotalPrice = (product.price + activeToppingsPrice) * quantity

  function handleAddToCart() {
    if (!product) return

    const activeToppings = Array.isArray(product.variants) ? product.variants.filter((t) =>
      selectedToppings.includes(t.name)
    ) : []

    const toppingsSuffix = activeToppings.length > 0
      ? ` (+ ${activeToppings.map(t => t.name).join(', ')})`
      : ''

    const finalName = `${product.name}${toppingsSuffix}`
    const finalPrice = product.price + activeToppings.reduce((sum, t) => sum + (Number(t.price) || 0), 0)
    const cartItemId = `${product.id}-${selectedToppings.join('-')}`

    addItem({
      id: cartItemId,
      name: finalName,
      price: finalPrice,
      description: product.description,
      photo_url: product.photo_url,
      is_available: true,
      is_veg: product.is_veg ?? null,
      category: product.category,
      variants: []
    })

    if (quantity > 1) {
      updateQuantity(cartItemId, quantity)
    }

    toast.success(`${finalName} added to cart!`)
    router.push('/menu')
  }

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f7f8fa] text-gray-900 pb-safe">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ChevronLeft className="size-6 text-[#c0392b]" />
          </button>
          <h1 className="text-base font-extrabold text-[#c0392b]">Dish Details</h1>
        </div>
        <div className="w-8" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-28">
        {/* Product Image */}
        <div className="relative w-full aspect-square max-h-[300px] rounded-3xl overflow-hidden bg-gray-50 mb-5 shadow-inner flex items-center justify-center text-8xl">
          {product.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.photo_url}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  parent.innerText = getCategoryEmoji(product.category);
                }
              }}
            />
          ) : (
            <span>{getCategoryEmoji(product.category)}</span>
          )}
          {/* Favorite heart button */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/85 hover:bg-white flex items-center justify-center shadow-md backdrop-blur-sm cursor-pointer border border-gray-100 transition-colors z-20"
          >
            <Heart className={`size-5 transition-colors ${isFavorite ? 'fill-[#c0392b] text-[#c0392b]' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Title & Price Row */}
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-xl font-extrabold text-gray-900 leading-tight pr-4">
            {product.name}
          </h2>
          <span className="text-xl font-extrabold text-[#c0392b] flex-shrink-0">
            ₹{product.price}
          </span>
        </div>

        {/* Rating and Duration */}
        <div className="flex items-center gap-3 text-xs font-semibold text-gray-500 mb-4">
          <span className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">
            <Star className="size-3.5 fill-amber-500 text-amber-500" />
            4.8 (120+ reviews)
          </span>
          <span className="flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
            <Clock className="size-3.5" />
            20–25 min
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 leading-relaxed mb-6 font-medium">
          {product.description}
        </p>

        {/* Optional Toppings */}
        {Array.isArray(product.variants) && product.variants.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-extrabold text-gray-900">Variants / Add-ons</h3>
              <span className="bg-gray-100 text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                Optional
              </span>
            </div>
            <div className="space-y-2.5">
              {product.variants.map((topping) => {
                const isSelected = selectedToppings.includes(topping.name)
                return (
                  <label
                    key={topping.name}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#c0392b] bg-red-50/10'
                        : 'border-gray-100 hover:bg-gray-50 bg-[#fbfbfb]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setSelectedToppings(selectedToppings.filter((t) => t !== topping.name))
                          } else {
                            setSelectedToppings([...selectedToppings, topping.name])
                          }
                        }}
                        className="rounded border-gray-300 text-[#c0392b] focus:ring-[#c0392b] size-4 accent-[#c0392b]"
                      />
                      <span className="text-xs font-bold text-gray-700">{topping.name}</span>
                    </div>
                    <span className="text-xs font-extrabold text-gray-400">{Number(topping.price) > 0 ? `+₹${topping.price}` : 'Free'}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] border-t border-gray-100 px-5 pt-3.5 pb-6 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex items-center justify-between gap-3 z-40">
        {/* Quantity capsule */}
        <div className="flex items-center bg-[#f3f4f6] rounded-full px-3 py-2 gap-4 h-13">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="text-gray-500 hover:text-gray-700 p-0.5 cursor-pointer"
          >
            <Minus className="size-4" strokeWidth={3} />
          </button>
          <span className="text-sm font-extrabold text-gray-900 w-4 text-center">{quantity}</span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="text-gray-500 hover:text-gray-700 p-0.5 cursor-pointer"
          >
            <Plus className="size-4" strokeWidth={3} />
          </button>
        </div>

        {/* Add to Cart button */}
        <button
          onClick={handleAddToCart}
          className="flex-1 h-13 bg-[#c0392b] hover:bg-[#a93226] text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#c0392b]/20 active:scale-[0.98] transition-all cursor-pointer text-sm"
        >
          Add to Cart &bull; ₹{itemTotalPrice}
        </button>
      </div>
    </div>
  )
}