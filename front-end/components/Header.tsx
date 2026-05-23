"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'

export default function Header() {
  const pathname = usePathname()
  const [isMock, setIsMock] = useState(true)
  const { t, i18n } = useTranslation()

  useEffect(() => {
    // Quick fetch to check if using local mock database
    fetch('/api/clients?id=test-conn-probe')
      .then(() => {
        // Just probing, it's fine if it returns 404 or empty
        setIsMock(false)
      })
      .catch(() => {
        setIsMock(true)
      })
  }, [])

  const navLinks = [
    { href: '/', label: t('header.dashboard') },
    { href: '/collections', label: t('header.collections') },
    { href: '/clients', label: t('header.clients') },
    { href: '/upload', label: t('header.upload') },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg shadow-lg shadow-indigo-600/30">
            {t('header.logoInitials')}
          </div>
          <div>
            <span className="font-extrabold text-slate-800 dark:text-white text-lg tracking-tight">{t('header.brand')}</span>
            <span className="ml-1 text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">AI</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${
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

        {/* Database Connection Badge & Language Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t('header.online')}
          </div>

          <div className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
            isMock 
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30'
              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30'
          }`}>
            {isMock ? t('header.simulated') : t('header.supabase')}
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('header.language')}:</span>
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer text-slate-700 dark:text-slate-200 border-none p-0 outline-none"
            >
              <option value="pt" className="bg-white dark:bg-slate-900">PT</option>
              <option value="en" className="bg-white dark:bg-slate-900">EN</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  )
}
