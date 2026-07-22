'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OrdersClient from '@/components/OrdersClient'
import BottomNav from '@/components/BottomNav'
import { Order } from '@/lib/types'
import BackButton from '@/components/BackButton'

// Skeleton for order cards while loading
function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden animate-pulse" style={{ boxShadow: '0 2px 8px rgba(45,52,54,0.06)' }}>
      <div className="px-4 pt-4 flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="h-3 w-36 bg-gray-200 rounded" />
          <div className="h-2.5 w-24 bg-gray-200 rounded" />
        </div>
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
      </div>
      <div className="px-4 pb-3 pt-3 mt-2">
        {/* Stepper skeleton */}
        <div className="flex items-center justify-between mb-3">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-gray-200" />
              <div className="h-2 w-10 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-3 space-y-1.5">
          <div className="h-2.5 w-48 bg-gray-200 rounded" />
          <div className="flex justify-between items-center mt-1">
            <div className="h-2.5 w-16 bg-gray-200 rounded" />
            <div className="h-3.5 w-14 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      setUserId(user.id)

      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, cancellation_reason, cancelled_at, created_at, delivery_address, total, order_items(quantity, price_at_order, products(name))')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      setOrders((data as Order[]) ?? [])
    }

    load()
  }, [router])

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center gap-3 border-b border-[#e5beb6]/20">
        <BackButton />
        <h1 className="text-base font-bold text-[#b51c00]">My Orders</h1>
      </header>
      <main className="flex-1 px-4 pt-4 pb-24">
        {orders === null ? (
          // Loading skeleton — shows instantly
          <div className="space-y-3">
            <OrderCardSkeleton />
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </div>
        ) : userId ? (
          <OrdersClient initialOrders={orders} userId={userId} />
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}