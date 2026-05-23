"use client"
import React, { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { useTranslation } from 'react-i18next'

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
  const [kpis, setKpis] = useState<KPI | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [projections, setProjections] = useState<ProjectionData[]>([])
  const [scenario, setScenario] = useState<'best' | 'base' | 'worst'>('base')
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
      if (forceLoading) setLoading(false)
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

  // Get current projection value based on scenario
  const getScenarioValue = (proj: ProjectionData) => {
    if (scenario === 'best') return proj.best
    if (scenario === 'worst') return proj.worst
    return proj.base
  }

  const getScenarioLabel = () => {
    if (scenario === 'best') return t('dashboard.scenarioBest')
    if (scenario === 'worst') return t('dashboard.scenarioWorst')
    return t('dashboard.scenarioBase')
  }

  const getScenarioColor = () => {
    if (scenario === 'best') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200'
    if (scenario === 'worst') return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-200'
    return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200'
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="mx-auto w-full max-w-7xl px-6 py-8 flex-1">
        {/* Welcome Area */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t('dashboard.title')}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            className="self-start md:self-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            {t('dashboard.sync')}
          </button>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-950/20 dark:bg-rose-950/20 dark:text-rose-400">
            {t('dashboard.errorLoading')}{error}
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !kpis ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse mb-8">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-32 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : kpis ? (
          <>
            {/* KPI Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              {/* Volume em Risco */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.kpiVolumeAtRisk')}</span>
                  <span className="text-xl">🚨</span>
                </div>
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  R$ {kpis.totalOverdue.toLocaleString('pt-BR')}
                </h3>
                <p className="text-xs text-slate-400 mt-2">{t('dashboard.kpiVolumeAtRiskDesc')}</p>
              </div>

              {/* Taxa de Inadimplência */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.kpiDelinquency')}</span>
                  <span className="text-xl">📈</span>
                </div>
                <h3 className="text-2xl font-black text-amber-600 dark:text-amber-500">
                  {kpis.delinquencyRate}%
                </h3>
                <p className="text-xs text-slate-400 mt-2">{t('dashboard.kpiDelinquencyDesc')}</p>
              </div>

              {/* Taxa de Recuperação */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.kpiRecovery')}</span>
                  <span className="text-xl">🛡️</span>
                </div>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {kpis.recoveryRate}%
                </h3>
                <p className="text-xs text-slate-400 mt-2">{t('dashboard.kpiRecoveryDesc')}</p>
              </div>

              {/* Clientes Críticos */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.kpiCritical')}</span>
                  <span className="text-xl">⚠️</span>
                </div>
                <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {t('dashboard.clientsCount', { count: kpis.criticalClients })}
                </h3>
                <p className="text-xs text-slate-400 mt-2">{t('dashboard.kpiCriticalDesc')}</p>
              </div>
            </div>

            {/* Content Body Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Cash Flow Projection (Left & Middle Column) */}
              <div className="lg:col-span-2 space-y-8">
                <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t('dashboard.projectionTitle')}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.projectionSubtitle')}</p>
                    </div>

                    {/* Scenario Switcher Buttons */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl self-start sm:self-auto border border-slate-200/40">
                      {(['best', 'base', 'worst'] as const).map((sc) => (
                        <button
                          key={sc}
                          onClick={() => setScenario(sc)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 capitalize ${
                            scenario === sc
                              ? sc === 'best'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                                : sc === 'worst'
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/10'
                                : 'bg-amber-500 text-white shadow-md shadow-amber-500/10'
                              : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600'
                          }`}
                        >
                          {sc === 'best' ? t('dashboard.scenarioBtnBest') : sc === 'worst' ? t('dashboard.scenarioBtnWorst') : t('dashboard.scenarioBtnBase')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Scenario Banner */}
                  <div className={`mb-6 rounded-2xl border p-4 text-xs font-semibold flex items-center justify-between ${getScenarioColor()}`}>
                    <span>📋 {t('dashboard.modelActive')}{getScenarioLabel()}</span>
                  </div>

                  {/* Graphical Projection using responsive HTML Bars */}
                  <div className="space-y-5 my-8">
                    {projections.map((proj) => {
                      const maxVal = Math.max(...projections.map(p => p.expected))
                      const expectedPercent = maxVal > 0 ? (proj.expected / maxVal) * 100 : 0
                      const projectedPercent = maxVal > 0 ? (getScenarioValue(proj) / maxVal) * 100 : 0

                      return (
                        <div key={proj.label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-600 dark:text-slate-400">{proj.label}</span>
                            <div className="flex gap-4">
                              <span className="text-slate-400">{t('dashboard.forecastExpected')}: R$ {proj.expected.toLocaleString('pt-BR')}</span>
                              <span className="text-indigo-600 dark:text-indigo-400">{t('dashboard.forecastSimulated')}: R$ {getScenarioValue(proj).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                          
                          {/* Progress bar structure */}
                          <div className="relative h-4 w-full rounded-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
                            {/* Expected bar */}
                            <div
                              style={{ width: `${expectedPercent}%` }}
                              className="absolute top-0 left-0 h-full bg-slate-300 dark:bg-slate-800 transition-all duration-500"
                            />
                            {/* Scenario bar */}
                            <div
                              style={{ width: `${projectedPercent}%` }}
                              className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                                scenario === 'best' 
                                  ? 'bg-emerald-500' 
                                  : scenario === 'worst' 
                                  ? 'bg-rose-500' 
                                  : 'bg-amber-500'
                              }`}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex gap-4 items-center justify-end text-[10px] text-slate-400 font-semibold border-t border-slate-100 dark:border-slate-800 pt-4">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-800"></span> {t('dashboard.forecastExpectedLegend')}</span>
                    <span className="flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${
                        scenario === 'best' ? 'bg-emerald-500' : scenario === 'worst' ? 'bg-rose-500' : 'bg-amber-500'
                      }`}></span> {t('dashboard.forecastSimulatedLegend')}
                    </span>
                  </div>
                </div>

                {/* Dashboard Action Banner */}
                <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-indigo-600/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="font-extrabold text-lg">{t('dashboard.actionBannerTitle')}</h3>
                    <p className="text-xs text-indigo-100 mt-1 max-w-md">{t('dashboard.actionBannerDesc')}</p>
                  </div>
                  <a
                    href="/upload"
                    className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-xs font-extrabold text-indigo-600 hover:bg-slate-50 transition shadow"
                  >
                    {t('dashboard.actionBannerBtn')}
                  </a>
                </div>
              </div>

              {/* Critical Alerts Feed Sidebar (Right Column) */}
              <div className="lg:col-span-1 space-y-6">
                <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center justify-between">
                    <span>{t('dashboard.alertsTitle')}</span>
                    {alerts.length > 0 && (
                      <span className="rounded-full bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 px-2 py-0.5 text-[10px] font-black text-rose-600 dark:text-rose-400">
                        {t('dashboard.alertsActiveBadge', { count: alerts.length })}
                      </span>
                    )}
                  </h3>

                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <span className="text-3xl mb-2">🎉</span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t('dashboard.alertsCleanTitle')}</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-[200px]">{t('dashboard.alertsCleanDesc')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/20 hover:border-slate-200 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[130px]">
                              {t('dashboard.alertsClient', { name: alert.clientName })}
                            </span>
                            <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                              alert.severity === 'critical'
                                ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30'
                                : 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                            }`}>
                              {alert.severity}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            {alert.message}
                          </p>

                          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-1">
                            <span className="text-[9px] text-slate-400 font-semibold">
                              {t('dashboard.alertsTime', { date: new Date(alert.created_at).toLocaleDateString('pt-BR') })}
                            </span>
                            <button
                              onClick={() => handleResolveAlert(alert.id)}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline transition"
                            >
                              {t('dashboard.alertsArchive')}
                            </button>
                          </div>
                        </div>
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
