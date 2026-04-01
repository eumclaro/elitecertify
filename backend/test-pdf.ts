import { generateCertificatePdf } from './src/services/certificateService';
import fs from 'fs';
import path from 'path';

async function test() {
  const data = {
    studentName: 'ANA SOUZA',
    certifiedId: 'ELT-57B62B8C',
    issuedAt: new Date('2026-03-30T10:00:00Z'),
    templateFile: 'chpc-l1.jpg',
    courseTitle: 'Prova CHPC L1',
    courseDescription: 'Certificado de Aprovação no Nível 1'
  };

  try {
    const buffer = await generateCertificatePdf(data);
    const outputPath = path.resolve(__dirname, 'test-certificate.pdf');
    fs.writeFileSync(outputPath, buffer);
    console.log(`PDF gerado com sucesso em: ${outputPath}`);
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
  }
}

test();
