import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import prisma from '../config/database'
import { dispatchTemplateToMandrill } from './mail'

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
  // Ajuste para encontrar os assets tanto em dev quanto em dist/production
  const assetsDir = __dirname.includes('dist') 
    ? path.resolve(__dirname, '../../src/assets/certificates')
    : path.resolve(__dirname, '../assets/certificates');
    
  const templatePath = path.resolve(assetsDir, data.templateFile)

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
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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

export async function generateCertificateCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let isUnique = false
  let code = ''

  while (!isUnique) {
    code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const finalCode = `ELT-${code}`
    const existing = await prisma.certificate.findUnique({ where: { code: finalCode } })
    if (!existing) {
      isUnique = true
      return finalCode
    }
  }

  return `ELT-${code}`
}

/**
 * Envia o certificado em PDF por e-mail para o aluno
 */
export async function sendCertificateByEmail(
  certificateCode: string,
  studentEmail: string,
  studentName: string
): Promise<void> {
  try {
    const certificate = await prisma.certificate.findUnique({
      where: { code: certificateCode },
      include: {
        student: { include: { user: true } },
        exam: { include: { certificateTemplate: true } }
      }
    })

    if (!certificate) {
      throw new Error(`Certificado não encontrado: ${certificateCode}`)
    }

    const pdfBuffer = await generateCertificatePdf({
      studentName: `${certificate.student.user.name} ${certificate.student.lastName || ''}`.trim(),
      certifiedId: certificate.code,
      issuedAt: certificate.issuedAt,
      templateFile: certificate.exam.certificateTemplate?.fileName || 'padrao.jpg',
      nameTop: certificate.exam.certificateTemplate?.nameTop || 53.1,
      nameLeft: certificate.exam.certificateTemplate?.nameLeft || 14.2,
      codeTop: certificate.exam.certificateTemplate?.codeTop || 72.1,
      codeLeft: certificate.exam.certificateTemplate?.codeLeft || 59.1,
      dateBottom: certificate.exam.certificateTemplate?.dateBottom || 12.0,
      dateLeft: certificate.exam.certificateTemplate?.dateLeft || 16.2
    })

    await dispatchTemplateToMandrill(
      'CERTIFICATE_SENT',
      studentEmail,
      studentName,
      {
        NAME: studentName,
        EXAM_NAME: certificate.exam.title,
        CERTIFICATE_CODE: certificate.code
      },
      'Seu certificado Elite Certify está aqui! 🎓',
      undefined,
      {
        filename: `Certificado-${certificate.code}.pdf`,
        content: pdfBuffer.toString('base64'),
        type: 'application/pdf'
      },
      certificate.code
    )

    console.log(`[CertificateService] E-mail enviado: ${certificateCode}`)
  } catch (error: any) {
    console.error(`[CertificateService] Erro ao enviar e-mail:`, error.message)
  }
}
