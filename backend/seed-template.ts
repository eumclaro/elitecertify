import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Criando Template...');
  const template = await prisma.certificateTemplate.create({
    data: {
      name: 'CHPC Level 1 (Legado)',
      fileName: 'chpc-l1.jpg',
      nameTop: 53.1,
      nameLeft: 14.2,
      codeTop: 72.1,
      codeLeft: 59.1,
      dateBottom: 12.0,
      dateLeft: 16.2,
    }
  });
  console.log('Template criado com ID:', template.id);

  console.log('Vinculando template a provas existentes...');
  const result = await prisma.exam.updateMany({
    data: {
      certificateTemplateId: template.id
    }
  });
  console.log(result.count, 'provas atualizadas com o novo template.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
