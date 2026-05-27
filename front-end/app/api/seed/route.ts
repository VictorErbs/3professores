import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth'

export async function GET() {
  try {
    // Seeding is a dev-only tool; require auth in Supabase mode.
    if (!db.isMock()) {
      const user = await getAuthedUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const result = await db.seed(true) // force seed
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('Failed to seed database:', error)
    return NextResponse.json({
      error: 'Failed to seed database',
      message: error.message || String(error)
    }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
