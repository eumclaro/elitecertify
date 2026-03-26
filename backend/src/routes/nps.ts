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
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(surveys);
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
        classId: classId || null,
        createdBy: req.user!.userId,
        ...(questions?.length && {
          questions: {
            create: questions.map((q: any, i: number) => ({
              text: q.text,
              type: q.type || 'SCORE',
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
    const { title, classId, status } = req.body;
    const survey = await prisma.npsSurvey.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(classId !== undefined && { classId: classId || null }),
        ...(status && { status }),
      },
    });
    return res.json(survey);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar pesquisa' });
  }
});

// DELETE /api/nps/surveys/:id
router.delete('/surveys/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.npsSurvey.delete({ where: { id: req.params.id } });
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
      where: { id: req.params.id },
      include: { class: { include: { students: true } } },
    });

    if (!survey) return res.status(404).json({ error: 'Pesquisa não encontrada' });
    if (!survey.class) return res.status(400).json({ error: 'Pesquisa sem turma associada' });

    const studentIds = survey.class.students.map(cs => cs.studentId);
    const existingInvites = await prisma.npsInvite.findMany({
      where: { surveyId: survey.id, studentId: { in: studentIds } },
    });
    const existingStudentIds = existingInvites.map(i => i.studentId);
    const newStudentIds = studentIds.filter(id => !existingStudentIds.includes(id));

    if (newStudentIds.length === 0) {
      return res.json({ message: 'Todos os alunos já foram convidados', sent: 0 });
    }

    await prisma.npsInvite.createMany({
      data: newStudentIds.map(studentId => ({
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

// ============================================================
// RESPOND — Public (token) or Authenticated
// ============================================================

// GET /api/nps/respond/:token — Get survey by token
router.get('/respond/:token', async (req: Request, res: Response) => {
  try {
    const invite = await prisma.npsInvite.findUnique({
      where: { token: req.params.token },
      include: {
        survey: { include: { questions: { orderBy: { order: 'asc' } } } },
        student: { include: { user: { select: { name: true } } } },
      },
    });

    if (!invite) return res.status(404).json({ error: 'Link inválido' });
    if (invite.respondedAt) return res.status(400).json({ error: 'Pesquisa já respondida', alreadyResponded: true });

    return res.json({
      survey: invite.survey,
      studentName: invite.student.user.name,
      inviteId: invite.id,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar pesquisa' });
  }
});

// POST /api/nps/respond/:token — Submit NPS response
router.post('/respond/:token', async (req: Request, res: Response) => {
  try {
    const { answers } = req.body; // [{ questionId, score?, text? }]
    const invite = await prisma.npsInvite.findUnique({
      where: { token: req.params.token },
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
      data: { respondedAt: new Date() },
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
      where: { id: req.params.id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        invites: { include: { student: { include: { user: { select: { name: true, email: true } } } } } },
        responses: {
          include: {
            student: { include: { user: { select: { name: true, email: true } } } },
            details: true,
          },
        },
      },
    });

    if (!survey) return res.status(404).json({ error: 'Pesquisa não encontrada' });

    // Calculate NPS for score questions
    const scoreQuestions = survey.questions.filter(q => q.type === 'SCORE');
    let npsScore = null;
    let promoters = 0, detractors = 0, passives = 0;

    if (scoreQuestions.length > 0 && survey.responses.length > 0) {
      survey.responses.forEach(r => {
        r.details.forEach(d => {
          if (d.score !== null) {
            if (d.score >= 9) promoters++;
            else if (d.score <= 6) detractors++;
            else passives++;
          }
        });
      });
      const totalResponses = promoters + detractors + passives;
      npsScore = totalResponses > 0 ? Math.round(((promoters - detractors) / totalResponses) * 100) : 0;
    }

    return res.json({
      survey: { id: survey.id, title: survey.title, status: survey.status },
      stats: {
        totalInvites: survey.invites.length,
        totalResponses: survey.responses.length,
        responseRate: survey.invites.length > 0 ? Math.round((survey.responses.length / survey.invites.length) * 100) : 0,
        npsScore,
        promoters, passives, detractors,
      },
      questions: survey.questions,
      responses: survey.responses.map(r => ({
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
      where: { id: req.params.id },
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
    const headers = ['Aluno', 'Email', ...survey.questions.map(q => q.text), 'Data'];
    const rows = survey.responses.map(r => {
      const answers = survey.questions.map(q => {
        const detail = r.details.find(d => d.questionId === q.id);
        return detail?.score?.toString() || detail?.text || '';
      });
      return [r.student.user.name, r.student.user.email, ...answers, r.createdAt.toISOString()];
    });

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

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
