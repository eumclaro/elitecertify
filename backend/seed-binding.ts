import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const turmaB = await prisma.class.findFirst({ where: { name: 'Turma B' } });
  const prova = await prisma.exam.findFirst({ where: { title: 'Prova CHPC L1' } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  if (!turmaB || !prova || !admin) {
    console.error('Missing records');
    process.exit(1);
  }

  const existing = await prisma.examRelease.findFirst({
    where: { classId: turmaB.id, examId: prova.id }
  });

  if (!existing) {
    await prisma.examRelease.create({
      data: {
        classId: turmaB.id,
        examId: prova.id,
        releasedBy: admin.id
      }
    });
    console.log('Linked successfully');
  } else {
    console.log('Already linked');
  }
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
