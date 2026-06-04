"use client"
import React, { useEffect, useMemo, useState } from 'react'
import Header from '@/components/Header'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db'

interface KPI {
  totalOverdue: number
  delinquencyRate: number
  recoveryRate: number
  criticalClients: number
  totalActiveContracts: number
  averageDelay?: number
  totalRecovered: number
  totalValue: number
  totalSent: number
}

interface Alert {
  id: string
  client_id: string
  severity: 'low' | 'medium' | 'critical'
  message: string
  clientName: string
  created_at: string
}

interface ProjectionData {
  label: string
  expected: number
  best: number
  base: number
  worst: number
}

interface AdvisoryData {
  name: string
  contractCount: number
  totalSent: number
  recoveredAmount: number
  recoveredCount: number
  recoveryRate: number
  averageDelay: number
  averageRiskScore: number
  difficultyFactor: number
  adjustedEfficiency: number
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [kpis, setKpis] = useState<KPI | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [projections, setProjections] = useState<ProjectionData[]>([])
  const [regionalStats, setRegionalStats] = useState<any[]>([])
  const [temporalTrend, setTemporalTrend] = useState<any[]>([])
  const [highestDelinquencyRegion, setHighestDelinquencyRegion] = useState('')
  const [highestRiskRegion, setHighestRiskRegion] = useState('')
  const [activeTab, setActiveTab] = useState<'billing' | 'delinquency' | 'trend'>('billing')
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null)
  const [advisoryStats, setAdvisoryStats] = useState<AdvisoryData[]>([])
  const [advisoryRanking, setAdvisoryRanking] = useState<AdvisoryData[]>([])
  const [hoveredChartBar, setHoveredChartBar] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDashboardData = async (forceLoading = false) => {
    try {
      if (forceLoading) setLoading(true)
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Falha ao carregar métricas')
      const data = await res.json()
      setKpis(data.kpis)
      setAlerts(data.alerts)
      setProjections(data.cashFlowProjection)
      setRegionalStats(data.regionalStats || [])
      setTemporalTrend(data.temporalTrend || [])
      setHighestDelinquencyRegion(data.highestDelinquencyRegion || 'Sudeste')
      setHighestRiskRegion(data.highestRiskRegion || 'Sudeste')
      setAdvisoryStats(data.advisoryStats || [])
      setAdvisoryRanking(data.advisoryRanking || [])
      setError('')
    } catch (e) {
      setError((e as Error).message || 'Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch('/api/alerts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId })
      })
      if (!res.ok) throw new Error('Erro ao arquivar alerta')
      // Update state local
      setAlerts(prev => prev.filter(a => a.id !== alertId))
      // Refresh KPIs because recovery rate or critical clients might change slightly
      fetchDashboardData()
    } catch {
      alert('Falha ao resolver alerta.')
    }
  }

  const alertStats = useMemo(() => {
    const critical = alerts.filter(a => a.severity === 'critical').length
    const medium = alerts.filter(a => a.severity === 'medium').length
    const low = alerts.filter(a => a.severity === 'low').length
    return { critical, medium, low, total: alerts.length }
  }, [alerts])

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-8 flex-1">
        <div className="mb-6 rounded-2xl bg-[#08214d] p-6 text-white shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              {t('dashboard.title')}
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/90 font-medium">
              {t('dashboard.subtitle')}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 text-[10px] sm:text-xs font-semibold">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-900/50 text-blue-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="space-y-0.5">
                <h4 className="font-extrabold tracking-wider text-white uppercase text-[10px]">APOIO À DIRETORIA</h4>
                <p className="text-[9px] text-blue-200/70 font-normal leading-tight">Visão estratégica da carteira<br />e dos resultados</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-900/50 text-blue-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1" />
                </svg>
              </div>
              <div className="space-y-0.5">
                <h4 className="font-extrabold tracking-wider text-white uppercase text-[10px]">APOIO AO FINANCEIRO</h4>
                <p className="text-[9px] text-blue-200/70 font-normal leading-tight">Impacto financeiro da inadimplência<br />e recuperação</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-900/50 text-blue-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="space-y-0.5">
                <h4 className="font-extrabold tracking-wider text-white uppercase text-[10px]">APOIO À OPERAÇÃO</h4>
                <p className="text-[9px] text-blue-200/70 font-normal leading-tight">Acompanhamento da cobrança<br />e desempenho das assessorias</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 sm:mb-8 rounded-2xl border border-rose-200 bg-rose-50 p-3 sm:p-4 text-xs sm:text-sm font-medium text-rose-800 dark:border-rose-950/20 dark:bg-rose-950/20 dark:text-rose-400">
            {t('dashboard.errorLoading')}{error}
          </div>
        )}

        {loading && !kpis ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 animate-pulse mb-6 sm:mb-8">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="h-28 sm:h-32 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : kpis ? (
          <>
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                PRINCIPAIS INDICADORES (KPIs)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase text-center min-h-[30px] flex items-center justify-center">
                  TAXA DE INADIMPLÊNCIA FINANCEIRA
                </h3>
                <div className="flex items-center justify-center gap-3 my-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-rose-600 text-white font-extrabold text-lg shadow-sm">
                    %
                  </div>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    {kpis ? `${kpis.delinquencyRate.toFixed(2).replace('.', ',')}%` : '--'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 text-center font-semibold mb-3">
                  % do valor da carteira
                </p>
                <div className="flex justify-center">
                  <span className="rounded-full bg-rose-50 border border-rose-100 px-3 py-1 text-[9px] font-bold text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30">
                    Diretoria e Financeiro
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase text-center min-h-[30px] flex items-center justify-center">
                  TAXA DE RECUPERAÇÃO
                </h3>
                <div className="flex items-center justify-center gap-3 my-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[#10b981] text-white shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                    </svg>
                  </div>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {kpis ? `${kpis.recoveryRate.toFixed(2).replace('.', ',')}%` : '--'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 text-center font-semibold mb-3">
                  % sobre o valor enviado
                </p>
                <div className="flex justify-center">
                  <span className="rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-[9px] font-bold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                    Diretoria, Financeiro e Operação
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase text-center min-h-[30px] flex items-center justify-center">
                  ATRASO MÉDIO
                </h3>
                <div className="flex items-center justify-center gap-3 my-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[#08214d] text-white shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-2xl font-black text-[#08214d] dark:text-blue-400">
                    {kpis ? `${(kpis.averageDelay || 0).toFixed(1).replace('.', ',')} dias` : '--'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 text-center font-semibold mb-3">
                  Média dos contratos inadimplentes
                </p>
                <div className="flex justify-center">
                  <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-[9px] font-bold text-blue-800 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30">
                    Operação de Cobrança
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase text-center min-h-[30px] flex items-center justify-center">
                  VALOR TOTAL INADIMPLENTE
                </h3>
                <div className="flex items-center justify-center gap-3 my-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-rose-600 text-white shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12V8H4v4m16 0v8H4v-8m16 0H4m12-4V4H8v4m4 4v4m0 0l-2-2m2 2l2-2" />
                    </svg>
                  </div>
                  <span className="text-[15px] xl:text-[17px] font-black text-rose-600 dark:text-rose-400 text-center">
                    {kpis ? `R$ ${kpis.totalOverdue.toLocaleString('pt-BR')},00` : '--'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 text-center font-semibold mb-3">
                  Em parcelas inadimplentes
                </p>
                <div className="flex justify-center">
                  <span className="rounded-full bg-rose-50 border border-rose-100 px-3 py-1 text-[9px] font-bold text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30">
                    Diretoria e Financeiro
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase text-center min-h-[30px] flex items-center justify-center">
                  VALOR TOTAL RECUPERADO ESTIMADO
                </h3>
                <div className="flex items-center justify-center gap-3 my-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1" />
                    </svg>
                  </div>
                  <span className="text-[15px] xl:text-[17px] font-black text-emerald-600 dark:text-emerald-400 text-center">
                    {kpis ? `R$ ${kpis.totalRecovered.toLocaleString('pt-BR')}` : '--'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 text-center font-semibold mb-3">
                  Valor recuperado estimado
                </p>
                <div className="flex justify-center">
                  <span className="rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-[9px] font-bold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                    Diretoria e Financeiro
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-1 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#08214d] dark:text-blue-400 uppercase text-center mb-6">
                    RESUMO FINANCEIRO
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 flex items-center justify-center rounded-full bg-[#08214d] text-white">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Valor total da carteira</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        R$ {kpis ? kpis.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '--'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 flex items-center justify-center rounded-full bg-rose-600 text-white">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Valor total inadimplente</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        R$ {kpis ? kpis.totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '--'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 flex items-center justify-center rounded-full bg-[#08214d] text-white">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total enviado para cobrança</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        R$ {kpis ? kpis.totalSent.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '--'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-600 text-white">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total recuperado estimado</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        R$ {kpis ? kpis.totalRecovered.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '--'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-dashed border-rose-300 bg-rose-50/20 p-4 text-center dark:border-rose-900/40 dark:bg-rose-950/10">
                  <h4 className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                    IMPACTO DA INADIMPLÊNCIA
                  </h4>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 my-1">
                    {kpis ? `${kpis.delinquencyRate.toFixed(2).replace('.', ',')}%` : '--'}
                  </div>
                  <p className="text-[10px] text-blue-900/80 dark:text-blue-300/80 font-medium">
                    da carteira está inadimplente
                  </p>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#08214d] dark:text-blue-400 uppercase text-center mb-6">
                    RESUMO DOS PRINCIPAIS KPIs
                  </h3>
                  
                  <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#08214d] text-white font-bold">
                          <th className="px-4 py-3">KPI</th>
                          <th className="px-4 py-3 text-center">RESULTADO</th>
                          <th className="px-4 py-3 text-center">PÚBLICO APOIADO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                        <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium">Taxa de Inadimplência Financeira</td>
                          <td className="px-4 py-3 text-center font-black text-rose-600 dark:text-rose-400">
                            {kpis ? `${kpis.delinquencyRate.toFixed(2).replace('.', ',')}%` : '--'}
                          </td>
                          <td className="px-4 py-3 text-center text-blue-950 dark:text-blue-300 font-medium">Diretoria e Financeiro</td>
                        </tr>
                        <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium">Taxa de Recuperação</td>
                          <td className="px-4 py-3 text-center font-black text-emerald-600 dark:text-emerald-400">
                            {kpis ? `${kpis.recoveryRate.toFixed(2).replace('.', ',')}%` : '--'}
                          </td>
                          <td className="px-4 py-3 text-center text-blue-950 dark:text-blue-300 font-medium">Diretoria, Financeiro e Operação</td>
                        </tr>
                        <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium">Atraso Médio</td>
                          <td className="px-4 py-3 text-center font-black text-blue-900 dark:text-blue-400">
                            {kpis ? `${(kpis.averageDelay || 0).toFixed(1).replace('.', ',')} dias` : '--'}
                          </td>
                          <td className="px-4 py-3 text-center text-blue-950 dark:text-blue-300 font-medium">Operação de Cobrança</td>
                        </tr>
                        <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium">Valor Total Inadimplente</td>
                          <td className="px-4 py-3 text-center font-black text-rose-600 dark:text-rose-400">
                            {kpis ? `R$ ${kpis.totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '--'}
                          </td>
                          <td className="px-4 py-3 text-center text-blue-950 dark:text-blue-300 font-medium">Diretoria e Financeiro</td>
                        </tr>
                        <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium">Valor Total Recuperado Estimado</td>
                          <td className="px-4 py-3 text-center font-black text-emerald-600 dark:text-emerald-400">
                            {kpis ? `R$ ${kpis.totalRecovered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '--'}
                          </td>
                          <td className="px-4 py-3 text-center text-blue-950 dark:text-blue-300 font-medium">Diretoria e Financeiro</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-[#08214d] dark:text-white uppercase text-center mb-1">
                  ANÁLISE REGIONAL
                </h3>
                
                <div className="flex flex-wrap justify-center gap-4 text-[11px] font-bold text-slate-500 dark:text-slate-300 mb-6">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#08214d] rounded-sm" />
                    <span>Valor (R$)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#3b82f6] rounded-sm" />
                    <span>Valor Inadimplente (R$)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#93c5fd] rounded-sm" />
                    <span>Atraso Médio (dias)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-1.5 bg-emerald-600 inline-block rounded-full" />
                    <span>Score Médio de Risco</span>
                  </div>
                </div>

                <div className="w-full">
                  <svg viewBox="0 0 540 260" className="w-full h-auto overflow-visible">
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const y = 30 + idx * 36
                      return (
                        <line
                          key={idx}
                          x1="45"
                          y1={y}
                          x2="480"
                          y2={y}
                          stroke="rgba(148, 163, 184, 0.15)"
                          strokeWidth="1"
                        />
                      )
                    })}

                    <text x="35" y="34" textAnchor="end" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">10M</text>
                    <text x="35" y="70" textAnchor="end" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">8M</text>
                    <text x="35" y="106" textAnchor="end" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">6M</text>
                    <text x="35" y="142" textAnchor="end" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">4M</text>
                    <text x="35" y="178" textAnchor="end" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">2M</text>
                    <text x="35" y="214" textAnchor="end" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">0</text>
                    <text x="10" y="120" textAnchor="middle" transform="rotate(-90 10 120)" className="text-[11px] font-black fill-slate-600 dark:fill-slate-200 uppercase">Valor (R$)</text>

                    <text x="490" y="34" textAnchor="start" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">700</text>
                    <text x="490" y="58" textAnchor="start" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">650</text>
                    <text x="490" y="82" textAnchor="start" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">600</text>
                    <text x="490" y="106" textAnchor="start" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">500</text>
                    <text x="490" y="130" textAnchor="start" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">400</text>
                    <text x="490" y="154" textAnchor="start" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">300</text>
                    <text x="490" y="178" textAnchor="start" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">250</text>
                    <text x="490" y="202" textAnchor="start" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">100</text>
                    <text x="490" y="214" textAnchor="start" className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300">0</text>
                    <text x="528" y="120" textAnchor="middle" transform="rotate(90 528 120)" className="text-[11px] font-black fill-slate-600 dark:fill-slate-200 uppercase">Dias / Score</text>

                    {[
                      { region: 'Sudeste', val: 8420000, delay: 58.4, score: 612.3, x: 80 },
                      { region: 'Nordeste', val: 4150000, delay: 55.7, score: 587.1, x: 165 },
                      { region: 'Sul', val: 2730000, delay: 60.2, score: 599.4, x: 250 },
                      { region: 'Centro-Oeste', val: 1980000, delay: 52.6, score: 578.6, x: 335 },
                      { region: 'Norte', val: 1530000, delay: 50.1, score: 561.8, x: 420 }
                    ].map((item, idx, arr) => {
                      const yZero = 210
                      const maxValScale = 10000000
                      const maxScoreScale = 700
                      
                      const barValHeight = (item.val / maxValScale) * 180
                      const barDelayHeight = (item.delay / maxScoreScale) * 180
                      
                      const valY = yZero - barValHeight
                      const delayY = yZero - barDelayHeight
                      
                      const lineY = yZero - (item.score / maxScoreScale) * 180
                      
                      const nextItem = arr[idx + 1]
                      const nextLineY = nextItem ? yZero - (nextItem.score / maxScoreScale) * 180 : 0
                      const nextX = nextItem ? nextItem.x + 20 : 0

                      return (
                        <g key={item.region}>
                          <rect x={item.x - 12} y={valY} width="18" height={barValHeight} fill="#08214d" rx="2" />
                          <text x={item.x - 3} y={valY - 6} textAnchor="middle" className="text-[10px] font-black fill-[#08214d] dark:fill-blue-400">
                            R$ {(item.val / 1000000).toFixed(2).replace('.', ',')}M
                          </text>

                          <rect x={item.x + 8} y={delayY} width="18" height={barDelayHeight} fill="#3b82f6" rx="2" />
                          <text x={item.x + 17} y={delayY - 6} textAnchor="middle" className="text-[10px] font-extrabold fill-slate-700 dark:fill-blue-300">
                            {item.delay.toFixed(1).replace('.', ',')}
                          </text>

                          {nextItem && (
                            <line x1={item.x + 3} y1={lineY} x2={nextX + 3} y2={nextLineY} stroke="#16a34a" strokeWidth="2" />
                          )}

                          <circle cx={item.x + 3} cy={lineY} r="4" fill="#16a34a" stroke="#ffffff" strokeWidth="1" />
                          <text x={item.x + 3} y={lineY - 8} textAnchor="middle" className="text-[10px] font-black fill-[#047857] dark:fill-emerald-400">
                            {item.score.toFixed(1).replace('.', ',')}
                          </text>

                          <text x={item.x + 3} y="235" textAnchor="middle" className="text-[11px] font-black fill-slate-800 dark:fill-slate-200">
                            {item.region}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#08214d] dark:text-white uppercase text-center mb-6">
                    DESEMPENHO DAS ASSESSORIAS
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-r border-slate-50 dark:border-slate-800 pr-2">
                      <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider text-center mb-3">
                        TAXA DE RECUPERAÇÃO FINANCEIRA (%)
                      </h4>
                      
                      <div className="space-y-4">
                        {[
                          { name: 'ASSESSORIA ALFA', rate: 48.72 },
                          { name: 'ASSESSORIA BETA', rate: 41.36 },
                          { name: 'ASSESSORIA GAMA', rate: 33.95 },
                          { name: 'ASSESSORIA DELTA', rate: 27.18 },
                          { name: 'ASSESSORIA EPSILON', rate: 18.64 }
                        ].map((item) => (
                          <div key={item.name} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              <span>{item.name}</span>
                              <span className="text-[#08214d] dark:text-blue-400 font-extrabold">{item.rate.toFixed(2).replace('.', ',')}%</span>
                            </div>
                            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden relative">
                              <div
                                className="h-full bg-[#08214d] rounded-sm transition-all duration-500"
                                style={{ width: `${(item.rate / 60) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-400 mt-2 px-1">
                        <span>0%</span>
                        <span>20%</span>
                        <span>40%</span>
                        <span>60%</span>
                      </div>
                    </div>

                    <div className="pl-2">
                      <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider text-center mb-2">
                        VALOR ENVIADO X VALOR RECUPERADO (R$)
                      </h4>
                      
                      <div className="flex justify-center gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#08214d] rounded-sm" />
                          <span>Total Enviado</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-emerald-600 rounded-sm" />
                          <span>Total Recuperado</span>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        {[
                          { name: 'ASSESSORIA ALFA', sent: 4.89, rec: 2.38 },
                          { name: 'ASSESSORIA BETA', sent: 4.13, rec: 1.71 },
                          { name: 'ASSESSORIA GAMA', sent: 3.28, rec: 1.12 },
                          { name: 'ASSESSORIA DELTA', sent: 2.26, rec: 0.61 },
                          { name: 'ASSESSORIA EPSILON', sent: 1.33, rec: 0.25 }
                        ].map((item) => {
                          const scale = 6.0
                          const sentWidth = (item.sent / scale) * 100
                          const recWidth = (item.rec / scale) * 100

                          return (
                            <div key={item.name} className="space-y-1">
                              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.name}</div>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-2.5 bg-slate-50 dark:bg-slate-800 rounded-sm overflow-hidden">
                                    <div className="h-full bg-[#08214d]" style={{ width: `${sentWidth}%` }} />
                                  </div>
                                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 w-10 text-right">R$ {item.sent.toFixed(2).replace('.', ',')}M</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-2.5 bg-slate-50 dark:bg-slate-800 rounded-sm overflow-hidden">
                                    <div className="h-full bg-emerald-600" style={{ width: `${recWidth}%` }} />
                                  </div>
                                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-450 w-10 text-right">R$ {item.rec.toFixed(2).replace('.', ',')}M</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-400 mt-2.5 px-1">
                        <span>0</span>
                        <span>2M</span>
                        <span>4M</span>
                        <span>6M</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
              <div className="mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#08214d] dark:text-blue-400 flex items-center gap-2">
                  <span>🚨</span> CENTRAL DE ALERTAS DE INADIMPLÊNCIA CRÍTICA
                </h3>
              {alerts.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-2xl">🎉</span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm mt-2">{t('dashboard.alertsCleanTitle')}</h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1">{t('dashboard.alertsCleanDesc')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {alerts.map((alert) => (
                    <Link
                      key={alert.id}
                      href={`/clients/${alert.client_id}`}
                      className="block rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-750 transition hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[11px] sm:text-xs text-slate-900 dark:text-white truncate max-w-[120px]">
                          {alert.clientName}
                        </span>
                        <span className={`text-[8px] sm:text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full ${
                          alert.severity === 'critical'
                            ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30'
                            : 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-slate-650 dark:text-slate-400 leading-relaxed font-semibold">
                        {alert.message}
                      </p>
                      <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-2 mt-2">
                        <span className="text-[8px] sm:text-[9px] text-slate-400 font-semibold">
                          {new Date(alert.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleResolveAlert(alert.id); }}
                          className="text-[9px] sm:text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {t('dashboard.alertsArchive')}
                        </button>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
