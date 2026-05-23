import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Interface types matching database schema
export interface Client {
  id: string
  name: string
  email: string
  cpf: string
  phone: string
  created_at: string
}

export interface Contract {
  id: string
  client_id: string
  contract_number: string
  start_date: string
  end_date: string
  total_value: number
  created_at: string
}

export interface Installment {
  id: string
  contract_id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'pending' | 'paid' | 'overdue'
  created_at: string
}

export interface Payment {
  id: string
  installment_id: string
  paid_at: string | null
  amount: number
  method: string
  created_at: string
}

export interface RiskScore {
  id: string
  client_id: string
  score: number
  model: string
  computed_at: string
}

export interface Alert {
  id: string
  client_id: string
  contract_id: string | null
  severity: 'low' | 'medium' | 'critical'
  message: string
  created_at: string
  resolved: boolean
}

// Check Supabase env variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasSupabase = !!(supabaseUrl && supabaseServiceRoleKey)

console.log('=== [CreditGuard DB Initialize Log] ===')
console.log('Database Mode:', hasSupabase ? 'SUPABASE ACTIVE' : 'SIMULATED MOCK ACTIVE')
console.log('SUPABASE_URL:', supabaseUrl ? 'Set (' + supabaseUrl + ')' : 'NOT SET')
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? 'Set (Length: ' + supabaseServiceRoleKey.length + ')' : 'NOT SET')
console.log('=======================================')

const supabase = hasSupabase
  ? createSupabaseClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: { persistSession: false },
    })
  : null

// In-Memory Data Store for Mock Mode
interface MockStore {
  clients: Client[]
  contracts: Contract[]
  installments: Installment[]
  payments: Payment[]
  riskScores: RiskScore[]
  alerts: Alert[]
}

// Preserve state across Next.js dev hot-reloads using global
const globalStore = global as unknown as { __mockStore?: MockStore }

if (!globalStore.__mockStore) {
  globalStore.__mockStore = {
    clients: [],
    contracts: [],
    installments: [],
    payments: [],
    riskScores: [],
    alerts: [],
  }
}

const store = globalStore.__mockStore

// Utility to generate UUIDs in Mock Mode
function generateUUID(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Operational wrapper API
export const db = {
  isMock: () => !hasSupabase,

  seed: async (force = false) => {
    console.log('[db.seed] Starting DB seeding check...')
    // Check if seeding is already done or forced
    if (!force && db.isMock() && store.clients.length > 0) {
      console.log('[db.seed] Mock DB already seeded, skipping.')
      return { message: 'Already seeded (mock)', count: store.clients.length }
    }

    if (!db.isMock()) {
      try {
        console.log('[db.seed] Probing Supabase clients table...')
        const { count, error } = await supabase!
          .from('clients')
          .select('*', { count: 'exact', head: true })
          
        if (error) {
          console.error('[db.seed Error probing clients table]:', error)
          throw error
        }

        if (count && count > 0 && !force) {
          console.log('[db.seed] Supabase database has data, skipping seed. Count:', count)
          return { message: 'Database already has data (supabase)', count }
        }
      } catch (err: any) {
        console.error('[db.seed CRITICAL EXCEPTION during probe]:', err)
        throw err
      }
    }

    // Mock Data Definition
    const rawClients = [
      { name: 'João Carlos da Silva', email: 'joao.carlos@email.com', cpf: '12345678901', phone: '(11) 98765-4321' },
      { name: 'Maria Fernanda Santos', email: 'maria.santos@email.com', cpf: '23456789012', phone: '(21) 99876-5432' },
      { name: 'Pedro Henrique Oliveira', email: 'pedro.oliveira@email.com', cpf: '34567890123', phone: '(31) 98888-7777' },
      { name: 'Ana Beatriz Souza', email: 'ana.souza@email.com', cpf: '45678901234', phone: '(41) 97777-6666' },
      { name: 'Ricardo Mendes Pereira', email: 'ricardo.mendes@email.com', cpf: '56789012345', phone: '(81) 96666-5555' },
      { name: 'Camila Lima Rodrigues', email: 'camila.lima@email.com', cpf: '67890123456', phone: '(71) 95555-4444' },
      { name: 'Lucas Gabriel Costa', email: 'lucas.costa@email.com', cpf: '78901234567', phone: '(19) 94444-3333' },
      { name: 'Juliana Barbosa Rocha', email: 'juliana.rocha@email.com', cpf: '89012345678', phone: '(51) 93333-2222' },
      { name: 'Felipe Augusto Almeida', email: 'felipe.almeida@email.com', cpf: '90123456789', phone: '(85) 92222-1111' },
      { name: 'Letícia Araujo Gomez', email: 'leticia.gomez@email.com', cpf: '01234567890', phone: '(62) 91111-0000' }
    ]

    const seedClients: Client[] = []
    const seedContracts: Contract[] = []
    const seedInstallments: Installment[] = []
    const seedPayments: Payment[] = []
    const seedRiskScores: RiskScore[] = []
    const seedAlerts: Alert[] = []

    const today = new Date()

    let i = 0
    for (const rc of rawClients) {
      const clientId = db.isMock() ? generateUUID() : undefined

      const clientObj: Client = {
        id: clientId || '',
        name: rc.name,
        email: rc.email,
        cpf: rc.cpf,
        phone: rc.phone,
        created_at: new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString() // 6 months ago
      }

      if (!db.isMock()) {
        const { data, error } = await supabase!.from('clients').insert({
          name: rc.name,
          email: rc.email,
          cpf: rc.cpf,
          phone: rc.phone
        }).select('id').single()
        if (error) throw error
        clientObj.id = data.id
      }
      seedClients.push(clientObj)

      // Create 1 or 2 contracts for each client
      const contractCount = i % 3 === 0 ? 2 : 1
      for (let c = 0; c < contractCount; c++) {
        const contractId = db.isMock() ? generateUUID() : undefined
        const contractNum = `CNS-${100000 + i * 10 + c}`
        const totalVal = (i % 2 === 0 ? 45000 : 90000) + (c * 15000)
        
        const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 10)
        const endDate = new Date(today.getFullYear(), today.getMonth() + 19, 10)

        const contractObj: Contract = {
          id: contractId || '',
          client_id: clientObj.id,
          contract_number: contractNum,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          total_value: totalVal,
          created_at: startDate.toISOString()
        }

        if (!db.isMock()) {
          const { data, error } = await supabase!.from('contracts').insert({
            client_id: clientObj.id,
            contract_number: contractNum,
            start_date: contractObj.start_date,
            end_date: contractObj.end_date,
            total_value: totalVal
          }).select('id').single()
          if (error) throw error
          contractObj.id = data.id
        }
        seedContracts.push(contractObj)

        // Generate 6 installments (some paid, some overdue, some pending)
        const monthlyAmount = Math.round(totalVal / 24)
        for (let inst = 1; inst <= 6; inst++) {
          const installmentId = db.isMock() ? generateUUID() : undefined
          const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + inst - 1, 10)
          
          let status: 'pending' | 'paid' | 'overdue' = 'pending'
          
          // Logic for status based on profile
          if (dueDate < today) {
            // Installment should be paid or overdue
            if (i === 0 && inst >= 4) {
              // João Carlos (i=0) has overdue installments from month 4 onwards (severe overdue)
              status = 'overdue'
            } else if (i === 2 && inst >= 5) {
              // Pedro Henrique (i=2) has overdue installments
              status = 'overdue'
            } else if (i === 4 && inst >= 5) {
              // Ricardo Mendes (i=4) has overdue installments
              status = 'overdue'
            } else {
              status = 'paid'
            }
          } else {
            status = 'pending'
          }

          const installmentObj: Installment = {
            id: installmentId || '',
            contract_id: contractObj.id,
            installment_number: inst,
            due_date: dueDate.toISOString().split('T')[0],
            amount: monthlyAmount,
            status,
            created_at: startDate.toISOString()
          }

          if (!db.isMock()) {
            const { data, error } = await supabase!.from('installments').insert({
              contract_id: contractObj.id,
              installment_number: inst,
              due_date: installmentObj.due_date,
              amount: monthlyAmount,
              status
            }).select('id').single()
            if (error) throw error
            installmentObj.id = data.id
          }
          seedInstallments.push(installmentObj)

          // If paid, create a payment
          if (status === 'paid') {
            const paymentId = db.isMock() ? generateUUID() : undefined
            const payDate = new Date(dueDate.getTime() + (Math.random() > 0.7 ? 3 : -1) * 24 * 60 * 60 * 1000) // pay early or slightly late
            
            const paymentObj: Payment = {
              id: paymentId || '',
              installment_id: installmentObj.id,
              paid_at: payDate.toISOString(),
              amount: monthlyAmount,
              method: inst % 2 === 0 ? 'Boleto' : 'Pix',
              created_at: payDate.toISOString()
            }

            if (!db.isMock()) {
              const { error } = await supabase!.from('payments').insert({
                installment_id: installmentObj.id,
                paid_at: paymentObj.paid_at,
                amount: monthlyAmount,
                method: paymentObj.method
              })
              if (error) throw error
            }
            seedPayments.push(paymentObj)
          }
        }
      }
      i++
    }

    // Now populate risk scores and alerts in memory (will be updated by the analytical engine)
    // Seed Naive heuristic risk scores for seeding
    for (const c of seedClients) {
      const clientId = c.id
      const overdueInstallments = seedInstallments.filter(inst => {
        const contract = seedContracts.find(con => con.id === inst.contract_id)
        return contract?.client_id === clientId && inst.status === 'overdue'
      })

      const overdueCount = overdueInstallments.length
      let score = 15 // base low risk
      if (overdueCount > 0) {
        score = Math.min(100, 30 + overdueCount * 22 + Math.floor(Math.random() * 10))
      }

      const riskObj: RiskScore = {
        id: db.isMock() ? generateUUID() : '',
        client_id: clientId,
        score,
        model: 'heuristic_v1',
        computed_at: today.toISOString()
      }

      if (!db.isMock()) {
        await supabase!.from('risk_scores').insert({
          client_id: clientId,
          score,
          model: 'heuristic_v1'
        })
      }
      seedRiskScores.push(riskObj)

      // Create an alert for critical risk
      if (score >= 70) {
        const alertObj: Alert = {
          id: db.isMock() ? generateUUID() : '',
          client_id: clientId,
          contract_id: seedContracts.find(con => con.client_id === clientId)?.id || null,
          severity: 'critical',
          message: `Inadimplência detectada: Cliente possui ${overdueCount} parcelas vencidas em atraso crítico.`,
          created_at: today.toISOString(),
          resolved: false
        }

        if (!db.isMock()) {
          await supabase!.from('alerts').insert({
            client_id: clientId,
            contract_id: alertObj.contract_id,
            severity: 'critical',
            message: alertObj.message
          })
        }
        seedAlerts.push(alertObj)
      } else if (score >= 35) {
        const alertObj: Alert = {
          id: db.isMock() ? generateUUID() : '',
          client_id: clientId,
          contract_id: seedContracts.find(con => con.client_id === clientId)?.id || null,
          severity: 'medium',
          message: `Risco moderado: Histórico de atraso recorrente.`,
          created_at: today.toISOString(),
          resolved: false
        }

        if (!db.isMock()) {
          await supabase!.from('alerts').insert({
            client_id: clientId,
            contract_id: alertObj.contract_id,
            severity: 'medium',
            message: alertObj.message
          })
        }
        seedAlerts.push(alertObj)
      }
    }

    if (db.isMock()) {
      store.clients = seedClients
      store.contracts = seedContracts
      store.installments = seedInstallments
      store.payments = seedPayments
      store.riskScores = seedRiskScores
      store.alerts = seedAlerts
    }

    return {
      message: db.isMock() ? 'Mock Database Seeded Successfully' : 'Supabase Seeded Successfully',
      clients: seedClients.length,
      contracts: seedContracts.length,
      installments: seedInstallments.length,
      payments: seedPayments.length,
      riskScores: seedRiskScores.length,
      alerts: seedAlerts.length,
    }
  },

  clients: {
    list: async (): Promise<Client[]> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!
          .from('clients')
          .select('*')
          .order('name', { ascending: true })
        if (error) throw error
        return data || []
      }
      return [...store.clients].sort((a, b) => a.name.localeCompare(b.name))
    },
    get: async (id: string): Promise<Client | null> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!
          .from('clients')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        return data
      }
      return store.clients.find(c => c.id === id) || null
    },
    create: async (data: Partial<Client>): Promise<Client> => {
      const clientObj: Client = {
        id: db.isMock() ? generateUUID() : '',
        name: data.name || '',
        email: data.email || '',
        cpf: data.cpf || '',
        phone: data.phone || '',
        created_at: new Date().toISOString()
      }

      if (!db.isMock()) {
        const { data: inserted, error } = await supabase!
          .from('clients')
          .insert({
            name: clientObj.name,
            email: clientObj.email,
            cpf: clientObj.cpf,
            phone: clientObj.phone
          })
          .select('*')
          .single()
        if (error) throw error
        return inserted
      }

      store.clients.push(clientObj)
      return clientObj
    }
  },

  contracts: {
    list: async (): Promise<Contract[]> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!.from('contracts').select('*')
        if (error) throw error
        return data || []
      }
      return [...store.contracts]
    },
    getByClient: async (clientId: string): Promise<Contract[]> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!.from('contracts').select('*').eq('client_id', clientId)
        if (error) throw error
        return data || []
      }
      return store.contracts.filter(c => c.client_id === clientId)
    },
    create: async (data: Partial<Contract>): Promise<Contract> => {
      const contractObj: Contract = {
        id: db.isMock() ? generateUUID() : '',
        client_id: data.client_id || '',
        contract_number: data.contract_number || `CNS-${100000 + Math.floor(Math.random() * 900000)}`,
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        end_date: data.end_date || new Date().toISOString().split('T')[0],
        total_value: Number(data.total_value) || 0,
        created_at: new Date().toISOString()
      }

      if (!db.isMock()) {
        const { data: inserted, error } = await supabase!
          .from('contracts')
          .insert({
            client_id: contractObj.client_id,
            contract_number: contractObj.contract_number,
            start_date: contractObj.start_date,
            end_date: contractObj.end_date,
            total_value: contractObj.total_value
          })
          .select('*')
          .single()
        if (error) throw error
        return inserted
      }

      store.contracts.push(contractObj)
      return contractObj
    }
  },

  installments: {
    list: async (): Promise<Installment[]> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!.from('installments').select('*').order('due_date', { ascending: true })
        if (error) throw error
        return data || []
      }
      return [...store.installments].sort((a, b) => a.due_date.localeCompare(b.due_date))
    },
    getByContract: async (contractId: string): Promise<Installment[]> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!.from('installments').select('*').eq('contract_id', contractId).order('installment_number', { ascending: true })
        if (error) throw error
        return data || []
      }
      return store.installments.filter(i => i.contract_id === contractId).sort((a, b) => a.installment_number - b.installment_number)
    },
    create: async (data: Partial<Installment>): Promise<Installment> => {
      const instObj: Installment = {
        id: db.isMock() ? generateUUID() : '',
        contract_id: data.contract_id || '',
        installment_number: Number(data.installment_number) || 1,
        due_date: data.due_date || new Date().toISOString().split('T')[0],
        amount: Number(data.amount) || 0,
        status: data.status as 'pending' | 'paid' | 'overdue' || 'pending',
        created_at: new Date().toISOString()
      }

      if (!db.isMock()) {
        const { data: inserted, error } = await supabase!
          .from('installments')
          .insert({
            contract_id: instObj.contract_id,
            installment_number: instObj.installment_number,
            due_date: instObj.due_date,
            amount: instObj.amount,
            status: instObj.status
          })
          .select('*')
          .single()
        if (error) throw error
        return inserted
      }

      store.installments.push(instObj)
      return instObj
    },
    updateStatus: async (id: string, status: 'pending' | 'paid' | 'overdue'): Promise<Installment | null> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!
          .from('installments')
          .update({ status })
          .eq('id', id)
          .select('*')
          .single()
        if (error) throw error
        return data
      }

      const inst = store.installments.find(i => i.id === id)
      if (inst) {
        inst.status = status
        return { ...inst }
      }
      return null
    }
  },

  payments: {
    list: async (): Promise<Payment[]> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!.from('payments').select('*')
        if (error) throw error
        return data || []
      }
      return [...store.payments]
    },
    create: async (data: Partial<Payment>): Promise<Payment> => {
      const payObj: Payment = {
        id: db.isMock() ? generateUUID() : '',
        installment_id: data.installment_id || '',
        paid_at: data.paid_at || new Date().toISOString(),
        amount: Number(data.amount) || 0,
        method: data.method || 'Pix',
        created_at: new Date().toISOString()
      }

      if (!db.isMock()) {
        const { data: inserted, error } = await supabase!
          .from('payments')
          .insert({
            installment_id: payObj.installment_id,
            paid_at: payObj.paid_at,
            amount: payObj.amount,
            method: payObj.method
          })
          .select('*')
          .single()
        if (error) throw error
        return inserted
      }

      store.payments.push(payObj)
      // Automatically update installment status to paid
      const instIndex = store.installments.findIndex(i => i.id === payObj.installment_id)
      if (instIndex !== -1) {
        store.installments[instIndex].status = 'paid'
      }

      return payObj
    }
  },

  risk_scores: {
    list: async (): Promise<RiskScore[]> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!.from('risk_scores').select('*').order('computed_at', { ascending: false })
        if (error) throw error
        return data || []
      }
      return [...store.riskScores].sort((a, b) => b.computed_at.localeCompare(a.computed_at))
    },
    getLatestByClient: async (clientId: string): Promise<RiskScore | null> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!
          .from('risk_scores')
          .select('*')
          .eq('client_id', clientId)
          .order('computed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw error
        return data
      }
      const clientScores = store.riskScores.filter(r => r.client_id === clientId)
      if (clientScores.length === 0) return null
      return clientScores.sort((a, b) => b.computed_at.localeCompare(a.computed_at))[0]
    },
    create: async (data: Partial<RiskScore>): Promise<RiskScore> => {
      const riskObj: RiskScore = {
        id: db.isMock() ? generateUUID() : '',
        client_id: data.client_id || '',
        score: Number(data.score) || 0,
        model: data.model || 'heuristic_v1',
        computed_at: new Date().toISOString()
      }

      if (!db.isMock()) {
        const { data: inserted, error } = await supabase!
          .from('risk_scores')
          .insert({
            client_id: riskObj.client_id,
            score: riskObj.score,
            model: riskObj.model
          })
          .select('*')
          .single()
        if (error) throw error
        return inserted
      }

      store.riskScores.push(riskObj)
      return riskObj
    }
  },

  alerts: {
    list: async (): Promise<Alert[]> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!.from('alerts').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return data || []
      }
      return [...store.alerts].sort((a, b) => b.created_at.localeCompare(a.created_at))
    },
    create: async (data: Partial<Alert>): Promise<Alert> => {
      const alertObj: Alert = {
        id: db.isMock() ? generateUUID() : '',
        client_id: data.client_id || '',
        contract_id: data.contract_id || null,
        severity: data.severity as 'low' | 'medium' | 'critical' || 'medium',
        message: data.message || '',
        created_at: new Date().toISOString(),
        resolved: false
      }

      if (!db.isMock()) {
        const { data: inserted, error } = await supabase!
          .from('alerts')
          .insert({
            client_id: alertObj.client_id,
            contract_id: alertObj.contract_id,
            severity: alertObj.severity,
            message: alertObj.message
          })
          .select('*')
          .single()
        if (error) throw error
        return inserted
      }

      store.alerts.push(alertObj)
      return alertObj
    },
    resolve: async (id: string): Promise<Alert | null> => {
      if (!db.isMock()) {
        const { data, error } = await supabase!
          .from('alerts')
          .update({ resolved: true })
          .eq('id', id)
          .select('*')
          .single()
        if (error) throw error
        return data
      }

      const alert = store.alerts.find(a => a.id === id)
      if (alert) {
        alert.resolved = true
        return { ...alert }
      }
      return null
    }
  }
}
