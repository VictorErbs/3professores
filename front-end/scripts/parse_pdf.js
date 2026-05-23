const fs = require('fs');
const pdf = require('pdf-parse');

const filePath = './docs/requirements.pdf';

(async () => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    console.log(data.text);
    fs.writeFileSync('./docs/requirements.txt', data.text);
    console.log('\nSaved extracted text to docs/requirements.txt');
  } catch (err) {
    console.error('Error reading PDF:', err);
    process.exit(1);
  }
})();
