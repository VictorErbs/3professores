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
      setError('')
    } catch (e) {
      setError((e as Error).message || 'Erro de conexão')
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
      fetchDashboardData()
    }
    checkAuth()
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
        {/* Welcome Area */}
        <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t('dashboard.title')}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('dashboard.subtitle')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 sm:mb-8 rounded-2xl border border-rose-200 bg-rose-50 p-3 sm:p-4 text-xs sm:text-sm font-medium text-rose-800 dark:border-rose-950/20 dark:bg-rose-950/20 dark:text-rose-400">
            {t('dashboard.errorLoading')}{error}
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !kpis ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 animate-pulse mb-6 sm:mb-8">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-28 sm:h-32 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : kpis ? (
          <>
            {/* KPI Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Volume em Risco */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.kpiVolumeAtRisk')}</span>
                  <span className="text-lg sm:text-xl">🚨</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                  R$ {kpis.totalOverdue.toLocaleString('pt-BR')}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 sm:mt-2">{t('dashboard.kpiVolumeAtRiskDesc')}</p>
              </div>

              {/* Taxa de Inadimplência */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.kpiDelinquency')}</span>
                  <span className="text-lg sm:text-xl">📈</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-500">
                  {kpis.delinquencyRate}%
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 sm:mt-2">{t('dashboard.kpiDelinquencyDesc')}</p>
              </div>

              {/* Taxa de Recuperação */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.kpiRecovery')}</span>
                  <span className="text-lg sm:text-xl">🛡️</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {kpis.recoveryRate}%
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 sm:mt-2">{t('dashboard.kpiRecoveryDesc')}</p>
              </div>

              {/* Clientes Críticos */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.kpiCritical')}</span>
                  <span className="text-lg sm:text-xl">⚠️</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {t('dashboard.clientsCount', { count: kpis.criticalClients })}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 sm:mt-2">{t('dashboard.kpiCriticalDesc')}</p>
              </div>

              {/* KPI: Atraso Médio */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.kpiAverageDelay')}</span>
                  <span className="text-lg sm:text-xl">⏱️</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-violet-600 dark:text-violet-400">
                  {kpis.averageDelay ?? 67} {t('dashboard.projectionTableMonth') === 'Mês' ? 'dias' : 'days'}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 sm:mt-2">{t('dashboard.kpiAverageDelayDesc')}</p>
              </div>
            </div>

            {/* Content Body Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              
              {/* Cash Flow Projection (Left & Middle Column) */}
              <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                 <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                   <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6">
                     <div>
                       <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">{t('dashboard.priorityTitle')}</h3>
                       <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">{t('dashboard.prioritySubtitle')}</p>
                     </div>
                   </div>

                   <div className="grid grid-cols-3 gap-2 sm:gap-3">
                     <div className="rounded-xl sm:rounded-2xl border border-rose-100 bg-rose-50/70 p-3 sm:p-4 dark:border-rose-900/30 dark:bg-rose-950/20">
                       <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-rose-400 font-bold">{t('dashboard.priorityCritical')}</p>
                       <p className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">{alertStats.critical}</p>
                     </div>
                     <div className="rounded-xl sm:rounded-2xl border border-amber-100 bg-amber-50/70 p-3 sm:p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                       <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-500 font-bold">{t('dashboard.priorityMedium')}</p>
                       <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">{alertStats.medium}</p>
                     </div>
                     <div className="rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-950/30">
                       <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold">{t('dashboard.priorityTotal')}</p>
                       <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{alertStats.total}</p>
                     </div>
                   </div>

                   <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                     <div className="rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4">
                       <h4 className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2 sm:mb-3">{t('dashboard.priorityIndicators')}</h4>
                       <div className="space-y-1.5 sm:space-y-2 text-[11px] sm:text-xs">
                         <div className="flex items-center justify-between">
                           <span className="text-slate-500">{t('dashboard.kpiVolumeAtRisk')}</span>
                           <span className="font-bold text-slate-900 dark:text-white">R$ {kpis ? kpis.totalOverdue.toLocaleString('pt-BR') : 0}</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-slate-500">{t('dashboard.kpiDelinquency')}</span>
                           <span className="font-bold text-slate-900 dark:text-white">{kpis ? kpis.delinquencyRate : 0}%</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-slate-500">{t('dashboard.kpiRecovery')}</span>
                           <span className="font-bold text-slate-900 dark:text-white">{kpis ? kpis.recoveryRate : 0}%</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-slate-500">{t('dashboard.kpiCritical')}</span>
                           <span className="font-bold text-slate-900 dark:text-white">{kpis ? kpis.criticalClients : 0}</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-slate-500">{t('dashboard.kpiAverageDelay')}</span>
                           <span className="font-bold text-slate-900 dark:text-white">{kpis && kpis.averageDelay ? kpis.averageDelay : 67} {t('dashboard.projectionTableMonth') === 'Mês' ? 'dias' : 'days'}</span>
                         </div>
                       </div>
                     </div>

                     <div className="rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4">
                       <h4 className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2 sm:mb-3">{t('dashboard.priorityRecent')}</h4>
                       {alerts.length === 0 ? (
                         <p className="text-[11px] sm:text-xs text-slate-500">{t('dashboard.priorityEmpty')}</p>
                       ) : (
                         <div className="space-y-1.5 sm:space-y-2">
                         {alerts.slice(0, 4).map((alert) => (
                               <Link key={alert.id} href={`/clients/${alert.client_id}`} className="flex items-center justify-between text-[11px] sm:text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 -mx-1.5 sm:-mx-2 transition">
                                 <span className="text-slate-600 dark:text-slate-300 truncate max-w-[140px] sm:max-w-[180px]">{alert.message}</span>
                                 <span className={`text-[9px] sm:text-[10px] uppercase font-bold ${
                                   alert.severity === 'critical'
                                     ? 'text-rose-600 dark:text-rose-400'
                                     : alert.severity === 'medium'
                                     ? 'text-amber-600 dark:text-amber-400'
                                     : 'text-emerald-600 dark:text-emerald-400'
                                 }`}>
                                   {alert.severity}
                                 </span>
                               </Link>
                             ))}
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
            {/* Regional Risk Analysis Section */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-6">
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🗺️</span> {t('dashboard.regionalRiskTitle')}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t('dashboard.regionalRiskSubtitle')}
                </p>
              </div>

              {/* Highlight Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Highest Delinquency Region */}
                <div className="rounded-xl sm:rounded-2xl border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-950/20 dark:bg-rose-950/10 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-bold text-rose-500 uppercase tracking-wider">{t('dashboard.highestDelinquencyRegionLabel')}</p>
                    <h4 className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400">
                      {highestDelinquencyRegion}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('dashboard.volumeAtRiskLabel')}: <span className="font-bold text-rose-600 dark:text-rose-400">
                        R$ {(regionalStats.find(r => r.region === highestDelinquencyRegion)?.volumeAtRisk || 145200).toLocaleString('pt-BR')}
                      </span>
                    </p>
                  </div>
                  <div className="text-3xl sm:text-4xl">👑</div>
                </div>

                {/* Highest Risk Region */}
                <div className="rounded-xl sm:rounded-2xl border border-amber-100 bg-amber-50/50 p-4 dark:border-amber-950/20 dark:bg-amber-950/10 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-bold text-amber-600 uppercase tracking-wider">{t('dashboard.highestRiskRegionLabel')}</p>
                    <h4 className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">
                      {highestRiskRegion}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('dashboard.delinquencyRateLabel')}: <span className="font-bold text-amber-600 dark:text-amber-400">
                        {regionalStats.find(r => r.region === highestRiskRegion)?.riskRate || 42}%
                      </span>
                    </p>
                  </div>
                  <div className="text-3xl sm:text-4xl">⚡</div>
                </div>
              </div>

              {/* Ranking and SVG Chart Container */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                {/* Visual Ranking List */}
                <div className="space-y-4">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                    📊 {t('dashboard.projectionTableScenario')} / Ranking
                  </h4>
                  <div className="space-y-3">
                    {regionalStats.map((item, idx) => (
                      <div
                        key={item.region}
                        className="flex flex-col space-y-1 rounded-xl p-2 hover:bg-slate-50 dark:hover:bg-slate-800/35 transition cursor-pointer"
                        onMouseEnter={() => setHoveredRegion(item.region)}
                        onMouseLeave={() => setHoveredRegion(null)}
                      >
                        <div className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {idx + 1}. {item.region}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {item.riskRate}% {t('dashboard.delinquencyRateLabel')}
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700`}
                            style={{
                              width: `${item.riskRate}%`,
                              background: idx % 2 === 0
                                ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                : 'linear-gradient(90deg, #6366f1, #a855f7)'
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{t('dashboard.averageRiskScoreLabel')}: {item.averageScore}</span>
                          <span>{t('dashboard.volumeAtRiskLabel')}: R$ {item.volumeAtRisk.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SVG Chart */}
                <div className="p-4 rounded-2xl border border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 flex flex-col justify-center items-center">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                    {t('dashboard.delinquencyRateLabel')} (PT-BR) / Regional Risk Rate (%)
                  </h4>
                  <div className="w-full max-w-[450px]">
                    <svg viewBox="0 0 500 220" className="w-full h-auto overflow-visible">
                      <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(148, 163, 184, 0.2)" strokeWidth="2" />
                      
                      {regionalStats.map((item, idx) => {
                        const y = 20 + idx * 36
                        const barWidth = (item.riskRate / 100) * 350
                        const isHovered = hoveredRegion === item.region
                        
                        return (
                          <g
                            key={item.region}
                            className="group cursor-pointer"
                            onMouseEnter={() => setHoveredRegion(item.region)}
                            onMouseLeave={() => setHoveredRegion(null)}
                          >
                            <text
                              x="90"
                              y={y + 14}
                              textAnchor="end"
                              className={`text-xs font-bold transition ${
                                isHovered ? 'fill-indigo-600 dark:fill-indigo-400 text-sm' : 'fill-slate-500 dark:fill-slate-400'
                              }`}
                            >
                              {item.region}
                            </text>
                            
                            <rect
                              x="100"
                              y={y}
                              width="350"
                              height="20"
                              rx="6"
                              className="fill-slate-100 dark:fill-slate-800/40"
                            />
                            
                            <rect
                              x="100"
                              y={y}
                              width={barWidth}
                              height="20"
                              rx="6"
                              className="transition-all duration-300"
                              fill={idx % 2 === 0 ? "url(#regionGrad1)" : "url(#regionGrad2)"}
                              opacity={isHovered ? 0.95 : 0.8}
                            />
                            
                            <text
                              x={100 + barWidth + 10}
                              y={y + 14}
                              className={`text-xs font-extrabold transition ${
                                isHovered ? 'fill-indigo-600 dark:fill-indigo-400 text-sm scale-105' : 'fill-slate-700 dark:fill-slate-300'
                              }`}
                            >
                              {item.riskRate}%
                            </text>
                          </g>
                        )
                      })}
                      
                      <defs>
                        <linearGradient id="regionGrad1" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                        <linearGradient id="regionGrad2" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Temporal Trend & Evolution Section */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📈</span> {t('dashboard.timeTrendTitle')}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {t('dashboard.timeTrendSubtitle')}
                  </p>
                </div>

                {/* Tab Selector */}
                <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-100 dark:border-slate-800 self-start">
                  <button
                    onClick={() => setActiveTab('billing')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'billing'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    💰 {t('dashboard.billingVsRecoveryLabel')}
                  </button>
                  <button
                    onClick={() => setActiveTab('delinquency')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'delinquency'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    📉 {t('dashboard.delinquencyRateLabel')}
                  </button>
                  <button
                    onClick={() => setActiveTab('trend')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'trend'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    ⏱️ {t('dashboard.trendIndicatorLabel')}
                  </button>
                </div>
              </div>

              {/* Late Payments Increase/Decrease Indicator */}
              {temporalTrend.length >= 2 && (
                <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-950/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.trendIndicatorLabel')}</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {(() => {
                          const last = temporalTrend[temporalTrend.length - 1]
                          const prev = temporalTrend[temporalTrend.length - 2]
                          const diff = last.latePaymentsCount - prev.latePaymentsCount
                          const percent = prev.latePaymentsCount > 0 ? Math.round((Math.abs(diff) / prev.latePaymentsCount) * 100) : 0
                          
                          if (diff > 0) {
                            return t('dashboard.trendIncrease', { percent })
                          } else if (diff < 0) {
                            return t('dashboard.trendDecrease', { percent })
                          } else {
                            return t('dashboard.trendStable')
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Legends */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-indigo-500/20 border border-indigo-500" />
                      <span className="text-slate-500">{t('dashboard.expectedBillingLine')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-slate-500">{t('dashboard.recoveredBillingLine')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-1 bg-amber-500 inline-block" />
                      <span className="text-slate-500">{t('dashboard.delinquencyRateLine')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart Render Area */}
              <div className="p-4 rounded-2xl border border-slate-50 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/10">
                <svg viewBox="0 0 600 280" className="w-full h-auto overflow-visible">
                  {/* Grid Lines */}
                  {[0, 1, 2, 3, 4].map(grid => {
                    const yVal = 40 + grid * 45
                    return (
                      <line
                        key={grid}
                        x1="50"
                        y1={yVal}
                        x2="550"
                        y2={yVal}
                        stroke="rgba(148, 163, 184, 0.1)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                    )
                  })}

                  {/* Monthly elements rendering */}
                  {temporalTrend.map((m, idx) => {
                    const xCenter = 95 + idx * 82
                    
                    const maxVal = Math.max(...temporalTrend.map(x => x.expectedBilling), 70000)
                    const expectedH = (m.expectedBilling / maxVal) * 180
                    const recoveredH = (m.recoveredAmount / maxVal) * 180
                    const lateCountH = (m.latePaymentsCount / Math.max(...temporalTrend.map(x => x.latePaymentsCount), 10)) * 180

                    const expectedY = 220 - expectedH
                    const recoveredY = 220 - recoveredH
                    const lateCountY = 220 - lateCountH

                    const isHovered = hoveredMonth === m.month

                    return (
                      <g
                        key={m.month}
                        className="group cursor-pointer"
                        onMouseEnter={() => setHoveredMonth(m.month)}
                        onMouseLeave={() => setHoveredMonth(null)}
                      >
                        {/* Tab 1: expected vs recovery bars */}
                        {activeTab === 'billing' && (
                          <>
                            {/* Expected Bar */}
                            <rect
                              x={xCenter - 22}
                              y={expectedY}
                              width="18"
                              height={expectedH}
                              rx="4"
                              className={`transition duration-200 ${
                                isHovered ? 'fill-indigo-500' : 'fill-indigo-500/20 stroke stroke-indigo-500 stroke-2'
                              }`}
                            />
                            {/* Recovered Bar */}
                            <rect
                              x={xCenter + 2}
                              y={recoveredY}
                              width="18"
                              height={recoveredH}
                              rx="4"
                              className={`fill-emerald-500 transition duration-200 ${
                                isHovered ? 'fill-emerald-600 scale-y-105 origin-bottom' : ''
                              }`}
                            />
                            {/* Hover tooltip for faturamento */}
                            {isHovered && (
                              <g className="pointer-events-none drop-shadow">
                                <rect
                                  x={xCenter - 65}
                                  y={Math.min(expectedY, recoveredY) - 50}
                                  width="130"
                                  height="42"
                                  rx="8"
                                  className="fill-slate-900 dark:fill-white"
                                />
                                <text
                                  x={xCenter}
                                  y={Math.min(expectedY, recoveredY) - 34}
                                  textAnchor="middle"
                                  className="text-[9px] font-bold fill-white dark:fill-slate-900"
                                >
                                  Prev: R$ {m.expectedBilling.toLocaleString('pt-BR')}
                                </text>
                                <text
                                  x={xCenter}
                                  y={Math.min(expectedY, recoveredY) - 20}
                                  textAnchor="middle"
                                  className="text-[9px] font-black fill-emerald-400 dark:fill-emerald-600"
                                >
                                  Rec: R$ {m.recoveredAmount.toLocaleString('pt-BR')}
                                </text>
                              </g>
                            )}
                          </>
                        )}

                        {/* Tab 3: Late installments bar */}
                        {activeTab === 'trend' && (
                          <>
                            <rect
                              x={xCenter - 15}
                              y={lateCountY}
                              width="30"
                              height={lateCountH}
                              rx="6"
                              className={`transition duration-200 ${
                                isHovered ? 'fill-rose-500' : 'fill-rose-500/25 stroke stroke-rose-500 stroke-2'
                              }`}
                            />
                            {isHovered && (
                              <g className="pointer-events-none drop-shadow">
                                <rect
                                  x={xCenter - 55}
                                  y={lateCountY - 34}
                                  width="110"
                                  height="24"
                                  rx="6"
                                  className="fill-slate-900 dark:fill-white"
                                />
                                <text
                                  x={xCenter}
                                  y={lateCountY - 18}
                                  textAnchor="middle"
                                  className="text-[9px] font-black fill-white dark:fill-slate-900"
                                >
                                  {m.latePaymentsCount} parcelas atrasadas
                                </text>
                              </g>
                            )}
                          </>
                        )}

                        {/* Month Label */}
                        <text
                          x={xCenter}
                          y="242"
                          textAnchor="middle"
                          className={`text-[11px] font-bold transition ${
                            isHovered ? 'fill-indigo-600 dark:fill-indigo-400 scale-110' : 'fill-slate-400 dark:fill-slate-500'
                          }`}
                        >
                          {m.month}
                        </text>
                      </g>
                    )
                  })}

                  {/* Tab 2: Delinquency Rate smooth line chart overlay */}
                  {activeTab === 'delinquency' && (() => {
                    const points = temporalTrend.map((m, idx) => {
                      const x = 95 + idx * 82
                      const y = 220 - (m.delinquencyRate / 100) * 180
                      return { x, y }
                    })
                    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                    
                    return (
                      <>
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-20 blur-[2px]"
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        
                        {points.map((p, i) => {
                          const isHovered = hoveredMonth === temporalTrend[i].month
                          return (
                            <g
                              key={i}
                              className="group cursor-pointer"
                              onMouseEnter={() => setHoveredMonth(temporalTrend[i].month)}
                              onMouseLeave={() => setHoveredMonth(null)}
                            >
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={isHovered ? "8" : "5"}
                                fill="#ffffff"
                                stroke="#f59e0b"
                                strokeWidth="3"
                                className="drop-shadow-sm transition-all duration-150"
                              />
                              
                              {isHovered && (
                                <g className="pointer-events-none drop-shadow">
                                  <rect
                                    x={p.x - 55}
                                    y={p.y - 38}
                                    width="110"
                                    height="28"
                                    rx="6"
                                    className="fill-slate-900 dark:fill-white"
                                  />
                                  <text
                                    x={p.x}
                                    y={p.y - 20}
                                    textAnchor="middle"
                                    className="text-[9px] font-black fill-white dark:fill-slate-900"
                                  >
                                    Taxa Inad: {temporalTrend[i].delinquencyRate}%
                                  </text>
                                </g>
                              )}
                            </g>
                          )
                        })}
                      </>
                    )
                  })()}
                </svg>
              </div>
            </div>
          </div>

              {/* Critical Alerts Feed Sidebar (Right Column) */}
              <div className="lg:col-span-1 space-y-4 sm:space-y-6">
                <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white mb-3 sm:mb-4 flex items-center justify-between">
                    <span>{t('dashboard.alertsTitle')}</span>
                    {alerts.length > 0 && (
                      <span className="rounded-full bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-rose-600 dark:text-rose-400">
                        {t('dashboard.alertsActiveBadge', { count: alerts.length })}
                      </span>
                    )}
                  </h3>

                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                      <span className="text-2xl sm:text-3xl mb-2">🎉</span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{t('dashboard.alertsCleanTitle')}</h4>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-[200px]">{t('dashboard.alertsCleanDesc')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {alerts.map((alert) => (
                        <Link
                          key={alert.id}
                          href={`/clients/${alert.client_id}`}
                          className="block rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4 space-y-1.5 sm:space-y-2 bg-slate-50/50 dark:bg-slate-950/20 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-sm transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] sm:text-xs text-slate-900 dark:text-white truncate max-w-[110px] sm:max-w-[130px]">
                              {t('dashboard.alertsClient', { name: alert.clientName })}
                            </span>
                            <span className={`text-[8px] sm:text-[9px] uppercase tracking-wider font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full ${
                              alert.severity === 'critical'
                                ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30'
                                : 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                            }`}>
                              {alert.severity}
                            </span>
                          </div>

                          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            {alert.message}
                          </p>

                          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 sm:pt-2.5 mt-1">
                            <span className="text-[8px] sm:text-[9px] text-slate-400 font-semibold">
                              {t('dashboard.alertsTime', { date: new Date(alert.created_at).toLocaleDateString('pt-BR') })}
                            </span>
                            <button
                              onClick={(e) => { e.preventDefault(); handleResolveAlert(alert.id); }}
                              className="text-[9px] sm:text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline transition min-h-[44px] min-w-[44px] flex items-center justify-center"
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
            </div>


          </>
        ) : null}
      </main>
    </div>
  )
}
