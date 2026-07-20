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
import AndroidInstallPrompt from '@/components/AndroidInstallPrompt'
import { Product } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface RestaurantSettings {
  id: string
  is_open: boolean
  opening_time: string
  closing_time: string
  /** Staff-chosen reason, set by the dashboard on a manual close. Null when open. */
  closed_reason: string | null
}


function formatTime12(t?: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// Why the restaurant isn't taking orders:
//   'manual' — staff flipped the switch off in the dashboard
//   'hours'  — outside the configured opening/closing times
//   null     — open
type ClosedReason = 'manual' | 'hours' | null

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function isWithinHours(s: RestaurantSettings, now: Date): boolean {
  if (!s.opening_time || !s.closing_time) return true
  const mins = now.getHours() * 60 + now.getMinutes()
  const open = toMinutes(s.opening_time)
  const close = toMinutes(s.closing_time)
  // Overnight window (e.g. 18:00 → 02:00) wraps past midnight
  return close > open ? mins >= open && mins < close : mins >= open || mins < close
}

// Nothing in the database closes the shop on a schedule (the only cron job
// re-enables individual dishes), so the app enforces the opening hours itself.
// Order matters: the clock wins, then the manual switch.
function getClosedReason(s: RestaurantSettings | null, now: Date): ClosedReason {
  if (!s) return null                          // settings not loaded — assume open
  if (!isWithinHours(s, now)) return 'hours'   // outside opening hours
  if (!s.is_open) return 'manual'              // inside hours, but switched off
  return null
}

// Mirrors the dashboard's menu categories, in the same order.
// `label` is the display name customers see; `slug` is what's stored on
// products.category — the two differ (e.g. "Roasted" is stored as "tandoor").
const CATEGORIES: { label: string; slug: string }[] = [
  { label: 'Popular',        slug: 'popular' },
  { label: 'All',            slug: 'all' },
  { label: 'Biryani & Rice', slug: 'biryani' },
  { label: 'Fried',          slug: 'fry' },
  { label: 'Kebabs',         slug: 'kebabs' },
  { label: 'Roasted',        slug: 'tandoor' },
  { label: 'Gravies',        slug: 'gravy' },
  { label: 'Breads',         slug: 'breads' },
  { label: 'Dessert',        slug: 'dessert' },
  { label: 'Veg',            slug: 'veg' },
  { label: 'Combos',         slug: 'combos' },
  { label: 'Combo',          slug: 'combo' },
  { label: 'Others',         slug: 'other' },
]

// Hero banner photos are read from Supabase Storage at runtime — upload to
// this bucket/folder and they appear in the slideshow automatically.
const HERO_BUCKET = 'menu-photos'
const HERO_FOLDER = 'dishes/hero section photos'

// Shown only if the Storage folder is empty or unreachable.
const HERO_IMAGES = [
  '/hero/hero-1.png',
  '/hero/hero-2.png',
  '/hero/hero-3.png',
  '/hero/hero-4.png',
]

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
  if (cat.includes('veg')) return '🥗'
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
            {item.is_veg !== null && (
              <span className={`inline-flex items-center justify-center w-4 h-4 border-2 rounded-sm flex-shrink-0 ${item.is_veg ? 'border-green-600' : 'border-red-700'}`}>
                <span className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-green-600' : 'bg-red-700'}`} />
              </span>
            )}
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
  const [activeCategory, setActiveCategory] = useState('popular')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  
  const [MENU, setMENU] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings | null>(null)

  const [heroImages, setHeroImages] = useState<string[]>(HERO_IMAGES)
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroPaused, setHeroPaused] = useState(false)

  const [selectedItem, setSelectedItem] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedToppings, setSelectedToppings] = useState<string[]>([])
  const [isFavorite, setIsFavorite] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    async function loadProducts(attempt = 0) {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,description,price,photo_url,is_available,is_veg,category,created_at,variants')
        .eq('is_available', true)
        .order('created_at', { ascending: true })

      if (cancelled) return

      // Retry once on a transient failure (e.g. free-tier cold-start statement timeout)
      if (error && attempt === 0) {
        setTimeout(() => { if (!cancelled) loadProducts(1) }, 1500)
        return
      }

      if (data) setMENU(data)
      setLoading(false)
    }

    loadProducts()
    return () => { cancelled = true }
  }, [supabase])

  // Fetch restaurant open/close status and subscribe to realtime changes
  useEffect(() => {
    supabase.from('restaurants').select('id, is_open, opening_time, closing_time, closed_reason').limit(1).single()
      .then(({ data }) => { if (data) setRestaurantSettings(data) })

    const ch = supabase.channel('restaurant-open-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants' }, (payload) => {
        const row = payload.new as RestaurantSettings
        setRestaurantSettings(row)
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  // Re-check the clock every minute so the banner flips at opening/closing
  // time without the customer needing to refresh.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const closedReason = useMemo(() => getClosedReason(restaurantSettings, now), [restaurantSettings, now])
  const effectivelyOpen = closedReason === null

  // Hero images, in priority order:
  //   1. Banners uploaded from the dashboard's Banners page
  //   2. Photos dropped straight into the Storage folder
  //   3. The bundled defaults already in state
  // So uploading banners swaps the hero; uploading none keeps what's there.
  useEffect(() => {
    let cancelled = false

    async function loadHeroImages() {
      const { data: banners } = await supabase
        .from('banners')
        .select('image_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (cancelled) return

      const bannerUrls = (banners ?? []).map((b) => b.image_url).filter(Boolean)
      if (bannerUrls.length > 0) {
        setHeroImages(bannerUrls)
        setHeroIndex(0)
        return
      }

      const { data: files } = await supabase.storage
        .from(HERO_BUCKET)
        .list(HERO_FOLDER, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
      if (cancelled || !files) return

      const urls = files
        .filter((o) => o.id && /\.(jpe?g|png|webp|avif)$/i.test(o.name))
        .map(
          (o) =>
            supabase.storage.from(HERO_BUCKET).getPublicUrl(`${HERO_FOLDER}/${o.name}`).data.publicUrl
        )
      if (urls.length > 0) {
        setHeroImages(urls)
        setHeroIndex(0)
      }
    }

    loadHeroImages()
    return () => { cancelled = true }
  }, [supabase])

  // Auto-rotate the hero every 4s — unless the user is holding/swiping it
  useEffect(() => {
    if (heroImages.length <= 1 || heroPaused) return
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroImages.length)
    }, 4000)
    return () => clearInterval(id)
  }, [heroImages.length, heroPaused])

  function goToHeroSlide(dir: 1 | -1) {
    setHeroIndex((i) => (i + dir + heroImages.length) % heroImages.length)
  }

  // Instagram-story controls: a quick tap on the right advances / left goes
  // back; press-and-hold pauses on the current image and resumes on release.
  const heroPress = useRef<{ t: number; x: number } | null>(null)
  function onHeroPointerDown(e: React.PointerEvent) {
    heroPress.current = { t: Date.now(), x: e.clientX }
    setHeroPaused(true) // hold to stop
  }
  function onHeroPointerUp(e: React.PointerEvent) {
    const start = heroPress.current
    heroPress.current = null
    setHeroPaused(false) // release resumes auto-rotation
    if (!start) return
    const heldMs = Date.now() - start.t
    const movedX = Math.abs(e.clientX - start.x)
    if (heldMs > 250 || movedX > 12) return // a hold or a scroll, not a tap
    const rect = e.currentTarget.getBoundingClientRect()
    const tappedLeftThird = e.clientX - rect.left < rect.width * 0.33
    goToHeroSlide(tappedLeftThird ? -1 : 1)
  }
  function onHeroPointerLeave() {
    heroPress.current = null
    setHeroPaused(false)
  }

  // Curated groups shown on the Popular tab
  const SECTIONS = [
    { title: 'Popular Choice', filter: (i: Product) => i.name.toLowerCase().includes('butter chicken') || i.name.toLowerCase() === 'chicken biryani' },
    { title: 'From the Clay Oven', filter: (i: Product) => (i.category || '').toLowerCase() === 'kebabs' || (i.category || '').toLowerCase() === 'tandoor' },
    { title: 'Biryani & Gravy', filter: (i: Product) => (i.category || '').toLowerCase() === 'biryani' || (i.category || '').toLowerCase() === 'gravy' },
  ]

  function getCategoryCount(slug: string): number {
    if (slug === 'all') return MENU.length
    // A dish can appear in more than one section, so count distinct items
    if (slug === 'popular') {
      return new Set(
        SECTIONS.flatMap((s) => MENU.filter(s.filter).map((i) => i.id))
      ).size
    }
    return MENU.filter(i => (i.category || '').toLowerCase() === slug).length
  }

  // Hide tabs with nothing in them — the customer app only lists available
  // dishes, so a category can be non-empty in the dashboard but empty here.
  const visibleCategories = CATEGORIES.filter(
    (c) => c.slug === 'all' || getCategoryCount(c.slug) > 0
  )

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
    : activeCategory === 'all'
    ? MENU
    : MENU.filter(i => (i.category || '').toLowerCase() === activeCategory)

  // The Popular tab shows curated sections instead of a flat list
  const sectionsToShow = (!q && activeCategory === 'popular') ? SECTIONS : null

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
      is_veg: selectedItem.is_veg,
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

      <NavBar role="customer" onSearchClick={openSearch} isOpen={effectivelyOpen} openingTime={restaurantSettings?.opening_time} closedReason={closedReason} />
      <PushSetup />
      <IOSInstallPrompt variant="menu" />
      <AndroidInstallPrompt />

      {/* Closed banner — wording depends on why we're closed */}
      {closedReason === 'manual' ? (
        <div className="bg-amber-600 text-white text-center py-2 px-4 text-sm font-bold sticky top-14 z-40">
          🔴 {restaurantSettings?.closed_reason || 'Temporarily Closed · Back in 1–2 hrs'}
        </div>
      ) : closedReason === 'hours' ? (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-bold sticky top-14 z-40">
          🔴 We&apos;re Closed
          {restaurantSettings?.opening_time && ` · Opens at ${formatTime12(restaurantSettings.opening_time)}`}
        </div>
      ) : null}

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

        {/* ── Hero Banner (auto-rotating slideshow) ── */}
        <div
          className="relative h-52 overflow-hidden touch-pan-y select-none cursor-pointer"
          onPointerDown={onHeroPointerDown}
          onPointerUp={onHeroPointerUp}
          onPointerLeave={onHeroPointerLeave}
          onPointerCancel={onHeroPointerLeave}
        >
          {heroImages.map((src, i) => {
            // Only mount the visible slide plus its neighbours, so we never
            // download the whole folder up front but can still swipe both ways.
            const isActive = i === heroIndex
            const isNext = i === (heroIndex + 1) % heroImages.length
            const isPrev = i === (heroIndex - 1 + heroImages.length) % heroImages.length
            if (!isActive && !isNext && !isPrev) return null
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt="Taste of Kanpur"
                draggable={false}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`}
              />
            )
          })}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end px-5 pb-5 text-white">
            <span className="inline-flex items-center gap-1 bg-[#c0392b] text-white text-[9px] font-bold px-2 py-0.5 rounded-md mb-2 w-fit tracking-widest uppercase">
              ★ Bestseller
            </span>
            <h2 className="text-xl font-extrabold leading-tight drop-shadow-md">
              Taste of<br />Kanpur
            </h2>
          </div>
          {/* Slide indicator dots */}
          <div className="absolute bottom-3 right-4 flex gap-1.5">
            {heroImages.map((src, i) => (
              <span
                key={src}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === heroIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
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
            {visibleCategories.map((cat) => (
              <button
                key={cat.slug}
                onClick={(e) => {
                  setActiveCategory(cat.slug)
                  // Bring the tapped tab (and its neighbours) into view
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                }}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCategory === cat.slug
                    ? 'bg-[#c0392b] text-[#ffffff] shadow-md shadow-[#c0392b]/20'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {cat.label} ({getCategoryCount(cat.slug)})
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
                <div className="flex items-center gap-2 pr-4">
                  {selectedItem.is_veg !== null && (
                    <span className={`inline-flex items-center justify-center w-5 h-5 border-2 rounded-sm flex-shrink-0 ${selectedItem.is_veg ? 'border-green-600' : 'border-red-700'}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${selectedItem.is_veg ? 'bg-green-600' : 'bg-red-700'}`} />
                    </span>
                  )}
                  <h2 className="text-xl font-extrabold text-gray-900 leading-tight">
                    {selectedItem.name}
                  </h2>
                </div>
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