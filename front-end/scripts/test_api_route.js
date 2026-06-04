const fs = require('fs');

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

async function supabaseGet(path, params) {
  const url = new URL(`${supabaseUrl}/rest/v1/${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  console.log(`Fetching: ${url.toString()}`);
  const res = await fetch(url.toString(), {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=none',
      'Range-Unit': 'items',
      'Range': '0-299',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  return res.json();
}

async function test() {
  const id = "1da7e68d-2ad2-4898-a526-f5140cb6e0a3";
  try {
    const [clientArr, contracts, riskScores] = await Promise.all([
      supabaseGet('clients', { id: `eq.${id}`, select: '*' }),
      supabaseGet('contracts', { client_id: `eq.${id}`, select: '*' }),
      supabaseGet('risk_scores', { client_id: `eq.${id}`, select: '*', order: 'computed_at.desc' }),
    ]);

    console.log("Client:", clientArr);
    console.log("Contracts:", contracts);
    console.log("Risk Scores:", riskScores);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
