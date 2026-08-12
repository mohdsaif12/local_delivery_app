'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Search, ChevronRight, CreditCard, History, HelpCircle, LogOut, X, Phone, User as UserIcon, Mail, MessageSquareWarning, Camera, Info } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import OutletPicker from '@/components/OutletPicker'
import { useOutlets } from '@/hooks/useOutlets'
import { outletLabel } from '@/lib/outlets'
import { telHref, formatPhone } from '@/lib/phone'
import { compressImage } from '@/lib/compressImage'
import { toast } from 'sonner'

export default function ProfilePage() {
  const router = useRouter()
  const { outlets, outlet, point, selectOutlet } = useOutlets()
  const supportTel = telHref(outlet?.phone)

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [orderCount, setOrderCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // Edit Profile modal state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [saving, setSaving] = useState(false)

  // Profile photo
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Custom modal states
  const [activeModal, setActiveModal] = useState<'payment' | 'support' | 'about' | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function loadProfile() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)

      // Fetch profile row
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, phone, avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle()

      // Fetch dynamic order count
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', currentUser.id)

      const finalProfile = profileData || {
        full_name: currentUser.user_metadata?.full_name || 'Elena Rodriguez',
        email: currentUser.email,
        phone: currentUser.user_metadata?.phone || '+1 (555) 012-3456',
        avatar_url: '',
      }

      setProfile(finalProfile)
      setEditName(finalProfile.full_name || '')
      setEditPhone(finalProfile.phone || '')
      setAvatarUrl(finalProfile.avatar_url || '')
      setOrderCount(count || 0)
      setLoading(false)
    }
    loadProfile()
  }, [router])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    router.push('/login')
    router.refresh()
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file || !user) return

    setUploadingAvatar(true)
    const supabase = createClient()
    try {
      // Avatars are small — resize hard to 512px and store as WebP
      const compressed = await compressImage(file, { maxWidth: 512 })
      const ext = compressed.name.split('.').pop() || 'webp'
      // Path MUST start with the user's id — the storage policy only lets a
      // user write into their own folder (avatars/<uid>/...).
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, compressed, { contentType: compressed.type, upsert: true, cacheControl: '31536000' })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = pub.publicUrl

      // Persist immediately so the photo sticks even without hitting "Save"
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id)
      if (dbErr) throw dbErr

      setAvatarUrl(url)
      setProfile((prev: any) => ({ ...prev, avatar_url: url }))
      toast.success('Profile photo updated!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSaveProfile(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!editName.trim()) {
      toast.error('Name cannot be empty')
      return
    }

    setSaving(true)
    const supabase = createClient()

    try {
      // Upsert profile in Supabase
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          role: 'customer',
          full_name: editName.trim(),
          email: user.email,
          phone: editPhone.trim(),
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })

      if (error) throw error

      // Update Auth metadata to sync values
      await supabase.auth.updateUser({
        data: { full_name: editName.trim(), phone: editPhone.trim() }
      })

      setProfile((prev: any) => ({
        ...prev,
        full_name: editName.trim(),
        phone: editPhone.trim(),
      }))
      setIsEditing(false)
      toast.success('Profile updated successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] phone-screen flex flex-col items-center justify-center bg-[#f7f8fa]">
        <div className="w-10 h-10 border-4 border-[#c0392b] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 mt-3 font-semibold">Loading profile...</p>
      </div>
    )
  }

  const fullName = profile?.full_name || 'Elena Rodriguez'
  const email = profile?.email || user?.email || 'elena.rodriguez@example.com'
  const phone = profile?.phone || '+1 (555) 012-3456'

  // Dynamic loyalty tier logic
  let loyaltyTier = 'Bronze Foodie'
  let tierColor = 'text-[#c0392b] bg-[#fff0ee]'
  if (orderCount >= 10) {
    loyaltyTier = 'Gold Gourmet'
    tierColor = 'text-[#d4af37] bg-yellow-50 border border-yellow-100'
  } else if (orderCount >= 5) {
    loyaltyTier = 'Silver Connoisseur'
    tierColor = 'text-gray-600 bg-gray-50 border border-gray-100'
  }

  return (
    <div className="min-h-[100dvh] phone-screen flex flex-col bg-[#f7f8fa] text-gray-900 pb-safe relative">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 h-14 flex items-center justify-between border-b border-gray-100">
        {/* Outlet chooser — same control as the menu header */}
        <div className="min-w-0 flex-1">
          {outlet ? (
            <OutletPicker
              outlets={outlets}
              selected={outlet}
              point={point}
              onSelect={selectOutlet}
              variant="nav"
              className="!text-sm !font-extrabold"
            />
          ) : (
            <div className="flex items-center gap-2 text-[#c0392b]">
              <MapPin className="size-5" />
              <span className="font-extrabold text-sm text-gray-800">Wali Baba Foods</span>
            </div>
          )}
        </div>
        <button className="p-1 cursor-pointer">
          <Search className="size-5 text-gray-700" />
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-grow overflow-y-auto pb-24">
        
        {/* Profile Card Info */}
        <div className="flex flex-col items-center pt-6 pb-5">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center text-5xl shadow-md border-2 border-white select-none overflow-hidden">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                '👩‍🦰'
              )}
            </div>
            {/* Edit pencil badge */}
            <button
              onClick={() => setIsEditing(true)}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#c0392b] text-white flex items-center justify-center shadow-md cursor-pointer border-2 border-white hover:bg-[#a93226] transition-colors"
            >
              <svg className="size-3.5 fill-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.127 22.564l-5.127 1.436 1.436-5.127 12.192-12.192 3.691 3.691-12.192 12.192zm14.288-14.288l-2.485-2.485 1.586-1.586 2.485 2.485-1.586 1.586z"/>
              </svg>
            </button>
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mt-4 leading-tight">
            {fullName}
          </h2>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {email}
          </p>
          <div className={`mt-2.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide ${tierColor}`}>
            {loyaltyTier} • {phone}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 px-4 mb-5">
          <div className="bg-white rounded-2xl p-3 text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-gray-50/50 flex flex-col justify-center">
            <span className="text-base font-extrabold text-[#c0392b]">{orderCount}</span>
            <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mt-0.5">Orders</span>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-gray-50/50 flex flex-col justify-center">
            <span className="text-base font-extrabold text-[#c0392b]">{orderCount * 50 || 150}</span>
            <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mt-0.5">Points</span>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-gray-50/50 flex flex-col justify-center">
            <span className="text-base font-extrabold text-[#c0392b]">3</span>
            <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mt-0.5">Coupons</span>
          </div>
        </div>

        {/* Options List */}
        <div className="px-4 space-y-2.5 mb-6">
          {[
            { label: 'Saved Addresses', icon: MapPin, color: 'bg-red-50 text-[#c0392b] border-red-100/20', href: '/location' },
            { label: 'Payment Methods', icon: CreditCard, color: 'bg-blue-50 text-blue-600 border-blue-100/20', onClick: () => setActiveModal('payment') },
            { label: 'Order History', icon: History, color: 'bg-amber-50 text-amber-600 border-amber-100/20', href: '/orders' },
            { label: 'My Complaints', icon: MessageSquareWarning, color: 'bg-orange-50 text-orange-600 border-orange-100/20', href: '/complaints' },
            { label: 'Help & Support', icon: HelpCircle, color: 'bg-cyan-50 text-cyan-600 border-cyan-100/20', onClick: () => setActiveModal('support') },
            { label: 'About Baba Biryani', icon: Info, color: 'bg-green-50 text-green-700 border-green-100/20', onClick: () => setActiveModal('about') },
            { label: 'Logout', icon: LogOut, color: 'bg-red-50 text-red-600 border-red-100/20', onClick: handleLogout },
          ].map((opt, i) => {
            const Icon = opt.icon
            return (
              <div
                key={i}
                onClick={() => {
                  if (opt.onClick) opt.onClick()
                  else if (opt.href && opt.href !== '#') router.push(opt.href)
                }}
                className="bg-white rounded-2xl p-3 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-gray-50/50 cursor-pointer hover:bg-gray-50 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border ${opt.color}`}>
                    <Icon className="size-4.5" />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{opt.label}</span>
                </div>
                <ChevronRight className="size-4 text-gray-400" />
              </div>
            )
          })}
        </div>

        {/* Refer a Friend Banner */}
        <div className="mx-4 bg-[#c0392b] rounded-3xl p-5 flex items-center justify-between text-white relative overflow-hidden shadow-md shadow-[#c0392b]/15">
          <div className="space-y-2 max-w-[65%] z-10">
            <h3 className="text-sm font-extrabold">Refer a friend</h3>
            <p className="text-[10px] text-white/80 leading-normal font-semibold">
              Give ₹100, get ₹100. Spread the love for Wali Baba Foods!
            </p>
            <button 
              onClick={() => toast.success('Referral code copied to clipboard!')}
              className="h-8 px-4 bg-white text-[#c0392b] text-[10px] font-extrabold rounded-xl shadow-sm cursor-pointer mt-1 hover:bg-red-50 transition-colors"
            >
              Invite Friends
            </button>
          </div>
          
          {/* Giftbox Icon Illustration */}
          <div className="absolute right-3 bottom-0 w-24 h-24 text-white/10 flex items-center justify-center pointer-events-none scale-110 z-0 select-none">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              <path d="M20 8.5v12c0 .825-.675 1.5-1.5 1.5h-13c-.825 0-1.5-.675-1.5-1.5v-12h16zm-3.5-6c1.1 0 2 .9 2 2 0 .5-.175.95-.475 1.3.175.25.325.525.425.825L19 7h3v1.5H2v-1.5h3l.55-1.375c.1-.3.25-.575.425-.825C5.675 5.45 5.5 5 5.5 4c0-1.1.9-2 2-2 1.35 0 2.45.9 2.875 2.125L12 5.5l1.625-1.375C14.05 2.9 15.15 2 16.5 2zM8 8.5H3.5v12H8v-12zm6.5 0H9.5v12h5v-12zM20.5 8.5H16v12h4.5v-12zM7.5 3.5c-.275 0-.5.225-.5.5s.225.5.5.5h1.7l-.3-1c-.1-.55-.6-.9-1.2-.9zm9 0c-.6 0-1.1.35-1.2.9l-.3 1h1.7c.275 0 .5-.225.5-.5s-.225-.5-.5-.5z"/>
            </svg>
          </div>
        </div>

      </div>

      {/* ── Edit Profile Modal ── */}
      {isEditing && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end justify-center transition-all duration-300">
          <div className="bg-white w-full rounded-t-3xl p-6 pb-8 max-w-[430px] border-t border-gray-100 flex flex-col gap-4 animate-in slide-in-from-bottom duration-250">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">Edit Profile</h3>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="size-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Profile photo picker */}
              <div className="flex flex-col items-center gap-2 pb-1">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center text-4xl overflow-hidden border-2 border-white shadow-md select-none">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      '👩‍🦰'
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#c0392b] text-white flex items-center justify-center shadow-md cursor-pointer border-2 border-white hover:bg-[#a93226] transition-colors">
                    {uploadingAvatar ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="size-3.5" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingAvatar}
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>
                <span className="text-[10px] text-gray-400 font-semibold">
                  {uploadingAvatar ? 'Uploading…' : 'Tap the camera to change photo'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#c0392b] focus:bg-white transition-all"
                    placeholder="Enter your name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#c0392b] focus:bg-white transition-all"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full h-11 bg-[#c0392b] text-white text-xs font-extrabold rounded-2xl flex items-center justify-center gap-2 cursor-pointer hover:bg-[#a93226] active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving changes...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Mock Details Modal (Payments / Support) ── */}
      {activeModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end justify-center transition-all duration-300">
          <div className="bg-white w-full rounded-t-3xl p-6 pb-8 max-w-[430px] border-t border-gray-100 flex flex-col gap-4 animate-in slide-in-from-bottom duration-250">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">
                {activeModal === 'payment'
                  ? 'Payment Methods'
                  : activeModal === 'about'
                  ? 'About Baba Biryani'
                  : 'Help & Support'}
              </h3>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="size-5 text-gray-500" />
              </button>
            </div>

            {activeModal === 'about' ? (
              <div className="space-y-4">
                {/* Brand mark — the transparent green logo */}
                <div className="flex flex-col items-center text-center gap-2 pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/baba-biryani-logo.png"
                    alt="Baba Biryani"
                    style={{ height: '84px', width: 'auto', maxWidth: '160px', objectFit: 'contain' }}
                  />
                  <p className="text-[11px] font-bold text-gray-500 tracking-wide uppercase">
                    The Authentic Biryani Brand
                  </p>
                  <span className="text-[10px] font-extrabold text-green-800 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                    Since 1990
                  </span>
                </div>

                <div className="space-y-3 text-xs text-gray-600 leading-relaxed font-medium">
                  <p>
                    Baba Biryani was established in the heart of Kanpur city in 1990, and has been
                    serving the city ever since.
                  </p>
                  <p>
                    In no time it became a{' '}
                    <span className="font-bold text-gray-800">&ldquo;Word of Mouth&rdquo;</span> name,
                    thanks to its unique hidden recipe and preparation with pure Desi Ghee.
                  </p>
                  <p>
                    Baba Becanganj soon became a landmark for everybody craving Chicken Biryani, Bun
                    Butter and Lassi.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl border border-gray-200/60 p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                    Part of the family
                  </p>
                  <p className="text-xs font-bold text-gray-700">
                    Wali Baba Foods is a product of Baba Biryani.
                  </p>
                </div>
              </div>
            ) : activeModal === 'payment' ? (
              <div className="space-y-4">
                {/* Visual Premium Cards */}
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 rounded-2xl text-white relative overflow-hidden shadow-md">
                    <div className="absolute right-4 top-4 font-bold text-sm tracking-widest text-white/50">VISA</div>
                    <div className="text-[10px] text-white/60 tracking-wider uppercase">Saved Card</div>
                    <div className="text-xs font-bold tracking-widest mt-4">•••• •••• •••• 4242</div>
                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <div className="text-[8px] text-white/40 uppercase">Card Holder</div>
                        <div className="text-[10px] font-bold">{fullName}</div>
                      </div>
                      <div className="text-[10px] font-bold">12/28</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200/60 rounded-2xl cursor-pointer hover:bg-gray-100/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">G</div>
                      <div>
                        <div className="text-xs font-bold text-gray-800">Google Pay</div>
                        <div className="text-[9px] text-gray-400">Connected</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-[#c0392b]">Primary</span>
                  </div>
                </div>

                <button 
                  onClick={() => toast.info('Payment integration coming soon!')}
                  className="w-full h-11 border-2 border-dashed border-gray-300 text-gray-500 text-xs font-bold rounded-2xl flex items-center justify-center hover:bg-gray-50 cursor-pointer transition-colors mt-2"
                >
                  + Add New Payment Method
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                  Need help with an order, account settings, or payments? Our 24/7 support team is here to assist.
                </p>

                <div className="space-y-2">
                  <button 
                    onClick={() => toast.success('Connecting to chat support...')}
                    className="w-full h-11 bg-[#fff0ee] hover:bg-[#ffe5e2] text-[#c0392b] text-xs font-extrabold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    💬 Live Chat Support
                  </button>
                  
                  {/* Calls the outlet the customer is ordering from, so support
                      reaches the branch that actually has their order. */}
                  {supportTel && (
                    <a
                      href={`tel:${supportTel}`}
                      className="w-full h-11 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      📞 Call {outlet ? outletLabel(outlet) : 'Us'} ({formatPhone(outlet?.phone)})
                    </a>
                  )}

                  <a 
                    href="mailto:support@walibabafoods.com" 
                    className="w-full h-11 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    ✉️ Email Support
                  </a>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/60 mt-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Frequently Asked</div>
                  <div className="text-xs font-bold text-gray-700 hover:text-[#c0392b] cursor-pointer py-1 border-b border-gray-200/40">
                    How do I cancel my order?
                  </div>
                  <div className="text-xs font-bold text-gray-700 hover:text-[#c0392b] cursor-pointer py-1 pt-2">
                    What is Wali Baba Foods refund policy?
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
