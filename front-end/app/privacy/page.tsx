"use client"
import Link from 'next/link'
import Header from '@/components/Header'
import { useTranslation } from 'react-i18next'

export default function PrivacyPage() {
  const { t } = useTranslation()
  const updatedAt = new Date('2026-05-27').toLocaleDateString('pt-BR')
  const contactEmail = 'privacidade@creditguard.local'

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-6 py-10 flex-1">
        <div className="mb-6">
          <Link href="/register" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            {t('privacy.back')}
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t('privacy.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t('privacy.updatedAt', { date: updatedAt })}
        </p>

        <div className="mt-8 space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('privacy.intro')}
          </p>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">{t('privacy.controllerTitle')}</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              {t('privacy.controllerBody', { email: contactEmail })}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">{t('privacy.dataTitle')}</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t('privacy.dataBody')}</p>
          </section>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">{t('privacy.legalTitle')}</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t('privacy.legalBody')}</p>
          </section>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">{t('privacy.rightsTitle')}</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t('privacy.rightsBody')}</p>
          </section>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">{t('privacy.retentionTitle')}</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t('privacy.retentionBody')}</p>
          </section>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">{t('privacy.securityTitle')}</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t('privacy.securityBody')}</p>
          </section>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">{t('privacy.sharingTitle')}</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t('privacy.sharingBody')}</p>
          </section>

          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">{t('privacy.cookiesTitle')}</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t('privacy.cookiesBody')}</p>
          </section>
        </div>
      </main>
    </div>
  )
}
