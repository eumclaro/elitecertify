import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const report: Record<string, any> = {};

  // 2.1 — Turmas sem nenhuma prova liberada
  report['2.1'] = await prisma.class.findMany({
    where: { examReleases: { none: {} } },
    select: { id: true, name: true }
  });

  // 2.2 — Provas sem template de certificado
  report['2.2'] = await prisma.exam.findMany({
    where: {
      status: 'PUBLISHED',
      certificateTemplateId: null
    },
    select: { id: true, title: true }
  });

  // 2.3 — Provas sem nenhuma liberação
  report['2.3'] = await prisma.exam.findMany({
    where: {
      status: 'PUBLISHED',
      releases: { none: {} }
    },
    select: { id: true, title: true }
  });

  // 2.4 — Alunos sem turma
  report['2.4'] = await prisma.student.findMany({
    where: {
      classes: { none: {} }
    },
    select: { id: true, user: { select: { name: true, email: true } } }
  });

  // 2.5 — Alunos com tentativas de prova sem liberação correspondente
  const allAttempts = await prisma.examAttempt.findMany({
    select: {
      id: true,
      studentId: true,
      examId: true,
      student: { select: { user: { select: { name: true } }, classes: { select: { classId: true } } } }
    }
  });

  const attemptsWithoutRelease: any[] = [];
  for (const attempt of allAttempts) {
    const classIds = attempt.student.classes.map(c => c.classId);
    if (classIds.length === 0) classIds.push('__DUMMY__');

    const release = await prisma.examRelease.findFirst({
      where: {
        examId: attempt.examId,
        OR: [
          { studentId: attempt.studentId },
          { classId: { in: classIds } }
        ]
      }
    });

    if (!release) {
      attemptsWithoutRelease.push({
        attemptId: attempt.id,
        studentId: attempt.studentId,
        studentName: attempt.student.user.name,
        examId: attempt.examId
      });
    }
  }
  report['2.5'] = attemptsWithoutRelease;

  // 2.6 — Certificados emitidos para provas sem template
  report['2.6'] = await prisma.certificate.findMany({
    where: {
      exam: { certificateTemplateId: null }
    },
    select: {
      id: true,
      code: true,
      student: { select: { user: { select: { name: true } } } },
      exam: { select: { id: true, title: true } }
    }
  });

  // 2.7 — Turmas com alunos mas sem prova liberada
  report['2.7'] = await prisma.class.findMany({
    where: {
      students: { some: {} },
      examReleases: { none: {} }
    },
    select: { id: true, name: true }
  });

  console.log(JSON.stringify(report, null, 2));
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
