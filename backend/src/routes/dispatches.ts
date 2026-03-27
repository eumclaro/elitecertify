import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getEmailProvider, getAuthorizedSender, dispatchTemplateToMandrill } from '../services/mail';
import { MANDRILL_TEMPLATES, TemplateKey } from '../services/mail-templates';
import { EmailEventKey } from '../constants/emailEvents';

const router = Router();

// GET /api/dispatches — Histórico de disparos
router.get('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const dispatches = await prisma.dispatch.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Mapear para o formato que o frontend espera
    const mapped = dispatches.map((d: any) => ({
      ...d,
      successCount: d.totalSent,
      errorCount: d.totalFailed,
      totalCount: d.totalSent + d.totalFailed,
      status: d.totalFailed === 0 ? 'COMPLETED' : 'PARTIAL'
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('List dispatches error:', error);
    return res.status(500).json({ error: 'Erro ao carregar histórico de disparos' });
  }
});

// GET /api/dispatches/exams-with-releases — Listar provas que têm liberações
router.get('/exams-with-releases', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const exams = await prisma.exam.findMany({
      where: {
        releases: { some: {} }
      },
      select: {
        id: true,
        title: true,
        releases: {
          select: {
            id: true,
            classId: true,
            studentId: true,
            releasedAt: true,
            class: { select: { name: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return res.json(exams);
  } catch (error) {
    console.error('Exams with releases error:', error);
    return res.status(500).json({ error: 'Erro ao buscar provas com liberações' });
  }
});

// POST /api/dispatches/recipients/resolve — Resolver lista de destinatários por filtro
router.post('/recipients/resolve', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { type, classId, examId, releaseId } = req.body;

    if (type === 'NOT_ATTEMPTED') {
      if (!classId || !examId) return res.status(400).json({ error: 'Turma e Prova são obrigatórios' });

      const students = await prisma.student.findMany({
        where: {
          classes: { some: { classId } },
          examAttempts: {
            none: { examId }
          }
        },
        include: {
          user: { select: { name: true, email: true } }
        }
      });

      return res.json({ students });
    }

    if (type === 'RELEASE_SPECIFIC') {
      if (!releaseId) return res.status(400).json({ error: 'ID da liberação é obrigatório' });

      const release = await prisma.examRelease.findUnique({
        where: { id: releaseId },
        include: {
          class: {
            include: {
              students: {
                include: {
                  student: {
                    include: { user: { select: { name: true, email: true } } }
                  }
                }
              }
            }
          },
          student: {
            include: { user: { select: { name: true, email: true } } }
          }
        }
      });

      if (!release) return res.status(404).json({ error: 'Liberação não encontrada' });

      let studentList: any[] = [];
      if (release.class) {
        studentList = release.class.students.map(cs => cs.student);
      } else if (release.student) {
        studentList = [release.student];
      }

      return res.json({ students: studentList });
    }

    return res.status(400).json({ error: 'Tipo de filtro inválido' });
  } catch (error) {
    console.error('Resolve recipients error:', error);
    return res.status(500).json({ error: 'Erro ao resolver destinatários' });
  }
});

// POST /api/dispatches — Criar novo disparo em lote
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { templateSlug, recipientGroup, recipientIds: initialIds, classId, variables = {} } = req.body;
    let recipientIds = initialIds || [];

    const templateConfig = MANDRILL_TEMPLATES[templateSlug as TemplateKey];
    if (!templateConfig) {
      return res.status(400).json({ error: 'Template não configurado no registro do sistema' });
    }

    // Se for por turma, buscar os IDs dos alunos
    if (recipientGroup === 'turma' && classId) {
      const classStudents = await prisma.classStudent.findMany({
        where: { classId },
        select: { studentId: true }
      });
      recipientIds = classStudents.map(cs => cs.studentId);
    }

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ error: 'Nenhum destinatário encontrado para o disparo' });
    }

    const provider = getEmailProvider();
    const { fromEmail, fromName } = await getAuthorizedSender();
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    const batchSize = 50;
    for (let i = 0; i < recipientIds.length; i += batchSize) {
      const batchSlice = recipientIds.slice(i, i + batchSize);
      
      const students = await prisma.student.findMany({
        where: { id: { in: batchSlice } },
        include: { user: true }
      });

      const promises = students.map(async (student) => {
        try {
          const dynamicData: any = {
            NAME: student.user.name,
            'LAST-NAME': student.lastName || '',
            EMAIL: student.user.email,
            ...variables 
          };

          // Decidir o eventKey com base no eventSlug do template
          let eventKey: string;
          if (Array.isArray(templateConfig.eventSlug)) {
            // Caso especial: Resultado de Prova (branching por status)
            if (variables.STATUS === 'APROVADO') {
              eventKey = 'EXAM_PASSED';
            } else if (variables.STATUS === 'REPROVADO') {
              eventKey = 'EXAM_FAILED';
            } else {
              // Fallback para o primeiro se não houver status
              eventKey = templateConfig.eventSlug[0];
            }
          } else {
            eventKey = templateConfig.eventSlug;
          }

          // Chamar a função unificada que busca o vínculo real no DB e gera log em EmailLog
          await dispatchTemplateToMandrill(
            eventKey as EmailEventKey,
            student.user.email,
            student.user.name,
            dynamicData
          );
          
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push({ 
            email: student.user.email, 
            error: err.message || 'Erro desconhecido no provedor' 
          });
        }
      });

      await Promise.all(promises);
    }

    const dispatch = await prisma.dispatch.create({
      data: {
        templateSlug,
        recipientGroup: recipientGroup || 'manual',
        totalSent: results.success,
        totalFailed: results.failed,
        failedEmails: results.errors as any
      }
    });

    return res.status(201).json({
      ...dispatch,
      successCount: dispatch.totalSent,
      errorCount: dispatch.totalFailed,
      totalCount: dispatch.totalSent + dispatch.totalFailed,
      status: dispatch.totalFailed === 0 ? 'COMPLETED' : 'PARTIAL'
    });
  } catch (error: any) {
    console.error('Mass dispatch error:', error);
    return res.status(500).json({ error: 'Ocorreu um erro ao processar o envio em lote' });
  }
});

export default router;
