const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, 'fixtures');
fs.mkdirSync(directory, { recursive: true });
for (const [name, title] of [['source.pdf', 'Synthetic incoming document'], ['result-1.pdf', 'Submission round 1'], ['result-2.pdf', 'Submission round 2'], ['coordination.pdf', 'Coordination result']]) {
  const content = `BT /F1 18 Tf 50 760 Td (${title}) Tj 0 -30 Td (Workflow acceptance only. No real data.) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  fs.writeFileSync(path.join(directory, name), pdf);
}
console.log('Created four synthetic PDF fixtures.');
