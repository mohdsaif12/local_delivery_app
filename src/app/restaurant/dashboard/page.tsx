import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import DashboardClient from '@/components/DashboardClient'
import { Order } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/restaurant/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'restaurant') redirect('/menu')

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(quantity, price_at_order, products(name)), profiles(full_name, phone)')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <NavBar role="restaurant" />
      <main className="phone-screen px-4 pt-4 pb-8">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Live Orders</h1>
          <p className="text-sm text-muted-foreground">New orders appear automatically</p>
        </div>
        <DashboardClient initialOrders={(orders as Order[]) ?? []} />
      </main>
    </div>
  )
}