import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

async function testPng() {
  const data = {
    studentName: 'ANA SOUZA',
    certifiedId: 'ELT-57B62B8C',
    issuedAt: new Date('2026-03-30T10:00:00Z'),
    templateFile: 'chpc-l1.jpg',
    courseTitle: 'Prova CHPC L1',
    courseDescription: 'Certificado de Aprovação no Nível 1'
  };

  const templatePath = path.resolve(__dirname, 'src/assets/certificates', data.templateFile);
  const imageBase64 = fs.readFileSync(templatePath).toString('base64');
  const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;

  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data.issuedAt);

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 297mm; height: 210mm; overflow: hidden; }
  .page {
    position: relative;
    width: 297mm;
    height: 210mm;
    background-image: url('${imageDataUrl}');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    font-family: Arial, sans-serif;
  }
  .student-name {
    position: absolute;
    top: 53.1%;
    left: 14.2%;
    width: 62%;
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 36pt;
    color: #1a1a1a;
    line-height: 1.1;
  }
  .certified-id {
    position: absolute;
    top: 72.1%;
    left: 59.1%;
    font-size: 13pt;
    font-weight: bold;
    color: #1a1a1a;
    letter-spacing: 1px;
  }
  .issue-date {
    position: absolute;
    bottom: 12.0%;
    left: 16.2%;
    font-size: 13pt;
    font-weight: bold;
    color: #c0001a;
  }
</style>
</head>
<body>
<div class="page">
  <div class="student-name">${data.studentName}</div>
  <div class="certified-id">${data.certifiedId}</div>
  <div class="issue-date">${formattedDate}</div>
</div>
</body>
</html>
`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1122, height: 794 }); // 297mm x 210mm aprox at 96dpi
  await page.setContent(html);
  await page.screenshot({ path: path.resolve(__dirname, 'test-certificate.png'), fullPage: true });
  await browser.close();
  console.log('PNG gerado com sucesso.');
}

testPng();
