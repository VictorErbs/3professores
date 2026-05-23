"use client"
import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db'

interface ClientProfile {
  id: string
  name: string
  email: string
  cpf: string
  phone: string
  created_at: string
  contracts: Array<{
    id: string
    contract_number: string
    start_date: string
    end_date: string
    total_value: number
  }>
  installments: Array<{
    id: string
    contract_id: string
    installment_number: number
    due_date: string
    amount: number
    status: 'pending' | 'paid' | 'overdue'
  }>
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useTranslation()
  const router = useRouter()
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [predicting, setPredicting] = useState(false)
  const [predictMsg, setPredictMsg] = useState('')

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/clients?id=${id}`)
      if (!res.ok) throw new Error('Falha ao carregar perfil do cliente')
      const data = await res.json()
      setProfile(data)
      setError('')
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar dados do cliente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      if (!db.isMock()) {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }
      }
      fetchProfile()
    }
    checkAuth()
  }, [id])

  // Recalibrate score in real-time
  const handleRecalculateScore = async () => {
    if (!profile) return
    setPredicting(true)
    setPredictMsg('')
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: profile.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao recalcular')

      setPredictMsg(`Score atualizado para ${data.score}% (${data.severity})!`)
      // Refresh profile data
      fetchProfile()
    } catch (e: any) {
      setPredictMsg('Erro: ' + e.message)
    } finally {
      setPredicting(false)
    }
  }

  // Pay an installment directly
  const handlePayInstallment = async (installmentId: string) => {
    try {
      // Simulate settling the installment
      await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: `id,status\n${installmentId},paid`
        })
      })

      // Reload
      fetchProfile()
    } catch (e) {
      alert('Erro ao pagar parcela')
    }
  }

  if (loading && !profile) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-6 py-8 flex-1 animate-pulse">
          <div className="h-8 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-xl mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="md:col-span-2 h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
        </main>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <Header />
        <main className="mx-auto w-full max-w-xl px-6 py-16 text-center">
          <span className="text-4xl">⚠️</span>
          <h2 className="font-extrabold text-xl mt-4">{t('clientDetail.notFoundTitle')}</h2>
          <p className="text-slate-500 mt-2">{error || t('clientDetail.notFoundDesc')}</p>
          <Link href="/clients" className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white">
            {t('clientDetail.backToListBtn')}
          </Link>
        </main>
      </div>
    )
  }

  // Calculate score and overdue summaries for display
  const overdueInsts = profile.installments.filter(i => i.status === 'overdue')
  const overdueCount = overdueInsts.length
  const totalOverdue = overdueInsts.reduce((acc, i) => acc + i.amount, 0)
  
  // Find latest risk score
  const isCritical = overdueCount > 0
  const computedScore = isCritical ? Math.min(100, 30 + overdueCount * 20) : 15

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="mx-auto w-full max-w-7xl px-6 py-8 flex-1">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 text-xs font-semibold text-slate-400">
          <Link href="/clients" className="hover:text-indigo-600">👥 {t('clientDetail.backToListBtn')}</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-600 dark:text-slate-300">{profile.name}</span>
        </div>

        {/* Header Block */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {profile.name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {t('clientDetail.docLabel', { cpf: profile.cpf ? profile.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : t('clientDetail.noDoc') })}
            </p>
          </div>
          
          <button
            onClick={handleRecalculateScore}
            disabled={predicting}
            className="self-start sm:self-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-md shadow-indigo-600/10"
          >
            {predicting ? t('clientDetail.recalculatingBtn') : t('clientDetail.recalculateBtn')}
          </button>
        </div>

        {predictMsg && (
          <div className="mb-8 rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-xs font-bold text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/30">
            {predictMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Cadastral Info & Risk Analyzer Card */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Risk dial Card */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">{t('clientDetail.riskScoreTitle')}</span>
              
              {/* Dial Representation */}
              <div className="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-slate-100 dark:border-slate-800 mb-4">
                <div className={`absolute inset-1 rounded-full border-8 border-transparent ${
                  computedScore >= 70
                    ? 'border-t-rose-500 border-r-rose-500'
                    : computedScore >= 35
                    ? 'border-t-amber-500 border-r-amber-500'
                    : 'border-t-emerald-500'
                }`} />
                <span className="text-3xl font-black text-slate-950 dark:text-white">{computedScore}%</span>
              </div>

              <span className={`inline-block text-xs font-extrabold px-3 py-1 rounded-full uppercase ${
                computedScore >= 70
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                  : computedScore >= 35
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
              }`}>
                {computedScore >= 70 ? t('clientDetail.riskCritical') : computedScore >= 35 ? t('clientDetail.riskMedium') : t('clientDetail.riskLow')}
              </span>

              <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                {t('clientDetail.riskSummary', { count: overdueCount, contractsCount: profile.contracts.length })}
              </p>
            </div>

            {/* Cadastro Card */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-4">{t('clientDetail.detailsTitle')}</h3>
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">{t('clientDetail.emailLabel')}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{profile.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{t('clientDetail.phoneLabel')}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{profile.phone || t('clientDetail.noPhone')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{t('clientDetail.operationalId')}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">{profile.id}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Contracts & Installments Timeline */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Delinquency Warning Header */}
            {overdueCount > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/50 dark:bg-rose-950/20 flex gap-4 items-center">
                <span className="text-3xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-rose-800 dark:text-rose-400 text-sm">{t('clientDetail.warningTitle')}</h4>
                  <p className="text-xs text-rose-700 dark:text-rose-400/80 mt-0.5">
                    {t('clientDetail.warningDesc', { amount: totalOverdue.toLocaleString('pt-BR'), count: overdueCount })}
                  </p>
                </div>
              </div>
            )}

            {/* Active Contracts */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t('clientDetail.contractsTitle')}</h3>
              <div className="space-y-4">
                {profile.contracts.map((con) => (
                  <div key={con.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-slate-100 dark:border-slate-800 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 gap-3">
                    <div>
                      <div className="font-bold text-xs">{t('clientDetail.contractLabel', { num: con.contract_number })}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{t('clientDetail.contractPeriod', { start: new Date(con.start_date).toLocaleDateString('pt-BR'), end: new Date(con.end_date).toLocaleDateString('pt-BR') })}</div>
                    </div>
                    <div className="text-right sm:text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('clientDetail.contractValueLabel')}</span>
                      <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">R$ {con.total_value.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Installments Timeline */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t('clientDetail.installmentsTitle')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.installments.map((inst) => (
                  <div
                    key={inst.id}
                    className={`rounded-2xl border p-4 flex items-center justify-between transition hover:shadow-sm ${
                      inst.status === 'paid'
                        ? 'border-emerald-100 bg-emerald-50/10 dark:border-emerald-950/30'
                        : inst.status === 'overdue'
                        ? 'border-rose-100 bg-rose-50/10 dark:border-rose-950/30'
                        : 'border-slate-100 bg-white dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs">{t('clientDetail.installmentNum', { num: inst.installment_number })}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{t('clientDetail.dueDateLabel', { date: new Date(inst.due_date).toLocaleDateString('pt-BR') })}</div>
                      <div className="font-semibold text-xs text-slate-700 dark:text-slate-300 mt-1">R$ {inst.amount.toLocaleString('pt-BR')}</div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                        inst.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                          : inst.status === 'overdue'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {inst.status === 'paid' ? t('clientDetail.statusPaid') : inst.status === 'overdue' ? t('clientDetail.statusOverdue') : t('clientDetail.statusPending')}
                      </span>

                      {inst.status === 'overdue' && (
                        <button
                          onClick={() => handlePayInstallment(inst.id)}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black text-white px-2.5 py-1 transition"
                        >
                          {t('clientDetail.liquidateBtn')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
