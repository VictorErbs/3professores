#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')
const { createClient } = require('@supabase/supabase-js')
const { randomUUID } = require('crypto')

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const match = line.match(/^\s*([\w_]+)=(.*)$/)
    if (match) {
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[match[1]]) {
        process.env[match[1]] = value
      }
    }
  }
}

const CSV_FILE = 'assets/cobranca_assessorias.csv'
const XLSX_FILE = 'assets/fluxo_pagamentos.xlsx'

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/\s/g, '').replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function clampNumber(value, min = 0, max = 100) {
  if (value === null || value === undefined) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, n))
}

function parseExcelDate(value) {
  if (value instanceof Date) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    return new Date(excelEpoch + value * 86400000)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (brMatch) {
      const day = Number(brMatch[1])
      const month = Number(brMatch[2]) - 1
      const year = Number(brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3])
      return new Date(Date.UTC(year, month, day))
    }
  }
  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function toDate(value) {
  if (!value) return null
  const d = parseExcelDate(value)
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
}

async function insertInBatches(supabase, table, rows, size = 500, options = {}) {
  const groups = chunk(rows, size)
  for (let i = 0; i < groups.length; i++) {
    const query = options.upsert
      ? supabase.from(table).upsert(groups[i], { onConflict: options.onConflict })
      : supabase.from(table).insert(groups[i])
    const { error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    console.log(`[${table}] lote ${i + 1}/${groups.length}`)
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })

  // ── 1. Read CSV ─────────────────────────────────────────────────────────
  const csvPath = path.join(process.cwd(), CSV_FILE)
  if (!fs.existsSync(csvPath)) throw new Error(`Arquivo ausente: ${csvPath}`)
  const csvText = fs.readFileSync(csvPath, 'utf8')
  const cobrancaRows = parse(csvText, { columns: true, skip_empty_lines: true, bom: true })
  console.log(`CSV cobranca: ${cobrancaRows.length} linhas`)

  // ── 2. Read XLSX ────────────────────────────────────────────────────────
  const xlsxPath = path.join(process.cwd(), XLSX_FILE)
  if (!fs.existsSync(xlsxPath)) throw new Error(`Arquivo ausente: ${xlsxPath}`)
  const XLSX = require('xlsx')
  const wb = XLSX.readFile(xlsxPath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const pagamentoRows = XLSX.utils.sheet_to_json(sheet, { defval: null })
  console.log(`XLSX pagamentos: ${pagamentoRows.length} linhas`)

  // ── 3. Build data structures ────────────────────────────────────────────
  const clients = []
  const contracts = []
  const installments = []
  const payments = []
  const riskScores = []
  const alerts = []
  const contractMetadata = []
  const contractMetadataByNumber = new Map()
  const sourceCobrancaRows = []
  const sourcePagamentoRows = []
  const installmentByKey = new Map() // "${contractNumber}|${installmentNum}" => installment object

  const processedContractIds = new Set()
  const clientByContract = new Map()
  const contractIdByNumber = new Map()
  const now = new Date()

  // ── 3a. Process CSV: create clients, contracts, contract_metadata ──────
  for (const row of cobrancaRows) {
    const contractNumber = String(row.ID_Contrato || '').trim()
    if (!contractNumber) continue
    if (processedContractIds.has(contractNumber)) continue
    processedContractIds.add(contractNumber)

    const syntheticCpf = contractNumber.replace(/\D/g, '').slice(-11).padStart(11, '0')
    const safeContractNumber = contractNumber.replace(/[^a-zA-Z0-9]/g, '')
    const clientId = randomUUID()
    const contractId = randomUUID()
    clientByContract.set(contractNumber, clientId)
    contractIdByNumber.set(contractNumber, contractId)

    clients.push({
      id: clientId,
      name: contractNumber,
      email: `cliente.${safeContractNumber.toLowerCase()}@creditguard.local`,
      cpf: syntheticCpf,
      phone: ''
    })

    contracts.push({
      id: contractId,
      client_id: clientId,
      contract_number: contractNumber,
      start_date: null,
      end_date: null,
      total_value: null
    })

    const collectionStatus = row.Status_Cobranca ? String(row.Status_Cobranca).trim() : null
    const clientRegion = row.Regiao_Cliente ? String(row.Regiao_Cliente).trim() : null
    const advisoryName = row.Nome_Assessoria ? String(row.Nome_Assessoria).trim() : null
    const riskScore = clampNumber(row.Score_Interno_Risco)

    contractMetadataByNumber.set(contractNumber, {
      contract_number: contractNumber,
      advisory_name: advisoryName,
      collection_status: collectionStatus,
      client_region: clientRegion,
      contemplated_indicator: null,
      payment_method: null,
    })

    sourceCobrancaRows.push({ raw: row })
  }

  // ── 3b. Process XLSX: create installments, payments, update metadata ───
  // Track which (contract, parcel) combos we've handled
  const handledParcel = new Set()

  for (const row of pagamentoRows) {
    const contractNumber = String(row.ID_Contrato || '').trim()
    if (!contractNumber || !processedContractIds.has(contractNumber)) continue

    const parcelNum = Number(row.Numero_Parcela)
    if (!Number.isFinite(parcelNum)) continue

    const installmentKey = `${contractNumber}|${parcelNum}`
    const dataPagamento = toDate(row.Data_Pagamento)
    const valorPago = toNumber(row.Valor_Pago)
    const valorParcela = toNumber(row.Valor_Parcela)

    // Update contract metadata (only first occurrence per contract)
    const meta = contractMetadataByNumber.get(contractNumber)
    if (meta) {
      if (row.Forma_Pagamento && !meta.payment_method) {
        meta.payment_method = String(row.Forma_Pagamento).trim()
      }
      if (row.Indicador_Contemplado && !meta.contemplated_indicator) {
        meta.contemplated_indicator = String(row.Indicador_Contemplado).trim()
      }
    }

    // Create or find installment
    let inst = installmentByKey.get(installmentKey)
    if (!inst) {
      if (handledParcel.has(installmentKey)) continue // skip duplicates

      const dueDate = toDate(row.Data_Vencimento)
      if (!dueDate) continue

      const contractId = contractIdByNumber.get(contractNumber)
      if (!contractId) continue

      inst = {
        id: randomUUID(),
        contract_id: contractId,
        installment_number: parcelNum,
        due_date: dueDate,
        amount: valorParcela || 0,
        status: 'pending'
      }
      installmentByKey.set(installmentKey, inst)
      installments.push(inst)
    }

    // Create payment if there's a paid date
    if (dataPagamento && valorPago !== null && valorPago > 0) {
      // Update installment status to paid
      inst.status = 'paid'

      const payment = {
        id: randomUUID(),
        installment_id: inst.id,
        paid_at: dataPagamento,
        amount: valorPago,
        method: row.Forma_Pagamento || null,
        created_at: new Date().toISOString()
      }

      // Check for duplicate payment (same installment, same date, same amount)
      const isDuplicate = payments.some(p =>
        p.installment_id === payment.installment_id &&
        p.paid_at === payment.paid_at &&
        Math.abs(p.amount - payment.amount) < 0.01
      )
      if (!isDuplicate) {
        payments.push(payment)
      }
    }

    handledParcel.add(installmentKey)
    sourcePagamentoRows.push({ raw: row })
  }

  console.log(`Clientes: ${clients.length}`)
  console.log(`Contratos: ${contracts.length}`)
  console.log(`Parcelas (sinteticas + XLSX): ${installments.length}`)
  console.log(`Pagamentos (XLSX): ${payments.length}`)

  // ── 3c. Compute risk scores and alerts ──────────────────────────────────
  const today = new Date()
  for (const contract of contracts) {
    const contractInsts = installments.filter(i => i.contract_id === contract.id)
    const overdueInsts = contractInsts.filter(i => i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_date) < today))
    const overdueCount = overdueInsts.length
    const overdueAmount = overdueInsts.reduce((acc, i) => acc + i.amount, 0)
    const maxDaysOverdue = overdueInsts.reduce((acc, i) => {
      const days = Math.floor((today - new Date(i.due_date)) / (1000 * 60 * 60 * 24))
      return Math.max(acc, days)
    }, 0)

    // Use CSV risk score if available, else compute heuristic
    const csvRow = cobrancaRows.find(r => r.ID_Contrato === contract.contract_number)
    const csvRiskScore = csvRow ? clampNumber(csvRow.Score_Interno_Risco) : null
    const score = csvRiskScore !== null
      ? csvRiskScore
      : Math.min(100, Math.round(overdueCount * 18 + maxDaysOverdue * 0.35))

    riskScores.push({
      client_id: contract.client_id,
      score,
      model: 'real_data_v1'
    })

    if (overdueCount > 0) {
      alerts.push({
        client_id: contract.client_id,
        contract_id: contract.id,
        severity: maxDaysOverdue >= 90 ? 'critical' : 'medium',
        message: `Contrato ${contract.contract_number}: ${overdueCount} parcela(s) em atraso, max ${maxDaysOverdue} dias, total R$ ${Math.round(overdueAmount).toLocaleString('pt-BR')}`
      })
    }
  }

  // Mark installments that are past due and not paid as 'overdue'
  for (const inst of installments) {
    if (inst.status === 'pending' && new Date(inst.due_date) < today) {
      inst.status = 'overdue'
    }
  }

  console.log(`Scores de risco: ${riskScores.length}`)
  console.log(`Alertas: ${alerts.length}`)

  // ── 4. Truncate existing data via RPC (empty arrays = truncate only) ─────
  const { error: resetError } = await supabase.rpc('creditguard_reset_and_load', {
    p_clients: [],
    p_contracts: [],
    p_installments: [],
    p_payments: [],
    p_risk_scores: [],
    p_alerts: [],
    p_cobrancas: [],
    p_pagamentos: []
  })

  if (resetError) {
    throw new Error(`RPC creditguard_reset_and_load falhou: ${resetError.message}`)
  }

  // ── 5. Insert all data via batches ──────────────────────────────────────
  if (sourceCobrancaRows.length > 0) {
    await insertInBatches(supabase, 'source_cobranca_assessorias', sourceCobrancaRows, 500)
  }
  if (sourcePagamentoRows.length > 0) {
    await insertInBatches(supabase, 'source_fluxo_pagamentos', sourcePagamentoRows, 500)
  }
  if (clients.length > 0) {
    await insertInBatches(supabase, 'clients', clients, 500)
  }
  if (contracts.length > 0) {
    await insertInBatches(supabase, 'contracts', contracts, 500)
  }
  if (installments.length > 0) {
    await insertInBatches(supabase, 'installments', installments, 500)
  }
  if (payments.length > 0) {
    await insertInBatches(supabase, 'payments', payments, 500)
  }
  const filteredRisk = riskScores.filter(r => r.client_id)
  if (filteredRisk.length > 0) {
    await insertInBatches(supabase, 'risk_scores', filteredRisk, 500)
  }
  const filteredAlerts = alerts.filter(a => a.client_id && a.contract_id)
  if (filteredAlerts.length > 0) {
    await insertInBatches(supabase, 'alerts', filteredAlerts, 500)
  }

  // ── 6. Insert contract_metadata (upsert) ────────────────────────────────
  const metaArray = Array.from(contractMetadataByNumber.values())
  if (metaArray.length > 0) {
    await insertInBatches(supabase, 'contract_metadata', metaArray, 500, {
      upsert: true,
      onConflict: 'contract_number'
    })
  }

  console.log('Carga finalizada com sucesso.')
  console.log(`  - source_cobranca_assessorias: ${sourceCobrancaRows.length}`)
  console.log(`  - source_fluxo_pagamentos: ${sourcePagamentoRows.length}`)
  console.log(`  - clientes: ${clients.length}`)
  console.log(`  - contratos: ${contracts.length}`)
  console.log(`  - parcelas: ${installments.length}`)
  console.log(`  - pagamentos: ${payments.length}`)
  console.log(`  - scores: ${riskScores.length}`)
  console.log(`  - alertas: ${alerts.length}`)
  console.log(`  - metadados: ${metaArray.length}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
