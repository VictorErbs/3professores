import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    if (!db.isMock()) {
      const user = await getAuthedUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const { contractNumber, clientId, type } = body

    if (!contractNumber || !clientId || !type) {
      return NextResponse.json({ error: 'Missing contractNumber, clientId or type parameter' }, { status: 400 })
    }

    // Verify type
    if (!['Sorteio', 'Lance', 'Nao contemplado'].includes(type)) {
      return NextResponse.json({ error: 'Invalid contemplation type' }, { status: 400 })
    }

    if (db.isMock()) {
      return NextResponse.json({ success: true, mock: true })
    }

    // Connect to Supabase and update contract_metadata
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && supabaseServiceRoleKey) {
      const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
      
      const val = type === 'Nao contemplado' ? null : type
      const { error } = await supabase
        .from('contract_metadata')
        .upsert({
          contract_number: contractNumber,
          contemplated_indicator: val
        }, { onConflict: 'contract_number' })

      if (error) {
        throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to register contemplation:', error)
    return NextResponse.json({
      error: 'Contemplation registration failed',
      message: error.message || String(error)
    }, { status: 500 })
  }
}
