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
      where: { id: req.params.id },
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
    await prisma.class.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Turma excluída com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir turma' });
  }
});

// GET /api/classes/:id/students — List students in a class
router.get('/:id/students', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const classStudents = await prisma.classStudent.findMany({
      where: { classId: req.params.id },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });
    
    const students = classStudents.map(cs => ({
      id: cs.student.id,
      name: cs.student.user.name,
      email: cs.student.user.email,
      joinedAt: cs.joinedAt
    }));

    return res.json(students);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar alunos da turma' });
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
    await prisma.classStudent.deleteMany({ where: { classId: req.params.id } });
    
    if (studentIds.length > 0) {
      await prisma.classStudent.createMany({
        data: studentIds.map((studentId: string) => ({
          classId: req.params.id,
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
