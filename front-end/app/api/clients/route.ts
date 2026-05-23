import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    // Auto-seed if database is empty
    await db.seed()

    if (id) {
      const client = await db.clients.get(id)
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      // Fetch contracts and installments
      const contracts = await db.contracts.getByClient(id)
      const contractIds = contracts.map(c => c.id)

      const allInstallments = await db.installments.list()
      const clientInstallments = allInstallments.filter(inst => contractIds.includes(inst.contract_id))

      // Return unified profile
      return NextResponse.json({
        ...client,
        contracts,
        installments: clientInstallments
      })
    }

    // List all clients
    const clientsList = await db.clients.list()
    return NextResponse.json(clientsList)

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
