import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAuthedUser } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    if (!db.isMock()) {
      const user = await getAuthedUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const url = new URL(req.url)
    const search = url.searchParams.get('search')?.trim()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = supabaseUrl && supabaseServiceRoleKey
      ? createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
      : null

    let clients: any[] = []
    if (db.isMock()) {
      clients = await db.clients.list()
      if (search) {
        const lower = search.toLowerCase()
        clients = clients.filter(c => 
          c.name?.toLowerCase().includes(lower) || 
          c.email?.toLowerCase().includes(lower) || 
          c.cpf?.includes(search)
        )
      }
    } else {
      // Direct REST: list all clients ordered by name
      let restUrl = `${supabaseUrl}/rest/v1/clients?select=*&order=name.asc`
      if (search) {
        const escaped = search.replace(/[%_]/g, '\\$&')
        restUrl += `&or=(name.ilike.*${encodeURIComponent(escaped)}*,email.ilike.*${encodeURIComponent(escaped)}*,cpf.ilike.*${encodeURIComponent(escaped)}*)`
      }
      
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      try {
        const res = await fetch(restUrl, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'apikey': supabaseServiceRoleKey!,
            'Authorization': `Bearer ${supabaseServiceRoleKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=none',
            'Range-Unit': 'items',
            'Range': '0-9999',
          },
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Supabase error ${res.status}: ${text}`)
        }
        clients = await res.json()
      } finally {
        clearTimeout(timer)
      }
    }
    let contracts: any[] = []
    let installments: any[] = []
    let riskScores: any[] = []
    let alerts: any[] = []
    const metadataMap = new Map<string, { advisory_name: string | null; collection_status: string | null; client_region: string | null; contemplated_indicator: string | null; payment_method: string | null }>()

    if (db.isMock()) {
      contracts = await db.contracts.list()
      installments = await db.installments.list()
      riskScores = await db.risk_scores.list()
      alerts = await db.alerts.list()
    } else {
      // Direct Supabase chunked querying (overcomes 1000 row truncation limit)
      const clientIds = clients.map((c: any) => c.id)
      const CHUNK_SIZE = 150
      const chunks: string[][] = []
      for (let i = 0; i < clientIds.length; i += CHUNK_SIZE) {
        chunks.push(clientIds.slice(i, i + CHUNK_SIZE))
      }

      // Fetch contracts, risk scores, and alerts in parallel
      const contractsPromises = chunks.map(async chunk => {
        const { data } = await supabase!
          .from('contracts')
          .select('id,client_id,contract_number')
          .in('client_id', chunk)
        return data || []
      })
      const riskScoresPromises = chunks.map(async chunk => {
        const { data } = await supabase!
          .from('risk_scores')
          .select('client_id,score,computed_at')
          .in('client_id', chunk)
        return data || []
      })
      const alertsPromises = chunks.map(async chunk => {
        const { data } = await supabase!
          .from('alerts')
          .select('id,client_id,severity,resolved')
          .in('client_id', chunk)
        return data || []
      })

      const [contractsChunks, riskScoresChunks, alertsChunks] = await Promise.all([
        Promise.all(contractsPromises),
        Promise.all(riskScoresPromises),
        Promise.all(alertsPromises)
      ])

      contracts = contractsChunks.flat()
      riskScores = riskScoresChunks.flat()
      alerts = alertsChunks.flat()

      // Fetch installments specifically for the contract IDs
      const contractIds = contracts.map((c: any) => c.id).filter(Boolean)
      const contractIdChunks: string[][] = []
      for (let i = 0; i < contractIds.length; i += CHUNK_SIZE) {
        contractIdChunks.push(contractIds.slice(i, i + CHUNK_SIZE))
      }

      const installmentsPromises = contractIdChunks.map(async chunk => {
        const { data } = await supabase!
          .from('installments')
          .select('id,contract_id,amount,status,due_date')
          .in('contract_id', chunk)
        return data || []
      })
      const installmentsChunks = await Promise.all(installmentsPromises)
      installments = installmentsChunks.flat()

      // Fetch contract metadata specifically for the contract numbers
      const contractNumbers = contracts.map((c: any) => c.contract_number).filter(Boolean)
      const contractNumberChunks: string[][] = []
      for (let i = 0; i < contractNumbers.length; i += CHUNK_SIZE) {
        contractNumberChunks.push(contractNumbers.slice(i, i + CHUNK_SIZE))
      }

      const metadataPromises = contractNumberChunks.map(async chunk => {
        const { data } = await supabase!
          .from('contract_metadata')
          .select('contract_number,advisory_name,collection_status,client_region,contemplated_indicator,payment_method')
          .in('contract_number', chunk)
        return data || []
      })
      const metadataChunks = await Promise.all(metadataPromises)
      const metadataList = metadataChunks.flat()

      for (const row of metadataList || []) {
        if (row && row.contract_number) {
          metadataMap.set(row.contract_number, row)
        }
      }
    }

    const collectionsQueue = []
    const today = new Date()

    for (const client of clients) {
      // Find all contracts for this client
      const clientContracts = contracts.filter(con => con.client_id === client.id)
      const contractIds = clientContracts.map(con => con.id)
      const contractNumbers = clientContracts.map(con => con.contract_number).filter(Boolean)

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

      // Rule 4: Carência de Alerta Ativo (atrasos <= 3 dias úteis)
      if (maxDaysOverdue <= 3) continue

      // Get latest risk score
      const clientRiskScores = riskScores.filter(r => r.client_id === client.id)
      const latestScore = clientRiskScores.length > 0 
        ? clientRiskScores.sort((a, b) => b.computed_at.localeCompare(a.computed_at))[0].score 
        : 54.0 // Default Mediana da carteira (Regra 1)

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
        recommendedAction,
        advisoryName: metadataMap.get(contractNumbers[0])?.advisory_name || null,
        collectionStatus: metadataMap.get(contractNumbers[0])?.collection_status || null,
        clientRegion: metadataMap.get(contractNumbers[0])?.client_region || null,
        contemplatedIndicator: metadataMap.get(contractNumbers[0])?.contemplated_indicator || null,
        paymentMethod: metadataMap.get(contractNumbers[0])?.payment_method || null,
      })
    }

    // If no overdue clients found, surface top risk clients as fallback
    if (collectionsQueue.length === 0) {
      const latestByClient = new Map<string, number>()
      for (const score of riskScores) {
        if (!latestByClient.has(score.client_id)) {
          latestByClient.set(score.client_id, Number(score.score) || 0)
        }
      }

      for (const client of clients) {
        const score = latestByClient.has(client.id) ? latestByClient.get(client.id)! : 54.0
        if (score < 35) continue
        collectionsQueue.push({
          clientId: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          cpf: client.cpf,
          overdueCount: 0,
          totalOverdueAmount: 0,
          maxDaysOverdue: 0,
          riskScore: score,
          priority: score,
          status: 'open',
          recommendedAction: score >= 70 ? 'Contato imediato' : 'Contato preventivo',
          advisoryName: null,
          collectionStatus: null,
          clientRegion: null,
          contemplatedIndicator: null,
          paymentMethod: null,
        })
      }
    }

    // Ensure new clients without installments appear with a clear status
    const latestByClient = new Map<string, number>()
    for (const score of riskScores) {
      if (!latestByClient.has(score.client_id)) {
        latestByClient.set(score.client_id, Number(score.score) || 0)
      }
    }

    for (const client of clients) {
      const clientContracts = contracts.filter(con => con.client_id === client.id)
      const contractIds = clientContracts.map(con => con.id)
      const hasInstallments = installments.some(inst => contractIds.includes(inst.contract_id))
      const alreadyInQueue = collectionsQueue.some(item => item.clientId === client.id)
      if (alreadyInQueue || hasInstallments) continue

      const score = latestByClient.has(client.id) ? latestByClient.get(client.id)! : 54.0
      collectionsQueue.push({
        clientId: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        cpf: client.cpf,
        overdueCount: 0,
        totalOverdueAmount: 0,
        maxDaysOverdue: 0,
        riskScore: score,
        priority: score,
        status: 'open',
        recommendedAction: 'Cadastrar parcelas',
        advisoryName: null,
        collectionStatus: 'Sem parcelas',
        clientRegion: null,
        contemplatedIndicator: null,
        paymentMethod: null,
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
