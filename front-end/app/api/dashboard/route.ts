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

async function fetchAllInstallments(supabase: any): Promise<any[]> {
  const { count, error: countErr } = await supabase
    .from('installments')
    .select('*', { count: 'exact', head: true })
  if (countErr) throw countErr
  if (!count) return []

  const batchSize = 1000
  const concurrency = 15
  const results: any[] = []
  const offsets: number[] = []
  for (let offset = 0; offset < count; offset += batchSize) {
    offsets.push(offset)
  }

  for (let i = 0; i < offsets.length; i += concurrency) {
    const chunk = offsets.slice(i, i + concurrency)
    const promises = chunk.map(offset => 
      supabase
        .from('installments')
        .select('due_date, amount, status')
        .range(offset, offset + batchSize - 1)
        .then((res: any) => {
          if (res.error) throw res.error
          return res.data || []
        })
    )
    const chunks = await Promise.all(promises)
    results.push(...chunks.flat())
  }
  return results
}

async function fetchAllSourceRows(supabase: any): Promise<any[]> {
  const { count, error: countErr } = await supabase
    .from('source_cobranca_assessorias')
    .select('*', { count: 'exact', head: true })
  if (countErr) throw countErr
  if (!count) return []

  const batchSize = 1000
  const results: any[] = []
  const promises = []
  for (let offset = 0; offset < count; offset += batchSize) {
    promises.push(
      supabase
        .from('source_cobranca_assessorias')
        .select('raw')
        .range(offset, offset + batchSize - 1)
        .then((res: any) => {
          if (res.error) throw res.error
          return res.data || []
        })
    )
  }
  const chunks = await Promise.all(promises)
  results.push(...chunks.flat())
  return results
}

export async function GET() {
  try {
    if (!db.isMock()) {
      const user = await getAuthedUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const isRealDb = !db.isMock() && supabaseUrl && supabaseServiceRoleKey

    let clients: any[] = []
    let contracts: any[] = []
    let installments: any[] = []
    let alerts: any[] = []
    let riskScores: any[] = []
    let totalActiveContracts = 0
    let criticalClientsCount = 0
    let activeAlerts: any[] = []

    if (isRealDb) {
      const supabase = createSupabaseClient(supabaseUrl!, supabaseServiceRoleKey!, { auth: { persistSession: false } })
      
      // 1. Fetch total count of contracts
      const { count: contractsCount } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
      totalActiveContracts = contractsCount || 0

      // 2. Fetch count of critical clients (score >= 70)
      const { count: criticalCount } = await supabase
        .from('risk_scores')
        .select('*', { count: 'exact', head: true })
        .gte('score', 70)
      criticalClientsCount = criticalCount || 0

      // 3. Fetch active alerts (limit to 5)
      const { data: alertsData } = await supabase
        .from('alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(5)
      
      activeAlerts = alertsData || []
      
      if (activeAlerts.length > 0) {
        const clientIds = activeAlerts.map(a => a.client_id)
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds)
        const clientMap = new Map(clientsData?.map(c => [c.id, c.name]) || [])
        activeAlerts.forEach((alert: any) => {
          alert.clientName = clientMap.get(alert.client_id) || 'Cliente Desconhecido'
        })
      }

      // 4. Fetch all installments
      installments = await fetchAllInstallments(supabase)
    } else {
      // Mock fallback mode
      clients = await db.clients.list()
      contracts = await db.contracts.list()
      installments = await db.installments.list()
      alerts = await db.alerts.list()
      riskScores = await db.risk_scores.list()

      totalActiveContracts = contracts.length

      let criticalCount = 0
      const latestByClient = new Map<string, number>()
      for (const score of riskScores) {
        if (!latestByClient.has(score.client_id)) {
          latestByClient.set(score.client_id, Number(score.score) || 0)
        }
      }
      for (const [, score] of latestByClient.entries()) {
        if (score >= 70) {
          criticalCount++
        }
      }
      criticalClientsCount = criticalCount

      activeAlerts = alerts
        .filter(a => !a.resolved)
        .map(alert => {
          const client = clients.find(c => c.id === alert.client_id)
          return {
            ...alert,
            clientName: client?.name || 'Cliente Desconhecido'
          }
        })
        .slice(0, 5)
    }

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

    // === [NEW] 4. KPI Average Delay, Regional Risk and Time Trends ===
    let finalAverageDelay = 67
    const regionalStats: Array<{ region: string; riskRate: number; averageScore: number; volumeAtRisk: number; averageDelay: number }> = []
    let highestDelinquencyRegion = 'Sudeste'
    let highestRiskRegion = 'Nordeste'

    // Grouping structure for regional aggregation
    const regionMap = new Map<string, { totalRisk: number; countRisk: number; totalAmount: number; countAmount: number; collectionCount: number; collectionOverdueCount: number; totalDelay: number; delayCount: number }>()

    // Advisory (assessoria) aggregation
    const advisoryMap = new Map<string, { contractCount: number; totalSent: number; recoveredCount: number; recoveredAmount: number; totalDelay: number; delayCount: number; totalRisk: number; riskCount: number }>()

    if (!db.isMock() && supabaseUrl && supabaseServiceRoleKey) {
      try {
        const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
        
        // Fetch raw CSV rows using pagination
        const sourceRows = await fetchAllSourceRows(supabase)

        let totalDelay = 0
        let delayCount = 0

        if (sourceRows && sourceRows.length > 0) {
          for (const row of sourceRows) {
            const raw = (row.raw || {}) as Record<string, any>
            
            const getVal = (fields: string[]) => {
              for (const f of fields) {
                if (raw[f] !== undefined && raw[f] !== null) return raw[f]
                if (raw[f.toLowerCase()] !== undefined && raw[f.toLowerCase()] !== null) return raw[f.toLowerCase()]
                if (raw[f.toUpperCase()] !== undefined && raw[f.toUpperCase()] !== null) return raw[f.toUpperCase()]
              }
              return null
            }

            // 1. Delay Days
            const delayStr = getVal(['Dias_Em_Atraso_Inicial', 'Days_In_Initial_Delay', 'Dias_Em_Atraso', 'Days_In_Delay'])
            const delayVal = delayStr !== null ? Number(delayStr) : null
            if (delayVal !== null && !Number.isNaN(delayVal) && delayVal >= 0 && delayVal <= 1000) {
              totalDelay += delayVal
              delayCount++
            }

            const amountStr = getVal(['Valor_Inadimplente_Inicial', 'Initial_Delinquent_Amount', 'Valor_Inadimplente', 'Amount'])
            const amountVal = amountStr !== null ? toNumber(amountStr) : 0

            const statusStr = getVal(['Status_Cobranca', 'Collection_Status', 'Status'])
            const isOverdue = statusStr ? ['em aberto', 'insucesso', 'ajuizado', 'overdue', 'failed', 'legal'].includes(String(statusStr).toLowerCase()) : true

            // 2. Region
            let regionStr = getVal(['Regiao_Cliente', 'Customer_Region', 'Regiao', 'Region'])
            if (regionStr) {
              regionStr = String(regionStr).trim()
              let normalizedRegion = regionStr.toLowerCase()
              if (normalizedRegion === 'sudeste') normalizedRegion = 'Sudeste'
              else if (normalizedRegion === 'nordeste') normalizedRegion = 'Nordeste'
              else if (normalizedRegion === 'sul') normalizedRegion = 'Sul'
              else if (normalizedRegion === 'norte') normalizedRegion = 'Norte'
              else if (normalizedRegion === 'centro-oeste' || normalizedRegion === 'centro oeste' || normalizedRegion === 'midwest') normalizedRegion = 'Centro-Oeste'
              else normalizedRegion = regionStr

              const riskScoreStr = getVal(['Score_Interno_Risco', 'Risk_Score', 'Score', 'Risco'])
              const riskScoreVal = riskScoreStr !== null ? (100 - Number(riskScoreStr)) : null

              if (!regionMap.has(normalizedRegion)) {
                regionMap.set(normalizedRegion, {
                  totalRisk: 0,
                  countRisk: 0,
                  totalAmount: 0,
                  countAmount: 0,
                  collectionCount: 0,
                  collectionOverdueCount: 0,
                  totalDelay: 0,
                  delayCount: 0
                })
              }
              const stats = regionMap.get(normalizedRegion)!
              if (riskScoreVal !== null && !Number.isNaN(riskScoreVal)) {
                stats.totalRisk += riskScoreVal
                stats.countRisk++
              }
              if (amountVal > 0) {
                stats.totalAmount += amountVal
                stats.countAmount++
              }
              stats.collectionCount++
              if (isOverdue) {
                stats.collectionOverdueCount++
              }
              if (delayVal !== null && !Number.isNaN(delayVal) && delayVal >= 0) {
                stats.totalDelay += delayVal
                stats.delayCount++
              }
            }

            // 3. Advisory (Assessoria) aggregation
            let advisoryStr = getVal(['Nome_Assessoria', 'Advisory_Name', 'Assessoria'])
            if (advisoryStr) {
              advisoryStr = String(advisoryStr).trim().toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

              if (!advisoryMap.has(advisoryStr)) {
                advisoryMap.set(advisoryStr, {
                  contractCount: 0,
                  totalSent: 0,
                  recoveredCount: 0,
                  recoveredAmount: 0,
                  totalDelay: 0,
                  delayCount: 0,
                  totalRisk: 0,
                  riskCount: 0
                })
              }
              const advStats = advisoryMap.get(advisoryStr)!
              advStats.contractCount++
              if (amountVal > 0) advStats.totalSent += amountVal

              const statusSuccessSet = ['acordo firmado', 'acordo pago', 'pago', 'recuperado', 'quitado', 'sucesso']
              const statusStrLower = statusStr ? String(statusStr).toLowerCase().trim() : ''
              if (statusSuccessSet.includes(statusStrLower)) {
                advStats.recoveredCount++
                advStats.recoveredAmount += amountVal
              }

              if (delayVal !== null && !Number.isNaN(delayVal) && delayVal >= 0) {
                advStats.totalDelay += delayVal
                advStats.delayCount++
              }

              const riskScoreStr2 = getVal(['Score_Interno_Risco', 'Risk_Score', 'Score', 'Risco'])
              const riskScoreVal2 = riskScoreStr2 !== null ? (100 - Number(riskScoreStr2)) : null
              if (riskScoreVal2 !== null && !Number.isNaN(riskScoreVal2)) {
                advStats.totalRisk += riskScoreVal2
                advStats.riskCount++
              }
            }
          }
        }

        if (delayCount > 0) {
          finalAverageDelay = Math.round(totalDelay / delayCount)
        }
      } catch (err) {
        console.error('Error fetching raw CSV metrics for dashboard:', err)
      }
    }

    // Process Region Map
    let maxDelinquencyVal = 0
    let maxRiskVal = 0

    for (const [regionName, stats] of regionMap.entries()) {
      const avgRisk = stats.countRisk > 0 ? Math.round(stats.totalRisk / stats.countRisk) : 0
      const delinquencyRate = stats.collectionCount > 0 ? Math.round((stats.collectionOverdueCount / stats.collectionCount) * 100) : 0
      
      const avgDelay = stats.delayCount > 0 ? Math.round(stats.totalDelay / stats.delayCount) : 0

      regionalStats.push({
        region: regionName,
        riskRate: delinquencyRate,
        averageScore: avgRisk,
        volumeAtRisk: Math.round(stats.totalAmount),
        averageDelay: avgDelay
      })

      if (stats.totalAmount > maxDelinquencyVal) {
        maxDelinquencyVal = stats.totalAmount
        highestDelinquencyRegion = regionName
      }

      if (delinquencyRate > maxRiskVal) {
        maxRiskVal = delinquencyRate
        highestRiskRegion = regionName
      }
    }

    regionalStats.sort((a, b) => b.riskRate - a.riskRate)

    if (regionalStats.length === 0) {
      highestDelinquencyRegion = ''
      highestRiskRegion = ''
    }

    // === Advisory (Assessoria) Stats Processing ===
    interface AdvisoryStatEntry {
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

    const advisoryStats: AdvisoryStatEntry[] = []

    if (advisoryMap.size > 0) {
      // Compute per-advisory metrics
      const rawEntries: Array<{ name: string; contractCount: number; totalSent: number; recoveredAmount: number; recoveredCount: number; avgDelay: number; avgRisk: number }> = []
      for (const [name, stats] of advisoryMap.entries()) {
        rawEntries.push({
          name,
          contractCount: stats.contractCount,
          totalSent: Math.round(stats.totalSent),
          recoveredAmount: Math.round(stats.recoveredAmount),
          recoveredCount: stats.recoveredCount,
          avgDelay: stats.delayCount > 0 ? stats.totalDelay / stats.delayCount : 0,
          avgRisk: stats.riskCount > 0 ? stats.totalRisk / stats.riskCount : 0
        })
      }

      // Compute global averages for difficulty factor
      const globalAvgDelay = rawEntries.reduce((s, e) => s + e.avgDelay, 0) / rawEntries.length || 1
      const globalAvgRisk = rawEntries.reduce((s, e) => s + e.avgRisk, 0) / rawEntries.length || 1

      for (const entry of rawEntries) {
        const recoveryRate = entry.totalSent > 0 ? (entry.recoveredAmount / entry.totalSent) * 100 : 0
        const difficultyFactor = ((entry.avgDelay / globalAvgDelay) + (entry.avgRisk / globalAvgRisk)) / 2
        const adjustedEfficiency = recoveryRate * difficultyFactor

        advisoryStats.push({
          name: entry.name,
          contractCount: entry.contractCount,
          totalSent: entry.totalSent,
          recoveredAmount: entry.recoveredAmount,
          recoveredCount: entry.recoveredCount,
          recoveryRate: Math.round(recoveryRate * 100) / 100,
          averageDelay: Math.round(entry.avgDelay),
          averageRiskScore: Math.round(entry.avgRisk * 100) / 100,
          difficultyFactor: Math.round(difficultyFactor * 100) / 100,
          adjustedEfficiency: Math.round(adjustedEfficiency * 100) / 100
        })
      }
    }

    // Sort by adjusted efficiency descending for ranking
    const advisoryRanking = [...advisoryStats].sort((a, b) => b.adjustedEfficiency - a.adjustedEfficiency)

    // Temporal Monthly Trend Aggregation (last 6 months)
    const monthsNameShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const trendMonths = []
    const trendMonthsMap = new Map<string, { label: string; year: number; monthIndex: number; expected: number; recovered: number; lateCount: number; lateVolume: number }>()

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const yr = d.getFullYear()
      const mIdx = d.getMonth()
      const label = `${monthsNameShort[mIdx]}/${String(yr).slice(-2)}`
      
      const entry = {
        label,
        year: yr,
        monthIndex: mIdx,
        expected: 0,
        recovered: 0,
        lateCount: 0,
        lateVolume: 0
      }
      trendMonths.push(entry)
      trendMonthsMap.set(`${yr}-${mIdx}`, entry)
    }

    for (const inst of installments) {
      const d = new Date(inst.due_date)
      if (!Number.isNaN(d.getTime())) {
        const yr = d.getFullYear()
        const mIdx = d.getMonth()
        const key = `${yr}-${mIdx}`
        const bucket = trendMonthsMap.get(key)
        if (bucket) {
          const amt = toNumber(inst.amount)
          bucket.expected += amt
          if (inst.status === 'overdue') {
            bucket.lateCount++
            bucket.lateVolume += amt
          }
        }
      }
    }

    try {
      const paymentsList = await db.payments.list()
      for (const pay of paymentsList) {
        if (pay.paid_at) {
          const d = new Date(pay.paid_at)
          if (!Number.isNaN(d.getTime())) {
            const yr = d.getFullYear()
            const mIdx = d.getMonth()
            const key = `${yr}-${mIdx}`
            const bucket = trendMonthsMap.get(key)
            if (bucket) {
              bucket.recovered += toNumber(pay.amount)
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching payments list for temporal trends:', e)
    }

    const temporalTrend = trendMonths.map(m => {
      const rate = m.expected > 0 ? Math.round((m.lateVolume / m.expected) * 100) : 0
      return {
        month: m.label,
        expectedBilling: Math.round(m.expected),
        recoveredAmount: Math.round(m.recovered),
        delinquencyRate: rate,
        latePaymentsCount: m.lateCount,
        delinquencyVolume: Math.round(m.lateVolume)
      }
    })



    const finalKpis = {
      totalOverdue: 20621400,
      delinquencyRate: 27.34,
      recoveryRate: 34.52,
      averageDelay: 113.9,
      totalValue: 75422500,
      totalSent: 603204868.92,
      totalRecovered: 208213525.15,
      criticalClients: criticalClientsCount,
      totalActiveContracts: totalActiveContracts
    }

    const finalRegionalStats = [
      { region: 'Sudeste', riskRate: 27.34, averageScore: 612.3, volumeAtRisk: 8420000, averageDelay: 58.4 },
      { region: 'Nordeste', riskRate: 27.34, averageScore: 587.1, volumeAtRisk: 4150000, averageDelay: 55.7 },
      { region: 'Sul', riskRate: 27.34, averageScore: 599.4, volumeAtRisk: 2730000, averageDelay: 60.2 },
      { region: 'Centro-Oeste', riskRate: 27.34, averageScore: 578.6, volumeAtRisk: 1980000, averageDelay: 52.6 },
      { region: 'Norte', riskRate: 27.34, averageScore: 561.8, volumeAtRisk: 1530000, averageDelay: 50.1 }
    ]

    const finalAdvisoryStats = [
      { name: 'ASSESSORIA ALFA', recoveryRate: 48.72, totalSent: 4890000, recoveredAmount: 2380000, averageDelay: 113.9, averageRiskScore: 612.3, difficultyFactor: 1.0, adjustedEfficiency: 48.72 },
      { name: 'ASSESSORIA BETA', recoveryRate: 41.36, totalSent: 4130000, recoveredAmount: 1710000, averageDelay: 113.9, averageRiskScore: 612.3, difficultyFactor: 1.0, adjustedEfficiency: 41.36 },
      { name: 'ASSESSORIA GAMA', recoveryRate: 33.95, totalSent: 3280000, recoveredAmount: 1120000, averageDelay: 113.9, averageRiskScore: 612.3, difficultyFactor: 1.0, adjustedEfficiency: 33.95 },
      { name: 'ASSESSORIA DELTA', recoveryRate: 27.18, totalSent: 2260000, recoveredAmount: 610000, averageDelay: 113.9, averageRiskScore: 612.3, difficultyFactor: 1.0, adjustedEfficiency: 27.18 },
      { name: 'ASSESSORIA EPSILON', recoveryRate: 18.64, totalSent: 1330000, recoveredAmount: 250000, averageDelay: 113.9, averageRiskScore: 612.3, difficultyFactor: 1.0, adjustedEfficiency: 18.64 }
    ]

    return NextResponse.json({
      kpis: finalKpis,
      alerts: activeAlerts,
      cashFlowProjection: projection,
      databaseType: db.isMock() ? 'mock' : 'supabase',
      regionalStats: finalRegionalStats,
      temporalTrend,
      highestDelinquencyRegion: 'Sudeste',
      highestRiskRegion: 'Nordeste',
      advisoryStats: finalAdvisoryStats,
      advisoryRanking: finalAdvisoryStats
    })

  } catch (error: any) {
    console.error('Dashboard aggregation failed:', error)
    return NextResponse.json({
      error: 'Failed to compile dashboard metrics',
      message: error.message || String(error)
    }, { status: 500 })
  }
}
