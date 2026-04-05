// v2
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { checkPermission } from '../middlewares/checkPermission';
import { sendWelcomeEmail } from '../services/mail';
import { getClientInfo } from '../middleware/audit';

const router = Router();

// GET /api/students â€” List all students
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

// GET /api/students/:id â€” Get single student
router.get('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id as string },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true } },
        classes: { include: { class: true } },
        examAttempts: { include: { exam: { select: { id: true, title: true, cooldownDays: true } } }, take: 10, orderBy: { startedAt: 'desc' } },
        certificates: { include: { exam: { select: { id: true, title: true } } } },
        cooldowns: { where: { status: 'ACTIVE', endsAt: { gt: new Date() } } },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Aluno nÃ£o encontrado' });
    }

    return res.json(student);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar aluno' });
  }
});

// GET /api/students/:id/cooldowns â€” Get active cooldowns
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

// POST /api/students/import â€” Import students from a list
router.post('/import', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: 'Payload de importaÃ§Ã£o invÃ¡lido. Esperado array.' });
    }

    // PrÃ©-carrega as turmas para vinculaÃ§Ã£o rÃ¡pida sem dezenas de queries no DB
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
        results.details.push(`Linha ${rowNum}: Erro - Nome e email sÃ£o obrigatÃ³rios.`);
        continue;
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        results.ignoredEmail++;
        results.details.push(`Linha ${rowNum}: Aviso - Email '${email}' jÃ¡ cadastrado. Aluno ignorado.`);
        continue;
      }

      if (cpf) {
        const existingCpf = await prisma.student.findUnique({ where: { cpf } });
        if (existingCpf) {
          results.errors++;
          results.details.push(`Linha ${rowNum}: Erro - CPF '${cpf}' jÃ¡ cadastrado.`);
          continue;
        }
      }

      let classIdToLink = null;
      if (className) {
        const foundClass = classes.find((c: any) => c.name.toLowerCase() === className.toLowerCase());
        if (foundClass) {
          classIdToLink = foundClass.id;
        } else {
          results.details.push(`Linha ${rowNum}: Aviso - Turma '${className}' nÃ£o localizada. O aluno foi importado sem vÃ­nculo.`);
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
        
        // Disparo assÃ­ncrono para o aluno importado
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

// POST /api/students â€” Create student
router.post('/', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const { name, lastName, email, password, cpf, phone, classIds } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha sÃ£o obrigatÃ³rios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email jÃ¡ cadastrado' });
    }

    if (cpf) {
      const existingCpf = await prisma.student.findUnique({ where: { cpf } });
      if (existingCpf) {
        return res.status(409).json({ error: 'CPF jÃ¡ cadastrado' });
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

// PUT /api/students/:id â€” Update student
router.put('/:id', authMiddleware, requireRole('ADMIN'), checkPermission('canEdit'), async (req: Request, res: Response) => {
  try {
    const { name, lastName, email, password, cpf, phone, status, active, classIds } = req.body;

    const student = await prisma.student.findUnique({
      where: { id: req.params.id as string },
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ error: 'Aluno nÃ£o encontrado' });
    }

    // Update user fields
    if (name || email || active !== undefined || password) {
      const userData: any = {};
      if (name) userData.name = name;
      if (email) userData.email = email;
      if (active !== undefined) userData.active = active;
      if (password) {
        userData.passwordHash = await bcrypt.hash(password, 12);
        
        const { ip, device } = getClientInfo(req);
        await prisma.auditEvent.create({
          data: { userId: (req as any).user.userId, action: 'STUDENT_PASSWORD_RESET_BY_ADMIN', entity: 'student', entityId: student.id, ip, device }
        });
      }

      await prisma.user.update({
        where: { id: student.userId as string },
        data: userData,
      });

      if (active !== undefined) {
        const { ip, device } = getClientInfo(req);
        await prisma.auditEvent.create({
          data: { 
            userId: (req as any).user.userId, 
            action: active ? 'STUDENT_ACCOUNT_ACTIVATED' : 'STUDENT_ACCOUNT_DEACTIVATED', 
            entity: 'student', 
            entityId: student.id, 
            ip, 
            device 
          }
        });
      }

      if (name || email) {
        const { ip, device } = getClientInfo(req);
        await prisma.auditEvent.create({
          data: { userId: (req as any).user.userId, action: 'STUDENT_PROFILE_EDITED', entity: 'student', entityId: student.id, ip, device }
        });
      }
    }

    // Update student fields
    // Sanitize: empty strings -> null (CPF has @unique, empty string causes P2002)
    const cleanCpf = cpf !== undefined ? (cpf?.trim() || null) : undefined;
    const cleanPhone = phone !== undefined ? (phone?.trim() || null) : undefined;

    const updated = await prisma.student.update({
      where: { id: req.params.id as string },
      data: {
        ...(cleanCpf !== undefined && { cpf: cleanCpf }),
        ...(cleanPhone !== undefined && { phone: cleanPhone }),
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

      const { ip, device } = getClientInfo(req);
      await prisma.auditEvent.create({
        data: { userId: (req as any).user.userId, action: 'STUDENT_CLASSES_UPDATED', entity: 'student', entityId: student.id, ip, device }
      });
    }

    return res.json(updated);
  } catch (error: any) {
    console.error('Update student error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar aluno' });
  }
});

// DELETE /api/students/:id â€” Delete student
router.delete('/:id', authMiddleware, requireRole('ADMIN'), checkPermission('canDelete'), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.params.id as string } });
    if (!student) {
      return res.status(404).json({ error: 'Aluno nÃ£o encontrado' });
    }

    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: { userId: (req as any).user.userId, action: 'STUDENT_DELETED', entity: 'student', entityId: student.id, ip, device }
    });

    // Delete user (cascades to student)
    await prisma.user.delete({ where: { id: student.userId as string } });

    return res.json({ message: 'Aluno excluÃ­do com sucesso' });
  } catch (error) {
    console.error('Delete student error:', error);
    return res.status(500).json({ error: 'Erro ao excluir aluno' });
  }
});

// POST /api/students/:id/resend-access â€” Generate new password and resend welcome email
router.post('/:id/resend-access', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id as string },
      include: { user: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Aluno nÃ£o encontrado' });
    }

    // ValidaÃ§Ã£o de VÃ­nculo de Template (Nova Regra Etapa 1)
    const binding = await prisma.emailEventBinding.findUnique({ 
      where: { eventKey: 'STUDENT_CREATED' },
      include: { template: true }
    });

    if (!binding || !binding.isActive || !binding.template) {
      return res.status(412).json({ 
        error: 'TEMPLATE_NOT_CONFIGURED', 
        message: 'O template STUDENT_CREATED nÃ£o possui um vÃ­nculo ativo configurado.' 
      });
    }

    const newPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: student.userId as string },
      data: { passwordHash }
    });

    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: { userId: (req as any).user.userId, action: 'STUDENT_PASSWORD_RESET_BY_ADMIN', entity: 'student', entityId: student.id, ip, device }
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

// GET /api/students/:id/timeline â€” Unified activity timeline
router.get('/:id/timeline', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id as string;

    // Fetch the basic student info including user email for the email log query
    const studentInfo = await prisma.student.findUnique({
      where: { id: studentId },
      include: { 
        user: { select: { email: true, createdAt: true } },
        classes: { include: { class: { select: { name: true } } } }
      }
    }) as any;

    if (!studentInfo) return res.status(404).json({ error: 'Aluno nÃ£o encontrado' });

    // Fetch all relevant entities in parallel
    const [attempts, cooldowns, emails, referrals, interests, logins, audits] = await Promise.all([
      prisma.examAttempt.findMany({
        where: { studentId },
        include: { exam: { select: { title: true } } },
        orderBy: { startedAt: 'desc' }
      }),
      prisma.cooldown.findMany({
        where: { studentId },
        include: { exam: { select: { title: true } } },
        orderBy: { startedAt: 'desc' }
      }),
      prisma.emailLog.findMany({ // cache-bust sync
        where: { recipient: studentInfo.user.email },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.eventReferral.findMany({
        where: { referrerId: studentId },
        include: { event: { select: { title: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.eventInterest.findMany({
        where: { studentId },
        include: { event: { select: { title: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.studentLoginLog.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 30
      }),
      prisma.auditEvent.findMany({
        where: { entity: 'student', entityId: studentId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const timeline: any[] = [];

    // 1. Registration
    timeline.push({
      type: 'REGISTRATION',
      date: studentInfo.user.createdAt,
      title: 'Aluno cadastrado na plataforma',
      description: 'Conta criada e acesso liberado pelo sistema.',
      color: 'bg-green-500'
    });

    // 2. Enrollments
    if (studentInfo.classes) {
      studentInfo.classes.forEach((c: any) => {
        timeline.push({
          type: 'ENROLLMENT',
          date: c.joinedAt,
          title: `Matriculado na turma ${c.class.name}`,
          description: `Ingresso na turma para realizaÃ§Ã£o de provas e certificaÃ§Ãµes.`,
          color: 'bg-blue-500'
        });
      });
    }

    // 3. Exam Attempts
    (attempts as any[]).forEach((a: any) => {
      // Started
      timeline.push({
        type: 'EXAM_STARTED',
        date: a.startedAt,
        title: `Iniciou a prova ${a.exam?.title || 'Prova'}`,
        description: `SessÃ£o aberta via ${a.device || 'dispositivo desconhecido'}.`,
        color: 'bg-amber-600'
      });

      // Finished
      if (a.finishedAt) {
        let statusTitle = '';
        let color = '';
        if (a.resultStatus === 'PASSED') {
          statusTitle = `Aprovado na prova ${a.exam?.title || 'Prova'}`;
          color = 'bg-emerald-600';
        } else if (a.resultStatus === 'FAILED' || a.resultStatus === 'FAILED_TIMEOUT') {
          statusTitle = `Reprovado na prova ${a.exam?.title || 'Prova'}`;
          color = 'bg-rose-600';
        }

        if (statusTitle) {
          const isTimeout = a.resultStatus === 'FAILED_TIMEOUT';
          timeline.push({
            type: 'EXAM_RESULT',
            date: a.finishedAt,
            title: statusTitle,
            description: isTimeout 
              ? `Resultado concluÃ­do com nota de ${a.score}%. Motivo: tempo excedido.`
              : `Resultado concluÃ­do com nota de ${a.score}%.`,
            color: color
          });
        }
      }

      // Abandoned
      if (a.executionStatus === 'ABANDONED') {
        timeline.push({
          type: 'EXAM_ABANDONED',
          date: a.finishedAt || a.createdAt,
          title: `Desclassificado na prova ${a.exam?.title || 'Prova'}`,
          description: `A prova foi encerrada por abandono ou expiraÃ§Ã£o de tempo.`,
          color: 'bg-slate-600'
        });
      }
    });

    // 4. Cooldowns
    (cooldowns as any[]).forEach((c: any) => {
      timeline.push({
        type: 'COOLDOWN_APPLIED',
        date: c.startedAt,
        title: `Cooldown aplicado â€” ${c.exam?.title || 'Prova'}`,
        description: `Acesso bloqueado temporariamente atÃ© ${formatDT(new Date(c.endsAt))}.`,
        color: 'bg-amber-600'
      });

      if (c.status === 'CLEARED' && c.clearedAt) {
        timeline.push({
          type: 'COOLDOWN_RELEASED',
          date: c.clearedAt, 
          title: 'Cooldown liberado manualmente',
          description: `O bloqueio da prova ${c.exam?.title || 'Prova'} foi removido por um administrador.`,
          color: 'bg-blue-600'
        });
      }
    });

    const eventLabels: Record<string, string> = {
      'EXAM_PASSED': 'Aprovado na prova',
      'EXAM_FAILED': 'Reprovado na prova',
      'EXAM_ABANDONED': 'Prova abandonada',
      'EXAM_STARTED': 'Iniciou a prova',
      'CERTIFICATE_SENT': 'Certificado enviado',
      'CERTIFICATE_AVAILABLE': 'Certificado enviado',
      'COOLDOWN_RELEASED': 'Cooldown liberado',
      'COOLDOWN_APPLIED': 'Cooldown aplicado',
      'STUDENT_CREATED': 'Boas-vindas enviado',
      'PASSWORD_RESET': 'RedefiniÃ§Ã£o de senha',
    };

    (emails as any[]).forEach((e: any) => {
      let iconColor = 'bg-indigo-600';
      const title = eventLabels[e.eventKey] || 'E-mail enviado';
      
      if (e.eventKey === 'EXAM_PASSED') iconColor = 'bg-emerald-500';
      else if (e.eventKey === 'EXAM_FAILED') iconColor = 'bg-rose-500';
      else if (e.eventKey === 'CERTIFICATE_SENT' || e.eventKey === 'CERTIFICATE_AVAILABLE') iconColor = 'bg-blue-500';
      else if (e.eventKey === 'EXAM_ABANDONED') iconColor = 'bg-slate-600';
      else if (e.eventKey === 'EXAM_STARTED') iconColor = 'bg-amber-600';
      else if (e.eventKey === 'COOLDOWN_RELEASED') iconColor = 'bg-blue-600';
      else if (e.eventKey === 'COOLDOWN_APPLIED') iconColor = 'bg-amber-600';

      timeline.push({
        type: 'EMAIL_SENT',
        date: e.createdAt,
        title,
        description: `ComunicaÃ§Ã£o enviada para ${e.recipient}. Status: ${e.status}`,
        color: iconColor
      });
    });

    // 6. Referrals
    (referrals as any[]).forEach((r: any) => {
      timeline.push({
        type: 'REFERRAL',
        date: r.createdAt,
        title: `Indicou um amigo para o evento`,
        description: `Indicou ${r.referredName} (${r.referredEmail}) para o evento "${r.event?.title || 'Evento'}".`,
        color: 'bg-violet-500'
      });
    });

    // 7. Interests
    (interests as any[]).forEach((i: any) => {
      timeline.push({
        type: 'INTEREST',
        date: i.createdAt,
        title: `Interesse no evento ${i.event?.title || 'Evento'}`,
        description: `Demonstrou interesse em participar e receber mais informaÃ§Ãµes.`,
        color: 'bg-sky-600'
      });
    });

    // 8. Logins
    (logins as any[]).forEach((l: any) => {
      timeline.push({
        type: 'LOGIN',
        date: l.createdAt,
        title: 'Acesso Ã  plataforma',
        description: `Login realizado. IP: ${l.ip || 'desconhecido'}.`,
        color: 'bg-zinc-800'
      });
    });

    // 9. Admin Actions (Audits)
    (audits as any[]).forEach((audit: any) => {
      let title = 'AÃ§Ã£o administrativa';
      let color = 'bg-gray-700';
      let description = `AÃ§Ã£o realizada por administrador. IP: ${audit.ip || 'desconhecido'}`;

      if (audit.action === 'STUDENT_PROFILE_EDITED') {
        title = 'Perfil editado pelo admin';
        color = 'bg-gray-600';
      } else if (audit.action === 'STUDENT_PASSWORD_RESET_BY_ADMIN') {
        title = 'Senha resetada pelo admin';
        color = 'bg-orange-700';
      } else if (audit.action === 'STUDENT_ACCOUNT_DEACTIVATED') {
        title = 'Conta desativada pelo admin';
        color = 'bg-red-900';
      } else if (audit.action === 'STUDENT_ACCOUNT_ACTIVATED') {
        title = 'Conta reativada pelo admin';
        color = 'bg-green-900';
      } else if (audit.action === 'STUDENT_CLASSES_UPDATED') {
        title = 'Turmas/VÃ­nculos alterados';
        color = 'bg-cyan-700';
      }

      timeline.push({
        type: 'ADMIN_ACTION',
        date: audit.createdAt,
        title,
        description,
        color
      });
    });

    // Sort all events by date descending
    const sortedTimeline = timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Pagination logic (applied after aggregation and sorting)
    const { page = '1', limit = '10' } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    const startIndex = (p - 1) * l;
    const endIndex = p * l;
    const total = sortedTimeline.length;
    const slicedTimeline = sortedTimeline.slice(startIndex, endIndex);

    return res.json({
      data: slicedTimeline,
      pagination: {
        total,
        page: p,
        limit: l,
        pages: Math.ceil(total / l),
        hasMore: endIndex < total
      }
    });
  } catch (error) {
    console.error('Timeline error:', error);
    return res.status(500).json({ error: 'Erro ao gerar timeline' });
  }
});

function formatDT(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date).replace(',', '');
}

// GET /api/students/:id/referrals â€” Get referrals made by student
router.get('/:id/referrals', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id as string;
    const referrals = await prisma.eventReferral.findMany({
      where: { referrerId: studentId },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(referrals);
  } catch (error) {
    console.error('Student referrals error:', error);
    return res.status(500).json({ error: 'Erro ao buscar indicaÃ§Ãµes' });
  }
});

// POST /api/students/:id/enroll â€” Enroll student in a class
router.post('/:id/enroll', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const { classId } = req.body;
    if (!classId) return res.status(400).json({ error: 'ID da turma Ã© obrigatÃ³rio' });

    const enrollment = await prisma.classStudent.create({
      data: {
        studentId: req.params.id as string,
        classId
      },
      include: { class: true }
    });

    return res.status(201).json(enrollment);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Aluno jÃ¡ estÃ¡ matriculado nesta turma' });
    }
    console.error('Enroll student error:', error);
    return res.status(500).json({ error: 'Erro ao matricular aluno' });
  }
});

// DELETE /api/students/:id/unenroll/:classId â€” Unenroll student from a class
router.delete('/:id/unenroll/:classId', authMiddleware, requireRole('ADMIN'), checkPermission('canDelete'), async (req: Request, res: Response) => {
  try {
    await prisma.classStudent.delete({
      where: {
        classId_studentId: {
          studentId: req.params.id as string,
          classId: req.params.classId as string
        }
      }
    });

    return res.json({ message: 'Desmatriculado com sucesso' });
  } catch (error) {
    console.error('Unenroll student error:', error);
    return res.status(500).json({ error: 'Erro ao desmatricular aluno' });
  }
});

export default router;
