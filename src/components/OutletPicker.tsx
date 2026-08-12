'use client'

import { useState } from 'react'
import { ChevronDown, MapPin, Check, X } from 'lucide-react'
import {
  Outlet,
  outletLabel,
  outletDelivery,
  outletsByDistance,
  isOutletOpen,
  etaMinutesFromKm,
} from '@/lib/outlets'

interface Props {
  outlets: Outlet[]
  selected: Outlet | null
  point: { lat: number; lng: number } | null
  onSelect: (id: string) => void
  /** 'nav' is the compact header trigger; 'row' is the boxed one used on
   *  checkout and profile. */
  variant?: 'nav' | 'row'
  className?: string
}

/**
 * Outlet chooser. The trigger shows the current outlet; tapping it opens a
 * sheet listing every outlet with its distance, ETA and whether it is open.
 *
 * Outlets that cannot deliver to the saved address are still listed, marked
 * as out of range, so the customer can see why rather than wondering where an
 * outlet went.
 */
export default function OutletPicker({
  outlets,
  selected,
  point,
  onSelect,
  variant = 'nav',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)

  // A single outlet needs no chooser — show it as plain text.
  const switchable = outlets.length > 1
  const label = selected ? outletLabel(selected) : 'Choose outlet'

  const ordered = point ? outletsByDistance(outlets, point.lat, point.lng) : outlets

  const trigger =
    variant === 'nav' ? (
      <button
        type="button"
        onClick={() => switchable && setOpen(true)}
        disabled={!switchable}
        className={`flex items-center gap-0.5 text-[11px] font-bold text-[#c0392b] max-w-full ${
          switchable ? 'active:opacity-60' : ''
        } ${className}`}
      >
        <MapPin className="size-3 flex-shrink-0" />
        <span className="truncate">{label}</span>
        {switchable && <ChevronDown className="size-3 flex-shrink-0" />}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => switchable && setOpen(true)}
        disabled={!switchable}
        className={`w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-gray-100 text-left ${className}`}
      >
        <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
          <MapPin className="size-4 text-[#c0392b]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Ordering from</p>
          <p className="text-xs font-bold text-gray-900 truncate">{label}</p>
        </div>
        {switchable && <span className="text-[11px] font-bold text-[#c0392b]">Change</span>}
      </button>
    )

  return (
    <>
      {trigger}

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[430px] bg-white rounded-t-3xl max-h-[80dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Choose outlet</h3>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                  Same menu everywhere · delivery time and fee change
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
              >
                <X className="size-4 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {ordered.map((o) => {
                const d = point ? outletDelivery(o, point.lat, point.lng) : null
                const openNow = isOutletOpen(o, new Date())
                const eta = etaMinutesFromKm(d?.roadKm ?? null)
                const isSelected = o.id === selected?.id

                return (
                  <button
                    key={o.id}
                    onClick={() => {
                      onSelect(o.id)
                      setOpen(false)
                    }}
                    className={`w-full text-left rounded-2xl border p-3 flex items-start gap-3 ${
                      isSelected ? 'border-[#c0392b] bg-red-50/40' : 'border-gray-150 bg-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-extrabold text-gray-900 truncate">
                          {outletLabel(o)}
                        </p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            openNow ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {openNow ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>

                      {o.address && (
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5 line-clamp-2">
                          {o.address}
                        </p>
                      )}

                      <p className="text-[10px] font-semibold mt-1">
                        {d == null ? (
                          <span className="text-gray-400">Set your address to see delivery</span>
                        ) : !d.inRange ? (
                          <span className="text-amber-600">
                            Does not deliver to your address
                            {d.roadKm != null && ` · ${d.roadKm.toFixed(1)} km away`}
                          </span>
                        ) : (
                          <span className="text-gray-500">
                            {d.roadKm != null && `${d.roadKm.toFixed(1)} km · `}
                            {eta.min}–{eta.max} mins
                            {d.fee != null && ` · ₹${d.fee} delivery`}
                          </span>
                        )}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#c0392b] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="size-3 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
