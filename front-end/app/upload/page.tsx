"use client"
import React, { useMemo, useState } from 'react'
import Header from '@/components/Header'
import { useTranslation } from 'react-i18next'

function downloadTemplate() {
  const header = ['name,email,cpf,phone,contract_number,installment_number,due_date,amount,status,paid_at,paid_amount']
  const sample = ['Maria,maria@cliente.com,12345678901,(11)90000-0000,CNS-123,1,2026-06-10,850.00,pending,,']
  const blob = new Blob([header.concat(sample).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'creditguard_template.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function UploadPage() {
  const { t } = useTranslation()
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const linesCount = useMemo(() => {
    const trimmed = csvText.trim()
    if (!trimmed) return 0
    return trimmed.split(/\r?\n/).filter(Boolean).length
  }, [csvText])

  async function handleImport() {
    const trimmed = csvText.trim()
    if (!trimmed) {
      setMessage(t('upload.errorEmptyText'))
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      // Upload into staging table #1 by default.
      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: trimmed, stagingTable: 'staging_csv1' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || data?.error || 'Falha ao importar')
      setMessage(t('upload.successImport', { count: data?.inserted || 0 }))
    } catch (e: any) {
      setMessage((t('upload.errorImport') || 'Erro: ') + (e?.message || String(e)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="mx-auto w-full max-w-5xl px-6 py-10 flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{t('upload.title')}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">{t('upload.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{t('upload.instructionsTitle')}</h2>
            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
              <li>{t('upload.instruction1')}</li>
              <li>{t('upload.instruction2')}</li>
              <li>{t('upload.instruction3')}</li>
              <li>{t('upload.instruction4')}</li>
            </ul>
            <button
              onClick={downloadTemplate}
              className="w-full rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition"
            >
              {t('upload.downloadBtn')}
            </button>
          </div>

          <div className="lg:col-span-2 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('upload.previewTitle')}</h2>
              <div className="text-xs font-bold text-slate-400">
                {linesCount > 0 ? t('upload.linesDetected', { count: Math.max(0, linesCount - 1) }) : t('upload.emptyCSV')}
              </div>
            </div>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={t('upload.csvTextPlaceholder')}
              rows={14}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />

            <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <button
                onClick={() => { setCsvText(''); setMessage(null) }}
                className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t('upload.clearBtn')}
              </button>

              <button
                onClick={handleImport}
                disabled={loading}
                className="rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:opacity-60"
              >
                {loading ? t('upload.importBtnLoading') : t('upload.importBtn')}
              </button>
            </div>

            {message && (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {message}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
