'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { Minus, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CartDrawer({ open, onOpenChange }: Props) {
  const { items, updateQuantity, removeItem } = useCartStore()
  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex flex-col max-h-[88dvh] rounded-t-3xl px-0 pb-0 phone-screen mx-auto"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <SheetHeader className="px-5 pb-3 border-b flex-shrink-0">
          <SheetTitle className="text-left text-base">
            Your Cart{' '}
            <span className="text-muted-foreground font-normal text-sm">
              ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </span>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 pb-10">
            <span className="text-4xl">🛒</span>
            <p className="text-sm">Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.product.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">₹{item.product.price} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100 transition-colors"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      className="w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center text-white active:bg-orange-700 transition-colors"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    >
                      <Plus className="size-3" />
                    </button>
                    <button
                      className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 ml-1 active:bg-red-50 transition-colors"
                      onClick={() => removeItem(item.product.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-bold w-12 text-right text-gray-900">
                    ₹{item.product.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-5 pt-3 pb-8 border-t bg-white flex-shrink-0">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-600 font-medium">Total</span>
                <span className="text-orange-600 font-bold text-xl">₹{total}</span>
              </div>
              <Link href="/checkout" onClick={() => onOpenChange(false)}>
                <Button
                  className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-base font-semibold rounded-xl"
                >
                  Proceed to Checkout
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}