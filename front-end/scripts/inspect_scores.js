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

console.log("Total parsed rows:", parsed.length);

// Print first 20 rows
console.log("\nSample rows (first 20):");
parsed.slice(0, 20).forEach(r => {
  console.log(`Contract: ${r.ID_Contrato} | Days Overdue: ${r.Dias_Em_Atraso_Inicial} | Score: ${r.Score_Interno_Risco} | Status: ${r.Status_Cobranca}`);
});

// Let's analyze the distribution of Score_Interno_Risco
const scores = parsed.map(r => parseFloat(r.Score_Interno_Risco)).filter(s => !isNaN(s));
console.log("\nScore statistics:");
console.log(`Min: ${Math.min(...scores)}`);
console.log(`Max: ${Math.max(...scores)}`);
console.log(`Average: ${(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2)}`);

// Check how many have score < 30 and their status/days overdue
const lowScores = parsed.filter(r => parseFloat(r.Score_Interno_Risco) < 30);
console.log(`\nContracts with score < 30 count: ${lowScores.length}`);
console.log("Sample of low scores (< 30):");
lowScores.slice(0, 10).forEach(r => {
  console.log(`Contract: ${r.ID_Contrato} | Days: ${r.Dias_Em_Atraso_Inicial} | Score: ${r.Score_Interno_Risco} | Status: ${r.Status_Cobranca}`);
});

// Check how many have score >= 70
const highScores = parsed.filter(r => parseFloat(r.Score_Interno_Risco) >= 70);
console.log(`\nContracts with score >= 70 count: ${highScores.length}`);
console.log("Sample of high scores (>= 70):");
highScores.slice(0, 10).forEach(r => {
  console.log(`Contract: ${r.ID_Contrato} | Days: ${r.Dias_Em_Atraso_Inicial} | Score: ${r.Score_Interno_Risco} | Status: ${r.Status_Cobranca}`);
});
