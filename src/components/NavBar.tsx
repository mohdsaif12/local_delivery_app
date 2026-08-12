'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cart'
import { ChevronLeft, Search, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import OutletPicker from './OutletPicker'
import { Outlet, outletDelivery, etaMinutesFromKm } from '@/lib/outlets'

interface Props {
  role: 'customer' | 'restaurant'
  title?: string
  showBack?: boolean
  onSearchClick?: () => void
  isOpen?: boolean
  openingTime?: string
  /** Why we're closed: 'manual' = staff switched off, 'hours' = outside opening times */
  closedReason?: 'manual' | 'hours' | null
  /** Outlet chooser. Supplied by pages that already load outlets, so the header
   *  and the page can never show different outlets. */
  outlets?: Outlet[]
  outlet?: Outlet | null
  point?: { lat: number; lng: number } | null
  onSelectOutlet?: (id: string) => void
}

function formatTime12(timeStr?: string): string {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`
}

export default function NavBar({
  role,
  title,
  showBack,
  onSearchClick,
  isOpen,
  openingTime,
  closedReason,
  outlets = [],
  outlet = null,
  point = null,
  onSelectOutlet,
}: Props) {
  const router = useRouter()
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  // Real distance and ETA for the chosen outlet. Before multiple outlets this
  // line was hardcoded to "25–35 mins • 0.6 km" for every customer.
  const outletStatus = (() => {
    if (!outlet || !point) return 'Open • 25–35 mins'
    const { roadKm } = outletDelivery(outlet, point.lat, point.lng)
    const eta = etaMinutesFromKm(roadKm)
    return `Open • ${eta.min}–${eta.max} mins${roadKm != null ? ` • ${roadKm.toFixed(1)} km` : ''}`
  })()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(role === 'restaurant' ? '/restaurant/login' : '/login')
    router.refresh()
  }

  if (role === 'restaurant') {
    return (
      <nav className="bg-white sticky top-0 z-40 border-b border-gray-100">
        <div className="phone-screen px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBack && (
              <button onClick={() => router.back()} className="p-1 -ml-1">
                <ChevronLeft className="size-5 text-gray-800" />
              </button>
            )}
            <span className="font-bold text-gray-900">{title ?? 'Dashboard'}</span>
          </div>
          <button onClick={handleLogout} className="text-xs font-semibold text-[#c0392b]">
            Sign out
          </button>
        </div>
      </nav>
    )
  }

  // Customer nav — matches stitch design
  return (
    <nav className="bg-white sticky top-0 z-40 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="phone-screen px-4 h-14 flex items-center gap-3">
        {/* Back or logo */}
        {showBack ? (
          <button onClick={() => router.back()} className="p-1 -ml-1 flex-shrink-0">
            <ChevronLeft className="size-6 text-gray-800" />
          </button>
        ) : null}

        {/* Center text block */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {!showBack && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo.png" alt="Wali Baba Foods" className="w-8 h-8 object-contain flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h1 className="font-extrabold text-gray-900 text-base leading-tight truncate">
              {title ?? 'Wali Baba Foods'}
            </h1>

            {/* Outlet chooser — the customer's "which branch am I ordering from" */}
            {!showBack && outlet && (
              <OutletPicker
                outlets={outlets}
                selected={outlet}
                point={point}
                onSelect={onSelectOutlet ?? (() => {})}
                variant="nav"
                className="mt-0.5"
              />
            )}

            {!showBack && (
              <p className="text-[11px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                  closedReason === 'manual' ? 'bg-amber-500' : isOpen === false ? 'bg-red-500' : 'bg-green-500'
                }`} />
                {closedReason === 'manual'
                  ? 'Temporarily closed · Back in 1–2 hrs'
                  : isOpen === false
                  ? openingTime ? `Closed · Opens at ${formatTime12(openingTime)}` : 'Closed'
                  : outletStatus}
              </p>
            )}
            {!showBack && (
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                A Product of Baba Biryani
              </p>
            )}
          </div>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onSearchClick} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <Search className="size-5 text-gray-600" />
          </button>
          <Link href="/checkout" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors relative">
            <ShoppingCart className="size-5 text-gray-600" />
            {itemCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-[#c0392b] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  )
}