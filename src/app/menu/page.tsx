'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCartStore } from '@/store/cart'
import { Plus, Minus, X, Heart, Star, Clock } from 'lucide-react'
import { toast } from 'sonner'
import NavBar from '@/components/NavBar'
import BottomNav from '@/components/BottomNav'
import CartBar from '@/components/CartBar'
import { MENU, TOPPINGS_MAP, MenuItem } from '@/lib/menu'

const CATEGORIES = ['Popular', 'Biryani', 'Gravy', 'Breads', 'Fry', 'Kebabs', 'Tandoor', 'Combos', 'Desserts']

const SECTIONS = [
  { title: 'Popular Choice', filter: (i: MenuItem) => !!i.bestseller },
  { title: 'From the Clay Oven', filter: (i: MenuItem) => i.category === 'Kebabs' || i.category === 'Tandoor' },
  { title: 'Biryani & Gravy', filter: (i: MenuItem) => i.category === 'Biryani' || i.category === 'Gravy' },
]

function getCategoryEmoji(category: string) {
  switch (category) {
    case 'Biryani': return '🍛'
    case 'Gravy': return '🍲'
    case 'Breads': return '🫓'
    case 'Fry': return '🍗'
    case 'Kebabs': return '🍢'
    case 'Tandoor': return '🔥'
    case 'Desserts': return '🍧'
    case 'Combos': return '🍱'
    default: return '🍽'
  }
}

interface MenuItemCardProps {
  item: MenuItem
  onClick: () => void
}

function MenuItemCard({ item, onClick }: MenuItemCardProps) {
  const addItem = useCartStore((s) => s.addItem)

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addItem({ id: item.id, name: item.name, price: item.price, description: item.description, photo_url: item.photo, is_available: true })
    toast.success(`${item.name} added to cart!`)
  }

  return (
    <div onClick={onClick} className="block cursor-pointer">
      <div className="bg-white rounded-2xl flex items-center gap-3 p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] active:scale-[0.98] transition-transform">
        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {item.bestseller && (
              <span className="bg-[#fff0ee] text-[#c0392b] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                Best Seller
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1">{item.name}</h3>
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-2">{item.description}</p>
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-[#c0392b] text-base">₹{item.price}</span>
            <button
              onClick={handleAdd}
              className="w-8 h-8 bg-[#c0392b] text-white rounded-full flex items-center justify-center shadow-md shadow-[#c0392b]/20 active:scale-90 transition-transform cursor-pointer"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center text-4xl shadow-inner border border-gray-50/50">
          {item.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photo}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  parent.innerText = getCategoryEmoji(item.category);
                }
              }}
            />
          ) : (
            <span>{getCategoryEmoji(item.category)}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState('Popular')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedToppings, setSelectedToppings] = useState<string[]>([])
  const [isFavorite, setIsFavorite] = useState(false)

  // Horizontal scroll grab-and-drag states
  const [isDown, setIsDown] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeftState, setScrollLeftState] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    const slider = e.currentTarget as HTMLDivElement
    setIsDown(true)
    setStartX(e.pageX - slider.offsetLeft)
    setScrollLeftState(slider.scrollLeft)
  }

  const handleMouseLeave = () => {
    setIsDown(false)
  }

  const handleMouseUp = () => {
    setIsDown(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown) return
    e.preventDefault()
    const slider = e.currentTarget as HTMLDivElement
    const x = e.pageX - slider.offsetLeft
    const walk = (x - startX) * 1.5
    slider.scrollLeft = scrollLeftState - walk
  }

  const handleWheel = (e: React.WheelEvent) => {
    const container = e.currentTarget as HTMLDivElement
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      container.scrollLeft += e.deltaY
    }
  }

  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  // Filter items based on active category
  const filteredItems = activeCategory === 'Popular'
    ? MENU
    : MENU.filter(i => i.category === activeCategory)

  const sectionsToShow = activeCategory === 'Popular' ? SECTIONS : null

  function handleSelectProduct(item: MenuItem) {
    setSelectedItem(item)
    setQuantity(1)
    setSelectedToppings([])
    setIsFavorite(false)
  }

  // Calculate dynamic price based on selected toppings
  const activeToppingsPrice = selectedItem
    ? TOPPINGS_MAP[selectedItem.category]?.reduce((sum, t) => {
        return selectedToppings.includes(t.name) ? sum + t.price : sum
      }, 0) || 0
    : 0

  const itemTotalPrice = selectedItem ? (selectedItem.price + activeToppingsPrice) * quantity : 0

  function handleModalAddToCart() {
    if (!selectedItem) return

    const activeToppings = TOPPINGS_MAP[selectedItem.category]?.filter((t) =>
      selectedToppings.includes(t.name)
    ) || []

    const toppingsSuffix = activeToppings.length > 0
      ? ` (+ ${activeToppings.map(t => t.name).join(', ')})`
      : ''

    const finalName = `${selectedItem.name}${toppingsSuffix}`
    const finalPrice = selectedItem.price + activeToppings.reduce((sum, t) => sum + t.price, 0)
    const cartItemId = `${selectedItem.id}-${selectedToppings.join('-')}`

    addItem({
      id: cartItemId,
      name: finalName,
      price: finalPrice,
      description: selectedItem.description,
      photo_url: selectedItem.photo,
      is_available: true,
    })

    if (quantity > 1) {
      updateQuantity(cartItemId, quantity)
    }

    toast.success(`${finalName} added to cart!`)
    setSelectedItem(null)
  }

  return (
    <div className="min-h-[100dvh] bg-[#f7f7f7] pb-safe relative">
      {/* Dynamic Keyframes for details sheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
      ` }} />

      <NavBar role="customer" />

      <main className="phone-screen pb-40">

        {/* ── Hero Banner ── */}
        <div className="relative h-52 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/chicken-biryani.png"
            alt="Authentic Awadhi Flavors"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end px-5 pb-5 text-white">
            <span className="inline-flex items-center gap-1 bg-[#c0392b] text-white text-[9px] font-bold px-2 py-0.5 rounded-md mb-2 w-fit tracking-widest uppercase">
              ★ Bestseller
            </span>
            <h2 className="text-xl font-extrabold leading-tight drop-shadow-md">
              Authentic Awadhi<br />Flavors
            </h2>
          </div>
        </div>

        {/* ── Category Tabs ── */}
        <div className="bg-white sticky top-14 z-30 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            style={{ WebkitOverflowScrolling: 'touch' }}
            className="flex gap-1 overflow-x-auto no-scrollbar px-4 py-3 cursor-grab active:cursor-grabbing select-none"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCategory === cat
                    ? 'bg-[#c0392b] text-[#ffffff] shadow-md shadow-[#c0392b]/20'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Menu Sections ── */}
        {sectionsToShow ? (
          <div className="px-4 pt-4 space-y-6">
            {sectionsToShow.map((section) => {
              const items = MENU.filter(section.filter)
              if (items.length === 0) return null
              return (
                <div key={section.title}>
                  <h3 className="text-base font-extrabold text-gray-900 mb-3">{section.title}</h3>
                  <div className="space-y-3">
                    {items.map((item) => <MenuItemCard key={item.id} item={item} onClick={() => handleSelectProduct(item)} />)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-4 pt-4">
            {filteredItems.length === 0 ? (
              <p className="text-center text-gray-400 py-16 text-sm">No items in this category.</p>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => <MenuItemCard key={item.id} item={item} onClick={() => handleSelectProduct(item)} />)}
              </div>
            )}
          </div>
        )}
      </main>

      <CartBar />
      <BottomNav />

      {/* ── Slide-up Details Modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm bg-black/40 animate-fade-in">
          {/* Card container */}
          <div className="bg-white w-full max-w-[430px] rounded-t-3xl overflow-hidden shadow-[0_-8px_32px_rgba(0,0,0,0.15)] flex flex-col max-h-[90vh] animate-slide-up pb-safe">
            {/* Draggable Handle */}
            <div className="flex justify-center py-3 flex-shrink-0">
              <div className="w-12 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {/* Product Image */}
              <div className="relative w-full aspect-square max-h-[300px] rounded-3xl overflow-hidden bg-gray-50 mb-5 shadow-inner flex items-center justify-center text-8xl">
                {selectedItem.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedItem.photo}
                    alt={selectedItem.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent) {
                        parent.innerText = getCategoryEmoji(selectedItem.category);
                      }
                    }}
                  />
                ) : (
                  <span>{getCategoryEmoji(selectedItem.category)}</span>
                )}
                {/* Close (X) circle button */}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/85 hover:bg-white flex items-center justify-center shadow-md backdrop-blur-sm cursor-pointer border border-gray-100 transition-colors z-20"
                >
                  <X className="size-5 text-gray-800" />
                </button>
                {/* Favorite heart circle button */}
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
                  {selectedItem.name}
                </h2>
                <span className="text-xl font-extrabold text-[#c0392b] flex-shrink-0">
                  ₹{selectedItem.price}
                </span>
              </div>

              {/* Rating and Cooking Duration Row */}
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
                {selectedItem.description}
              </p>

              {/* Optional Toppings Section */}
              {TOPPINGS_MAP[selectedItem.category] && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-extrabold text-gray-900">Extra Toppings</h3>
                    <span className="bg-gray-100 text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Optional
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {TOPPINGS_MAP[selectedItem.category].map((topping) => {
                      const isSelected = selectedToppings.includes(topping.name)
                      return (
                        <label
                          key={topping.name}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#c0392b] bg-red-50/10 shadow-[0_2px_12px_rgba(192,57,43,0.04)]'
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
                          <span className="text-xs font-extrabold text-gray-400">+₹{topping.price}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Footer */}
            <div className="border-t border-gray-100 px-5 pt-3.5 pb-6 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex items-center justify-between gap-3 flex-shrink-0">
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
                onClick={handleModalAddToCart}
                className="flex-1 h-13 bg-[#c0392b] hover:bg-[#a93226] text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#c0392b]/20 active:scale-[0.98] transition-all cursor-pointer text-sm"
              >
                Add to Cart &bull; ₹{itemTotalPrice}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}