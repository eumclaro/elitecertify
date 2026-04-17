import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'

interface CertificateData {
  studentName: string
  certifiedId: string
  issuedAt: Date
  templateFile: string
  nameTop: number
  nameLeft: number
  codeTop: number
  codeLeft: number
  dateBottom: number
  dateLeft: number
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const templatePath = path.resolve(process.cwd(), 'assets/certificates', data.templateFile)

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template não encontrado: ${data.templateFile}`)
  }

  const imageBase64 = fs.readFileSync(templatePath).toString('base64')
  const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`

  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data.issuedAt)

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
    top: ${data.nameTop}%;
    left: ${data.nameLeft}%;
    width: 62%;
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 36pt;
    color: #1a1a1a;
    line-height: 1.1;
  }
  .certified-id {
    position: absolute;
    top: ${data.codeTop}%;
    left: ${data.codeLeft}%;
    font-size: 13pt;
    font-weight: bold;
    color: #1a1a1a;
    letter-spacing: 1px;
  }
  .issue-date {
    position: absolute;
    bottom: ${data.dateBottom}%;
    left: ${data.dateLeft}%;
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
`

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.emulateMediaType('screen')

    const pdf = await page.pdf({
      width: '297mm',
      height: '210mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
