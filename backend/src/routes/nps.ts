import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { v4 as uuid } from 'uuid';

const router = Router();

// ============================================================
// SURVEYS CRUD (Admin)
// ============================================================

// GET /api/nps/surveys
router.get('/surveys', authMiddleware, async (req: Request, res: Response) => {
  try {
    const surveys = await prisma.npsSurvey.findMany({
      include: {
        class: { select: { id: true, name: true } },
        _count: { select: { questions: true, invites: true, responses: true } },
        questions: { select: { id: true, type: true }, orderBy: { order: 'asc' } },
        responses: { include: { details: { select: { questionId: true, score: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = surveys.map(s => {
      let npsScore: number | null = null;
      const scoreQuestionIds = s.questions.filter(q => q.type === 'SCORE').map(q => q.id);

      if (scoreQuestionIds.length > 0 && s.responses.length > 0) {
        let promoters = 0, detractors = 0, passives = 0;
        s.responses.forEach(r => {
          const firstScore = r.details.find(d => scoreQuestionIds.includes(d.questionId));
          if (firstScore && firstScore.score !== null) {
            if (firstScore.score >= 9) promoters++;
            else if (firstScore.score <= 6) detractors++;
            else passives++;
          }
        });
        const total = promoters + detractors + passives;
        npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
      }

      // Remove heavy data from response
      const { questions: _q, responses: _r, ...rest } = s as any;
      return { ...rest, npsScore };
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar pesquisas' });
  }
});

// POST /api/nps/surveys
router.post('/surveys', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { title, classId, questions } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const survey = await prisma.npsSurvey.create({
      data: {
        title,
        classId: (classId === 'ALL' || !classId) ? null : classId,
        createdBy: req.user!.userId,
        ...(questions?.length && {
          questions: {
            create: questions.map((q: any, i: number) => ({
              text: q.text,
              type: q.type || 'SCORE',
              options: q.options || null,
              order: q.order ?? i + 1,
            })),
          },
        }),
      },
      include: { questions: true },
    });

    return res.status(201).json(survey);
  } catch (error: any) {
    console.error('Create survey error:', error);
    return res.status(500).json({ error: 'Erro ao criar pesquisa' });
  }
});

// PUT /api/nps/surveys/:id
router.put('/surveys/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const surveyId = req.params.id as string;

    // Block editing if survey already has responses
    const responseCount = await prisma.npsResponse.count({ where: { surveyId } });
    if (responseCount > 0) {
      return res.status(403).json({ error: 'Esta pesquisa já possui respostas e não pode ser editada.' });
    }

    const { title, classId, status, questions } = req.body;
    const survey = await prisma.npsSurvey.update({
      where: { id: surveyId },
      data: {
        ...(title && { title }),
        ...(classId !== undefined && { classId: classId === 'ALL' ? null : (classId || null) }),
        ...(status && { status }),
      },
    });

    // Update questions if provided
    if (questions && Array.isArray(questions)) {
      for (const q of questions) {
        if (q.id && q.text) {
          await prisma.npsQuestion.update({
            where: { id: q.id },
            data: {
              text: q.text,
              ...(q.type && { type: q.type }),
              ...(q.options !== undefined && { options: q.options || null }),
            },
          });
        }
      }
    }

    const updated = await prisma.npsSurvey.findUnique({
      where: { id: surveyId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar pesquisa' });
  }
});

// DELETE /api/nps/surveys/:id
router.delete('/surveys/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.npsSurvey.delete({ where: { id: req.params.id as string } });
    return res.json({ message: 'Pesquisa excluída' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir pesquisa' });
  }
});

// ============================================================
// INVITES — Send NPS to students
// ============================================================

// POST /api/nps/surveys/:id/send — Send to all students in class
router.post('/surveys/:id/send', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const survey = await prisma.npsSurvey.findUnique({
      where: { id: req.params.id as string },
      include: { class: { include: { students: true } } },
    });

    if (!survey) return res.status(404).json({ error: 'Pesquisa não encontrada' });
    
    let studentIds: string[] = [];
    if (survey.classId) {
      studentIds = (survey as any).class.students.map((cs: any) => cs.studentId);
    } else {
      // Global NPS - send to all students
      const allStudents = await prisma.student.findMany({ select: { id: true } });
      studentIds = allStudents.map(s => s.id);
    }

    const existingInvites = await prisma.npsInvite.findMany({
      where: { surveyId: survey.id, studentId: { in: studentIds } },
    });
    const existingStudentIds = existingInvites.map((i: any) => i.studentId);
    const newStudentIds = studentIds.filter((id: string) => !existingStudentIds.includes(id));

    if (newStudentIds.length === 0) {
      return res.json({ message: 'Todos os alunos elegíveis já foram convidados', sent: 0 });
    }

    await prisma.npsInvite.createMany({
      data: newStudentIds.map((studentId: string) => ({
        surveyId: survey.id,
        studentId,
        token: uuid(),
      })),
    });

    // Activate survey
    if (survey.status === 'DRAFT') {
      await prisma.npsSurvey.update({
        where: { id: survey.id },
        data: { status: 'ACTIVE' },
      });
    }

    return res.json({ message: `Convites enviados para ${newStudentIds.length} aluno(s)`, sent: newStudentIds.length });
  } catch (error: any) {
    console.error('Send NPS error:', error);
    return res.status(500).json({ error: 'Erro ao enviar convites' });
  }
});

// POST /api/nps/surveys/:id/send-individual — Send to one student
router.post('/surveys/:id/send-individual', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'ID do aluno é obrigatório' });

    const existingInvite = await prisma.npsInvite.findFirst({
      where: { surveyId: req.params.id as string, studentId }
    });

    if (existingInvite) return res.status(400).json({ error: 'Aluno já possui convite para esta pesquisa' });

    await prisma.npsInvite.create({
      data: {
        surveyId: req.params.id as string,
        studentId,
        token: uuid()
      }
    });

    // Ensure survey is active
    await prisma.npsSurvey.update({
      where: { id: req.params.id as string },
      data: { status: 'ACTIVE' }
    });

    return res.json({ message: 'Convite enviado com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao enviar convite individual' });
  }
});

// ============================================================
// STUDENT ENDPOINTS
// ============================================================

// GET /api/nps/my-pending — List pending NPS for student
router.get('/my-pending', authMiddleware, requireRole('STUDENT'), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } });
    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    const pending = await prisma.npsInvite.findMany({
      where: { 
        studentId: student.id,
        respondedAt: null,
        survey: { status: 'ACTIVE' }
      },
      include: {
        survey: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            _count: { select: { questions: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(pending);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar pesquisas pendentes' });
  }
});

// GET /api/nps/surveys/:id/student-details — Structure for student to respond
router.get('/surveys/:id/student-details', authMiddleware, requireRole('STUDENT'), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } });
    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    const invite = await prisma.npsInvite.findFirst({
      where: { surveyId: req.params.id as string, studentId: student.id },
      include: {
        survey: {
          include: {
            questions: { orderBy: { order: 'asc' } }
          }
        }
      }
    });

    if (!invite) return res.status(404).json({ error: 'Convite não encontrado' });
    if (invite.respondedAt) return res.status(400).json({ error: 'Você já respondeu esta pesquisa', alreadyResponded: true });

    return res.json((invite as any).survey);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar detalhes da pesquisa' });
  }
});

// POST /api/nps/responses/submit — Authenticated response submission
router.post('/responses/submit', authMiddleware, requireRole('STUDENT'), async (req: Request, res: Response) => {
  try {
    const { surveyId, answers } = req.body;
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } });
    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    const invite = await prisma.npsInvite.findFirst({
      where: { surveyId: surveyId as string, studentId: student.id }
    });

    if (!invite) return res.status(404).json({ error: 'Convite não encontrado' });
    if (invite.respondedAt) return res.status(400).json({ error: 'Já respondida' });

    const response = await prisma.npsResponse.create({
      data: {
        surveyId,
        studentId: student.id,
        inviteId: invite.id,
        details: {
          create: answers.map((a: any) => ({
            questionId: a.questionId,
            score: a.score ?? null,
            text: a.text ?? null,
          })),
        },
      },
    });

    await prisma.npsInvite.update({
      where: { id: invite.id },
      data: { respondedAt: new Date(), status: 'RESPONDED' },
    });

    return res.status(201).json({ message: 'Resposta registrada com sucesso' });
  } catch (error) {
    console.error('Submit NPS error:', error);
    return res.status(500).json({ error: 'Erro ao registrar resposta' });
  }
});

// ============================================================
// RESPOND — Public (token)
// ============================================================

// GET /api/nps/respond/:token — Get survey by token
router.get('/respond/:token', async (req: Request, res: Response) => {
  try {
    const invite = await prisma.npsInvite.findUnique({
      where: { token: req.params.token as string },
      include: {
        survey: { include: { questions: { orderBy: { order: 'asc' } } } },
        student: { include: { user: { select: { name: true } } } },
      },
    });

    if (!invite) return res.status(404).json({ error: 'Link inválido' });
    if (invite.respondedAt) return res.status(400).json({ error: 'Pesquisa já respondida', alreadyResponded: true });

    return res.json({
      survey: (invite as any).survey,
      studentName: (invite as any).student.user.name,
      inviteId: invite.id,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar pesquisa' });
  }
});

// POST /api/nps/respond/:token — Submit NPS response via token
router.post('/respond/:token', async (req: Request, res: Response) => {
  try {
    const { answers } = req.body;
    const invite = await prisma.npsInvite.findUnique({
      where: { token: req.params.token as string },
    });

    if (!invite) return res.status(404).json({ error: 'Link inválido' });
    if (invite.respondedAt) return res.status(400).json({ error: 'Já respondida' });

    const response = await prisma.npsResponse.create({
      data: {
        surveyId: invite.surveyId,
        studentId: invite.studentId,
        inviteId: invite.id,
        details: {
          create: answers.map((a: any) => ({
            questionId: a.questionId,
            score: a.score ?? null,
            text: a.text ?? null,
          })),
        },
      },
    });

    await prisma.npsInvite.update({
      where: { id: invite.id },
      data: { respondedAt: new Date(), status: 'RESPONDED' },
    });

    return res.json({ message: 'Resposta registrada com sucesso', responseId: response.id });
  } catch (error: any) {
    console.error('NPS respond error:', error);
    return res.status(500).json({ error: 'Erro ao registrar resposta' });
  }
});

// ============================================================
// NPS DASHBOARD — Stats per survey
// ============================================================

// GET /api/nps/surveys/:id/results
router.get('/surveys/:id/results', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const survey = await prisma.npsSurvey.findUnique({
      where: { id: req.params.id as string },
      include: {
        questions: { orderBy: { order: 'asc' } },
        invites: { include: { student: { include: { user: { select: { name: true, email: true } } } } } },
        responses: {
          include: {
            student: { include: { user: { select: { name: true, email: true } } } },
            details: true,
          },
        },
        class: {
          include: {
            students: {
              include: {
                student: { include: { user: { select: { name: true, email: true } } } }
              }
            }
          }
        }
      },
    });

    if (!survey) return res.status(404).json({ error: 'Pesquisa não encontrada' });

    // Build class students status list
    let studentsStatus: any[] = [];
    if (survey.class) {
      studentsStatus = survey.class.students.map((cs: any) => {
        const invite = survey.invites.find(i => i.studentId === cs.studentId);
        return {
          id: cs.studentId,
          name: cs.student.user.name,
          email: cs.student.user.email,
          status: invite?.respondedAt ? 'RESPONDED' : (invite ? 'PENDING' : 'NOT_INVITED')
        };
      });
    }

    // Calculate NPS for score questions
    const scoreQuestions = survey.questions.filter(q => q.type === 'SCORE' || q.type === 'RATING_5');
    let npsScore = null;
    let promoters = 0, detractors = 0, passives = 0;

    if (scoreQuestions.length > 0 && (survey as any).responses.length > 0) {
      (survey as any).responses.forEach((r: any) => {
        // We evaluate NPS generally based on the first score question or average if preferred.
        // Usually NPS is based on the "Primary" question (the 0-10 one). 
        // We'll take the first question that is SCORE.
        const firstScore = r.details.find((d: any) => {
          const q = survey.questions.find(sq => sq.id === d.questionId);
          return q?.type === 'SCORE';
        });

        if (firstScore && firstScore.score !== null) {
          if (firstScore.score >= 9) promoters++;
          else if (firstScore.score <= 6) detractors++;
          else passives++;
        }
      });
      const totalResponses = promoters + detractors + passives;
      npsScore = totalResponses > 0 ? Math.round(((promoters - detractors) / totalResponses) * 100) : 0;
    }

    return res.json({
      survey: { id: survey.id, title: survey.title, status: survey.status, classId: survey.classId },
      stats: {
        totalInvites: (survey as any).invites.length,
        totalResponses: (survey as any).responses.length,
        responseRate: (survey as any).invites.length > 0 ? Math.round(((survey as any).responses.length / (survey as any).invites.length) * 100) : 0,
        npsScore,
        promoters, passives, detractors,
      },
      questions: survey.questions,
      studentsStatus,
      responses: (survey as any).responses.map((r: any) => ({
        id: r.id,
        studentName: r.student.user.name,
        studentEmail: r.student.user.email,
        answers: r.details,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('NPS results error:', error);
    return res.status(500).json({ error: 'Erro ao carregar resultados' });
  }
});

// ============================================================
// EXPORT CSV
// ============================================================
router.get('/surveys/:id/export', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const survey = await prisma.npsSurvey.findUnique({
      where: { id: req.params.id as string },
      include: {
        questions: { orderBy: { order: 'asc' } },
        responses: {
          include: {
            student: { include: { user: { select: { name: true, email: true } } } },
            details: true,
          },
        },
      },
    });

    if (!survey) return res.status(404).json({ error: 'Pesquisa não encontrada' });

    // Build CSV
    const headers = ['Aluno', 'Email', ...(survey as any).questions.map((q: any) => q.text), 'Data'];
    const rows = (survey as any).responses.map((r: any) => {
      const answers = (survey as any).questions.map((q: any) => {
        const detail = r.details.find((d: any) => d.questionId === q.id);
        return detail?.score?.toString() || detail?.text || '';
      });
      return [r.student.user.name, r.student.user.email, ...answers, r.createdAt.toISOString()];
    });

    const csv = [headers.join(';'), ...rows.map((r: any) => r.join(';'))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nps-${survey.id}.csv"`);
    return res.send('\uFEFF' + csv); // BOM for Excel
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao exportar' });
  }
});

// ============================================================
// STUDENT HISTORY
// ============================================================
router.get('/history', authMiddleware, requireRole('STUDENT'), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } });
    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    const responses = await prisma.npsResponse.findMany({
      where: { studentId: student.id },
      include: {
        survey: { select: { id: true, title: true } },
        details: { include: { question: { select: { text: true, type: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(responses);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar histórico de NPS' });
  }
});

export default router;

