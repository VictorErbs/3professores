"use client"
import React, { ReactNode } from 'react'
import '@/lib/i18n' // import i18n configuration to initialize it

export default function I18nProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
