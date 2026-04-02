import { Router, Request, Response } from 'express';
import path from 'path';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { checkPermission } from '../middlewares/checkPermission';
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
router.post('/recipients/resolve', authMiddleware, requireRole('ADMIN'), checkPermission('canSendEmails'), async (req: Request, res: Response) => {
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
router.post('/', authMiddleware, requireRole('ADMIN'), checkPermission('canSendEmails'), async (req: Request, res: Response) => {
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
          // NAME, LAST_NAME e EMAIL são sempre injetados do banco por destinatário.
          // Variáveis específicas de prova (EXAM_NAME, SCORE, CORRETAS, ERRADAS,
          // TOTAL_QUESTOES, COOLDOWN_DATE, COOLDOWN_TIME, RESULT_LINK, etc.)
          // devem ser enviadas pelo frontend no campo `variables` do body do disparo.
          const dynamicData: any = {
            NAME: student.user.name,
            LAST_NAME: student.lastName || '',
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

    // Buscar IDs dos estudantes para permitir links no frontend
    const emails = logs.map((l: any) => l.recipient);
    const students = await prisma.student.findMany({
      where: { user: { email: { in: emails } } },
      select: { id: true, user: { select: { email: true } } }
    });
    const emailToId = Object.fromEntries(students.map((s: any) => [s.user.email, s.id]));

    // Mapear campos para o formato esperado pelo frontend
    const mapped = logs.map((log: any) => ({
      recipientName: (JSON.parse(log.payloadJson || '{}').NAME) || 'Estudante',
      recipientEmail: log.recipient,
      studentId: emailToId[log.recipient] || null,
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
      const PDFDocument = require('pdfkit');
      // Buffer pages to allow post-generation footer addition
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=dispatch-report-${id}.pdf`);
      doc.pipe(res);

      // 1. CABEÇALHO (LOGO + TÍTULOS)
      const logoPath = path.resolve(__dirname, '../../../frontend/public/logotipo-elite-training.png');
      try {
        doc.image(logoPath, 50, 45, { height: 40 });
      } catch (e) {
        console.warn('Logo not found at:', logoPath);
      }

      doc.fillColor('#1a1a1a')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('Relatório de Disparo', 200, 45, { align: 'right' });
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#666')
         .text('Elite Certify', 200, 70, { align: 'right' });

      doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#eeeeee').lineWidth(1).stroke();
      doc.moveDown(2);

      // 2. DADOS DO DISPARO (BLOCO DE METADADOS)
      const startY = 120;
      doc.rect(50, startY, 495, 60).fill('#f5f5f5');
      doc.fillColor('#1a1a1a');
      
      const templateInfo = MANDRILL_TEMPLATES[dispatch.templateSlug as TemplateKey];
      const templateName = templateInfo ? templateInfo.name : dispatch.templateSlug;
      const createdAt = dispatch.createdAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

      // Coluna Esquerda
      doc.fontSize(9).font('Helvetica-Bold').text('Template:', 70, startY + 15).font('Helvetica').text(templateName, 130, startY + 15);
      doc.font('Helvetica-Bold').text('Data:', 70, startY + 35).font('Helvetica').text(createdAt, 130, startY + 35);

      // Coluna Direita
      doc.font('Helvetica-Bold').text('Total Enviados:', 300, startY + 15).font('Helvetica').text(String(dispatch.totalSent + dispatch.totalFailed), 390, startY + 15);
      doc.font('Helvetica-Bold').text('Sucesso:', 300, startY + 30).fillColor('#16a34a').text(String(dispatch.totalSent), 390, startY + 30).fillColor('#1a1a1a');
      doc.font('Helvetica-Bold').text('Falhas:', 300, startY + 45).fillColor('#dc2626').text(String(dispatch.totalFailed), 390, startY + 45).fillColor('#1a1a1a');

      doc.moveDown(4);

      // 3. TABELA DE DESTINATÁRIOS
      const tableTop = 200;
      doc.rect(50, tableTop, 495, 20).fill('#333333');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('NOME', 60, tableTop + 7, { width: 140 });
      doc.text('E-MAIL', 200, tableTop + 7, { width: 160 });
      doc.text('STATUS', 360, tableTop + 7, { width: 60 });
      doc.text('HORÁRIO', 430, tableTop + 7, { width: 50 });
      doc.text('ERRO', 485, tableTop + 7, { width: 60 });

      let rowY = tableTop + 20;
      doc.font('Helvetica').fillColor('#1a1a1a');

      (dispatch as any).logs.forEach((log: any, index: number) => {
        // Page break safety
        if (rowY > 730) {
          doc.addPage();
          rowY = 50;
          // Redesenhar header na nova página
          doc.rect(50, rowY, 495, 20).fill('#333333');
          doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
          doc.text('NOME', 60, rowY + 7);
          doc.text('E-MAIL', 200, rowY + 7);
          doc.text('STATUS', 360, rowY + 7);
          doc.text('HORÁRIO', 430, rowY + 7);
          doc.text('ERRO', 485, rowY + 7);
          rowY += 20;
          doc.font('Helvetica').fillColor('#1a1a1a');
        }

        // Zebra striping
        if (index % 2 === 1) {
          doc.rect(50, rowY, 495, 20).fill('#fcfcfc');
        } else {
          doc.rect(50, rowY, 495, 20).fill('#ffffff');
        }

        doc.fillColor('#1a1a1a');
        const payload = JSON.parse(log.payloadJson || '{}');
        const name = payload.NAME || 'Estudante';
        const sentTime = (log.sentAt || log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        doc.fontSize(8).text(name, 60, rowY + 6, { width: 135, ellipsis: true });
        doc.text(log.recipient, 200, rowY + 6, { width: 155, ellipsis: true });
        
        if (log.status === 'SENT') {
          doc.fillColor('#16a34a').font('Helvetica-Bold').text('SUCESSO', 360, rowY + 6).font('Helvetica');
        } else {
          doc.fillColor('#dc2626').font('Helvetica-Bold').text('FALHA', 360, rowY + 6).font('Helvetica');
        }

        doc.fillColor('#1a1a1a').text(sentTime, 430, rowY + 6, { width: 50 });
        
        if (log.errorMessage) {
          doc.fillColor('#dc2626').fontSize(7).text(log.errorMessage, 485, rowY + 5, { width: 55, height: 12, ellipsis: true }).fontSize(8);
        }

        rowY += 20;
      });

      // 4. RODAPÉ (EM TODAS AS PÁGINAS)
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        const footerY = 800;
        doc.moveTo(50, footerY - 5).lineTo(545, footerY - 5).strokeColor('#eeeeee').lineWidth(0.5).stroke();
        doc.fontSize(7).fillColor('#999999');
        doc.text(`Elite Certify — Relatório gerado em ${new Date().toLocaleString('pt-BR')}`, 50, footerY);
        doc.text(`Página ${i + 1} de ${pages.count}`, 50, footerY, { align: 'right' });
      }

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
