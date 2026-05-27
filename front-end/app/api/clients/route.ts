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
        'Range': '0-9999',
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
        return NextResponse.json({ ...client, contracts, installments: clientInstallments })
      }

      // Direct REST for Supabase mode
      const [clientArr, contracts] = await Promise.all([
        supabaseGet('clients', { id: `eq.${id}`, select: '*' }),
        supabaseGet('contracts', { client_id: `eq.${id}`, select: '*' }),
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
      return NextResponse.json({ ...client, contracts: contracts || [], installments })
    }

    // List all clients (with optional server-side search)
    if (db.isMock()) {
      const clientsList = await db.clients.list()
      return NextResponse.json(clientsList)
    }

    const search = url.searchParams.get('search')?.trim()

    // Direct REST: list all clients ordered by name
    let supabaseUrl = `${SUPABASE_URL}/rest/v1/clients?select=*&order=name.asc`
    if (search) {
      const escaped = search.replace(/[%_]/g, '\\$&')
      supabaseUrl += `&or=(name.ilike.*${encodeURIComponent(escaped)}*,email.ilike.*${encodeURIComponent(escaped)}*,cpf.ilike.*${encodeURIComponent(escaped)}*)`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    let clientsList
    try {
      const res = await fetch(supabaseUrl, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
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
      clientsList = await res.json()
    } finally {
      clearTimeout(timer)
    }
    return NextResponse.json(clientsList || [])

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
