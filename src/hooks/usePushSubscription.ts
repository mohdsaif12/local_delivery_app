'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)
    ),
  ])
}

export async function subscribeAfterPermission(): Promise<string> {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported')
  if (!('PushManager' in window)) throw new Error('Push not supported')

  await withTimeout(navigator.serviceWorker.register('/sw.js'), 5000, 'SW register')
  const reg = await withTimeout(navigator.serviceWorker.ready, 8000, 'SW ready')

  let subscription = await reg.pushManager.getSubscription()
  if (!subscription) {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!key) throw new Error('VAPID key missing')
    subscription = await withTimeout(
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }),
      8000,
      'pushManager.subscribe'
    )
  }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DB save failed (${res.status}): ${body}`)
  }
  return 'ok'
}

export type PushState = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'in-app-browser' | 'insecure'

// Android in-app webviews (WhatsApp/Instagram/Facebook/etc.) can't do web push.
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp|Snapchat|; wv\)|GSA\//i.test(ua)
}

function computePushState(): PushState {
  // Push needs a secure context; the LAN dev URL over http is not one.
  if (!window.isSecureContext) return 'insecure'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // Distinguish "your browser can't" from "this in-app browser can't"
    return isInAppBrowser() ? 'in-app-browser' : 'unsupported'
  }
  // Notification.permission is the real signal, and it's synchronous —
  // no fragile serviceWorker.ready race that could hang on Android.
  const perm = Notification.permission
  return perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt'
}

export function usePushPermissionState(): PushState {
  // Start 'unsupported' so the server and first client render agree (this
  // component renders nothing then), and compute the real state after mount.
  const [state, setState] = useState<PushState>('unsupported')

  useEffect(() => {
    const next = computePushState()
    if (next !== 'insecure' && next !== 'unsupported' && next !== 'in-app-browser') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(next)
  }, [])

  return state
}

export async function requestPushPermission(): Promise<{ ok: boolean; error?: string }> {
  try {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return { ok: false, error: 'Permission denied' }
    }
    await subscribeAfterPermission()
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[Push] subscribe failed:', msg)
    return { ok: false, error: msg }
  }
}

export function usePushSubscription() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])
}
