"use client"
import React, { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db'

interface ClientItem {
  id: string
  name: string
  email: string
  cpf: string
  phone: string
  created_at: string
}

interface RiskDetail {
  score: number
  severity: 'low' | 'medium' | 'critical'
}

export default function ClientsListPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [clients, setClients] = useState<ClientItem[]>([])
  const [riskScores, setRiskScores] = useState<Map<string, RiskDetail>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Search & Filter
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')

  const fetchClients = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error('Falha ao carregar clientes')
      const clientsData = await res.json()
      setClients(clientsData)

      // Evaluating risk details for each client
      const tempScores = new Map<string, RiskDetail>()
      for (const client of clientsData) {
        const profileRes = await fetch(`/api/clients?id=${client.id}`)
        const profile = await profileRes.json()
        
        // Calculate score from installments
        const insts = profile.installments || []
        const overdue = insts.filter((i: { status: string }) => i.status === 'overdue')
        let score = 15
        if (insts.length === 0) {
          score = 0
        } else if (overdue.length > 0) {
          score = 30 + overdue.length * 20
        }
        score = Math.min(100, Math.max(0, score))

        let severity: 'low' | 'medium' | 'critical' = 'low'
        if (score >= 70) severity = 'critical'
        else if (score >= 35) severity = 'medium'

        tempScores.set(client.id, { score, severity })
      }

      setRiskScores(tempScores)
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
      fetchClients()
    }
    checkAuth()
  }, [])

  // Apply search & filters
  const filteredClients = useMemo(() => {
    let result = [...clients]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        c => 
          c.name.toLowerCase().includes(q) || 
          c.cpf.includes(q) || 
          c.email.toLowerCase().includes(q)
      )
    }

    if (riskFilter !== 'all') {
      result = result.filter(c => {
        const clientRisk = riskScores.get(c.id)
        if (!clientRisk) return riskFilter === 'low' // default fallback
        return clientRisk.severity === riskFilter
      })
    }

    return result
  }, [search, riskFilter, clients, riskScores])

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="mx-auto w-full max-w-7xl px-6 py-8 flex-1">
        {/* Page Title & Add Client */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t('clients.title')}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {t('clients.subtitle')}
            </p>
          </div>
          <Link
            href="/clients/create"
            className="self-start sm:self-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-md shadow-indigo-600/10"
          >
            {t('clients.newClientBtn')}
          </Link>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-950/20 dark:bg-rose-950/20 dark:text-rose-400">
            {t('clients.errorLoading')}{error}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="mb-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:max-w-xs relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('clients.searchPlaceholder')}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="w-full md:w-auto flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t('clients.classification')}</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 px-3 py-2 text-xs font-bold focus:outline-none"
            >
              <option value="all">{t('clients.optionAll')}</option>
              <option value="critical">{t('clients.optionCritical')}</option>
              <option value="medium">{t('clients.optionMedium')}</option>
              <option value="low">{t('clients.optionLow')}</option>
            </select>
          </div>
        </div>

        {/* Clients Table */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="text-4xl">👥</span>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mt-3">{t('clients.emptyTitle')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('clients.emptyDesc')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-4">{t('clients.thName')}</th>
                    <th className="px-6 py-4">{t('clients.thCpf')}</th>
                    <th className="px-6 py-4">{t('clients.thContact')}</th>
                    <th className="px-6 py-4">{t('clients.thRisk')}</th>
                    <th className="px-6 py-4 text-right">{t('clients.thAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredClients.map((client) => {
                    const clientRisk = riskScores.get(client.id) || { score: 0, severity: 'low' }

                    return (
                      <tr key={client.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <Link href={`/clients/${client.id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition">
                            {client.name}
                          </Link>
                          <div className="text-[10px] text-slate-400 mt-0.5">{t('clients.registeredOn', { date: new Date(client.created_at).toLocaleDateString('pt-BR') })}</div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">
                          {client.cpf ? client.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : t('clients.noDoc')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-700 dark:text-slate-300">{client.email}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{client.phone || t('clients.noPhone')}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full ${
                            clientRisk.severity === 'critical'
                              ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30'
                              : clientRisk.severity === 'medium'
                              ? 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              clientRisk.severity === 'critical' ? 'bg-rose-500' : clientRisk.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}></span>
                            {clientRisk.score}% ({clientRisk.severity === 'critical' ? t('clients.riskCritical') : clientRisk.severity === 'medium' ? t('clients.riskMedium') : t('clients.riskLow')})
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/clients/${client.id}`}
                            className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 px-3.5 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-150 transition"
                          >
                            {t('clients.analyzeProfile')}
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
