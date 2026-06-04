const fs = require('fs');
const xlsx = require('xlsx');

const XLSX_FILE = 'c:/Users/Administrator/Documents/3Professores/my-app/front-end/assets/fluxo_pagamentos.xlsx';

async function checkDuplicates() {
  console.log("Reading XLSX...");
  const workbook = xlsx.readFile(XLSX_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const keys = new Map();
  for (const r of rows) {
    const key = `${r.ID_Contrato}|${r.Numero_Parcela}`;
    if (!keys.has(key)) {
      keys.set(key, []);
    }
    keys.get(key).push(r);
  }

  let duplicateCount = 0;
  for (const [key, list] of keys.entries()) {
    if (list.length > 1) {
      duplicateCount++;
      if (duplicateCount <= 5) {
        console.log(`Duplicate key: ${key}`);
        list.forEach((item, idx) => {
          console.log(`  Row ${idx + 1}: Amount: ${item.Valor_Parcela} | Paid: ${item.Data_Pagamento} | Paid Amount: ${item.Valor_Pago}`);
        });
      }
    }
  }

  console.log(`Total unique keys: ${keys.size}`);
  console.log(`Total keys with duplicates: ${duplicateCount}`);
}

checkDuplicates();
