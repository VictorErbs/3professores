#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
const { randomUUID } = require('crypto')

const XLSX_FILE = 'assets/fluxo_pagamentos.xlsx'
const CSV_FILE = 'assets/cobranca_assessorias.csv'

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/\s/g, '').replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
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

  const xlsxPath = path.join(process.cwd(), XLSX_FILE)
  const csvPath = path.join(process.cwd(), CSV_FILE)
  if (!fs.existsSync(xlsxPath)) throw new Error(`Arquivo ausente: ${xlsxPath}`)
  if (!fs.existsSync(csvPath)) throw new Error(`Arquivo ausente: ${csvPath}`)

  const csvText = fs.readFileSync(csvPath, 'utf8')
  const cobrancaRows = parse(csvText, { columns: true, skip_empty_lines: true, bom: true })
  const workbook = XLSX.readFile(xlsxPath)
  const pagamentoRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null })

  console.log(`CSV cobrança: ${cobrancaRows.length} linhas`)
  console.log(`XLSX pagamentos: ${pagamentoRows.length} linhas`)

  const csvByContract = new Map()
  for (const row of cobrancaRows) {
    const contractNumber = String(row.ID_Contrato || '').trim()
    if (!contractNumber) continue
    csvByContract.set(contractNumber, row)
  }

  const clients = []
  const contracts = []
  const installments = []
  const payments = []
  const riskScores = []
  const alerts = []
  const contractMetadata = []
  const contractMetadataByNumber = new Map()

  const processedContractIds = new Set()
  const clientByContract = new Map()
  const contractIdByNumber = new Map()
  const installmentIdByKey = new Map()
  const statsByContract = new Map()
  const now = new Date()

  for (const row of pagamentoRows) {
    const contractNumber = String(row.ID_Contrato || '').trim()
    if (!contractNumber) continue
    const installmentNumber = Number(row.Numero_Parcela || 0)
    const dueDate = toDate(row.Data_Vencimento)
    const paidDate = toDate(row.Data_Pagamento)
    const amount = toNumber(row.Valor_Parcela || row.ValorParcela) || 0
    const paidAmount = toNumber(row.Valor_Pago || row.Valor_Pagma || row.Valor_Pagamento)
    const paymentMethod = row.Forma_Pagamento || row.FormaPagamento || null

    let status = 'pending'
    if (paidDate) {
      status = 'paid'
    } else if (dueDate && new Date(dueDate) < now) {
      status = 'overdue'
    }

    if (!processedContractIds.has(contractNumber)) {
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

      statsByContract.set(contractNumber, { overdueCount: 0, overdueAmount: 0, maxDaysOverdue: 0 })

      const csv = csvByContract.get(contractNumber)
      const metadataRow = {
        contract_number: contractNumber,
        advisory_name: csv ? String(csv.Nome_Assessoria || '').trim() : null,
        collection_status: csv ? String(csv.Status_Cobranca || '').trim() : null,
        client_region: csv ? String(csv.Regiao_Cliente || '').trim() : null,
        contemplated_indicator: row.Indicador_Contemplado ? String(row.Indicador_Contemplado).trim() : null,
        payment_method: paymentMethod ? String(paymentMethod).trim() : null,
      }
      contractMetadataByNumber.set(contractNumber, metadataRow)
    }

    const installmentKey = `${contractNumber}::${installmentNumber}`
    let installmentId = installmentIdByKey.get(installmentKey)
    if (!installmentId) {
      installmentId = randomUUID()
      installments.push({
        id: installmentId,
        contract_id: contractIdByNumber.get(contractNumber),
        installment_number: installmentNumber,
        due_date: dueDate,
        amount,
        status
      })
      installmentIdByKey.set(installmentKey, installmentId)

      if (status === 'overdue') {
        const stat = statsByContract.get(contractNumber)
        const days = dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86400000)) : 0
        stat.overdueCount += 1
        stat.overdueAmount += amount
        stat.maxDaysOverdue = Math.max(stat.maxDaysOverdue, days)
      }
    }

    if (paidDate) {
      payments.push({
        id: randomUUID(),
        installment_id: installmentId,
        paid_at: `${paidDate}T00:00:00.000Z`,
        amount: paidAmount ?? amount,
        method: paymentMethod ? String(paymentMethod) : null
      })
    }
  }

  for (const [contractNumber, stat] of statsByContract.entries()) {
    const score = Math.min(100, Math.round(stat.overdueCount * 18 + stat.maxDaysOverdue * 0.35))
    riskScores.push({
      client_id: clientByContract.get(contractNumber),
      score,
      model: 'xlsx_real_v1'
    })

    if (stat.overdueCount > 0) {
      alerts.push({
        client_id: clientByContract.get(contractNumber),
        contract_id: contractIdByNumber.get(contractNumber),
        severity: stat.maxDaysOverdue >= 90 ? 'critical' : 'medium',
        message: `Contrato ${contractNumber}: ${stat.overdueCount} parcela(s) em atraso, max ${stat.maxDaysOverdue} dias, total R$ ${Math.round(stat.overdueAmount).toLocaleString('pt-BR')}`
      })
    }
  }

  const filteredRisk = riskScores.filter((r) => r.client_id)
  const filteredAlerts = alerts.filter((a) => a.client_id && a.contract_id)

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

  await insertInBatches(supabase, 'source_cobranca_assessorias', [], 500)
  await insertInBatches(supabase, 'source_fluxo_pagamentos', pagamentoRows.map((raw) => ({ raw })), 500)
  await insertInBatches(supabase, 'source_cobranca_assessorias', cobrancaRows.map((raw) => ({ raw })), 500)
  for (const row of contractMetadataByNumber.values()) {
    contractMetadata.push(row)
  }
  await insertInBatches(supabase, 'contract_metadata', contractMetadata, 500, {
    upsert: true,
    onConflict: 'contract_number'
  })
  await insertInBatches(supabase, 'clients', clients, 500)
  await insertInBatches(supabase, 'contracts', contracts, 500)
  await insertInBatches(supabase, 'installments', installments, 500)
  await insertInBatches(supabase, 'payments', payments, 500)
  await insertInBatches(supabase, 'risk_scores', filteredRisk, 500)
  await insertInBatches(supabase, 'alerts', filteredAlerts, 500)

  console.log('Carga finalizada com sucesso.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
