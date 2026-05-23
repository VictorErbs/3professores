import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Manual CSV parser to avoid Next.js 16 / Turbopack build import errors
function parseCSV(text: string): any[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length === 0) return []
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
  
  const ALLOWED_HEADERS = new Set([
    'cpf', 'CPF', 'documento', 'cpf_cnpj',
    'email', 'Email',
    'name', 'nome', 'client', 'Client',
    'phone', 'telefone', 'Phone',
    'contract_number', 'contrato', 'contract', 'Contract',
    'total_value', 'valor_total', 'valor', 'Total',
    'start_date', 'data_inicio', 'StartDate',
    'end_date', 'data_fim', 'EndDate',
    'installment_number', 'parcela', 'installment',
    'due_date', 'vencimento', 'DueDate',
    'installment_amount', 'valor_parcela', 'amount', 'Amount',
    'status',
    'paid_at', 'data_pagamento', 'paidDate',
    'paid_amount', 'amount_paid', 'valor_pago',
    'method', 'forma_pagamento'
  ])

  const records = []
  for (let i = 1; i < lines.length; i++) {
    const lineStr = lines.at(i)
    if (!lineStr) continue
    const currentline = lineStr.split(',')
    if (currentline.length === 0) continue
    
    const obj = Object.create(null)
    for (let j = 0; j < headers.length; j++) {
      const headerKey = headers.at(j)
      if (!headerKey || !ALLOWED_HEADERS.has(headerKey)) continue
      
      const rawVal = currentline.at(j)
      let val = rawVal ? rawVal.trim() : ''
      val = val.replace(/^["']|["']$/g, '')
      
      Reflect.set(obj, headerKey, val)
    }
    records.push(obj)
  }
  return records
}

// Helper functions for parsing
function extractCPF(s: any): string {
  if (!s) return ''
  const digits = String(s).replace(/\D/g, '')
  return digits.length === 11 ? digits : ''
}

function extractEmail(s: any): string {
  if (!s) return ''
  const str = String(s).trim()
  return /\S+@\S+\.\S+/.test(str) ? str : ''
}

function extractDate(v: any): string {
  if (!v) return new Date().toISOString().split('T')[0]
  const d = new Date(v)
  return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
}

function extractNumber(v: any): number {
  if (v == null) return 0
  const n = Number(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export async function POST(req: Request) {
  try {
    const { csvText, targetTable } = await req.json()

    if (!csvText) {
      return NextResponse.json({ error: 'Missing csvText content' }, { status: 400 })
    }

    // Parse the CSV records
    const records = parseCSV(csvText)

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty or has no header row' }, { status: 400 })
    }

    console.log(`Received import request for ${records.length} rows`)

    let importedCount = 0
    let errorsCount = 0

    // Fetch existing clients to avoid duplicates
    const existingClients = await db.clients.list()
    const existingContracts = await db.contracts.list()

    for (const row of records) {
      try {
        // Extract client fields
        const rawCPF = row.cpf || row.CPF || row.documento || row.cpf_cnpj || ''
        const rawEmail = row.email || row.Email || ''
        const rawName = row.name || row.nome || row.client || row.Client || 'Cliente Sem Nome'
        const rawPhone = row.phone || row.telefone || row.Phone || ''

        const cpf = extractCPF(rawCPF)
        const email = extractEmail(rawEmail)

        // Find or create client
        let clientId = ''
        if (cpf) {
          const match = existingClients.find(c => c.cpf === cpf)
          if (match) clientId = match.id
        }
        if (!clientId && email) {
          const match = existingClients.find(c => c.email === email)
          if (match) clientId = match.id
        }

        if (!clientId) {
          const newClient = await db.clients.create({
            name: rawName,
            email,
            cpf,
            phone: rawPhone
          })
          clientId = newClient.id
          // Add to local checklist to avoid duplicates in subsequent rows of same CSV
          existingClients.push(newClient)
        }

        // Extract contract fields
        const rawContractNumber = row.contract_number || row.contrato || row.contract || row.Contract || ''
        const rawTotalValue = row.total_value || row.valor_total || row.valor || row.Total || 0
        const rawStartDate = row.start_date || row.data_inicio || row.StartDate || ''
        const rawEndDate = row.end_date || row.data_fim || row.EndDate || ''

        const totalValue = extractNumber(rawTotalValue)
        const contractNumber = String(rawContractNumber || `CNS-${100000 + Math.floor(Math.random() * 900000)}`)

        // Find or create contract
        let contractId = ''
        if (contractNumber) {
          const match = existingContracts.find(c => c.contract_number === contractNumber)
          if (match) contractId = match.id
        }

        if (!contractId) {
          const newContract = await db.contracts.create({
            client_id: clientId,
            contract_number: contractNumber,
            total_value: totalValue,
            start_date: extractDate(rawStartDate),
            end_date: extractDate(rawEndDate)
          })
          contractId = newContract.id
          existingContracts.push(newContract)
        }

        // Extract installment fields
        const rawInstNumber = row.installment_number || row.parcela || row.installment || 1
        const rawDueDate = row.due_date || row.vencimento || row.DueDate || ''
        const rawInstAmount = row.installment_amount || row.valor_parcela || row.amount || row.Amount || (totalValue / 24)
        const rawStatus = row.status || 'pending'

        const installmentNumber = Number(rawInstNumber)
        const dueDateStr = extractDate(rawDueDate)
        const amount = extractNumber(rawInstAmount)
        
        let status: 'pending' | 'paid' | 'overdue' = 'pending'
        const dueDate = new Date(dueDateStr)
        const today = new Date()

        if (rawStatus === 'paid' || rawStatus === 'pago') {
          status = 'paid'
        } else if (dueDate < today) {
          status = 'overdue'
        } else {
          status = 'pending'
        }

        const installment = await db.installments.create({
          contract_id: contractId,
          installment_number: installmentNumber,
          due_date: dueDateStr,
          amount,
          status
        })

        // Extract payment fields if paid
        const rawPaidAt = row.paid_at || row.data_pagamento || row.paidDate || ''
        const rawPaidAmount = row.paid_amount || row.amount_paid || row.valor_pago || amount

        if (status === 'paid' || rawPaidAt) {
          await db.payments.create({
            installment_id: installment.id,
            paid_at: rawPaidAt ? new Date(rawPaidAt).toISOString() : new Date().toISOString(),
            amount: extractNumber(rawPaidAmount),
            method: row.method || row.forma_pagamento || 'Pix'
          })
        }

        importedCount++
      } catch (err) {
        console.error('Row import error:', err)
        errorsCount++
      }
    }

    // Refresh all risk scores automatically for the newly imported/updated clients!
    const clientsToRefresh = await db.clients.list()
    for (const c of clientsToRefresh) {
      try {
        // Trigger a background risk calculation by calling internal routine logic
        // We can inline a call to predict API calculations or just run it.
        const contracts = await db.contracts.getByClient(c.id)
        const contractIds = contracts.map(con => con.id)
        const allInstallments = await db.installments.list()
        const clientInstallments = allInstallments.filter(inst => contractIds.includes(inst.contract_id))
        const overdueInstallments = clientInstallments.filter(inst => inst.status === 'overdue')
        
        let score = 15
        if (clientInstallments.length === 0) {
          score = 0
        } else if (overdueInstallments.length > 0) {
          score = 30 + (overdueInstallments.length * 20)
        }
        score = Math.min(100, Math.max(0, Math.round(score)))
        
        await db.risk_scores.create({
          client_id: c.id,
          score,
          model: 'heuristic_v1'
        })
      } catch (e) {
        // ignore predict refresh failures
      }
    }

    return NextResponse.json({
      success: true,
      message: `CSV import completed successfully.`,
      importedRows: importedCount,
      failedRows: errorsCount
    })

  } catch (error: any) {
    console.error('Failed to import CSV:', error)
    return NextResponse.json({
      error: 'Failed to process CSV file',
      message: error.message || String(error)
    }, { status: 500 })
  }
}
