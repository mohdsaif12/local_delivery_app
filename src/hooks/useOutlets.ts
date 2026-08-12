'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOutletStore } from '@/store/outlet'
import {
  Outlet,
  OUTLET_COLUMNS,
  pickDefaultOutlet,
  outletDelivery,
  getClosedReason,
  type ClosedReason,
} from '@/lib/outlets'

export interface UseOutlets {
  /** Every active outlet, in display order. */
  outlets: Outlet[]
  /** The outlet currently in effect, or null while loading. */
  outlet: Outlet | null
  /** The customer's default delivery point, used to rank outlets by distance. */
  point: { lat: number; lng: number } | null
  /** Fee and coverage of the current outlet for that point. */
  delivery: ReturnType<typeof outletDelivery> | null
  /** Why the current outlet is shut, or null if it is open. */
  closedReason: ClosedReason
  loading: boolean
  /** Switch outlet. Marks the choice as the customer's own. */
  selectOutlet: (id: string) => void
}

/**
 * Loads the outlets, works out which one applies, and keeps it live.
 *
 * Selection order: the customer's own choice if it is still active, otherwise
 * the nearest outlet that delivers to their address and is open. Everything
 * customer-facing reads the outlet from here so the menu, checkout and profile
 * can never disagree.
 */
export function useOutlets(): UseOutlets {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const outletId = useOutletStore((s) => s.outletId)
  const chosenByCustomer = useOutletStore((s) => s.chosenByCustomer)
  const setOutlet = useOutletStore((s) => s.setOutlet)

  // Re-check the clock every minute so open/closed flips without a refresh.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function load() {
      const { data: outletRows } = await supabase
        .from('restaurants')
        .select(OUTLET_COLUMNS)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      // Anonymous visitors have no saved address; outlets then fall back to
      // display order rather than distance.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let addressPoint: { lat: number; lng: number } | null = null
      if (user) {
        const { data: address } = await supabase
          .from('addresses')
          .select('latitude, longitude')
          .eq('customer_id', user.id)
          .eq('is_default', true)
          .maybeSingle()
        if (address?.latitude != null && address?.longitude != null) {
          addressPoint = { lat: address.latitude, lng: address.longitude }
        }
      }

      if (cancelled) return
      setOutlets((outletRows ?? []) as unknown as Outlet[])
      setPoint(addressPoint)
      setLoading(false)
    }

    load()

    // Staff toggling an outlet open or closed should reach customers live.
    const channel = supabase
      .channel('outlet-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'restaurants' },
        (payload) => {
          const row = payload.new as Outlet
          setOutlets((prev) => prev.map((o) => (o.id === row.id ? { ...o, ...row } : o)))
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const stored = outlets.find((o) => o.id === outletId) ?? null

  const outlet = useMemo(() => {
    // A customer's own choice wins, unless that outlet has gone inactive.
    if (chosenByCustomer && stored) return stored
    return pickDefaultOutlet(outlets, point, now) ?? stored
  }, [chosenByCustomer, stored, outlets, point, now])

  // Remember the auto-selected outlet so orders and the picker agree on it,
  // without marking it as the customer's own decision.
  useEffect(() => {
    if (outlet && outlet.id !== outletId) setOutlet(outlet.id, chosenByCustomer)
  }, [outlet, outletId, chosenByCustomer, setOutlet])

  const selectOutlet = useCallback((id: string) => setOutlet(id, true), [setOutlet])

  const delivery = useMemo(
    () => (outlet && point ? outletDelivery(outlet, point.lat, point.lng) : null),
    [outlet, point]
  )

  return {
    outlets,
    outlet,
    point,
    delivery,
    closedReason: getClosedReason(outlet, now),
    loading,
    selectOutlet,
  }
}
