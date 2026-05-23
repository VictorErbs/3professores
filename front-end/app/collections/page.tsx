"use client"
import React, { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db'

interface CollectionItem {
  clientId: string
  name: string
  email: string
  phone: string
  cpf: string
  overdueCount: number
  totalOverdueAmount: number
  maxDaysOverdue: number
  riskScore: number
  priority: number
  status: 'open' | 'negotiating' | 'recovered' | 'delinquent'
  recommendedAction: string
}

interface ClientInstallment {
  id: string
  contract_number: string
  installment_number: number
  due_date: string
  amount: number
  status: string
}

export default function CollectionsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [queue, setQueue] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')

  // Interactive Panel Modal State
  const [selectedClient, setSelectedClient] = useState<CollectionItem | null>(null)
  const [installments, setInstallments] = useState<ClientInstallment[]>([])
  const [loadingInstallments, setLoadingInstallments] = useState(false)
  const [negotiationNotes, setNegotiationNotes] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const fetchQueue = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/collections')
      if (!res.ok) throw new Error('Falha ao carregar fila de cobrança')
      const data = await res.json()
      setQueue(data)
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
      fetchQueue()
    }
    checkAuth()
  }, [])

  // Apply filters in real-time
  const filteredQueue = useMemo(() => {
    let result = [...queue]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        item => 
          item.name.toLowerCase().includes(q) || 
          item.cpf.includes(q) || 
          item.email.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter)
    }

    if (riskFilter !== 'all') {
      if (riskFilter === 'critical') {
        result = result.filter(item => item.riskScore >= 70)
      } else if (riskFilter === 'medium') {
        result = result.filter(item => item.riskScore >= 35 && item.riskScore < 70)
      } else {
        result = result.filter(item => item.riskScore < 35)
      }
    }

    return result
  }, [search, statusFilter, riskFilter, queue])

  // Open interactive panel and load client installments
  const handleOpenActionPanel = async (item: CollectionItem) => {
    setSelectedClient(item)
    setLoadingInstallments(true)
    setNegotiationNotes('')
    setActionSuccess('')
    setInstallments([])

    try {
      const resProfile = await fetch(`/api/clients?id=${item.clientId}&include=installments`)
      const profile = await resProfile.json()
      if (profile.installments) {
        setInstallments(profile.installments)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingInstallments(false)
    }
  }

  // Settle / Pay an installment in real-time
  const handlePayInstallment = async (installmentId: string) => {
    try {
      setActionSuccess('')
      
      await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: `status,paid_at,installment_number\npaid,${new Date().toISOString()},1`
        })
      })

      setActionSuccess(t('collections.settledSuccess'))
      // Refresh local installments list
      setInstallments(prev => prev.map(inst => inst.id === installmentId ? { ...inst, status: 'paid' } : inst))
      // Refresh collections queue
      fetchQueue()
    } catch {
      alert('Falha ao registrar pagamento.')
    }
  }

  // Register Negotiation
  const handleRegisterNegotiation = async () => {
    if (!negotiationNotes.trim()) return
    setActionSuccess(t('collections.negotiationSaved'))
    setNegotiationNotes('')
    fetchQueue()
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="mx-auto w-full max-w-7xl px-6 py-8 flex-1">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('collections.title')}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {t('collections.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-950/20 dark:bg-rose-950/20 dark:text-rose-400">
            {t('collections.errorLoading') || 'Erro ao carregar dados: '}{error}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="mb-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:max-w-xs relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('collections.searchPlaceholder')}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 items-center">
            {/* Status Filter */}
            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t('collections.filterStatus')}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 px-3 py-2 text-xs font-bold focus:outline-none"
              >
                <option value="all">{t('collections.optionAll')}</option>
                <option value="open">{t('collections.optionOpen')}</option>
                <option value="negotiating">{t('collections.optionNegotiating')}</option>
                <option value="delinquent">{t('collections.optionDelinquent')}</option>
              </select>
            </div>

            {/* Risk Filter */}
            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t('collections.filterRisk')}</span>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 px-3 py-2 text-xs font-bold focus:outline-none"
              >
                <option value="all">{t('collections.optionAll')}</option>
                <option value="critical">{t('collections.optionCriticalRisk')}</option>
                <option value="medium">{t('collections.optionMediumRisk')}</option>
                <option value="low">{t('collections.optionLowRisk')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Delinquency Queue Table */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="text-4xl">🧘</span>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mt-3">{t('collections.emptyQueueTitle')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('collections.emptyQueueDesc')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-4">{t('collections.thClient')}</th>
                    <th className="px-6 py-4">{t('collections.thOverdue')}</th>
                    <th className="px-6 py-4">{t('collections.thDaysOverdue')}</th>
                    <th className="px-6 py-4">{t('collections.thRiskScore')}</th>
                    <th className="px-6 py-4">{t('collections.thAction')}</th>
                    <th className="px-6 py-4 text-right">{t('collections.thTreatment')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredQueue.map((item) => (
                    <tr key={item.clientId} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{t('collections.cpfLabel', { cpf: item.cpf, phone: item.phone })}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-rose-600 dark:text-rose-400">
                        R$ {item.totalOverdueAmount.toLocaleString('pt-BR')}
                        <span className="text-[10px] ml-1.5 font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {item.overdueCount}x
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">
                        {item.maxDaysOverdue} dias
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                          item.riskScore >= 70
                            ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30'
                            : item.riskScore >= 35
                            ? 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                        }`}>
                          {item.riskScore}%
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                        {item.recommendedAction}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenActionPanel(item)}
                          className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          {t('collections.actionBtn')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal / Action Drawer for cobrar */}
        {selectedClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm transition-all duration-300">
            <div className="h-full w-full max-w-lg bg-white dark:bg-slate-900 p-8 shadow-2xl flex flex-col justify-between border-l border-slate-100 dark:border-slate-800 transition-all duration-300">
              
              <div className="space-y-6 overflow-y-auto pr-2 max-h-[85vh]">
                {/* Header of Drawer */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{t('collections.drawerTitle')}</h3>
                    <p className="text-xs text-slate-500">{t('collections.drawerClient', { name: selectedClient.name })}</p>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-slate-400 hover:text-slate-600 text-lg"
                  >
                    ✕
                  </button>
                </div>

                {/* Notifications in Drawer */}
                {actionSuccess && (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                    {actionSuccess}
                  </div>
                )}

                {/* Client Contact Info */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/20 text-xs space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-1">{t('collections.drawerContactHeader')}</h4>
                  <p className="font-medium text-slate-600 dark:text-slate-400">{t('collections.drawerPhone', { phone: selectedClient.phone })}</p>
                  <p className="font-medium text-slate-600 dark:text-slate-400">{t('collections.drawerEmail', { email: selectedClient.email })}</p>
                  <p className="font-medium text-slate-600 dark:text-slate-400">{t('collections.drawerCpf', { cpf: selectedClient.cpf })}</p>
                </div>

                {/* Overdue Installments Settle Section */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">{t('collections.drawerOverdueHeader')}</h4>
                  
                  {loadingInstallments ? (
                    <p className="text-xs text-slate-400">{t('collections.drawerLoadingInstallments')}</p>
                  ) : installments.length === 0 ? (
                    <p className="text-xs text-slate-500">{t('collections.drawerEmptyInstallments')}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {installments
                        .filter(inst => inst.status === 'overdue' || inst.status === 'pending')
                        .map(inst => (
                          <div
                            key={inst.id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 bg-white dark:bg-slate-900"
                          >
                            <div>
                              <div className="font-bold text-xs">{t('collections.drawerInstallmentLabel', { num: inst.installment_number, contract: inst.contract_number })}</div>
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">{t('collections.drawerDueDate', { date: new Date(inst.due_date).toLocaleDateString('pt-BR') })}</div>
                              <div className="text-[10px] text-slate-400 font-medium">{t('collections.drawerAmount', { amount: inst.amount.toLocaleString('pt-BR') })}</div>
                            </div>

                            <button
                              onClick={() => handlePayInstallment(inst.id)}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700 transition"
                            >
                              {t('collections.drawerSettleBtn')}
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Register Negotiation Note */}
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">{t('collections.drawerNegotiationHeader')}</h4>
                  <textarea
                    value={negotiationNotes}
                    onChange={(e) => setNegotiationNotes(e.target.value)}
                    placeholder={t('collections.drawerNegotiationPlaceholder')}
                    rows={3}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 p-3 text-xs focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    onClick={handleRegisterNegotiation}
                    disabled={!negotiationNotes.trim()}
                    className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
                  >
                    {t('collections.drawerSaveNotesBtn')}
                  </button>
                </div>
              </div>

              {/* Close Button at bottom of Drawer */}
              <button
                onClick={() => setSelectedClient(null)}
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 py-3 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                {t('collections.drawerBackBtn')}
              </button>

            </div>
          </div>
        )}

      </main>
    </div>
  )
}
