const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const CSV_FILE = 'c:/Users/Administrator/Documents/3Professores/my-app/front-end/assets/cobranca_assessorias.csv';
const XLSX_FILE = 'c:/Users/Administrator/Documents/3Professores/my-app/front-end/assets/fluxo_pagamentos.xlsx';

function cleanAmount(val) {
  if (val === null || val === undefined) return 0;
  let str = String(val).trim();
  str = str.replace('R$', '').replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

async function inspect() {
  console.log("Reading CSV...");
  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  const csvLines = csvContent.split('\n');
  const csvHeaders = csvLines[0].split(',').map(h => h.trim());
  
  let totalSent = 0;
  let totalRecovered = 0;
  let totalDelay = 0;
  let delayCount = 0;

  for (let i = 1; i < csvLines.length; i++) {
    if (!csvLines[i].trim()) continue;
    
    // Parse CSV line handling quotes
    const fields = [];
    let current = '';
    let inQuotes = false;
    const line = csvLines[i];
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    const amount = cleanAmount(fields[4]); // Valor_Inadimplente_Inicial
    const status = fields[5]; // Status_Cobranca
    const delay = parseInt(fields[3]); // Dias_Em_Atraso_Inicial

    totalSent += amount;
    if (status === 'Acordo Firmado') {
      totalRecovered += amount;
    }
    if (!isNaN(delay)) {
      totalDelay += delay;
      delayCount++;
    }
  }

  console.log("CSV Stats:");
  console.log(`  Total Sent (Volume Cobrança): R$ ${totalSent.toLocaleString('pt-BR')}`);
  console.log(`  Total Recovered (Acordo Firmado): R$ ${totalRecovered.toLocaleString('pt-BR')}`);
  console.log(`  Average Delay: ${totalDelay / delayCount} days`);

  console.log("\nReading XLSX...");
  const workbook = xlsx.readFile(XLSX_FILE);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet);

  console.log(`XLSX parsed rows: ${rows.length}`);
  
  let totalVal = 0;
  let totalAberto = 0;
  let abertoCount = 0;
  
  for (const r of rows) {
    const amount = cleanAmount(r.Valor_Parcela);
    const paid = r.Data_Pagamento;
    totalVal += amount;
    if (paid === null || paid === undefined || String(paid).trim() === '' || String(paid).trim() === 'NaT') {
      totalAberto += amount;
      abertoCount++;
    }
  }

  console.log("XLSX Stats:");
  console.log(`  Total Value (Carteira): R$ ${totalVal.toLocaleString('pt-BR')}`);
  console.log(`  Total Overdue (Em Aberto): R$ ${totalAberto.toLocaleString('pt-BR')} (Count: ${abertoCount})`);
  console.log(`  Delinquency Rate: ${(totalAberto / totalVal * 100).toFixed(2)}%`);
}

inspect();
