'use client'

import { useEffect, useState } from 'react'
import { Bell, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  usePushSubscription,
  usePushPermissionState,
  requestPushPermission,
  subscribeAfterPermission,
} from '@/hooks/usePushSubscription'

// Shared shell so every state looks consistent
function Banner({
  icon,
  title,
  subtitle,
  action,
  onDismiss,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  action?: React.ReactNode
  onDismiss: () => void
}) {
  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 flex justify-center pointer-events-none">
      <div className="bg-gray-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-sm w-full pointer-events-auto">
        <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">{title}</p>
          <p className="text-[10px] text-gray-400 font-medium">{subtitle}</p>
        </div>
        {action}
        <button onClick={onDismiss} className="flex-shrink-0">
          <X className="size-4 text-gray-500" />
        </button>
      </div>
    </div>
  )
}

interface Props {
  variant?: 'menu' | 'order'
}

export default function PushSetup({ variant = 'menu' }: Props) {
  usePushSubscription()
  const permState = usePushPermissionState()
  const storageKey = `push-setup-dismissed-${variant}`
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(storageKey) === '1' } catch { return false }
  })
  const [loading, setLoading] = useState(false)

  // If permission was already granted (e.g. a returning device), make sure a
  // subscription row actually exists — a previous save may have failed silently.
  useEffect(() => {
    if (permState === 'granted') {
      subscribeAfterPermission().catch((e) => console.error('[Push] re-subscribe failed:', e))
    }
  }, [permState])

  function handleDismiss() {
    setDismissed(true)
    try { sessionStorage.setItem(storageKey, '1') } catch {}
  }

  async function handleEnable() {
    setLoading(true)
    const result = await requestPushPermission()
    setLoading(false)
    if (result.ok) {
      handleDismiss()
      toast.success('Notifications enabled!')
    } else {
      toast.error(result.error ?? 'Could not enable notifications')
    }
  }

  if (dismissed) return null

  if (permState === 'prompt') {
    return (
      <Banner
        onDismiss={handleDismiss}
        icon={<Bell className="size-4 text-white" />}
        title="Enable order notifications"
        subtitle="Get notified when your order is ready"
        action={
          <button
            onClick={handleEnable}
            disabled={loading}
            className="text-xs font-bold text-orange-400 hover:text-orange-300 flex-shrink-0 disabled:opacity-50"
          >
            {loading ? '…' : 'Allow'}
          </button>
        }
      />
    )
  }

  // Opened inside WhatsApp/Instagram/etc. — web push simply isn't available there
  if (permState === 'in-app-browser') {
    return (
      <Banner
        onDismiss={handleDismiss}
        icon={<AlertCircle className="size-4 text-white" />}
        title="Open in Chrome for notifications"
        subtitle="Tap ⋮ → “Open in Chrome” to get order updates"
      />
    )
  }

  // Permission was blocked — the OS won't re-prompt; must be changed in settings
  if (permState === 'denied') {
    return (
      <Banner
        onDismiss={handleDismiss}
        icon={<AlertCircle className="size-4 text-white" />}
        title="Notifications are blocked"
        subtitle="Turn them on in your browser's site settings"
      />
    )
  }

  // 'granted', 'unsupported', 'insecure' → nothing actionable to show the user
  return null
}
