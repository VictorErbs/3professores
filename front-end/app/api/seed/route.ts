import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
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
