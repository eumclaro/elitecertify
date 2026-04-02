import { PrismaClient, Role, ExamStatus, QuestionOrder, AttemptExecutionStatus, AttemptResultStatus, CooldownStatus, NpsStatus, NpsInviteStatus, NpsQuestionType } from '@prisma/client'
import { randomUUID } from 'crypto'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// ─── GUARD DE PRODUÇÃO ───────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('❌  Seed bloqueado em produção. Abortando.')
  process.exit(1)
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const hash = (pw: string) => bcrypt.hashSync(pw, 10)
const daysAgo  = (n: number) => new Date(Date.now() - n * 86_400_000)
const daysFrom = (n: number) => new Date(Date.now() + n * 86_400_000)
const cert = () => `ELT-${randomUUID().slice(0, 8).toUpperCase()}`

async function main() {
  console.log('🌱  Iniciando seed Elite Certify...\n')

  // ─── 1. ADMIN ──────────────────────────────────────────────────────────────
  console.log('👤  Criando admin...')
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@eltcert.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@eltcert.com',
      passwordHash: hash('Admin@123'),
      role: Role.ADMIN,
      active: true,
    },
  })

  // ─── 2. TURMAS ─────────────────────────────────────────────────────────────
  console.log('🏫  Criando turmas...')
  const [classA, classB] = await Promise.all([
    prisma.class.create({
      data: {
        name: 'CHPC L1 MAIO',
        description: 'Turma nível 1 — maio 2026',
        startDate: daysAgo(30),
        endDate: daysFrom(60),
        status: 'ACTIVE',
      },
    }),
    prisma.class.create({
      data: {
        name: 'CHPC L2 JUNHO',
        description: 'Turma nível 2 — junho 2026',
        startDate: daysAgo(10),
        endDate: daysFrom(90),
        status: 'ACTIVE',
      },
    }),
  ])

  // ─── 3. ALUNOS (20) ────────────────────────────────────────────────────────
  console.log('🎓  Criando 20 alunos...')

  const alunosData = [
    // Turma A — 12 alunos
    { name: 'Ana',      last: 'Souza',      email: 'ana.souza@email.com',      class: classA.id },
    { name: 'Bruno',    last: 'Lima',       email: 'bruno.lima@email.com',      class: classA.id },
    { name: 'Carla',    last: 'Mendes',     email: 'carla.mendes@email.com',    class: classA.id },
    { name: 'Diego',    last: 'Ferreira',   email: 'diego.ferreira@email.com',  class: classA.id },
    { name: 'Elaine',   last: 'Costa',      email: 'elaine.costa@email.com',    class: classA.id },
    { name: 'Felipe',   last: 'Rocha',      email: 'felipe.rocha@email.com',    class: classA.id },
    { name: 'Gabriela', last: 'Alves',      email: 'gabriela.alves@email.com',  class: classA.id },
    { name: 'Henrique', last: 'Martins',    email: 'henrique.martins@email.com',class: classA.id },
    { name: 'Isabela',  last: 'Nunes',      email: 'isabela.nunes@email.com',   class: classA.id },
    { name: 'João',     last: 'Pereira',    email: 'joao.pereira@email.com',    class: classA.id },
    { name: 'Kátia',    last: 'Ribeiro',    email: 'katia.ribeiro@email.com',   class: classA.id },
    { name: 'Lucas',    last: 'Oliveira',   email: 'lucas.oliveira@email.com',  class: classA.id },
    // Turma B — 8 alunos
    { name: 'Mariana',  last: 'Santos',     email: 'mariana.santos@email.com',  class: classB.id },
    { name: 'Nicolas',  last: 'Carvalho',   email: 'nicolas.carvalho@email.com',class: classB.id },
    { name: 'Olivia',   last: 'Gomes',      email: 'olivia.gomes@email.com',    class: classB.id },
    { name: 'Paulo',    last: 'Araujo',     email: 'paulo.araujo@email.com',    class: classB.id },
    { name: 'Quezia',   last: 'Teixeira',   email: 'quezia.teixeira@email.com', class: classB.id },
    { name: 'Rafael',   last: 'Nascimento', email: 'rafael.nascimento@email.com',class: classB.id },
    { name: 'Sabrina',  last: 'Monteiro',   email: 'sabrina.monteiro@email.com',class: classB.id },
    { name: 'Thiago',   last: 'Barros',     email: 'thiago.barros@email.com',   class: classB.id },
  ]

  const students: { studentId: string; classId: string }[] = []

  for (const a of alunosData) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: {},
      create: {
        name: a.name,
        email: a.email,
        passwordHash: hash('Aluno@123'),
        role: Role.STUDENT,
        active: true,
      },
    })

    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        lastName: a.last,
        status: 'ACTIVE',
      },
    })

    await prisma.classStudent.upsert({
      where: { classId_studentId: { classId: a.class, studentId: student.id } },
      update: {},
      create: { classId: a.class, studentId: student.id },
    })

    students.push({ studentId: student.id, classId: a.class })
  }

  const studentsA = students.filter(s => s.classId === classA.id)
  const studentsB = students.filter(s => s.classId === classB.id)

  // ─── 4. PROVAS ─────────────────────────────────────────────────────────────
  console.log('📝  Criando 2 provas com questões...')

  const createExamWithQuestions = async (
    title: string,
    passing: number,
    cooldownDays: number,
  ) => {
    const exam = await prisma.exam.create({
      data: {
        title,
        description: `Prova gerada pelo seed — ${title}`,
        questionCount: 5,
        durationMinutes: 60,
        passingScore: passing,
        maxAttempts: 3,
        cooldownDays,
        questionOrder: QuestionOrder.FIXED,
        status: ExamStatus.PUBLISHED,
      },
    })

    const questions = []
    for (let i = 1; i <= 5; i++) {
      const q = await prisma.question.create({
        data: {
          examId: exam.id,
          text: `[${title}] Questão ${i}: qual é a alternativa correta?`,
          order: i,
          type: 'SINGLE_CHOICE',
        },
      })

      const alts = []
      for (let j = 1; j <= 4; j++) {
        const alt = await prisma.alternative.create({
          data: {
            questionId: q.id,
            text: `Alternativa ${j}`,
            isCorrect: j === 1, // sempre a primeira é correta
            order: j,
          },
        })
        alts.push(alt)
      }
      questions.push({ question: q, alternatives: alts })
    }

    return { exam, questions }
  }

  const { exam: examA, questions: questionsA } = await createExamWithQuestions('Prova CHPC L1', 70, 7)
  const { exam: examB, questions: questionsB } = await createExamWithQuestions('Prova CHPC L2', 75, 5)

  // ─── 5. LIBERAÇÕES ─────────────────────────────────────────────────────────
  console.log('🔓  Liberando provas para as turmas...')
  await prisma.examRelease.create({
    data: { examId: examA.id, classId: classA.id, releasedBy: adminUser.id },
  })
  await prisma.examRelease.create({
    data: { examId: examB.id, classId: classB.id, releasedBy: adminUser.id },
  })

  // ─── 6. TENTATIVAS DE PROVA ────────────────────────────────────────────────
  console.log('📊  Criando tentativas de prova...')

  // Distribuição para Turma A (12 alunos):
  // 6 aprovados | 3 reprovados | 2 em cooldown | 1 sem tentativa
  const createAttempt = async (
    studentId: string,
    exam: typeof examA,
    questions: typeof questionsA,
    result: 'PASSED' | 'FAILED' | 'IN_PROGRESS',
    score: number,
    correctCount: number,
  ) => {
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId,
        startedAt: daysAgo(Math.floor(Math.random() * 20) + 1),
        finishedAt: result !== 'IN_PROGRESS' ? daysAgo(Math.floor(Math.random() * 20)) : null,
        score: result !== 'IN_PROGRESS' ? score : null,
        correctAnswers: result !== 'IN_PROGRESS' ? correctCount : null,
        totalQuestions: 5,
        executionStatus: result === 'IN_PROGRESS' ? AttemptExecutionStatus.IN_PROGRESS : AttemptExecutionStatus.FINISHED,
        resultStatus: result === 'IN_PROGRESS' ? AttemptResultStatus.PENDING : result === 'PASSED' ? AttemptResultStatus.PASSED : AttemptResultStatus.FAILED,
        ip: '127.0.0.1',
        device: 'Mozilla/5.0 (seed)',
      },
    })

    // Respostas
    for (const { question, alternatives } of questions) {
      const chosen = result === 'PASSED'
        ? alternatives[0] // correta
        : alternatives[1] // errada
      await prisma.answer.create({
        data: {
          attemptId: attempt.id,
          questionId: question.id,
          alternativeId: chosen.id,
          isCorrect: chosen.isCorrect,
        },
      })
    }

    return attempt
  }

  // Turma A
  for (let i = 0; i < 6; i++) {
    const attempt = await createAttempt(studentsA[i].studentId, examA, questionsA, 'PASSED', 100, 5)
    await prisma.certificate.create({
      data: {
        studentId: studentsA[i].studentId,
        examId: examA.id,
        attemptId: attempt.id,
        code: cert(),
        issuedAt: daysAgo(i + 1),
      },
    })
  }
  for (let i = 6; i < 9; i++) {
    await createAttempt(studentsA[i].studentId, examA, questionsA, 'FAILED', 40, 2)
  }
  for (let i = 9; i < 11; i++) {
    await createAttempt(studentsA[i].studentId, examA, questionsA, 'FAILED', 50, 2)
    await prisma.cooldown.create({
      data: {
        studentId: studentsA[i].studentId,
        examId: examA.id,
        startedAt: daysAgo(2),
        endsAt: daysFrom(5),
        status: CooldownStatus.ACTIVE,
      },
    })
  }
  // studentsA[11] sem tentativa — sem ação

  // Turma B (8 alunos): 4 aprovados | 2 reprovados | 2 sem tentativa
  for (let i = 0; i < 4; i++) {
    const attempt = await createAttempt(studentsB[i].studentId, examB, questionsB, 'PASSED', 100, 5)
    await prisma.certificate.create({
      data: {
        studentId: studentsB[i].studentId,
        examId: examB.id,
        attemptId: attempt.id,
        code: cert(),
        issuedAt: daysAgo(i + 1),
      },
    })
  }
  for (let i = 4; i < 6; i++) {
    await createAttempt(studentsB[i].studentId, examB, questionsB, 'FAILED', 60, 3)
  }

  // ─── 7. NPS ────────────────────────────────────────────────────────────────
  console.log('📋  Criando 2 pesquisas NPS...')

  // NPS 1 — Turma A — ACTIVE com respostas variadas
  const nps1 = await prisma.npsSurvey.create({
    data: {
      title: 'NPS CHPC L1 MAIO',
      classId: classA.id,
      createdBy: adminUser.id,
      status: NpsStatus.ACTIVE,
    },
  })

  const [npsQ1, npsQ2] = await Promise.all([
    prisma.npsQuestion.create({
      data: {
        surveyId: nps1.id,
        text: 'De 0 a 10, qual sua satisfação com o curso?',
        order: 1,
        type: NpsQuestionType.SCORE,
      },
    }),
    prisma.npsQuestion.create({
      data: {
        surveyId: nps1.id,
        text: 'O que podemos melhorar?',
        order: 2,
        type: NpsQuestionType.TEXT,
      },
    }),
  ])

  // Distribuição de scores: 7 promotores (9-10), 2 neutros (7-8), 1 detrator (0-6)
  // Resultado esperado: NPS = ((7-1)/10) × 100 = 60
  const nps1Scores = [10, 10, 9, 9, 9, 9, 9, 8, 7, 4]
  const nps1Texts  = [
    'Excelente curso!', 'Ótima didática.', 'Muito bom, recomendo.',
    'Conteúdo rico.', 'Adorei a metodologia.', 'Superou minhas expectativas.',
    'Valeu muito.', 'Poderia ter mais exercícios.', 'Razoável, esperava mais.',
    'Tive dificuldades com o material.',
  ]

  for (let i = 0; i < studentsA.length && i < 10; i++) {
    const invite = await prisma.npsInvite.create({
      data: {
        surveyId: nps1.id,
        studentId: studentsA[i].studentId,
        status: NpsInviteStatus.RESPONDED,
        respondedAt: daysAgo(i + 1),
      },
    })

    const response = await prisma.npsResponse.create({
      data: {
        surveyId: nps1.id,
        studentId: studentsA[i].studentId,
        inviteId: invite.id,
        createdAt: daysAgo(i + 1),
      },
    })

    await prisma.npsResponseDetail.create({
      data: {
        responseId: response.id,
        questionId: npsQ1.id,
        score: nps1Scores[i],
      },
    })

    await prisma.npsResponseDetail.create({
      data: {
        responseId: response.id,
        questionId: npsQ2.id,
        text: nps1Texts[i],
      },
    })
  }

  // Convidados sem resposta (aluno 11)
  await prisma.npsInvite.create({
    data: {
      surveyId: nps1.id,
      studentId: studentsA[11].studentId,
      status: NpsInviteStatus.PENDING,
    },
  })

  // Convidados pendentes (alunos sem resposta) — todos da turma A convidados
  // (os 10 que responderam já têm invite criado acima)

  // NPS 2 — Turma B — ACTIVE sem nenhuma resposta ainda
  const nps2 = await prisma.npsSurvey.create({
    data: {
      title: 'NPS CHPC L2 JUNHO',
      classId: classB.id,
      createdBy: adminUser.id,
      status: NpsStatus.ACTIVE,
    },
  })

  await prisma.npsQuestion.create({
    data: {
      surveyId: nps2.id,
      text: 'De 0 a 10, qual sua satisfação com o curso?',
      order: 1,
      type: NpsQuestionType.SCORE,
    },
  })

  await prisma.npsQuestion.create({
    data: {
      surveyId: nps2.id,
      text: 'Você recomendaria este curso a um colega?',
      order: 2,
      type: NpsQuestionType.TEXT,
    },
  })

  // Convidar todos da Turma B sem resposta
  for (const s of studentsB) {
    await prisma.npsInvite.create({
      data: {
        surveyId: nps2.id,
        studentId: s.studentId,
        status: NpsInviteStatus.PENDING,
      },
    })
  }

  // ─── RESUMO ────────────────────────────────────────────────────────────────
  console.log('\n✅  Seed concluído com sucesso!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Admin        →  admin@eltcert.com / Admin@123')
  console.log('  Alunos       →  senha padrão: Aluno@123')
  console.log('  Turmas       →  CHPC L1 MAIO (12) | CHPC L2 JUNHO (8)')
  console.log('  Provas       →  Prova CHPC L1 | Prova CHPC L2')
  console.log('  Aprovados    →  6 (Turma A) + 4 (Turma B)')
  console.log('  Reprovados   →  3 (Turma A) + 2 (Turma B)')
  console.log('  Em cooldown  →  2 (Turma A)')
  console.log('  NPS 1        →  10 respostas | Score esperado: 60')
  console.log('  NPS 2        →  0 respostas | 8 convidados pendentes')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
