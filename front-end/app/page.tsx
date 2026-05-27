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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
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

                {/* Dashboard Action Banner */}
                <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-700 p-5 sm:p-6 text-white shadow-xl shadow-indigo-600/10 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg">{t('dashboard.actionBannerTitle')}</h3>
                    <p className="text-[11px] sm:text-xs text-indigo-100 mt-1 max-w-md">{t('dashboard.actionBannerDesc')}</p>
                  </div>
                  <a
                    href="/upload"
                    className="shrink-0 w-full sm:w-auto text-center rounded-xl bg-white px-5 py-2.5 text-xs font-extrabold text-indigo-600 hover:bg-slate-50 transition shadow"
                  >
                    {t('dashboard.actionBannerBtn')}
                  </a>
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
