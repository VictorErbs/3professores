import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Automatically seed if database is empty
    await db.seed()

    // Fetch all operational data
    const clients = await db.clients.list()
    const contracts = await db.contracts.list()
    const installments = await db.installments.list()
    const payments = await db.payments.list()
    const alerts = await db.alerts.list()

    // 1. Calculate top KPIs
    const totalInstallmentsAmount = installments.reduce((acc, inst) => acc + inst.amount, 0)
    
    const overdueInstallments = installments.filter(inst => inst.status === 'overdue')
    const totalOverdueAmount = overdueInstallments.reduce((acc, inst) => acc + inst.amount, 0)

    const paidInstallments = installments.filter(inst => inst.status === 'paid')
    const totalPaidAmount = paidInstallments.reduce((acc, inst) => acc + inst.amount, 0)

    const totalExpectedAmount = totalOverdueAmount + totalPaidAmount + installments.filter(inst => inst.status === 'pending').reduce((acc, inst) => acc + inst.amount, 0)

    // Heuristic rates
    const delinquencyRate = totalExpectedAmount > 0 
      ? (totalOverdueAmount / totalExpectedAmount) * 100 
      : 0

    const recoveryRate = (totalPaidAmount + totalOverdueAmount) > 0
      ? (totalPaidAmount / (totalPaidAmount + totalOverdueAmount)) * 100
      : 0

    // Fetch latest risk score for each client
    let criticalClientsCount = 0
    const latestScoresMap = new Map<string, number>()

    for (const c of clients) {
      const latestScore = await db.risk_scores.getLatestByClient(c.id)
      if (latestScore) {
        latestScoresMap.set(c.id, latestScore.score)
        if (latestScore.score >= 70) {
          criticalClientsCount++
        }
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

      const expected = monthlyInsts.reduce((acc, inst) => acc + inst.amount, 0)

      // Calculate scenarios:
      // Best (5% default rate / 95% collected)
      // Base (15% default rate / 85% collected)
      // Worst (30% default rate / 70% collected)
      const best = expected * 0.95
      const base = expected * 0.85
      const worst = expected * 0.70

      projection.push({
        label,
        expected: Math.round(expected),
        best: Math.round(best),
        base: Math.round(base),
        worst: Math.round(worst)
      })
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
