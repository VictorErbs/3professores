import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { alertId } = await req.json()
    if (!alertId) {
      return NextResponse.json({ error: 'Missing alertId' }, { status: 400 })
    }

    const updated = await db.alerts.resolve(alertId)
    return NextResponse.json({ success: true, alert: updated })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to resolve alert',
      message: error.message || String(error)
    }, { status: 500 })
  }
}
