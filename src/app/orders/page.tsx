import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrdersClient from '@/components/OrdersClient'
import BottomNav from '@/components/BottomNav'
import { Order } from '@/lib/types'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(quantity, price_at_order, products(name))')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f8f9fa]">
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center border-b border-[#e5beb6]/20">
        <h1 className="text-base font-bold text-[#b51c00]">My Orders</h1>
      </header>
      <main className="flex-1 px-4 pt-4 pb-24">
        <OrdersClient initialOrders={(orders as Order[]) ?? []} userId={user.id} />
      </main>
      <BottomNav />
    </div>
  )
}