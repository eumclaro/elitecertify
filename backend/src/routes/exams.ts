import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { sendExamReleasedEmail, sendCooldownReleasedEmail } from '../services/mail';

const router = Router();

// GET /api/exams — List exams
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        include: {
          releases: {
            include: {
              class: { select: { id: true, name: true } },
              student: { select: { id: true, user: { select: { name: true } } } }
            }
          },
          _count: { select: { questions: true, attempts: true, releases: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.exam.count({ where }),
    ]);

    return res.json({
      data: exams,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('List exams error:', error);
    return res.status(500).json({ error: 'Erro ao listar provas' });
  }
});

// GET /api/exams/:id — Get single exam
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id as string },
      include: {
        releases: {
          include: {
            class: { select: { id: true, name: true } },
            student: { select: { id: true, cpf: true, user: { select: { name: true } } } }
          }
        },
        questions: {
          include: { alternatives: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        attempts: { select: { studentId: true, score: true, resultStatus: true, executionStatus: true, startedAt: true } },
        cooldowns: { where: { status: 'ACTIVE' }, select: { studentId: true, endsAt: true, id: true } },
        _count: { select: { attempts: true } },
      },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Prova não encontrada' });
    }

    // Se aluno, omite isCorrect e limpa a visualização de questionOrder/cooldown p segurança
    const examData = exam as any;
    if (req.user?.role === 'STUDENT') {
      examData.questions.forEach((q: any) => {
        q.alternatives.forEach((a: any) => {
          a.isCorrect = undefined;
        });
      });
    }

    return res.json(examData);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar prova' });
  }
});

// POST /api/exams — Create exam
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const {
      title, description, questionCount,
      durationMinutes, passingScore, maxAttempts,
      cooldownDays, questionOrder, status
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        description: description || null,
        questionCount: questionCount || 10,
        durationMinutes: durationMinutes || 60,
        passingScore: passingScore || 70,
        maxAttempts: maxAttempts || 0,
        cooldownDays: cooldownDays || 0,
        questionOrder: questionOrder || 'FIXED',
        status: status || 'DRAFT',
      },
      include: {
        _count: { select: { questions: true } },
      },
    });

    await prisma.auditEvent.create({
      data: { userId: req.user!.userId, action: 'EXAM_CREATED', entity: 'Exam', entityId: exam.id, ip: req.ip }
    });

    return res.status(201).json(exam);
  } catch (error: any) {
    console.error('Create exam error:', error);
    return res.status(500).json({ error: 'Erro ao criar prova' });
  }
});

// PUT /api/exams/:id — Update exam
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const {
      title, description, questionCount,
      durationMinutes, passingScore, maxAttempts,
      cooldownDays, questionOrder, status
    } = req.body;

    const existing = await prisma.exam.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      return res.status(404).json({ error: 'Prova não encontrada' });
    }

    const exam = await prisma.exam.update({
      where: { id: req.params.id as string },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(questionCount !== undefined && { questionCount }),
        ...(durationMinutes !== undefined && { durationMinutes }),
        ...(passingScore !== undefined && { passingScore }),
        ...(maxAttempts !== undefined && { maxAttempts }),
        ...(cooldownDays !== undefined && { cooldownDays }),
        ...(questionOrder !== undefined && { questionOrder }),
        ...(status !== undefined && { status }),
      },
      include: {
        releases: true,
        _count: { select: { questions: true, attempts: true } },
      },
    });

    await prisma.auditEvent.create({
      data: { userId: req.user!.userId, action: 'EXAM_UPDATED', entity: 'Exam', entityId: exam.id, ip: req.ip }
    });

    return res.json(exam);
  } catch (error: any) {
    console.error('Update exam error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar prova' });
  }
});

// PATCH /api/exams/:id/certificate-template — Link template to exam
router.patch('/:id/certificate-template', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { certificateTemplateId } = req.body;

    const existing = await prisma.exam.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Prova não encontrada' });
    }

    const exam = await prisma.exam.update({
      where: { id },
      data: {
        certificateTemplateId: certificateTemplateId || null,
      },
    });

    await prisma.auditEvent.create({
      data: { userId: req.user!.userId, action: 'EXAM_TEMPLATE_LINKED', entity: 'Exam', entityId: exam.id, ip: req.ip, metadata: JSON.stringify({ certificateTemplateId }) }
    });

    return res.json(exam);
  } catch (error) {
    console.error('Update exam template error:', error);
    return res.status(500).json({ error: 'Erro ao vincular template à prova' });
  }
});

// DELETE /api/exams/:id — Delete exam
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.exam.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      return res.status(404).json({ error: 'Prova não encontrada' });
    }

    await prisma.exam.delete({ where: { id: req.params.id as string } });
    
    await prisma.auditEvent.create({
      data: { userId: req.user!.userId, action: 'EXAM_DELETED', entity: 'Exam', entityId: req.params.id as string, ip: req.ip }
    });

    return res.json({ message: 'Prova excluída com sucesso' });
  } catch (error) {
    console.error('Delete exam error:', error);
    return res.status(500).json({ error: 'Erro ao excluir prova' });
  }
});

// =========================================================
// EXAM RELEASES (LIBERAÇÕES)
// =========================================================

// POST /api/exams/:id/releases
router.post('/:id/releases', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const examId = req.params.id;
    const { classId, studentId } = req.body;

    // Regra XOR exata exigida na Fase 4
    if ((!classId && !studentId) || (classId && studentId)) {
      return res.status(400).json({ error: 'Forneça turma OU aluno. Nunca ambos. Nunca vazio.' });
    }

    const release = await prisma.examRelease.create({
      data: {
        examId: examId as string,
        classId: classId || null,
        studentId: studentId || null,
        releasedBy: req.user!.userId
      },
      include: {
        exam: { select: { title: true } },
        class: { select: { id: true, name: true } },
        student: { select: { id: true, lastName: true, user: { select: { name: true, email: true } } } }
      }
    });

    await prisma.auditEvent.create({
      data: { userId: req.user!.userId, action: 'EXAM_RELEASED', entity: 'ExamRelease', entityId: release.id, ip: req.ip }
    });

    // DISPARO DE E-MAIL EM LOTE OU INDIVIDUAL (Síncrono para retornar ok, mas async por baixo)
    const rel = release as any;
    if (studentId && rel.student) {
      sendExamReleasedEmail(rel.student.user.name, rel.student.user.email, rel.exam.title, rel.student.lastName || '').catch(() => {});
    } else if (classId) {
      // Find all students in this class
      prisma.classStudent.findMany({
        where: { classId },
        include: { student: { include: { user: true } } }
      }).then(classStudents => {
        for (const cs of classStudents) {
          const student = cs.student as any;
          if (student.user.email) {
            sendExamReleasedEmail(student.user.name, student.user.email, rel.exam.title, student.lastName || '').catch(() => {});
          }
        }
      });
    }

    return res.status(201).json(release);
  } catch (error: any) {
    if (error.code === 'P2003') { // Foreign key constraint failed
      return res.status(400).json({ error: 'Prova, turma ou aluno não encontrado.' });
    }
    console.error('Create exam release error:', error);
    return res.status(500).json({ error: 'Erro ao liberar prova' });
  }
});

// DELETE /api/exams/:id/releases/:releaseId
router.delete('/:id/releases/:releaseId', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { releaseId } = req.params;
    await prisma.examRelease.delete({ where: { id: releaseId as string } });
    
    await prisma.auditEvent.create({
      data: { userId: req.user!.userId, action: 'EXAM_RELEASE_REVOKED', entity: 'ExamRelease', entityId: releaseId as string, ip: req.ip }
    });
    
    return res.json({ message: 'Liberação revogada com sucesso' });
  } catch (error) {
    console.error('Delete exam release error:', error);
    return res.status(500).json({ error: 'Erro ao revogar liberação' });
  }
});

// =========================================================
// COOLDOWNS (MANUAL CLEAR)
// =========================================================

// PUT /api/exams/cooldowns/:id/clear
router.put('/cooldowns/:id/clear', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if cooldown exists
    const cooldown = await prisma.cooldown.findUnique({ where: { id: id as string } });
    if (!cooldown) {
      return res.status(404).json({ error: 'Cooldown não encontrado' });
    }

    // Set to CLEARED
    const updated = await prisma.cooldown.update({
      where: { id: id as string },
      data: { status: 'CLEARED' },
      include: { exam: { select: { title: true } }, student: { include: { user: true } } }
    });

    await prisma.auditEvent.create({
      data: { userId: req.user!.userId, action: 'COOLDOWN_CLEARED_MANUALLY', entity: 'Cooldown', entityId: id as string, ip: req.ip }
    });

    // Enviar aviso
    const upd = updated as any;
    sendCooldownReleasedEmail(upd.student.user.name, upd.student.user.email, upd.exam.title, upd.student.lastName || '').catch(() => {});

    return res.json({ message: 'Cooldown liberado com sucesso' });
  } catch (error) {
    console.error('Clear cooldown error:', error);
    return res.status(500).json({ error: 'Erro ao liberar cooldown' });
  }
});

export default router;
