export type UserRole = 'customer' | 'restaurant'
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  email: string
  phone: string | null
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  photo_url: string | null
  is_available: boolean
}

export interface DeliveryAddress {
  name: string
  phone: string
  address: string
  pincode: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  price_at_order: number
  products?: Pick<Product, 'name' | 'price'>
}

export interface Order {
  id: string
  customer_id: string
  status: OrderStatus
  delivery_address: DeliveryAddress
  total: number
  created_at: string
  profiles?: Pick<Profile, 'full_name' | 'phone'>
  order_items?: OrderItem[]
}
