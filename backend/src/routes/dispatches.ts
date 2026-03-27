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

    // Criar o registro do Disparo PRIMEIRO para ter o ID para os logs
    const dispatch = await prisma.dispatch.create({
      data: {
        templateSlug,
        recipientGroup: recipientGroup || 'manual',
        totalSent: 0,
        totalFailed: 0,
        failedEmails: [] as any
      }
    });

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
            dynamicData,
            undefined, // Use default subject from template if needed
            dispatch.id // <--- Passar o ID do dispatch
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

    // Atualizar o registro do Disparo com os resultados finais
    await prisma.dispatch.update({
      where: { id: dispatch.id },
      data: {
        totalSent: results.success,
        totalFailed: results.failed,
        failedEmails: results.errors as any
      }
    });

    return res.status(201).json({
      ...dispatch, // Note: partial data from initial create, but frontend expects dispatch object
      successCount: results.success,
      errorCount: results.failed,
      totalCount: results.success + results.failed,
      status: results.failed === 0 ? 'COMPLETED' : 'PARTIAL'
    });
  } catch (error: any) {
    console.error('Mass dispatch error:', error);
    return res.status(500).json({ error: 'Ocorreu um erro ao processar o envio em lote' });
  }
});

// GET /api/dispatches/:id/logs — Listar logs de um disparo
router.get('/:id/logs', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const logs = await (prisma.emailLog as any).findMany({
      where: { dispatchId: req.params.id as string },
      orderBy: { createdAt: 'desc' }
    });

    // Mapear campos para o formato esperado pelo frontend
    const mapped = logs.map((log: any) => ({
      recipientName: (JSON.parse(log.payloadJson || '{}').NAME) || 'Estudante',
      recipientEmail: log.recipient,
      status: log.status,
      failureReason: log.errorMessage,
      sentAt: log.sentAt || log.createdAt,
      mandrillMsgId: log.mandrillMsgId
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('Get logs error:', error);
    return res.status(500).json({ error: 'Erro ao carregar logs do disparo' });
  }
});

// GET /api/dispatches/:id/export — Exportar logs (CSV ou PDF)
router.get('/:id/export', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format } = req.query;

    const dispatch = await (prisma.dispatch as any).findUnique({
      where: { id: req.params.id as string },
      include: { logs: true }
    });

    if (!dispatch) return res.status(404).json({ error: 'Disparo não encontrado' });

    if (format === 'csv') {
      let csv = 'Nome,Email,Status,Erro,Data,MsgIDMandrill\n';
      (dispatch as any).logs.forEach((log: any) => {
        const name = (JSON.parse(log.payloadJson || '{}').NAME) || 'Estudante';
        const dateObj = log.sentAt || log.createdAt;
        const dateStr = dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
        csv += `"${name}","${log.recipient}","${log.status}","${log.errorMessage || ''}","${dateStr}","${log.mandrillMsgId || ''}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dispatch-report-${id}.csv`);
      return res.send(csv);
    }

    if (format === 'pdf') {
      // Lazy-load pdfkit para evitar crashes se não instalado em runtime inicial
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=dispatch-report-${id}.pdf`);
      doc.pipe(res);

      // Cabeçalho
      const templateInfo = MANDRILL_TEMPLATES[dispatch.templateSlug as TemplateKey];
      const templateName = templateInfo ? templateInfo.name : dispatch.templateSlug;

      doc.fontSize(20).text('Relatório de Disparo - ELT CERT', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`ID do Disparo: ${dispatch.id}`);
      doc.text(`Template: ${templateName}`);
      doc.text(`Data: ${dispatch.createdAt.toLocaleString('pt-BR')}`);
      doc.text(`Sucesso: ${dispatch.totalSent}`);
      doc.text(`Falha: ${dispatch.totalFailed}`);
      doc.moveDown();

      // Tabela de Logs (Simplificada)
      doc.fontSize(14).text('Destinatários', { underline: true });
      doc.moveDown(0.5);

      (dispatch as any).logs.forEach((log: any, index: number) => {
        const name = (JSON.parse(log.payloadJson || '{}').NAME) || 'Estudante';
        const info = `${index + 1}. ${name} (${log.recipient}) - ${log.status}`;
        doc.fontSize(10).text(info);
        if (log.errorMessage) {
          doc.fontSize(8).fillColor('red').text(`   Erro: ${log.errorMessage}`).fillColor('black');
        }
      });

      doc.end();
      return;
    }

    return res.status(400).json({ error: 'Formato de exportação inválido' });
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Erro ao gerar exportação' });
  }
});

export default router;
