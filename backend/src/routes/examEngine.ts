import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { checkPermission } from '../middlewares/checkPermission';
import { getClientInfo } from '../middleware/audit';
import { sendExamPassedEmail, sendExamFailedEmail, sendExamAbandonedEmail } from '../services/mail';
import { generateCertificateCode, sendCertificateByEmail } from '../services/certificateService';
import { triggerExamWebhook } from '../services/webhookService';
import { v4 as uuid } from 'uuid';

const router = Router();

// ============================================================
// STUDENT: Start an exam attempt
// POST /api/exam-engine/start/:examId
// ============================================================
router.post('/start/:examId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const userId = req.user!.userId;

    const student = await prisma.student.findUnique({
      where: { userId },
      include: { classes: true }
    });
    if (!student) return res.status(403).json({ error: 'Apenas alunos podem iniciar provas' });

    // Enforce Release (Security Check)
    const classIds = student.classes.map(c => c.classId);
    const release = await prisma.examRelease.findFirst({
      where: {
        examId: examId as string,
        OR: [
          { studentId: student.id },
          { classId: { in: classIds } }
        ]
      }
    });

    if (!release) return res.status(403).json({ error: 'Você não tem liberação para esta prova.' });

    const exam = await prisma.exam.findUnique({
      where: { id: examId as string },
      include: { questions: { include: { alternatives: true }, orderBy: { order: 'asc' } } },
    });
    if (!exam) return res.status(404).json({ error: 'Prova não encontrada' });
    if (exam.status !== 'PUBLISHED') return res.status(400).json({ error: 'Esta prova não está disponível' });

    // Check max attempts
    if (exam.maxAttempts > 0) {
      const attemptCount = await prisma.examAttempt.count({
        where: { examId: examId as string, studentId: student.id, executionStatus: { not: 'IN_PROGRESS' } },
      });
      if (attemptCount >= exam.maxAttempts) {
        return res.status(400).json({ error: `Número máximo de tentativas atingido (${exam.maxAttempts})` });
      }
    }

    // Check for in-progress attempt
    const inProgress = await prisma.examAttempt.findFirst({
      where: { examId: examId as string, studentId: student.id, executionStatus: 'IN_PROGRESS' },
    });
    
    const ex: any = exam;
    if (inProgress) {
      const questions = ex.questionOrder === 'RANDOM'
        ? ex.questions.sort(() => Math.random() - 0.5)
        : ex.questions;

      return res.json({
        attempt: inProgress,
        questions: questions.map((q: any) => ({
          id: q.id, text: q.text, type: q.type, order: q.order,
          alternatives: q.alternatives.map((a: any) => ({ id: a.id, text: a.text, order: a.order })),
        })),
        exam: { id: exam.id, title: exam.title, durationMinutes: exam.durationMinutes, passingScore: exam.passingScore, questionCount: exam.questionCount },
        existingAnswers: await prisma.answer.findMany({ where: { attemptId: inProgress.id } }),
      });
    }

    // Check cooldown
    const activeCooldown = await prisma.cooldown.findFirst({
      where: { examId: examId as string, studentId: student.id, status: 'ACTIVE', endsAt: { gt: new Date() } },
    });
    if (activeCooldown) {
      const remainingHours = Math.ceil((activeCooldown.endsAt.getTime() - Date.now()) / (1000 * 60 * 60));
      return res.status(400).json({ error: `Você está em cooldown. Tente novamente em ${remainingHours}h.`, cooldownEndsAt: activeCooldown.endsAt });
    }

    // Create attempt
    const { ip, device } = getClientInfo(req);
    const attempt = await prisma.examAttempt.create({
      data: { examId: examId as string, studentId: student.id, ip, device, executionStatus: 'IN_PROGRESS', resultStatus: 'PENDING' },
    });

    // Audit
    await prisma.auditEvent.create({
      data: { userId, action: 'EXAM_START', entity: 'ExamAttempt', entityId: attempt.id, ip, device },
    });

    const questions = ex.questionOrder === 'RANDOM'
      ? ex.questions.sort(() => Math.random() - 0.5)
      : ex.questions;

    return res.status(201).json({
      attempt,
      questions: questions.map((q: any) => ({
        id: q.id, text: q.text, type: q.type, order: q.order,
        alternatives: q.alternatives.map((a: any) => ({ id: a.id, text: a.text, order: a.order })),
      })),
      exam: { id: exam.id, title: exam.title, durationMinutes: exam.durationMinutes, passingScore: exam.passingScore, questionCount: exam.questionCount },
      existingAnswers: [],
    });
  } catch (error: any) {
    console.error('Start exam error:', error);
    return res.status(500).json({ error: 'Erro ao iniciar prova' });
  }
});

// ============================================================
// STUDENT: Save answer (auto-save)
// POST /api/exam-engine/answer
// ============================================================
router.post('/answer', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { attemptId, questionId, alternativeId } = req.body;

    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId as string } });
    if (!attempt || attempt.executionStatus !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Tentativa não está em andamento' });
    }

    const exam = await prisma.exam.findUnique({ where: { id: attempt.examId as string } });
    if (exam) {
      const elapsed = (Date.now() - attempt.startedAt.getTime()) / 60000;
      if (elapsed > exam.durationMinutes) {
        // Auto-abandon timeout
        await prisma.examAttempt.update({
          where: { id: attemptId as string },
          data: { executionStatus: 'EXPIRED', resultStatus: 'FAILED_TIMEOUT', finishedAt: new Date(), score: 0 },
        });
        
        if (exam.cooldownDays > 0) {
          const endsAt = new Date(Date.now() + exam.cooldownDays * 24 * 60 * 60 * 1000);
          await prisma.cooldown.create({
            data: { studentId: attempt.studentId, examId: attempt.examId, endsAt, status: 'ACTIVE' },
          });
        }

        prisma.student.findUnique({ where: { id: attempt.studentId }, include: { user: true } })
          .then(s => {
            if (s) sendExamAbandonedEmail(s.user.name, s.user.email, exam.title, s.lastName || '')
              .catch(err => console.error('[MAIL] Abandoned-Timeout Error:', err));
          });

        return res.status(400).json({ error: 'Tempo esgotado. Prova encerrada.', expired: true });
      }
    }

    const existing = await prisma.answer.findFirst({
      where: { attemptId: attemptId as string, questionId: questionId as string },
    });

    const alternative = alternativeId
      ? await prisma.alternative.findUnique({ where: { id: alternativeId as string } })
      : null;

    if (existing) {
      await prisma.answer.update({
        where: { id: existing.id as string },
        data: { alternativeId: alternativeId as string, isCorrect: alternative?.isCorrect || false },
      });
    } else {
      await prisma.answer.create({
        data: { attemptId: attemptId as string, questionId: questionId as string, alternativeId: alternativeId as string, isCorrect: alternative?.isCorrect || false },
      });
    }

    return res.json({ saved: true });
  } catch (error: any) {
    console.error('Save answer error:', error);
    return res.status(500).json({ error: 'Erro ao salvar resposta' });
  }
});

// ============================================================
// STUDENT: Submit exam
// POST /api/exam-engine/submit/:attemptId
// ============================================================
router.post('/submit/:attemptId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user!.userId;

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId as string },
      include: { 
        answers: true, 
        exam: { include: { _count: { select: { questions: true } } } },
        student: { include: { user: true } }
      },
    });

    if (!attempt || attempt.executionStatus !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Tentativa não está em andamento' });
    }

    const att: any = attempt;
    // Usar a quantidade exata de questões atribuídas a prova em vez do campo genérico
    const totalQuestions = att.exam._count.questions;
    const correctAnswers = att.answers.filter((a: any) => a.isCorrect).length;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const passed = score >= att.exam.passingScore;

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId as string },
      data: {
        executionStatus: 'FINISHED',
        resultStatus: passed ? 'PASSED' : 'FAILED',
        finishedAt: new Date(),
        score,
        correctAnswers,
        totalQuestions,
      },
    });

    // Gerar cooldown se o aluno reprovou
    let endsAt: Date | null = null;
    if (!passed && att.exam.cooldownDays > 0) {
      endsAt = new Date(Date.now() + att.exam.cooldownDays * 24 * 60 * 60 * 1000);
      await prisma.cooldown.create({
        data: { studentId: attempt.studentId, examId: attempt.examId, endsAt, status: 'ACTIVE' },
      });
    }

    // Se passou, cria certificado
    let certificate = null;
    if (passed) {
      const code = await generateCertificateCode();
      certificate = await prisma.certificate.create({
        data: {
          studentId: attempt.studentId,
          examId: attempt.examId,
          attemptId: attempt.id,
          code,
        },
      });

      // Enviar certificado em PDF por e-mail
      const certStudentName = `${att.student.user.name} ${att.student.lastName || ''}`.trim();
      sendCertificateByEmail(code, att.student.user.email, certStudentName)
        .catch(err => console.error('[MAIL] Certificate-Mail Error:', err));
    }

    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: {
        userId, action: passed ? 'EXAM_PASSED' : 'EXAM_FAILED',
        entity: 'ExamAttempt', entityId: attemptId as string, ip, device,
        metadata: JSON.stringify({ score, correctAnswers, totalQuestions }),
      },
    });

    // DISPARO DE E-MAILS ASSÍNCRONO
    if (passed) {
      sendExamPassedEmail(
        att.student.user.name,
        att.student.user.email,
        att.exam.title,
        score,
        correctAnswers,
        totalQuestions,
        // futuramente gerar URL de print do certificado
        undefined,
        att.student.lastName || ''
      ).catch((err) => console.error('[MAIL] Pass-Mail Error:', err));
    } else {
      sendExamFailedEmail(
        att.student.user.name,
        att.student.user.email,
        att.exam.title,
        score,
        correctAnswers,
        totalQuestions,
        endsAt || undefined,
        att.student.lastName || '',
        attempt.id
      ).catch((err) => console.error('[MAIL] Fail-Mail Error:', err));
    }

    // DISPARO DE WEBHOOK ASSÍNCRONO
    triggerExamWebhook(attempt.examId, {
      event: passed ? 'exam.approved' : 'exam.failed',
      timestamp: new Date().toISOString(),
      student: {
        id: att.student.id,
        name: `${att.student.user.name} ${att.student.lastName || ''}`.trim(),
        email: att.student.user.email,
      },
      exam: {
        id: att.exam.id,
        title: att.exam.title,
      },
      attempt: {
        id: attempt.id,
        score,
        passed,
        totalQuestions,
        correctAnswers,
      },
      ...(certificate ? {
        certificate: {
          code: certificate.code,
          validationUrl: `${process.env.PRODUCTION_URL || 'https://certify.elitetraining.com.br'}/api/certificates/validate/${certificate.code}`,
        }
      } : {}),
    }).catch(err => console.error('[Webhook] Trigger Error:', err));

    return res.json({ attempt: updated, score, passed, correctAnswers, totalQuestions, certificate });
  } catch (error: any) {
    console.error('Submit exam error:', error);
    return res.status(500).json({ error: 'Erro ao submeter prova' });
  }
});

// ============================================================
// STUDENT: Abandon exam (Anti-cheat triggered)
// POST /api/exam-engine/abandon/:attemptId
router.post('/abandon/:attemptId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const attemptId = req.params.attemptId as string;
    const { reason } = req.body;

    console.log(`[ABANDON] Received abandon request for attempt ${attemptId} due to ${reason}`);

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId as string },
      include: { exam: true },
    });

    if (!attempt) {
       console.log(`[ABANDON] Attempt not found: ${attemptId}`);
       return res.status(200).json({ ok: true, message: 'Already processed' });
    }

    if (attempt.executionStatus !== 'IN_PROGRESS') {
      console.log(`[ABANDON] Attempt is not IN_PROGRESS. Current status: ${attempt.executionStatus}`);
      return res.status(200).json({ ok: true, message: 'Already processed' });
    }

    console.log(`[ABANDON] Updating attempt ${attemptId} to ABANDONED`);
    await prisma.examAttempt.update({
      where: { id: attemptId as string },
      data: { executionStatus: 'ABANDONED', resultStatus: 'FAILED_ABANDONMENT', finishedAt: new Date(), score: 0 },
    });

    if (attempt.exam.cooldownDays > 0) {
      const endsAt = new Date(Date.now() + attempt.exam.cooldownDays * 24 * 60 * 60 * 1000);
      await prisma.cooldown.create({
        data: { studentId: attempt.studentId, examId: attempt.examId, endsAt, status: 'ACTIVE' },
      });
    }

    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: { userId: req.user!.userId, action: 'EXAM_ABANDONED', entity: 'ExamAttempt', entityId: attemptId, ip, device, metadata: JSON.stringify({ reason }) },
    });

    prisma.student.findUnique({ where: { id: attempt.studentId }, include: { user: true } })
      .then(s => {
        if (s) sendExamAbandonedEmail(s.user.name, s.user.email, attempt.exam.title, s.lastName || '')
          .catch(err => console.error('[MAIL] Abandoned-Voluntary Error:', err));
      });

    return res.json({ message: 'Prova abandonada' });
  } catch (error: any) {
    console.error('Abandon exam error:', error);
    return res.status(500).json({ error: 'Erro ao abandonar prova' });
  }
});

// ============================================================
// STUDENT: Get exam result / review
// GET /api/exam-engine/result/:attemptId
// ============================================================
router.get('/result/:attemptId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId as string },
      include: {
        exam: true,
        answers: { include: { question: { include: { alternatives: { orderBy: { order: 'asc' } } } }, alternative: true } },
        certificate: true,
      },
    });

    if (!attempt) return res.status(404).json({ error: 'Tentativa não encontrada' });
    if (attempt.executionStatus === 'IN_PROGRESS') return res.status(400).json({ error: 'Prova ainda em andamento' });

    const attRes: any = attempt;
    const allQuestions = await prisma.question.findMany({
      where: { examId: attRes.examId },
      include: { alternatives: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });

    let review;
    if (attRes.resultStatus === 'PASSED') {
      // Return ALL questions
      review = allQuestions.map(q => {
        const answer = attRes.answers.find((a: any) => a.questionId === q.id);
        return {
          id: q.id, text: q.text, order: q.order,
          alternatives: q.alternatives.map(a => ({ id: a.id, text: a.text, order: a.order, isCorrect: a.isCorrect, wasSelected: answer?.alternativeId === a.id })),
          studentCorrect: answer?.isCorrect || false,
        };
      });
    } else {
      // Return ONLY incorrect questions (FAILED, FAILED_ABANDONMENT, FAILED_TIMEOUT)
      review = allQuestions
        .filter(q => {
          const answer = attRes.answers.find((a: any) => a.questionId === q.id);
          return !answer || !answer.isCorrect;
        })
        .map(q => {
          const answer = attRes.answers.find((a: any) => a.questionId === q.id);
          return {
            id: q.id, text: q.text, order: q.order,
            alternatives: q.alternatives.map(a => ({ id: a.id, text: a.text, order: a.order, isCorrect: a.isCorrect, wasSelected: answer?.alternativeId === a.id })),
            studentCorrect: false,
          };
        });
    }

    return res.json({
      attempt: {
        id: attRes.id, executionStatus: attRes.executionStatus, resultStatus: attRes.resultStatus, score: attRes.score,
        startedAt: attRes.startedAt, finishedAt: attRes.finishedAt,
      },
      exam: { id: attRes.exam.id, title: attRes.exam.title, passingScore: attRes.exam.passingScore },
      totalQuestions: allQuestions.length,
      correctAnswers: attRes.answers.filter((a: any) => a.isCorrect).length,
      review,
      certificate: attRes.certificate,
    });
  } catch (error: any) {
    console.error('Get result error:', error);
    return res.status(500).json({ error: 'Erro ao buscar resultado' });
  }
});

// ============================================================
// STUDENT: List available exams
// GET /api/exam-engine/available
// ============================================================
router.get('/available', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const student = await prisma.student.findUnique({
      where: { userId },
      include: { classes: { include: { class: true } }, user: true },
    });

    if (!student) return res.status(403).json({ error: 'Apenas alunos podem acessar' });

    const classIds = student.classes.map(c => c.classId);

    // Fetch exams that are PUBLISHED and released to either the student's classes or the student directly
    const exams = await prisma.exam.findMany({
      where: {
        status: 'PUBLISHED',
        releases: {
          some: {
            OR: [
              { classId: { in: classIds } },
              { studentId: student.id }
            ]
          }
        }
      },
      include: {
        _count: { select: { questions: true } },
        releases: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[DEBUG /available] User: ${student.user.email}, ID: ${student.id}`);
    console.log(`[DEBUG /available] Class IDs: ${classIds.join(', ')}`);
    console.log(`[DEBUG /available] Exams Found: ${exams.length}`, exams.map(e => e.title));

    // Evaluate attempt counts and cooldowns
    const examsWithMetadata = await Promise.all(
      exams.map(async (exam) => {
        const attempts = await prisma.examAttempt.findMany({
          where: { examId: exam.id, studentId: student.id },
          orderBy: { startedAt: 'desc' },
        });

        const activeCooldown = await prisma.cooldown.findFirst({
          where: { examId: exam.id, studentId: student.id, status: 'ACTIVE', endsAt: { gt: new Date() } },
        });

        const certificate = await prisma.certificate.findFirst({
          where: { examId: exam.id, studentId: student.id },
        });

        const inProgress = attempts.some(a => a.executionStatus === 'IN_PROGRESS');
        
        // Computed Available Status
        let frontendStatus = 'AVAILABLE';
        if (inProgress) frontendStatus = 'IN_PROGRESS';
        else if (activeCooldown) frontendStatus = 'COOLDOWN_BLOCKED';
        else if (certificate) frontendStatus = 'PASSED';
        else if (exam.maxAttempts > 0 && attempts.length >= exam.maxAttempts) frontendStatus = 'EXHAUSTED';

        // Attach class relation if exam was released via class
        let examClass = null;
        const release = exam.releases.find(r => r.studentId === student.id || (r.classId && classIds.includes(r.classId)));
        if (release && release.classId) {
          const cls = student.classes.find(c => c.classId === release.classId);
          if (cls) examClass = { id: cls.class.id, name: cls.class.name };
        }

        return {
          ...exam,
          questionCount: exam._count.questions, // Quantidade REAL/Exata de questões no DB
          frontendStatus,
          class: examClass,
          attempts: attempts.length,
          lastAttempt: attempts[0] || null,
          hasCooldown: !!activeCooldown,
          cooldownEndsAt: activeCooldown?.endsAt || null,
          hasCertificate: !!certificate,
          certificateCode: certificate?.code || null,
        };
      })
    );

    return res.json(examsWithMetadata);
  } catch (error: any) {
    console.error('Available exams error:', error);
    return res.status(500).json({ error: 'Erro ao listar provas disponíveis' });
  }
});

// ============================================================
// STUDENT: My certificates
// GET /api/exam-engine/certificates
// ============================================================
router.get('/certificates', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) return res.status(403).json({ error: 'Apenas alunos' });

    const certificates = await prisma.certificate.findMany({
      where: { studentId: student.id },
      include: { exam: { select: { id: true, title: true } } },
      orderBy: { issuedAt: 'desc' },
    });

    return res.json(certificates);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar certificados' });
  }
});

export default router;
