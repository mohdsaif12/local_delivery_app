'use client'

import { ThemeProvider } from 'next-themes'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PUBLIC_PATHS = ['/welcome', '/login', '/signup', '/restaurant/login']

function SessionGuard() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !PUBLIC_PATHS.includes(pathname)) {
        router.push('/login')
      }
    })

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      ;(window as unknown as { deferredInstallPrompt?: Event }).deferredInstallPrompt = e
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [router, pathname])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <SessionGuard />
      {children}
    </ThemeProvider>
  )
}
