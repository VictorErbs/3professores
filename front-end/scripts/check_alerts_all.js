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
  const { data: alerts } = await supabase.from('alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(5);
  console.log("Recent Alerts count:", alerts?.length);
  for (const alert of (alerts || [])) {
    const { data: clients } = await supabase.from('clients').select('*').eq('id', alert.client_id);
    const client = clients?.[0];
    const { data: riskScores } = await supabase.from('risk_scores').select('*').eq('client_id', alert.client_id).order('computed_at', { ascending: false }).limit(1);
    const riskScore = riskScores?.[0];
    console.log(`Alert ID: ${alert.id} | Severity: ${alert.severity} | Msg: ${alert.message}`);
    console.log(`  Client ID: ${alert.client_id} | Client Name: ${client?.name}`);
    console.log(`  Risk Score: ${riskScore ? riskScore.score : 'None'} (${riskScore ? riskScore.computed_at : 'No date'})`);
  }
}

check();
