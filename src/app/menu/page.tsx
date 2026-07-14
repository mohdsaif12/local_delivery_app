'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useCartStore } from '@/store/cart'
import { Plus, Minus, X, Heart, Star, Clock, Search } from 'lucide-react'
import NavBar from '@/components/NavBar'
import BottomNav from '@/components/BottomNav'
import CartBar from '@/components/CartBar'
import PushSetup from '@/components/PushSetup'
import IOSInstallPrompt from '@/components/IOSInstallPrompt'
import { Product } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface RestaurantSettings {
  id: string
  is_open: boolean
  opening_time: string
  closing_time: string
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function getCurrentISTMinutes(): number {
  const s = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  })
  const [h, m] = s.split(':').map(Number)
  return h * 60 + (m || 0)
}

function formatTime12(t?: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function computeIsOpen(s: RestaurantSettings | null): boolean {
  if (!s) return true
  if (!s.is_open) return false
  const now = getCurrentISTMinutes()
  return now >= parseTimeToMinutes(s.opening_time) && now < parseTimeToMinutes(s.closing_time)
}

const CATEGORIES = ['Popular', 'Biryani', 'Fry', 'Gravy', 'Kebabs', 'Tandoor', 'Breads', 'Dessert']

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

interface MenuItemCardProps {
  item: Product
  onClick: () => void
  restaurantOpen: boolean
}

function MenuItemCard({ item, onClick, restaurantOpen }: MenuItemCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const qty = useCartStore((s) =>
    s.items
      .filter((i) => i.product.id === item.id || i.product.id.startsWith(item.id + '-'))
      .reduce((sum, i) => sum + i.quantity, 0)
  )

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addItem(item)
  }

  function handleInc(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(item.id, qty + 1)
  }

  function handleDec(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(item.id, qty - 1)
  }

  const isBestseller = item.name.toLowerCase().includes('butter chicken') || item.name.toLowerCase() === 'chicken biryani'

  return (
    <div onClick={onClick} className="block cursor-pointer">
      <div className="bg-white rounded-2xl flex items-center gap-3 p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] active:scale-[0.98] transition-transform">
        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {isBestseller && (
              <span className="bg-[#fff0ee] text-[#c0392b] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                Best Seller
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1">{item.name}</h3>
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-2">{item.description}</p>
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-[#c0392b] text-base">₹{item.price}</span>
            {qty === 0 ? (
              <button
                onClick={restaurantOpen ? handleAdd : (e) => { e.preventDefault(); e.stopPropagation() }}
                disabled={!restaurantOpen}
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform ${restaurantOpen ? 'bg-[#c0392b] text-white shadow-[#c0392b]/20 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                <Plus className="size-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-[#c0392b] rounded-full px-1 py-0.5 shadow-md shadow-[#c0392b]/20">
                <button
                  onClick={handleDec}
                  className="w-6 h-6 flex items-center justify-center text-white active:scale-90 transition-transform"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="text-white text-xs font-extrabold min-w-[14px] text-center">{qty}</span>
                <button
                  onClick={handleInc}
                  className="w-6 h-6 flex items-center justify-center text-white active:scale-90 transition-transform"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Image */}
        <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center text-4xl shadow-inner border border-gray-50/50 relative">
          {item.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photo_url}
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
          {!item.is_available && (
             <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
               <span className="text-white text-[9px] font-bold">Unavailable</span>
             </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState('Popular')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  
  const [MENU, setMENU] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings | null>(null)
  const [tick, setTick] = useState(0)

  const [selectedItem, setSelectedItem] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedToppings, setSelectedToppings] = useState<string[]>([])
  const [isFavorite, setIsFavorite] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('products').select('*').order('created_at').then(({ data }) => {
      if (data) setMENU(data.filter(d => d.is_available))
      setLoading(false)
    })
  }, [supabase])

  // Fetch restaurant open/close status and subscribe to realtime changes
  useEffect(() => {
    supabase.from('restaurants').select('id, is_open, opening_time, closing_time').limit(1).single()
      .then(({ data }) => { if (data) setRestaurantSettings(data) })

    const ch = supabase.channel('restaurant-open-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants' }, (payload) => {
        const row = payload.new as RestaurantSettings
        setRestaurantSettings(row)
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  // Re-evaluate time-based open status every minute
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effectivelyOpen = useMemo(() => computeIsOpen(restaurantSettings), [restaurantSettings, tick])

  function getCategoryCount(cat: string): number {
    if (cat === 'Popular') return MENU.filter(i => i.name.toLowerCase().includes('butter chicken') || i.name.toLowerCase() === 'chicken biryani').length
    return MENU.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase()).length
  }

  const SECTIONS = [
    { title: 'Popular Choice', filter: (i: Product) => i.name.toLowerCase().includes('butter chicken') || i.name.toLowerCase() === 'chicken biryani' },
    { title: 'From the Clay Oven', filter: (i: Product) => (i.category || '').toLowerCase() === 'kebabs' || (i.category || '').toLowerCase() === 'tandoor' },
    { title: 'Biryani & Gravy', filter: (i: Product) => (i.category || '').toLowerCase() === 'biryani' || (i.category || '').toLowerCase() === 'gravy' },
  ]

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

  const handleMouseLeave = () => { setIsDown(false) }
  const handleMouseUp = () => { setIsDown(false) }

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

  // Filter items based on search or active category
  const q = searchQuery.trim().toLowerCase()
  const filteredItems = q
    ? MENU.filter(i => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q))
    : activeCategory === 'Popular'
    ? MENU
    : MENU.filter(i => (i.category || '').toLowerCase() === activeCategory.toLowerCase())

  const sectionsToShow = (!q && activeCategory === 'Popular') ? SECTIONS : null

  function openSearch() {
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
  }

  function handleSelectProduct(item: Product) {
    setSelectedItem(item)
    setQuantity(1)
    setSelectedToppings([])
    setIsFavorite(false)
  }

  // Calculate dynamic price based on selected toppings
  const activeToppingsPrice = selectedItem && Array.isArray(selectedItem.variants)
    ? selectedItem.variants.reduce((sum, t) => {
        return selectedToppings.includes(t.name) ? sum + (Number(t.price) || 0) : sum
      }, 0)
    : 0

  const itemTotalPrice = selectedItem ? (selectedItem.price + activeToppingsPrice) * quantity : 0

  function handleModalAddToCart() {
    if (!selectedItem) return

    const activeToppings = Array.isArray(selectedItem.variants) ? selectedItem.variants.filter((t) =>
      selectedToppings.includes(t.name)
    ) : []

    const toppingsSuffix = activeToppings.length > 0
      ? ` (+ ${activeToppings.map(t => t.name).join(', ')})`
      : ''

    const finalName = `${selectedItem.name}${toppingsSuffix}`
    const finalPrice = selectedItem.price + activeToppings.reduce((sum, t) => sum + (Number(t.price) || 0), 0)
    const cartItemId = `${selectedItem.id}-${selectedToppings.join('-')}`

    addItem({
      id: cartItemId,
      name: finalName,
      price: finalPrice,
      description: selectedItem.description,
      photo_url: selectedItem.photo_url,
      is_available: true,
      category: selectedItem.category,
      variants: []
    })

    if (quantity > 1) {
      updateQuantity(cartItemId, quantity)
    }

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

      <NavBar role="customer" onSearchClick={openSearch} isOpen={effectivelyOpen} openingTime={restaurantSettings?.opening_time} />
      <PushSetup />
      <IOSInstallPrompt variant="menu" />

      {/* Closed banner */}
      {!effectivelyOpen && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-bold sticky top-14 z-40">
          🔴 We&apos;re Closed
          {restaurantSettings?.opening_time && ` · Opens at ${formatTime12(restaurantSettings.opening_time)}`}
        </div>
      )}

      {/* Search bar */}
      {searchOpen && (
        <div className="bg-white sticky top-14 z-40 px-4 py-2 shadow-sm flex items-center gap-2">
          <Search className="size-4 text-gray-400 flex-shrink-0" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu..."
            className="flex-1 text-sm outline-none text-gray-900 placeholder:text-gray-400"
          />
          <button onClick={closeSearch}>
            <X className="size-4 text-gray-400" />
          </button>
        </div>
      )}

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
                {cat} ({getCategoryCount(cat)})
              </button>
            ))}
          </div>
        </div>

        {/* ── Menu Sections ── */}
        {loading ? (
          <div className="px-4 pt-16 flex justify-center text-gray-400">Loading menu...</div>
        ) : sectionsToShow ? (
          <div className="px-4 pt-4 space-y-6">
            {sectionsToShow.map((section) => {
              const items = MENU.filter(section.filter)
              if (items.length === 0) return null
              return (
                <div key={section.title}>
                  <h3 className="text-base font-extrabold text-gray-900 mb-3">{section.title}</h3>
                  <div className="space-y-3">
                    {items.map((item) => <MenuItemCard key={item.id} item={item} onClick={() => handleSelectProduct(item)} restaurantOpen={effectivelyOpen} />)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-4 pt-4">
            {filteredItems.length === 0 ? (
              <p className="text-center text-gray-400 py-16 text-sm">{q ? `No results for "${searchQuery}"` : 'No items in this category.'}</p>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => <MenuItemCard key={item.id} item={item} onClick={() => handleSelectProduct(item)} restaurantOpen={effectivelyOpen} />)}
              </div>
            )}
          </div>
        )}
      </main>

      {effectivelyOpen && <CartBar />}
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
                {selectedItem.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedItem.photo_url}
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
              {Array.isArray(selectedItem.variants) && selectedItem.variants.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-extrabold text-gray-900">Variants / Add-ons</h3>
                    <span className="bg-gray-100 text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Optional
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {selectedItem.variants.map((topping) => {
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
                          <span className="text-xs font-extrabold text-gray-400">
                            {Number(topping.price) > 0 ? `+₹${topping.price}` : 'Free'}
                          </span>
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
                onClick={effectivelyOpen ? handleModalAddToCart : undefined}
                disabled={!effectivelyOpen}
                className={`flex-1 h-13 font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all text-sm ${effectivelyOpen ? 'bg-[#c0392b] hover:bg-[#a93226] text-white shadow-[#c0392b]/20 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}
              >
                {effectivelyOpen ? `Add to Cart • ₹${itemTotalPrice}` : '🔴 Restaurant Closed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}