const fs = require('fs');
const path = require('path');

const CSV_FILE = 'c:/Users/Administrator/Documents/3Professores/my-app/front-end/assets/cobranca_assessorias.csv';
const content = fs.readFileSync(CSV_FILE, 'utf8');
const lines = content.split('\n');

const headers = lines[0].split(',');
console.log("Headers:", headers);

const targetIds = ['CONTR_2026_09895', 'CONTR_2026_09896', 'CONTR_2026_09898', 'CONTR_2026_09899', 'CONTR_2026_09897'];

for (const line of lines) {
  const fields = line.split(',');
  if (fields.length > 0) {
    const id = fields[0].trim();
    if (targetIds.includes(id)) {
      console.log(`ID: ${id}`);
      headers.forEach((h, idx) => {
        console.log(`  ${h}: ${fields[idx]}`);
      });
    }
  }
}
