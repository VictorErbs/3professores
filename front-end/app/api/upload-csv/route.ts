import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { db } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth'

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function POST(req: Request) {
  try {
    if (!db.isMock()) {
      const user = await getAuthedUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { csvText, stagingTable } = await req.json()
    const target = String(stagingTable || 'staging_csv1')
    if (target !== 'staging_csv1' && target !== 'staging_csv2') {
      return NextResponse.json({ error: 'Invalid stagingTable' }, { status: 400 })
    }

    const text = String(csvText || '').trim()
    if (!text) return NextResponse.json({ error: 'Empty csvText' }, { status: 400 })

    // Parse records as JSON objects.
    const records = parse(text, { columns: true, skip_empty_lines: true, bom: true }) as Record<string, unknown>[]
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No records found' }, { status: 400 })
    }

    // In mock mode, we don't persist staging; just return the parsed count.
    if (db.isMock()) {
      return NextResponse.json({ success: true, inserted: records.length, mode: 'mock' })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })

    const rows = records.map((raw, idx) => ({ raw, row_num: idx + 1 }))
    const batches = chunk(rows, 500)
    for (const group of batches) {
      const { error } = await supabase.from(target).insert(group)
      if (error) throw error
    }

    return NextResponse.json({ success: true, inserted: records.length, mode: 'supabase', stagingTable: target })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Upload CSV failed',
      message: error.message || String(error),
    }, { status: 500 })
  }
}
