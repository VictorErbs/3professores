import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    if (!db.isMock()) {
      const user = await getAuthedUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const { clientId } = body

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId parameter' }, { status: 400 })
    }

    // Retrieve client details
    const client = await db.clients.get(clientId)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Fetch active contracts
    const contracts = await db.contracts.getByClient(clientId)
    const contractIds = contracts.map(c => c.id)

    // Fetch all installments for client's contracts
    const allInstallments = await db.installments.list()
    const clientInstallments = allInstallments.filter(inst => contractIds.includes(inst.contract_id))

    const overdueInstallments = clientInstallments.filter(inst => inst.status === 'overdue')
    const overdueCount = overdueInstallments.length

    const today = new Date()
    let maxDaysOverdue = 0
    let totalOverdueAmount = 0

    overdueInstallments.forEach(inst => {
      totalOverdueAmount += inst.amount
      const dueDate = new Date(inst.due_date)
      const diffTime = today.getTime() - dueDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays > maxDaysOverdue) {
        maxDaysOverdue = diffDays
      }
    })

    // Calculate score (0-100) using a real heuristic
    let score = 15 // base low risk for active clients in good standing
    
    if (clientInstallments.length === 0) {
      score = 0 // no active contracts/installments
    } else if (overdueCount > 0) {
      // 30 base points if there is any delinquency, plus 20 points per overdue installment
      score = 30 + (overdueCount * 20)
      
      // Additional penalty based on the longest duration in arrears
      if (maxDaysOverdue > 90) {
        score += 15
      } else if (maxDaysOverdue > 30) {
        score += 10
      } else if (maxDaysOverdue > 10) {
        score += 5
      }
    } else {
      // Check if client had previous alerts, adjust base score accordingly
      const allAlerts = await db.alerts.list()
      const clientAlerts = allAlerts.filter(a => a.client_id === clientId && a.resolved === false)
      if (clientAlerts.length > 0) {
        score = 25
      }
    }

    // Cap score at 100 and floor at 0
    score = Math.min(100, Math.max(0, Math.round(score)))

    let severity: 'low' | 'medium' | 'critical' = 'low'
    if (score >= 70) {
      severity = 'critical'
    } else if (score >= 35) {
      severity = 'medium'
    }

    // Save risk score record
    const riskRecord = await db.risk_scores.create({
      client_id: clientId,
      score,
      model: 'heuristic_v2'
    })

    // Check if critical/medium alerts are already generated
    const allAlerts = await db.alerts.list()
    const activeClientAlert = allAlerts.find(a => a.client_id === clientId && a.severity === severity && !a.resolved)

    if (!activeClientAlert && severity !== 'low') {
      const primaryContractId = contractIds[0] || null
      const message = severity === 'critical'
        ? `ALERTA CRÍTICO: Inadimplência severa detectada. Cliente possui ${overdueCount} parcelas em atraso (máximo de ${maxDaysOverdue} dias). Total exposto: R$ ${totalOverdueAmount.toLocaleString('pt-BR')}.`
        : `ALERTA MÉDIO: Atraso recente detectado. Cliente possui ${overdueCount} parcelas vencidas. Total exposto: R$ ${totalOverdueAmount.toLocaleString('pt-BR')}.`

      await db.alerts.create({
        client_id: clientId,
        contract_id: primaryContractId,
        severity,
        message
      })
    }

    return NextResponse.json({
      success: true,
      clientId,
      clientName: client.name,
      score,
      severity,
      overdueCount,
      totalOverdueAmount,
      maxDaysOverdue,
      riskRecordId: riskRecord.id
    })

  } catch (error: any) {
    console.error('Failed to run prediction engine:', error)
    return NextResponse.json({
      error: 'Prediction calculation failed',
      message: error.message || String(error)
    }, { status: 500 })
  }
}
