import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

// Direct REST call to Supabase (bypasses SDK WebSocket issues)
async function supabaseGet(path: string, params?: Record<string, string>) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=none',
        'Range-Unit': 'items',
        'Range': '0-299',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Supabase error ${res.status}: ${text}`)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(req: Request) {
  try {
    // In Supabase mode, require an authenticated user for data access.
    if (!db.isMock()) {
      const user = await getAuthedUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (id) {
      if (!isUuid(id)) {
        return NextResponse.json({ error: 'Invalid client id format' }, { status: 400 })
      }

      // If mock mode, fall back to db
      if (db.isMock()) {
        const client = await db.clients.get(id)
        if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
        const contracts = await db.contracts.getByClient(id)
        const contractIds = contracts.map(c => c.id)
        const allInstallments = await db.installments.list()
        const clientInstallments = allInstallments.filter(inst => contractIds.includes(inst.contract_id))
        const riskScoreObj = await db.risk_scores.getLatestByClient(id)
        return NextResponse.json({
          ...client,
          contracts,
          installments: clientInstallments,
          riskScore: riskScoreObj?.score ?? 54.0
        })
      }

      // Direct REST for Supabase mode
      const [clientArr, contracts, riskScores] = await Promise.all([
        supabaseGet('clients', { id: `eq.${id}`, select: '*' }),
        supabaseGet('contracts', { client_id: `eq.${id}`, select: '*' }),
        supabaseGet('risk_scores', { client_id: `eq.${id}`, select: '*', order: 'computed_at.desc' }),
      ])
      const client = clientArr?.[0]
      if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

      const contractIds = (contracts || []).map((c: any) => c.id)
      let installments: any[] = []
      if (contractIds.length > 0) {
        installments = await supabaseGet('installments', {
          contract_id: `in.(${contractIds.join(',')})`,
          select: '*',
          order: 'due_date.asc',
        })
      }

      let metadata: any[] = []
      const contractNumbers = (contracts || []).map((c: any) => c.contract_number).filter(Boolean)
      if (contractNumbers.length > 0) {
        metadata = await supabaseGet('contract_metadata', {
          contract_number: `in.(${contractNumbers.join(',')})`,
          select: '*'
        })
      }

      const primaryMeta = metadata?.[0] || null

      return NextResponse.json({
        ...client,
        contracts: contracts || [],
        installments,
        riskScore: riskScores?.[0]?.score ?? 54.0,
        contemplatedIndicator: primaryMeta?.contemplated_indicator || null,
        clientRegion: primaryMeta?.client_region || null,
        collectionStatus: primaryMeta?.collection_status || null,
        paymentMethod: primaryMeta?.payment_method || null,
        advisoryName: primaryMeta?.advisory_name || null
      })
    }

    // List all clients (with optional server-side search)
    if (db.isMock()) {
      const clientsList = await db.clients.list()
      return NextResponse.json(clientsList)
    }

    const search = url.searchParams.get('search')?.trim()

    // 1. Fetch clients first
    let clientsPath = `clients?select=*&order=name.asc`
    if (search) {
      const escaped = search.replace(/[%_]/g, '\\$&')
      clientsPath += `&or=(name.ilike.*${encodeURIComponent(escaped)}*,email.ilike.*${encodeURIComponent(escaped)}*,cpf.ilike.*${encodeURIComponent(escaped)}*)`
    }

    const clientsList = await supabaseGet(clientsPath)
    if (!clientsList || !Array.isArray(clientsList) || clientsList.length === 0) {
      return NextResponse.json([])
    }

    // 2. Extract client IDs and query risk scores and contracts in batches (to avoid large URLs)
    const clientIds = clientsList.map((c: any) => c.id)
    const CHUNK_SIZE = 150
    const chunks: string[][] = []
    for (let i = 0; i < clientIds.length; i += CHUNK_SIZE) {
      chunks.push(clientIds.slice(i, i + CHUNK_SIZE))
    }

    const riskScoresPromises = chunks.map(chunk => 
      supabaseGet('risk_scores', {
        client_id: `in.(${chunk.join(',')})`,
        select: 'client_id,score,model'
      })
    )

    const contractsPromises = chunks.map(chunk => 
      supabaseGet('contracts', {
        client_id: `in.(${chunk.join(',')})`,
        select: 'id,client_id,contract_number'
      })
    )

    const [riskScoresChunks, contractsChunks] = await Promise.all([
      Promise.all(riskScoresPromises),
      Promise.all(contractsPromises)
    ])

    const riskScoresList = riskScoresChunks.flat()
    const contractsList = contractsChunks.flat()

    // 3. Extract contract numbers and query contract metadata in batches
    const contractNumbers = contractsList
      .map((c: any) => c.contract_number)
      .filter((cn: any) => !!cn)

    const contractNumberChunks: string[][] = []
    for (let i = 0; i < contractNumbers.length; i += CHUNK_SIZE) {
      contractNumberChunks.push(contractNumbers.slice(i, i + CHUNK_SIZE))
    }

    const metadataPromises = contractNumberChunks.map(chunk => 
      supabaseGet('contract_metadata', {
        contract_number: `in.(${chunk.join(',')})`,
        select: 'contract_number,client_region,collection_status'
      })
    )

    const metadataChunks = await Promise.all(metadataPromises)
    const metadataList = metadataChunks.flat()

    // 4. Build mapping indexes for O(1) merge
    const riskMap = new Map<string, number>()
    if (riskScoresList && Array.isArray(riskScoresList)) {
      for (const r of riskScoresList) {
        if (r && r.client_id) {
          riskMap.set(r.client_id, Number(r.score) || 0)
        }
      }
    }

    const contractNumberMap = new Map<string, string>()
    if (contractsList && Array.isArray(contractsList)) {
      for (const c of contractsList) {
        if (c && c.client_id && c.contract_number) {
          contractNumberMap.set(c.client_id, c.contract_number)
        }
      }
    }

    const metaMap = new Map<string, any>()
    if (metadataList && Array.isArray(metadataList)) {
      for (const m of metadataList) {
        if (m && m.contract_number) {
          metaMap.set(m.contract_number, m)
        }
      }
    }

    // 5. Merge data into enriched clients
    const enrichedClients = clientsList.map((client: any) => {
      const score = riskMap.get(client.id) ?? 54.0
      const contractNumber = contractNumberMap.get(client.id)
      const meta = contractNumber ? metaMap.get(contractNumber) : null
      
      return {
        ...client,
        riskScore: score,
        clientRegion: meta?.client_region || 'Sem regiao',
        collectionStatus: meta?.collection_status || 'Sem status'
      }
    })

    return NextResponse.json(enrichedClients)

  } catch (error: any) {
    console.error('Failed in clients API:', error)
    return NextResponse.json({
      error: 'Clients API failed',
      message: error.message || String(error)
    }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!db.isMock()) {
      const user = await getAuthedUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const { name, email, cpf, phone } = body

    const created = await db.clients.create({
      name: name || '',
      email: email || '',
      cpf: cpf || '',
      phone: phone || ''
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create client:', error)
    return NextResponse.json({
      error: 'Failed to create client',
      message: error.message || String(error)
    }, { status: 500 })
  }
}
