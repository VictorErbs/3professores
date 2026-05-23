#!/usr/bin/env node
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

// Load optional mapping file from argv or env
const mappingPath = process.argv[2] || process.env.MAPPING_FILE
let mapping = null
if (mappingPath) {
  try {
    const content = fs.readFileSync(mappingPath, 'utf8')
    mapping = JSON.parse(content)
    console.log('Loaded mapping from', mappingPath)
  } catch (err) {
    console.warn('Could not load mapping file:', mappingPath, err.message)
    mapping = null
  }
}

function getField(raw, field, ...alternatives) {
  if (!raw) return null
  if (mapping && mapping[field]) {
    return raw[mapping[field]] ?? null
  }
  for (const a of alternatives) {
    if (raw[a] !== undefined && raw[a] !== null && String(raw[a]).trim() !== '') return raw[a]
  }
  return raw[field] ?? null
}

function extractCPF(s) {
  if (!s) return null
  const digits = String(s).replace(/\D/g, '')
  return digits.length === 11 ? digits : null
}

function extractEmail(s) {
  if (!s) return null
  const str = String(s).trim()
  return /\S+@\S+\.\S+/.test(str) ? str : null
}

function extractDate(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function extractNumber(v) {
  if (v == null) return null
  const n = Number(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

async function upsertClient(supabase, raw) {
  const cpf = extractCPF(getField(raw, 'cpf', 'CPF', 'cpf_cnpj', 'documento'))
  const email = extractEmail(getField(raw, 'email', 'Email'))
  const name = getField(raw, 'name', 'nome', 'client', 'Client') || ''
  // Try to find by cpf first, then email
  if (cpf) {
    const { data } = await supabase.from('clients').select('*').eq('cpf', cpf).maybeSingle()
    if (data) return data.id
  }
  if (email) {
    const { data } = await supabase.from('clients').select('*').eq('email', email).maybeSingle()
    if (data) return data.id
  }

  const insert = {
    name: String(name || '').slice(0, 255),
    email: email || '',
    cpf: cpf || '',
    phone: getField(raw, 'phone', 'phone', 'telefone') || ''
  }
  const { data, error } = await supabase.from('clients').insert(insert).select('id').single()
  if (error) throw error
  return data.id
}

async function findOrCreateContract(supabase, clientId, raw) {
  const contractNumber = getField(raw, 'contract_number', 'contrato', 'contract', 'Contract')
  if (contractNumber) {
    const { data } = await supabase.from('contracts').select('*').eq('contract_number', contractNumber).maybeSingle()
    if (data) return data.id
  }
  const insert = {
    client_id: clientId,
    contract_number: contractNumber || null,
    start_date: extractDate(getField(raw, 'start_date', 'data_inicio', 'StartDate')),
    end_date: extractDate(getField(raw, 'end_date', 'data_fim', 'EndDate')),
    total_value: extractNumber(getField(raw, 'total_value', 'valor_total', 'Total'))
  }
  const { data, error } = await supabase.from('contracts').insert(insert).select('id').single()
  if (error) throw error
  return data.id
}

async function createInstallment(supabase, contractId, raw) {
  const insert = {
    contract_id: contractId,
    installment_number: getField(raw, 'installment_number', 'installment_number') ? Number(getField(raw, 'installment_number', 'installment_number')) : null,
    due_date: extractDate(getField(raw, 'due_date', 'vencimento', 'DueDate')),
    amount: extractNumber(getField(raw, 'amount', 'valor', 'Amount')),
    status: getField(raw, 'status') || 'pending'
  }

  const { data, error } = await supabase.from('installments').insert(insert).select('id').single()
  if (error) throw error
  return data.id
}

async function createPayment(supabase, installmentId, raw) {
  const paidAt = getField(raw, 'paid_at', 'data_pagamento', 'paidDate')
  const insert = {
    installment_id: installmentId,
    paid_at: paidAt ? new Date(paidAt).toISOString() : null,
    amount: extractNumber(getField(raw, 'paid_amount', 'amount_paid', 'amount'))
  }
  const { data, error } = await supabase.from('payments').insert(insert).select('id').single()
  if (error) throw error
  return data.id
}

async function processStagingTable(supabase, table) {
  const { data: rows } = await supabase.from(table).select('*').eq('processed', false).order('imported_at', { ascending: true })
  if (!rows || rows.length === 0) {
    console.log(`No rows to process in ${table}`)
    return
  }

  console.log(`Processing ${rows.length} rows from ${table}`)

  for (const row of rows) {
    try {
      const raw = row.raw || {}
      const clientId = await upsertClient(supabase, raw)
      const contractId = await findOrCreateContract(supabase, clientId, raw)
      const installmentId = await createInstallment(supabase, contractId, raw)
      if (raw.paid_at || raw.paidDate || raw.data_pagamento) {
        await createPayment(supabase, installmentId, raw)
      }

      // Optional: compute a naive risk score (example)
      if (clientId) {
        const delays = getField(raw, 'delays')
        const score = delays ? Math.min(100, Number(delays) * 10) : 50
        await supabase.from('risk_scores').insert({ client_id: clientId, score, model: 'heuristic_v1' })
      }

      await supabase.from(table).update({ processed: true }).eq('id', row.id)
    } catch (err) {
      console.error('Error processing row', row.id, err.message || err)
      // don't halt; mark as processed=false for later inspection
    }
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })

  await processStagingTable(supabase, 'staging_csv1')
  await processStagingTable(supabase, 'staging_csv2')

  console.log('Normalization completed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
