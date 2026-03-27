import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { sendWelcomeEmail } from '../services/mail';

const router = Router();

// GET /api/students — List all students
router.get('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { search, status, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ],
      };
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true } },
          classes: { include: { class: { select: { id: true, name: true } } } },
          cooldowns: {
            where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
            orderBy: { endsAt: 'desc' },
            take: 1
          },
          examAttempts: {
            where: { executionStatus: { not: 'IN_PROGRESS' } },
            orderBy: { finishedAt: 'desc' },
            take: 1,
            include: { exam: { select: { title: true } } }
          }
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.student.count({ where }),
    ]);

    return res.json({
      data: students,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('List students error:', error);
    return res.status(500).json({ error: 'Erro ao listar alunos' });
  }
});

// GET /api/students/:id — Get single student
router.get('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id as string },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true } },
        classes: { include: { class: true } },
        examAttempts: { include: { exam: { select: { id: true, title: true } } }, take: 10, orderBy: { startedAt: 'desc' } },
        certificates: { include: { exam: { select: { id: true, title: true } } } },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    return res.json(student);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar aluno' });
  }
});

// GET /api/students/:id/cooldowns — Get active cooldowns
router.get('/:id/cooldowns', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const cooldowns = await prisma.cooldown.findMany({
      where: { studentId: req.params.id as string, status: 'ACTIVE' },
      include: { exam: { select: { id: true, title: true } } },
    });
    return res.json(cooldowns);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar cooldowns' });
  }
});

// POST /api/students/import — Import students from a list
router.post('/import', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: 'Payload de importação inválido. Esperado array.' });
    }

    // Pré-carrega as turmas para vinculação rápida sem dezenas de queries no DB
    const classes = await prisma.class.findMany({ select: { id: true, name: true } });

    const results = {
      total: students.length,
      success: 0,
      ignoredEmail: 0,
      errors: 0,
      details: [] as string[]
    };

    for (let i = 0; i < students.length; i++) {
      const { name, sobrenome, email, password, cpf, phone, className } = students[i];
      const rowNum = i + 1; // For better error reporting

      const lastNameToSave = sobrenome || '';

      if (!name || !email) {
        results.errors++;
        results.details.push(`Linha ${rowNum}: Erro - Nome e email são obrigatórios.`);
        continue;
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        results.ignoredEmail++;
        results.details.push(`Linha ${rowNum}: Aviso - Email '${email}' já cadastrado. Aluno ignorado.`);
        continue;
      }

      if (cpf) {
        const existingCpf = await prisma.student.findUnique({ where: { cpf } });
        if (existingCpf) {
          results.errors++;
          results.details.push(`Linha ${rowNum}: Erro - CPF '${cpf}' já cadastrado.`);
          continue;
        }
      }

      let classIdToLink = null;
      if (className) {
        const foundClass = classes.find((c: any) => c.name.toLowerCase() === className.toLowerCase());
        if (foundClass) {
          classIdToLink = foundClass.id;
        } else {
          results.details.push(`Linha ${rowNum}: Aviso - Turma '${className}' não localizada. O aluno foi importado sem vínculo.`);
        }
      }

      try {
        const passwordToUse = password || Math.random().toString(36).slice(-8); // Generate random password if not provided
        const passwordHash = await bcrypt.hash(passwordToUse, 12);

        await prisma.student.create({
          data: {
            cpf: cpf || null,
            phone: phone || null,
            lastName: lastNameToSave,
            user: {
              create: {
                name,
                email,
                passwordHash,
                role: 'STUDENT',
              },
            },
            ...(classIdToLink && {
              classes: {
                create: [{ classId: classIdToLink }]
              }
            })
          },
        });
        
        // Disparo assíncrono para o aluno importado
        sendWelcomeEmail(name, email, passwordToUse, lastNameToSave).catch(err => {
          console.error(`Falha silenciosa no envio transacional para importado ${email}`);
        });

        results.success++;
      } catch (e: any) {
        results.errors++;
        results.details.push(`Linha ${rowNum}: Erro ao criar aluno - ${e.message}`);
      }
    }

    return res.status(200).json(results);
  } catch (error: any) {
    console.error('Import students error:', error);
    return res.status(500).json({ error: 'Erro ao importar alunos', details: error.message });
  }
});

// POST /api/students — Create student
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, lastName, email, password, cpf, phone, classIds } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    if (cpf) {
      const existingCpf = await prisma.student.findUnique({ where: { cpf } });
      if (existingCpf) {
        return res.status(409).json({ error: 'CPF já cadastrado' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const student = await prisma.student.create({
      data: {
        cpf: cpf || null,
        phone: phone || null,
        lastName: lastName || '',
        user: {
          create: {
            name,
            email,
            passwordHash,
            role: 'STUDENT',
          },
        },
        ...(classIds?.length && {
          classes: {
            create: classIds.map((classId: string) => ({ classId })),
          },
        }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        classes: { include: { class: { select: { id: true, name: true } } } },
      },
    });

    // Enviar e-mail de boas-vindas fire-and-forget
    sendWelcomeEmail(name, email, password, lastName || '').catch(err => {
      console.error(`Falha ignorada no envio de e-mail de boas-vindas para ${email}`);
    });

    return res.status(201).json(student);
  } catch (error: any) {
    console.error('Create student error:', error);
    return res.status(500).json({ error: 'Erro ao criar aluno' });
  }
});

// PUT /api/students/:id — Update student
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, lastName, email, cpf, phone, status, active, classIds } = req.body;

    const student = await prisma.student.findUnique({
      where: { id: req.params.id as string },
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    // Update user fields
    if (name || email || active !== undefined) {
      await prisma.user.update({
        where: { id: student.userId as string },
        data: {
          ...(name && { name }),
          ...(email && { email }),
          ...(active !== undefined && { active }),
        },
      });
    }

    // Update student fields
    const updated = await prisma.student.update({
      where: { id: req.params.id as string },
      data: {
        ...(cpf !== undefined && { cpf }),
        ...(phone !== undefined && { phone }),
        ...(lastName !== undefined && { lastName }),
        ...(status && { status }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, active: true } },
        classes: { include: { class: { select: { id: true, name: true } } } },
      },
    });

    // Update class associations if provided
    if (classIds !== undefined) {
      await prisma.classStudent.deleteMany({ where: { studentId: req.params.id as string } });
      if (classIds.length > 0) {
        await prisma.classStudent.createMany({
          data: classIds.map((classId: string) => ({ classId, studentId: req.params.id as string })),
        });
      }
    }

    return res.json(updated);
  } catch (error: any) {
    console.error('Update student error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar aluno' });
  }
});

// DELETE /api/students/:id — Delete student
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.params.id as string } });
    if (!student) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    // Delete user (cascades to student)
    await prisma.user.delete({ where: { id: student.userId as string } });

    return res.json({ message: 'Aluno excluído com sucesso' });
  } catch (error) {
    console.error('Delete student error:', error);
    return res.status(500).json({ error: 'Erro ao excluir aluno' });
  }
});

// POST /api/students/:id/resend-access — Generate new password and resend welcome email
router.post('/:id/resend-access', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id as string },
      include: { user: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    const newPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: student.userId as string },
      data: { passwordHash }
    });

    // Disparo aguardado para o aluno
    const s = student as any;
    try {
      await sendWelcomeEmail(s.user.name, s.user.email, newPassword, s.lastName || '');
    } catch (err) {
      console.error(`Falha no reenvio transacional para ${s.user.email}:`, err);
      // Not failing the whole request because the password was already updated
    }

    return res.json({ message: 'Acesso reenviado com sucesso!' });
  } catch (error) {
    console.error('Resend access error:', error);
    return res.status(500).json({ error: 'Erro ao reenviar acesso' });
  }
});

export default router;
