#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const [, , csvPath, stagingTable] = process.argv

  if (!csvPath || !stagingTable) {
    console.error('Usage: node import_csv.js <csvPath> <staging_table>')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const basePath = path.normalize(process.cwd())
  const safeFilename = path.basename(csvPath)
  const absolutePath = path.normalize(path.join(basePath, safeFilename))
  if (!absolutePath.startsWith(basePath)) {
    console.error('Invalid path specified! File must be inside the working directory.')
    process.exit(1)
  }
  if (!fs.existsSync(absolutePath)) {
    console.error('CSV file not found:', absolutePath)
    process.exit(1)
  }

  const raw = fs.readFileSync(absolutePath, 'utf8')
  const records = parse(raw, { columns: true, skip_empty_lines: true })

  console.log(`Parsed ${records.length} rows from ${csvPath}`)

  // Prepare rows for insertion: each row will be stored as { raw: <object>, row_num }
  const rows = records.map((r, i) => ({ raw: r, row_num: i + 1 }))

  // Insert in batches
  const batchSize = 500
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    const { error } = await supabase.from(stagingTable).insert(chunk)
    if (error) {
      console.error('Error inserting chunk:', error)
      process.exit(1)
    }
    console.log(`Inserted rows ${i + 1}-${i + chunk.length}`)
  }

  console.log('Import completed into', stagingTable)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
