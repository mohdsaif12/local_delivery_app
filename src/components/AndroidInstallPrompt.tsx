'use client'

import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'

// The event Chrome fires when the PWA is installable.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isInstalled() {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(display-mode: standalone)').matches
}

const STORAGE_KEY = 'android-install-dismissed'

interface Props {
  /** ms to wait after the event before showing, so it doesn't interrupt load */
  delay?: number
}

export default function AndroidInstallPrompt({ delay = 3000 }: Props) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isInstalled()) return
    try { if (localStorage.getItem(STORAGE_KEY) === '1') return } catch {}

    let timer: ReturnType<typeof setTimeout>

    function onBeforeInstall(e: Event) {
      // Stop Chrome's own mini-infobar; we show our themed prompt instead.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      timer = setTimeout(() => setShow(true), delay)
    }

    function onInstalled() {
      setShow(false)
      try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      clearTimeout(timer)
    }
  }, [delay])

  async function handleInstall() {
    if (!deferred) return
    setInstalling(true)
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setInstalling(false)
    setShow(false)
    setDeferred(null)
    if (outcome === 'dismissed') {
      try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    }
  }

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }

  if (!show || !deferred) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-[#1B4332] px-5 pt-5 pb-4 relative">
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"
          >
            <X className="size-4 text-white" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Wali Baba Foods" className="w-14 h-14 object-contain mb-3" />
          <h2 className="text-white font-extrabold text-base leading-tight">Install Wali Baba Foods</h2>
          <p className="text-white/70 text-xs mt-1">
            Add the app to your home screen — faster, full screen, and ready to notify you when your order is on its way.
          </p>
        </div>

        <div className="px-5 py-5 flex flex-col gap-2">
          <button
            onClick={handleInstall}
            disabled={installing}
            className="w-full h-12 bg-[#1B4332] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Download className="size-4" />
            {installing ? 'Installing…' : 'Install App'}
          </button>
          <button onClick={dismiss} className="w-full h-9 text-gray-400 font-medium text-xs">
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
