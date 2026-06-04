const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = "./.env.local";
let supabaseUrl = "";
let supabaseKey = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      supabaseKey = line.split('=')[1].trim().replace(/['"]/g, '');
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim().replace(/['"]/g, '');
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: clients } = await supabase.from('clients').select('*').eq('name', 'CONTR_2026_09898');
  const client = clients?.[0];
  if (!client) {
    console.log("Client not found");
    return;
  }
  console.log("Client:", JSON.stringify(client, null, 2));

  const { data: riskScores } = await supabase.from('risk_scores').select('*').eq('client_id', client.id).order('computed_at', { ascending: false });
  console.log("Risk Scores:", JSON.stringify(riskScores, null, 2));

  const { data: alerts } = await supabase.from('alerts').select('*').eq('client_id', client.id);
  console.log("Alerts:", JSON.stringify(alerts, null, 2));

  const { data: contracts } = await supabase.from('contracts').select('*').eq('client_id', client.id);
  console.log("Contracts:", JSON.stringify(contracts, null, 2));

  const contractIds = (contracts || []).map(c => c.id);
  const { data: installments } = await supabase.from('installments').select('*').in('contract_id', contractIds);
  console.log("Installments:", JSON.stringify(installments, null, 2));
}

check();
