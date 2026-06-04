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

async function inspect() {
  const { count, error } = await supabase.from('installments').select('*', { count: 'exact', head: true });
  if (error) {
    console.error("Error fetching count:", error);
    return;
  }
  console.log("Total installments in database:", count);

  // Let's count by status
  const statuses = ['paid', 'overdue', 'pending'];
  for (const s of statuses) {
    const { data, count: statusCount, error: err } = await supabase.from('installments').select('amount', { count: 'exact' }).eq('status', s);
    if (err) {
      console.error(`Error for ${s}:`, err);
      continue;
    }
    const sum = data.reduce((acc, row) => acc + (row.amount || 0), 0);
    console.log(`Status: ${s} | Count: ${statusCount} | Sum: R$ ${sum.toLocaleString('pt-BR')}`);
  }
}

inspect();
