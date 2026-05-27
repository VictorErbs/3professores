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
    const installmentId = String(body.installmentId || '')
    const amount = Number(body.amount || 0)

    if (!installmentId) {
      return NextResponse.json({ error: 'Missing installmentId' }, { status: 400 })
    }

    const updated = await db.installments.updateStatus(installmentId, 'paid')
    if (!updated) {
      return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
    }

    await db.payments.create({
      installment_id: installmentId,
      paid_at: new Date().toISOString(),
      amount: amount > 0 ? amount : updated.amount,
      method: 'Manual'
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to pay installment' }, { status: 500 })
  }
}
