"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'

export default function Header() {
  const pathname = usePathname()
  const [isMock, setIsMock] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const { t, i18n } = useTranslation()

  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setIsMock(data?.dbMode === 'mock')
      })
      .catch(() => setIsMock(true))
  }, [])

  const [role, setRole] = useState('gestao')
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRole(localStorage.getItem('creditguard_role') || 'gestao')
    }
  }, [])

  // Close menu on navigation
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const navLinks = [
    ...(role === 'gestao' ? [{ href: '/', label: t('header.dashboard') }] : []),
    { href: '/collections', label: t('header.collections') },
    { href: '/clients', label: t('header.clients') },
    ...(role === 'gestao' ? [{ href: '/upload', label: t('header.upload') }] : []),
    { href: '/privacy', label: t('header.privacy') },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-base sm:text-lg shadow-lg shadow-indigo-600/30">
            {t('header.logoInitials')}
          </div>
          <div>
            <span className="font-extrabold text-slate-800 dark:text-white text-base sm:text-lg tracking-tight">{t('header.brand')}</span>
            <span className="ml-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">AI</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 xl:px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side: badges + hamburger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Online Badge - hide text on small screens */}
          <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden sm:inline">{t('header.online')}</span>
          </div>

          {/* DB Badge - hide on very small screens */}
          <div className={`hidden sm:block text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-md font-semibold ${
            isMock 
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30'
              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30'
          }`}>
            {isMock ? t('header.simulated') : t('header.supabase')}
          </div>

          {/* Actor selector (RF 01) */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-1.5 sm:px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
            <span className="hidden sm:inline text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ator:</span>
            <select
              value={typeof window !== 'undefined' ? (localStorage.getItem('creditguard_role') || 'gestao') : 'gestao'}
              onChange={(e) => {
                localStorage.setItem('creditguard_role', e.target.value)
                window.location.reload()
              }}
              className="bg-transparent text-[11px] sm:text-xs font-bold focus:outline-none cursor-pointer text-slate-700 dark:text-slate-200 border-none p-0 outline-none"
            >
              <option value="gestao" className="bg-white dark:bg-slate-900">Gestão</option>
              <option value="operador" className="bg-white dark:bg-slate-900">Operador</option>
            </select>
          </div>

          {/* Language Selector - compact on mobile */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-1.5 sm:px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
            <span className="hidden sm:inline text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('header.language')}:</span>
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-transparent text-[11px] sm:text-xs font-bold focus:outline-none cursor-pointer text-slate-700 dark:text-slate-200 border-none p-0 outline-none"
            >
              <option value="pt" className="bg-white dark:bg-slate-900">PT</option>
              <option value="en" className="bg-white dark:bg-slate-900">EN</option>
            </select>
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <nav className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-3 text-sm font-semibold rounded-xl transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </header>
  )
}
