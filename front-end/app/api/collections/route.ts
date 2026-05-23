import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Seed if empty
    await db.seed()

    const clients = await db.clients.list()
    const contracts = await db.contracts.list()
    const installments = await db.installments.list()
    const riskScores = await db.risk_scores.list()
    const alerts = await db.alerts.list()

    const collectionsQueue = []
    const today = new Date()

    for (const client of clients) {
      // Find all contracts for this client
      const clientContracts = contracts.filter(con => con.client_id === client.id)
      const contractIds = clientContracts.map(con => con.id)

      // Find all overdue installments
      const clientOverdueInsts = installments.filter(inst => 
        contractIds.includes(inst.contract_id) && inst.status === 'overdue'
      )

      if (clientOverdueInsts.length === 0) continue // Skip if client has no overdue installments

      const overdueCount = clientOverdueInsts.length
      const totalOverdueAmount = clientOverdueInsts.reduce((acc, inst) => acc + inst.amount, 0)

      // Calculate max delay in days
      let maxDaysOverdue = 0
      clientOverdueInsts.forEach(inst => {
        const dueDate = new Date(inst.due_date)
        const diffTime = today.getTime() - dueDate.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays > maxDaysOverdue) {
          maxDaysOverdue = diffDays
        }
      })

      // Get latest risk score
      const clientRiskScores = riskScores.filter(r => r.client_id === client.id)
      const latestScore = clientRiskScores.length > 0 
        ? clientRiskScores.sort((a, b) => b.computed_at.localeCompare(a.computed_at))[0].score 
        : 15 // Default low

      // Priority formula: Score * Delinquent value
      const priority = latestScore * totalOverdueAmount

      // Determine active treatment status
      // We can check if there are unresolved alerts for this client
      const activeAlerts = alerts.filter(a => a.client_id === client.id && !a.resolved)
      let status: 'open' | 'negotiating' | 'recovered' | 'delinquent' = 'open'
      
      const hasCriticalAlert = activeAlerts.some(a => a.severity === 'critical')
      if (hasCriticalAlert) {
        status = 'delinquent'
      } else if (activeAlerts.length > 0) {
        status = 'negotiating'
      }

      // Recommend action dynamically
      let recommendedAction = 'Enviar SMS / WhatsApp'
      if (maxDaysOverdue > 90) {
        recommendedAction = 'Acionamento Jurídico Urgente'
      } else if (maxDaysOverdue > 30) {
        recommendedAction = 'Ligação Direta da Assessoria'
      } else if (maxDaysOverdue > 10) {
        recommendedAction = 'E-mail de Notificação Formal'
      }

      collectionsQueue.push({
        clientId: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        cpf: client.cpf,
        overdueCount,
        totalOverdueAmount,
        maxDaysOverdue,
        riskScore: latestScore,
        priority,
        status,
        recommendedAction
      })
    }

    // Sort queue by priority score descending
    const sortedQueue = collectionsQueue.sort((a, b) => b.priority - a.priority)

    return NextResponse.json(sortedQueue)

  } catch (error: any) {
    console.error('Failed to compile collections queue:', error)
    return NextResponse.json({
      error: 'Failed to build collections queue',
      message: error.message || String(error)
    }, { status: 500 })
  }
}
