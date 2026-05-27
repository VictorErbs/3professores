#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')
const { createClient } = require('@supabase/supabase-js')
const { randomUUID } = require('crypto')

const CSV_FILE = 'assets/cobranca_assessorias.csv'
const INSTALLMENTS_PER_CONTRACT = 6

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

  const csvPath = path.join(process.cwd(), CSV_FILE)
  if (!fs.existsSync(csvPath)) throw new Error(`Arquivo ausente: ${csvPath}`)

  const csvText = fs.readFileSync(csvPath, 'utf8')
  const cobrancaRows = parse(csvText, { columns: true, skip_empty_lines: true, bom: true })

  console.log(`CSV cobrança: ${cobrancaRows.length} linhas`)

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
  const statsByContract = new Map()
  const now = new Date()

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
    const sentDate = toDate(row.Data_Envio_Assessoria)
    const daysOverdue = toNumber(row.Dias_Em_Atraso_Inicial) || 0
    const overdueAmount = toNumber(row.Valor_Inadimplente_Inicial) || 0
    const riskScore = clampNumber(row.Score_Interno_Risco)

    contractMetadataByNumber.set(contractNumber, {
      contract_number: contractNumber,
      advisory_name: advisoryName,
      collection_status: collectionStatus,
      client_region: clientRegion,
      contemplated_indicator: null,
      payment_method: null,
    })

    const stats = { overdueCount: 0, overdueAmount: 0, maxDaysOverdue: 0 }
    const monthlyAmount = Math.round((overdueAmount / INSTALLMENTS_PER_CONTRACT) * 100) / 100

    const baseDate = sentDate ? new Date(sentDate) : new Date(now)
    const firstDueDate = baseDate

    for (let i = 0; i < INSTALLMENTS_PER_CONTRACT; i++) {
      const dueDate = new Date(firstDueDate)
      dueDate.setMonth(dueDate.getMonth() + i)

      let status = 'pending'
      if (i === 0 && daysOverdue > 0 && dueDate < now) {
        status = 'overdue'
        stats.overdueCount += 1
        stats.overdueAmount += monthlyAmount
        stats.maxDaysOverdue = Math.max(stats.maxDaysOverdue, daysOverdue)
      }

      installments.push({
        id: randomUUID(),
        contract_id: contractId,
        installment_number: i + 1,
        due_date: dueDate.toISOString().slice(0, 10),
        amount: monthlyAmount,
        status
      })
    }

    statsByContract.set(contractNumber, stats)

    const score = riskScore !== null
      ? riskScore
      : Math.min(100, Math.round(stats.overdueCount * 20 + stats.maxDaysOverdue * 0.4))

    riskScores.push({
      client_id: clientId,
      score,
      model: 'csv_real_v1'
    })

    if (stats.overdueCount > 0) {
      alerts.push({
        client_id: clientId,
        contract_id: contractId,
        severity: stats.maxDaysOverdue >= 90 ? 'critical' : 'medium',
        message: `Contrato ${contractNumber}: ${stats.overdueCount} parcela(s) em atraso, max ${stats.maxDaysOverdue} dias, total R$ ${Math.round(stats.overdueAmount).toLocaleString('pt-BR')}`
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
