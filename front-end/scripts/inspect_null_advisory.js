const fs = require('fs');

const CSV_FILE = 'c:/Users/Administrator/Documents/3Professores/my-app/front-end/assets/cobranca_assessorias.csv';
const content = fs.readFileSync(CSV_FILE, 'utf8');
const lines = content.split('\n');

const parsed = [];
const headers = lines[0].split(',').map(h => h.trim());

// Simple CSV line parser that handles quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const fields = parseCSVLine(lines[i]);
  const row = {};
  headers.forEach((h, idx) => {
    row[h] = fields[idx];
  });
  parsed.push(row);
}

// Group by Nome_Assessoria
const groups = {};
for (const r of parsed) {
  let adv = r.Nome_Assessoria ? r.Nome_Assessoria.trim() : '';
  if (adv === '') adv = 'Sem Assessoria (Interno)';
  
  if (!groups[adv]) {
    groups[adv] = { totalSent: 0, totalRecovered: 0, count: 0 };
  }
  
  // clean amount
  let amtStr = r.Valor_Inadimplente_Inicial || '0';
  amtStr = amtStr.replace('R$', '').replace(/\./g, '').replace(/,/g, '.').trim();
  const amt = parseFloat(amtStr) || 0;
  
  groups[adv].totalSent += amt;
  groups[adv].count++;
  if (r.Status_Cobranca === 'Acordo Firmado') {
    groups[adv].totalRecovered += amt;
  }
}

for (const [name, stats] of Object.entries(groups)) {
  const rate = (stats.totalRecovered / stats.totalSent) * 100;
  console.log(`Assessoria: ${name}`);
  console.log(`  Count: ${stats.count}`);
  console.log(`  Total Sent: R$ ${stats.totalSent.toLocaleString('pt-BR')}`);
  console.log(`  Total Recovered: R$ ${stats.totalRecovered.toLocaleString('pt-BR')}`);
  console.log(`  Recovery Rate: ${rate.toFixed(2)}%`);
}
