import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import ProductCard from '@/components/ProductCard'
import BottomNav from '@/components/BottomNav'

export default async function MenuPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_available', true)
    .order('name')

  return (
    <div className="min-h-[100dvh] bg-[#f8f9fa]">
      <NavBar role="customer" />

      <main className="phone-screen pb-24">
        {/* Hero banner */}
        <div className="relative h-44 bg-[#b51c00] overflow-hidden mx-0">
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end px-5 pb-5 text-white">
            <span className="inline-block bg-[#db3416] text-white text-[10px] font-bold px-2 py-0.5 rounded mb-2 w-fit tracking-wide uppercase">
              Bestseller
            </span>
            <h2 className="text-xl font-bold leading-tight">Authentic Awadhi Flavors</h2>
          </div>
          {/* placeholder background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#8e1400] via-[#b51c00] to-[#db7016] -z-10" />
          <div className="absolute right-0 top-0 w-44 h-full flex items-center justify-center text-7xl opacity-30">
            🍛
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-4 py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['Popular', 'Biryani', 'Kebabs', 'Combos', 'Drinks', 'Desserts'].map((cat, i) => (
              <button
                key={cat}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  i === 0
                    ? 'bg-[#b51c00] text-white'
                    : 'bg-white text-[#586062] border border-[#e5beb6]/40'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products */}
        {!products || products.length === 0 ? (
          <p className="text-center text-[#586062] py-16 px-4">No items available right now.</p>
        ) : (
          <div className="px-4 space-y-3">
            <h3 className="text-base font-bold text-[#191c1d] mb-1">Popular Choice</h3>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}