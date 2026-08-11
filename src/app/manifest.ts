import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wali Baba Foods',
    short_name: 'Wali Baba',
    description: 'Order food directly from Wali Baba Foods',
    start_url: '/menu',
    display: 'standalone',
    // Matches the welcome screen's gradient, so Android's own launch splash
    // (icon + name, drawn by the OS before our HTML runs) hands over to the
    // welcome screen without a visible colour jump.
    background_color: '#fff8f7',
    theme_color: '#b51c00',
    icons: [
      // Square 192 + 512 are required for Android/Chrome to offer install
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
