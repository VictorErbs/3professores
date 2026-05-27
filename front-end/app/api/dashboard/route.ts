import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth'

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = String(value)
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function toDate(value: unknown) {
  if (!value) return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET() {
  try {
    if (!db.isMock()) {
      const user = await getAuthedUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Fetch all operational data
    const clients = await db.clients.list()
    const contracts = await db.contracts.list()
    let installments = await db.installments.list()
    const shouldFallback = installments.length === 0 && !db.isMock()
    if (shouldFallback) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && supabaseServiceRoleKey) {
        const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
        const { data } = await supabase.from('installments').select('*')
        if (data) {
          installments = data as typeof installments
        }
      }
    }
    const alerts = await db.alerts.list()
    const riskScores = await db.risk_scores.list()

    // 1. Calculate top KPIs
    const overdueInstallments = installments.filter(inst => inst.status === 'overdue')
    const totalOverdueAmount = overdueInstallments.reduce((acc, inst) => acc + toNumber(inst.amount), 0)

    const paidInstallments = installments.filter(inst => inst.status === 'paid')
    const totalPaidAmount = paidInstallments.reduce((acc, inst) => acc + toNumber(inst.amount), 0)

    const totalExpectedAmount = totalOverdueAmount + totalPaidAmount + installments
      .filter(inst => inst.status === 'pending')
      .reduce((acc, inst) => acc + toNumber(inst.amount), 0)

    // Heuristic rates
    const delinquencyRate = totalExpectedAmount > 0 
      ? (totalOverdueAmount / totalExpectedAmount) * 100 
      : 0

    const recoveryRate = (totalPaidAmount + totalOverdueAmount) > 0
      ? (totalPaidAmount / (totalPaidAmount + totalOverdueAmount)) * 100
      : 0

    // Compute latest risk score for each client in-memory (single query already loaded)
    let criticalClientsCount = 0
    const latestByClient = new Map<string, number>()
    for (const score of riskScores) {
      if (!latestByClient.has(score.client_id)) {
        latestByClient.set(score.client_id, Number(score.score) || 0)
      }
    }

    for (const [, score] of latestByClient.entries()) {
      if (score >= 70) {
        criticalClientsCount++
      }
    }

    // 2. Active Alertas Feed (resolved = false)
    const activeAlerts = alerts
      .filter(a => !a.resolved)
      .map(alert => {
        const client = clients.find(c => c.id === alert.client_id)
        return {
          ...alert,
          clientName: client?.name || 'Cliente Desconhecido'
        }
      })
      .slice(0, 5) // Limit to top 5 recent

    // 3. Projeção de Fluxo de Caixa para os próximos 6 meses
    const today = new Date()
    const monthsName = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const projection = []
    const projectionByKey = new Map<string, { label: string; expected: number; best: number; base: number; worst: number }>()

    const makeProjectionRow = (label: string, expected: number) => {
      const best = expected * 0.95
      const base = expected * 0.85
      const worst = expected * 0.70
      return {
        label,
        expected: Math.round(expected),
        best: Math.round(best),
        base: Math.round(base),
        worst: Math.round(worst)
      }
    }

    for (let m = 0; m < 6; m++) {
      const projectDate = new Date(today.getFullYear(), today.getMonth() + m, 1)
      const year = projectDate.getFullYear()
      const monthIndex = projectDate.getMonth()
      const label = `${monthsName[monthIndex]}/${String(year).slice(-2)}`

      // Filter installments due in this month & year
      const monthlyInsts = installments.filter(inst => {
        const d = new Date(inst.due_date)
        return d.getFullYear() === year && d.getMonth() === monthIndex
      })

      const expected = monthlyInsts.reduce((acc, inst) => acc + toNumber(inst.amount), 0)
      const row = makeProjectionRow(label, expected)
      projection.push(row)
      projectionByKey.set(label, row)
    }

    if (installments.length === 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && supabaseServiceRoleKey) {
        const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
        const { data: sourceRows } = await supabase
          .from('source_cobranca_assessorias')
          .select('raw')

        if (sourceRows && sourceRows.length > 0) {
          const monthsWindow = projection.map((p) => p.label)
          const windowSet = new Set(monthsWindow)

          for (const row of sourceRows) {
            const raw = row.raw || {}
            const sentDate = toDate(raw.Data_Envio_Assessoria || raw.data_envio_assessoria)
            const amount = toNumber(raw.Valor_Inadimplente_Inicial || raw.valor_inadimplente_inicial)
            if (!amount) continue

            const baseDate = sentDate || today
            const monthlyAmount = amount / 6
            for (let i = 0; i < 6; i++) {
              const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1)
              const label = `${monthsName[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`
              if (!windowSet.has(label)) continue
              const bucket = projectionByKey.get(label)
              if (!bucket) continue
              bucket.expected = Math.round((bucket.expected + monthlyAmount) * 100) / 100
              bucket.best = Math.round(bucket.expected * 0.95)
              bucket.base = Math.round(bucket.expected * 0.85)
              bucket.worst = Math.round(bucket.expected * 0.70)
            }
          }
        }
      }
    }

    return NextResponse.json({
      kpis: {
        totalOverdue: totalOverdueAmount,
        delinquencyRate: Math.round(delinquencyRate * 10) / 10,
        recoveryRate: Math.round(recoveryRate * 10) / 10,
        criticalClients: criticalClientsCount,
        totalActiveContracts: contracts.length
      },
      alerts: activeAlerts,
      cashFlowProjection: projection,
      databaseType: db.isMock() ? 'mock' : 'supabase'
    })

  } catch (error: any) {
    console.error('Dashboard aggregation failed:', error)
    return NextResponse.json({
      error: 'Failed to compile dashboard metrics',
      message: error.message || String(error)
    }, { status: 500 })
  }
}
