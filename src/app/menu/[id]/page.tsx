import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import NavBar from '@/components/NavBar'
import AddToCartButton from '@/components/AddToCartButton'
import { Button } from '@/components/ui/button'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (!product) notFound()

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <NavBar role="customer" showBack />
      <main className="phone-screen">
        {/* Hero image */}
        <div className="h-64 bg-orange-50 w-full">
          {product.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.photo_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-8xl">🍽️</div>
          )}
        </div>

        {/* Details card */}
        <div className="bg-white rounded-t-3xl -mt-4 px-5 pt-6 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex justify-between items-start mb-3">
            <h1 className="text-xl font-bold text-gray-900 flex-1 pr-4">{product.name}</h1>
            <span className="text-xl font-bold text-orange-600 flex-shrink-0">₹{product.price}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            {product.description}
          </p>
          {product.is_available ? (
            <AddToCartButton product={product} />
          ) : (
            <Button className="w-full h-12 rounded-xl" disabled>
              Out of Stock
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}