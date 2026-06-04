const fs = require('fs');
const xlsx = require('xlsx');

const CSV_FILE = 'c:/Users/Administrator/Documents/3Professores/my-app/front-end/assets/cobranca_assessorias.csv';
const XLSX_FILE = 'c:/Users/Administrator/Documents/3Professores/my-app/front-end/assets/fluxo_pagamentos.xlsx';

async function checkOverlap() {
  console.log("Reading CSV...");
  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  const csvLines = csvContent.split('\n');
  const csvContracts = new Set();
  for (let i = 1; i < csvLines.length; i++) {
    if (!csvLines[i].trim()) continue;
    const parts = csvLines[i].split(',');
    const id = parts[0].trim();
    if (id) csvContracts.add(id);
  }

  console.log(`Unique contracts in CSV: ${csvContracts.size}`);

  console.log("Reading XLSX...");
  const workbook = xlsx.readFile(XLSX_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);
  
  const xlsxContracts = new Set();
  for (const r of rows) {
    if (r.ID_Contrato) {
      xlsxContracts.add(String(r.ID_Contrato).trim());
    }
  }

  console.log(`Unique contracts in XLSX: ${xlsxContracts.size}`);

  // Find difference
  let inXlsxNotInCsv = 0;
  for (const id of xlsxContracts) {
    if (!csvContracts.has(id)) {
      inXlsxNotInCsv++;
    }
  }
  console.log(`Contracts in XLSX but NOT in CSV: ${inXlsxNotInCsv}`);

  let inCsvNotInXlsx = 0;
  for (const id of csvContracts) {
    if (!xlsxContracts.has(id)) {
      inCsvNotInXlsx++;
    }
  }
  console.log(`Contracts in CSV but NOT in XLSX: ${inCsvNotInXlsx}`);
}

checkOverlap();
