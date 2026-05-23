"use client"
import React, { useState } from 'react'
import Header from '@/components/Header'
import { useTranslation } from 'react-i18next'

export default function UploadPage() {
  const { t } = useTranslation()
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | ''; message: string }>({
    type: '',
    message: ''
  })
  const [dragOver, setDragOver] = useState(false)

  // Example CSV templates
  const exampleCSV = `name,cpf,email,phone,contract_number,total_value,start_date,end_date,installment_number,due_date,amount,status,paid_at,paid_amount,method
Guilherme Alencar,11223344556,guilherme.alencar@email.com,(11) 98888-1111,CNS-555666,50000,2026-01-01,2027-12-01,1,2026-02-10,2083,paid,2026-02-09,2083,Pix
Guilherme Alencar,11223344556,guilherme.alencar@email.com,(11) 98888-1111,CNS-555666,50000,2026-01-01,2027-12-01,2,2026-03-10,2083,overdue,,,
Guilherme Alencar,11223344556,guilherme.alencar@email.com,(11) 98888-1111,CNS-555666,50000,2026-01-01,2027-12-01,3,2026-04-10,2083,overdue,,,
Beatriz Nogueira,99887766554,beatriz.nogueira@email.com,(21) 97777-2222,CNS-777888,120000,2026-01-01,2027-12-01,1,2026-02-10,5000,paid,2026-02-09,5000,Boleto
Beatriz Nogueira,99887766554,beatriz.nogueira@email.com,(21) 97777-2222,CNS-777888,120000,2026-01-01,2027-12-01,2,2026-03-10,5000,paid,2026-03-08,5000,Boleto`

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setCsvText(event.target?.result as string || '')
      }
      reader.readAsText(file)
    } else {
      setStatusMsg({
        type: 'error',
        message: t('upload.invalidExtension')
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setCsvText(event.target?.result as string || '')
      }
      reader.readAsText(file)
    }
  }

  const handleImport = async () => {
    if (!csvText.trim()) {
      setStatusMsg({
        type: 'error',
        message: t('upload.errorEmptyText')
      })
      return
    }

    setLoading(true)
    setStatusMsg({ type: '', message: '' })

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, targetTable: 'staging_csv1' })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.message || data.error || 'Erro na importação')

      setStatusMsg({
        type: 'success',
        message: t('upload.successImport', { count: data.importedRows })
      })
      setCsvText('') // Clear on success
    } catch (e) {
      setStatusMsg({
        type: 'error',
        message: (e as Error).message || t('upload.errorImport')
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadTemplate = () => {
    const blob = new Blob([exampleCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'modelo_importacao_creditguard.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('upload.title')}
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t('upload.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Instructions and Download Template */}
          <div className="md:col-span-1 space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3">{t('upload.instructionsTitle')}</h3>
              <ul className="space-y-3.5 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold">1.</span>
                  {t('upload.instruction1')}
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold">2.</span>
                  {t('upload.instruction2')}
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold">3.</span>
                  {t('upload.instruction3')}
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold">4.</span>
                  {t('upload.instruction4')}
                </li>
              </ul>

              <button
                onClick={handleDownloadTemplate}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 shadow-md shadow-indigo-600/10"
              >
                {t('upload.downloadBtn')}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-2">{t('upload.acceptedFields')}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {t('upload.acceptedFieldsDesc')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['name', 'cpf', 'email', 'phone', 'contrato', 'total_value', 'due_date', 'amount', 'status', 'paid_at'].map(field => (
                  <span key={field} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Drag & Drop File Upload Panel */}
          <div className="md:col-span-2 space-y-6">
            {/* Status Notifications */}
            {statusMsg.type && (
              <div
                className={`rounded-2xl border p-4 text-sm font-medium ${
                  statusMsg.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400'
                    : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400'
                }`}
              >
                <div className="flex gap-2">
                  <span className="text-base">{statusMsg.type === 'success' ? '✅' : '⚠️'}</span>
                  <span>{statusMsg.message}</span>
                </div>
              </div>
            )}

            {/* Drag Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
                dragOver
                  ? 'border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-2xl shadow-inner mb-4">
                📂
              </div>

              <h3 className="font-bold text-slate-900 dark:text-white">{t('upload.dragTitle')}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('upload.dragSubtitle')}
              </p>

              <label className="mt-5 cursor-pointer rounded-xl bg-slate-100 dark:bg-slate-800 px-5 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                {t('upload.selectFileBtn')}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Textarea or Direct Preview */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t('upload.previewTitle')}</h4>
                {csvText && (
                  <button
                    onClick={() => setCsvText('')}
                    className="text-xs text-slate-500 hover:text-indigo-600 transition"
                  >
                    {t('upload.clearBtn')}
                  </button>
                )}
              </div>
              
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={t('upload.csvTextPlaceholder')}
                rows={8}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 p-4 font-mono text-xs focus:border-indigo-600 focus:outline-none dark:text-slate-300 focus:ring-1 focus:ring-indigo-600 transition-all duration-200"
              />

              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {csvText ? t('upload.linesDetected', { count: csvText.split('\n').filter(Boolean).length }) : t('upload.emptyCSV')}
                </span>

                <button
                  onClick={handleImport}
                  disabled={loading}
                  className={`rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/10 transition ${
                    loading 
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {loading ? t('upload.importBtnLoading') : t('upload.importBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
