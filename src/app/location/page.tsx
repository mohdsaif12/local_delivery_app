'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Address } from '@/lib/types'
import {
  MapPin,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Plus,
  CheckCircle2,
  Pencil,
  Trash2,
} from 'lucide-react'
import MapLocationPicker from '@/components/MapLocationPicker'

const LABEL_PRESETS = ['Home', 'Work', 'Other']

export default function LocationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] phone-screen flex items-center justify-center bg-[#f9f6f4]">
          <div className="w-10 h-10 border-4 border-[#b51c00] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LocationContent />
    </Suspense>
  )
}

function LocationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('from') === 'checkout' ? '/checkout' : '/menu'

  const [loading, setLoading] = useState(true)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ label: 'Home', address: '', landmark: '', pincode: '' })
  const [formCoords, setFormCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [showMapSelect, setShowMapSelect] = useState(false)

  const fetchAddresses = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
    setAddresses(data ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchAddresses()
  }, [fetchAddresses])

  // ── Map Selection View ──
  if (showMapSelect) {
    return (
      <MapLocationPicker
        initialCoords={formCoords}
        onClose={() => setShowMapSelect(false)}
        onConfirm={(coords, addressText, pincode) => {
          setFormCoords(coords)
          setForm((prev) => ({
            ...prev,
            address: addressText,
            pincode: pincode || prev.pincode,
          }))
          setShowMapSelect(false)
        }}
      />
    )
  }

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  async function selectAddress(address: Address) {
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('addresses').update({ is_default: false }).eq('customer_id', user.id)
    await supabase.from('addresses').update({ is_default: true }).eq('id', address.id)
    router.push(returnTo)
  }

  function handleEditClick(e: React.MouseEvent, addr: Address) {
    e.stopPropagation()
    setEditingAddress(addr)
    setForm({
      label: addr.label || 'Home',
      address: addr.address || '',
      landmark: addr.landmark || '',
      pincode: addr.pincode || '',
    })
    if (addr.latitude && addr.longitude) {
      setFormCoords({ lat: addr.latitude, lng: addr.longitude })
    } else {
      setFormCoords(null)
    }
    setError('')
    setShowAddForm(true)
  }

  async function handleDeleteClick(e: React.MouseEvent, addrId: string) {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this saved address?')) return

    const supabase = createClient()
    const { error: deleteErr } = await supabase.from('addresses').delete().eq('id', addrId)
    if (deleteErr) {
      setError('Failed to delete address.')
    } else {
      fetchAddresses()
    }
  }

  function handleUseCurrentLocation() {
    setLocating(true)
    setError('')
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      setLocating(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocating(false)
        setShowAddForm(true)
      },
      () => {
        setError('Location access denied. Please add your address manually.')
        setLocating(false)
        setShowAddForm(true)
      }
    )
  }

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault()
    if (!form.address.trim() || !form.pincode.trim()) {
      setError('Please fill in your address and pincode.')
      return
    }
    setError('')
    setSaving(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    let lat = formCoords?.lat ?? null
    let lng = formCoords?.lng ?? null

    // If coordinates are null, geocode the typed address using Google Maps Geocoding API
    if (lat === null || lng === null) {
      try {
        const addressStr = `${form.address}${form.landmark ? ', ' + form.landmark : ''}, ${form.pincode}`
        const response = await fetch(
          `/api/geocode?address=${encodeURIComponent(addressStr)}`
        )
        const data = await response.json()
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const loc = data.results[0].geometry.location
          lat = loc.lat
          lng = loc.lng
        } else {
          console.warn('Geocoding not successful: status =', data.status)
        }
      } catch (err) {
        console.error('Error during manual address geocoding:', err)
      }
    }

    if (editingAddress) {
      // ── UPDATE EXISTING ADDRESS ──
      const { error: updateError } = await supabase
        .from('addresses')
        .update({
          label: form.label.trim() || 'Home',
          address: form.address.trim(),
          landmark: form.landmark.trim() || null,
          pincode: form.pincode.trim(),
          latitude: lat,
          longitude: lng,
        })
        .eq('id', editingAddress.id)

      setSaving(false)
      if (updateError) {
        setError('Failed to update address. Please try again.')
        return
      }
      setEditingAddress(null)
      setShowAddForm(false)
      fetchAddresses()
    } else {
      // ── INSERT NEW ADDRESS ──
      await supabase.from('addresses').update({ is_default: false }).eq('customer_id', user.id)
      const { error: insertError } = await supabase.from('addresses').insert({
        customer_id: user.id,
        label: form.label.trim() || 'Home',
        address: form.address.trim(),
        landmark: form.landmark.trim() || null,
        pincode: form.pincode.trim(),
        latitude: lat,
        longitude: lng,
        is_default: true,
      })

      if (insertError) {
        setError('Failed to save address. Please try again.')
        setSaving(false)
        return
      }

      router.push(returnTo)
    }
  }

  const filteredAddresses = addresses.filter(
    (a) =>
      search.trim() === '' ||
      a.label.toLowerCase().includes(search.toLowerCase()) ||
      a.address.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-[100dvh] phone-screen flex items-center justify-center bg-[#f9f6f4]">
        <div className="w-10 h-10 border-4 border-[#b51c00] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── First-time hero flow (no saved addresses yet) ──
  if (addresses.length === 0 && !showAddForm) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f9f6f4] relative">
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white text-[#b51c00] flex items-center justify-center shadow-md border border-gray-100/80"
            aria-label="Go back"
          >
            <ChevronLeft className="size-6 text-[#b51c00]" />
          </button>
        </div>

        <div className="relative w-full aspect-square max-h-[52vw] sm:max-h-[260px] overflow-hidden rounded-b-3xl bg-[#1a1a1a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/location-hero.webp" alt="Find your location" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#f9f6f4] to-transparent" />
        </div>

        <div className="flex-1 flex flex-col px-6 pt-6 pb-10">
          <div className="text-center mb-3">
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
              Find the Nearest <span className="text-[#b51c00]">Wali Baba<br />Foods</span>
            </h1>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed px-4">
              To show accurate delivery fees, we need to know where to find you.
            </p>
          </div>

          {error && (
            <div className="mt-2 mb-1 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-3 text-center">
              {error}
            </div>
          )}

          <div className="flex-1" />

          <div className="space-y-3">
            <button
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="w-full h-14 bg-[#b51c00] hover:bg-[#a01700] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-70 shadow-lg shadow-[#b51c00]/25"
            >
              {locating ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span>Locating you…</span>
                </>
              ) : (
                <>
                  <Navigation className="size-5 fill-white" />
                  <span>Allow Location</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setEditingAddress(null)
                setForm({ label: 'Home', address: '', landmark: '', pincode: '' })
                setFormCoords(null)
                setShowAddForm(true)
              }}
              className="w-full h-12 text-[#b51c00] font-bold text-sm flex items-center justify-center gap-1.5 rounded-2xl hover:bg-red-50 transition-colors"
            >
              Enter Address Manually
              <ChevronRight className="size-4" />
            </button>

            <p className="text-center text-[11px] text-gray-400 leading-relaxed px-6 pt-1">
              Your location is used only for delivery accuracy and is never shared with third parties.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Add / Edit address form ──
  if (showAddForm) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
        <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center gap-3 border-b border-[#e1e3e4]">
          <button
            onClick={() => {
              setShowAddForm(false)
              setEditingAddress(null)
            }}
            className="p-1 -ml-1"
          >
            <ChevronLeft className="size-5 text-[#191c1d]" />
          </button>
          <h1 className="text-base font-bold text-[#b51c00]">
            {editingAddress ? 'Edit Address' : 'Add New Address'}
          </h1>
        </header>

        <form onSubmit={handleSaveAddress} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-3">
              {error}
            </div>
          )}


          <div>
            <p className="text-xs font-bold text-[#586062] mb-2">Save as</p>
            <div className="flex gap-2">
              {LABEL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, label: preset }))}
                  className={`h-9 px-4 rounded-full text-xs font-semibold border transition-colors ${
                    form.label === preset
                      ? 'bg-[#b51c00] text-white border-[#b51c00]'
                      : 'bg-white text-[#586062] border-[#e1e3e4]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <textarea
              placeholder="Full address — house no, street, area"
              value={form.address}
              onChange={field('address')}
              required
              rows={3}
              className="w-full p-3 rounded-lg bg-white border border-[#e1e3e4] text-sm focus:outline-none focus:ring-1 focus:ring-[#b51c00] resize-none"
            />
            <input
              placeholder="Landmark (optional)"
              value={form.landmark}
              onChange={field('landmark')}
              className="w-full h-11 px-3 rounded-lg bg-white border border-[#e1e3e4] text-sm focus:outline-none focus:ring-1 focus:ring-[#b51c00]"
            />
            <input
              placeholder="Pincode"
              value={form.pincode}
              onChange={field('pincode')}
              required
              inputMode="numeric"
              maxLength={6}
              className="w-full h-11 px-3 rounded-lg bg-white border border-[#e1e3e4] text-sm focus:outline-none focus:ring-1 focus:ring-[#b51c00]"
            />
          </div>

          {formCoords ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-4 py-3.5 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0" />
                <span>GPS coordinates captured ({formCoords.lat.toFixed(5)}, {formCoords.lng.toFixed(5)})</span>
              </div>
              <div className="flex gap-3 mt-0.5">
                <button
                  type="button"
                  onClick={() => setShowMapSelect(true)}
                  className="text-xs text-[#b51c00] font-bold hover:underline"
                >
                  Adjust on Map
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="text-xs text-[#b51c00] font-bold hover:underline disabled:opacity-50"
                >
                  Recapture GPS
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locating}
                className="h-11 flex items-center justify-center gap-1.5 text-xs font-bold text-[#b51c00] border border-[#ffdad3] bg-[#fff5f3] rounded-xl disabled:opacity-60 hover:bg-[#ffece8] active:scale-[0.98] transition-all"
              >
                {locating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Navigation className="size-3.5 fill-[#b51c00]" />
                )}
                Use GPS Location
              </button>
              <button
                type="button"
                onClick={() => setShowMapSelect(true)}
                className="h-11 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-800 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                <MapPin className="size-3.5 text-[#b51c00]" />
                Select on Map
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full h-14 bg-[#b51c00] text-white font-bold rounded-xl disabled:opacity-70"
          >
            {saving ? 'Saving…' : editingAddress ? 'Update Address' : 'Save Address'}
          </button>
        </form>
      </div>
    )
  }

  // ── Swiggy-style picker (returning users with saved addresses) ──
  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center gap-3 border-b border-[#e1e3e4]">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ChevronLeft className="size-5 text-[#191c1d]" />
        </button>
        <h1 className="text-base font-bold text-[#191c1d]">Select your location</h1>
      </header>

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9ea3a5]" />
          <input
            placeholder="Search for area or address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-lg bg-white border border-[#e1e3e4] text-sm focus:outline-none focus:ring-1 focus:ring-[#b51c00]"
          />
        </div>
      </div>

      <div className="px-4 flex gap-3 pb-2">
        <button
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-lg border border-[#ffdad3] bg-[#fff5f3] text-[#b51c00] text-xs font-bold disabled:opacity-60"
        >
          {locating ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
          Use Current Location
        </button>
        <button
          onClick={() => {
            setEditingAddress(null)
            setForm({ label: 'Home', address: '', landmark: '', pincode: '' })
            setFormCoords(null)
            setShowAddForm(true)
          }}
          className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-lg border border-[#e1e3e4] bg-white text-[#191c1d] text-xs font-bold"
        >
          <Plus className="size-4" />
          Add New Address
        </button>
      </div>

      {error && (
        <div className="mx-4 mb-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[11px] font-bold text-[#9ea3a5] uppercase tracking-wide mb-2">
          Saved Addresses
        </p>
        <div className="space-y-2">
          {filteredAddresses.map((addr) => (
            <div
              key={addr.id}
              onClick={() => selectAddress(addr)}
              className="w-full text-left bg-white rounded-xl p-4 flex items-start gap-3 cursor-pointer group hover:border-[#b51c00]/30 transition-colors border border-transparent"
              style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}
            >
              <MapPin className="size-4 text-[#b51c00] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-[#191c1d]">{addr.label}</p>
                  {addr.is_default && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      SELECTED
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#586062] mt-0.5 truncate">
                  {addr.address}
                  {addr.landmark ? `, ${addr.landmark}` : ''} — {addr.pincode}
                </p>
              </div>

              {/* Edit & Delete Action Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                <button
                  type="button"
                  onClick={(e) => handleEditClick(e, addr)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#b51c00] hover:bg-red-50 transition-colors"
                  title="Edit Address"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteClick(e, addr.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete Address"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
