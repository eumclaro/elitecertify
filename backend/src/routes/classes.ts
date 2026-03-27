import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/classes — List classes
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (search) where.name = { contains: search as string, mode: 'insensitive' };

    const classes = await prisma.class.findMany({
      where,
      include: { _count: { select: { students: true, examReleases: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(classes);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar turmas' });
  }
});

// POST /api/classes
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, description, startDate, endDate } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const cls = await prisma.class.create({
      data: {
        name,
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    return res.status(201).json(cls);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar turma' });
  }
});

// PUT /api/classes/:id
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, description, startDate, endDate, status } = req.body;
    const cls = await prisma.class.update({
      where: { id: req.params.id as string },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(status && { status }),
      },
    });
    return res.json(cls);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar turma' });
  }
});

// DELETE /api/classes/:id
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.class.delete({ where: { id: req.params.id as string } });
    return res.json({ message: 'Turma excluída com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir turma' });
  }
});

// GET /api/classes/:id/students — List students with performance data and metrics
router.get('/:id/students', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const classId = req.params.id as string;
    
    const classStudents = await prisma.classStudent.findMany({
      where: { classId },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            examAttempts: {
              orderBy: { createdAt: 'desc' },
              select: { score: true, resultStatus: true, finishedAt: true, startedAt: true }
            },
            cooldowns: {
              where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
              orderBy: { endsAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    const metrics = { total: 0, approved: 0, reproved: 0, pending: 0, cooldown: 0 };
    
    const students = classStudents.map((cs: any) => {
      const s = cs.student;
      const attempts = s.examAttempts || [];
      const activeCooldown = s.cooldowns[0] || null;
      
      const hasPassed = attempts.some((a: any) => a.resultStatus === 'PASSED');
      const maxScore = attempts.length > 0 ? Math.max(...attempts.map((a: any) => a.score || 0)) : null;
      const lastAttempt = attempts[0] || null;
      const lastActivity = lastAttempt ? (lastAttempt.finishedAt || lastAttempt.startedAt) : null;

      let status = 'PENDING';
      if (hasPassed) {
        status = 'APPROVED';
      } else if (activeCooldown) {
        status = 'COOLDOWN';
      } else if (attempts.length > 0) {
        status = 'REPROVED';
      }

      metrics.total++;
      if (status === 'APPROVED') metrics.approved++;
      else if (status === 'COOLDOWN') metrics.cooldown++;
      else if (status === 'REPROVED') metrics.reproved++;
      else metrics.pending++;

      return {
        id: s.id,
        name: s.user.name,
        email: s.user.email,
        joinedAt: cs.joinedAt,
        grade: maxScore,
        status,
        attempts: attempts.length,
        cooldownUntil: activeCooldown ? activeCooldown.endsAt : null,
        cooldownId: activeCooldown ? activeCooldown.id : null,
        lastActivity
      };
    });

    return res.json({ students, metrics });
  } catch (error) {
    console.error('List class students error:', error);
    return res.status(500).json({ error: 'Erro ao buscar alunos da turma' });
  }
});

// GET /api/classes/:id/export — Export class students to CSV
router.get('/:id/export', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const classId = req.params.id as string;
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
    if (!cls) return res.status(404).json({ error: 'Turma não encontrada' });

    const classStudents = await prisma.classStudent.findMany({
      where: { classId },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            examAttempts: {
              select: { score: true, resultStatus: true }
            },
            cooldowns: {
              where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
              orderBy: { endsAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    let csv = 'Nome,Email,Nota,Status,Tentativas,Cooldown ate\n';
    classStudents.forEach((cs: any) => {
      const s = cs.student;
      const hasPassed = s.examAttempts.some((a: any) => a.resultStatus === 'PASSED');
      const maxScore = s.examAttempts.length > 0 ? Math.max(...s.examAttempts.map((a: any) => a.score || 0)) : 0;
      const activeCooldown = s.cooldowns[0] || null;
      
      let status = 'PENDING';
      if (hasPassed) status = 'APPROVED';
      else if (activeCooldown) status = 'COOLDOWN';
      else if (s.examAttempts.length > 0) status = 'REPROVED';

      const cooldownAt = activeCooldown ? activeCooldown.endsAt.toLocaleString('pt-BR') : '';
      
      csv += `"${s.user.name}","${s.user.email}",${maxScore},"${status}",${s.examAttempts.length},"${cooldownAt}"\n`;
    });

    const filename = `alunos-turma-${cls.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.send(csv);
  } catch (error) {
    console.error('Export class error:', error);
    return res.status(500).json({ error: 'Erro ao exportar turma' });
  }
});

// PUT /api/classes/:id/students — Update students in a class
router.put('/:id/students', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { studentIds } = req.body;
    
    if (!Array.isArray(studentIds)) {
      return res.status(400).json({ error: 'studentIds deve ser um array' });
    }

    // Replace all associations
    await prisma.classStudent.deleteMany({ where: { classId: req.params.id as string } });
    
    if (studentIds.length > 0) {
      await prisma.classStudent.createMany({
        data: studentIds.map((studentId: string) => ({
          classId: req.params.id as string,
          studentId
        }))
      });
    }

    return res.json({ message: 'Alunos vinculados com sucesso' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao atualizar alunos da turma' });
  }
});

export default router;
