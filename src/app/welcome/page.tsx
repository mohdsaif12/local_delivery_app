'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function WelcomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div
      className="min-h-[100dvh] phone-screen flex flex-col relative overflow-hidden"
      style={{
        background: 'linear-gradient(170deg, #ffffff 0%, #fff8f7 40%, #fff3f0 100%)',
      }}
    >
      {/* ── Ghost watermark icons ── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        {/* Top-left ghost */}
        <span className="absolute top-24 left-6 text-[80px] opacity-[0.04] rotate-[-15deg]">🍛</span>
        {/* Center ghost */}
        <span className="absolute top-40 left-1/2 -translate-x-1/2 text-[120px] opacity-[0.04]">🫕</span>
        {/* Right ghost */}
        <span className="absolute top-32 right-4 text-[60px] opacity-[0.04] rotate-[20deg]">🌾</span>
        {/* Bottom-left */}
        <span className="absolute bottom-44 left-4 text-[70px] opacity-[0.04] rotate-[10deg]">🫙</span>
        {/* Bottom-right */}
        <span className="absolute bottom-52 right-2 text-[50px] opacity-[0.04] rotate-[-10deg]">✨</span>
      </div>

      {/* ── Top label ── */}
      <div className="flex justify-center pt-14">
        <span className="text-[11px] font-bold tracking-[0.25em] text-gray-400 uppercase">Since 1999</span>
      </div>

      {/* ── Center content ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Transparent logo PNG (no white background box) */}
        <div className="mb-6 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Wali Baba Foods"
            className="w-40 h-40 object-contain drop-shadow-xl"
          />
        </div>

        {/* Brand name */}
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight text-center">
          Wali Baba Foods
        </h1>

        {/* Tagline */}
        <p className="mt-2 text-base text-[#c0392b] italic text-center font-bold tracking-wide">
          Taste of Kanpur
        </p>

        {/* Parent brand attribution */}
        <p
          className="mt-5 text-[11px] font-semibold text-gray-400 tracking-wide text-center"
          style={{
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.7s ease 0.3s',
          }}
        >
          A product of Baba Biryani
        </p>
      </div>

      {/* ── Bottom section ── */}
      <div className="px-6 pb-12 flex flex-col items-center gap-6">
        {/* CTA Button */}
        <Link
          href="/login"
          className="w-full h-14 bg-[#c0392b] hover:bg-[#a93226] text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-[#c0392b]/30"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.7s ease 0.2s, transform 0.7s ease 0.2s',
          }}
        >
          Get Started
          <ArrowRight className="size-5" />
        </Link>

        {/* Decorative food icon row */}
        <div
          className="flex items-center gap-5"
          style={{
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.8s ease 0.4s',
          }}
        >
          <span className="text-lg opacity-20">🍗</span>
          <span className="text-lg opacity-20">🍛</span>
          <span className="text-lg opacity-20">🫕</span>
        </div>
      </div>
    </div>
  )
}
