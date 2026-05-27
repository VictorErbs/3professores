import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth'

// Lightweight health endpoint used by the UI.
// Intentionally does not require auth.
export async function GET() {
  const user = await getAuthedUser()
  return NextResponse.json({
    dbMode: db.isMock() ? 'mock' : 'supabase',
    authed: !!user,
  })
}
