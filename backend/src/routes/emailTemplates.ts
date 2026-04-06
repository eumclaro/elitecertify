import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { checkPermission } from '../middlewares/checkPermission';
import { getEmailProvider, getAuthorizedSender, dispatchTemplateToMandrill } from '../services/mail';
import { EmailEventKey } from '../constants/emailEvents';

const router = Router();

export const EVENT_MERGE_TAGS: Record<string, string[]> = {
  STUDENT_CREATED: ['NAME', 'LAST_NAME', 'EMAIL', 'PASSWORD', 'SUPPORT_EMAIL'],
  AUTH_PASSWORD_RESET: ['NAME', 'LAST_NAME', 'EMAIL', 'RESET_LINK', 'SUPPORT_EMAIL'],
  EXAM_RELEASED: ['NAME', 'LAST_NAME', 'EMAIL', 'EXAM_NAME', 'SUPPORT_EMAIL'],
  EXAM_PASSED: ['NAME', 'LAST_NAME', 'EMAIL', 'EXAM_NAME', 'SCORE', 'CORRETAS', 'ERRADAS', 'TOTAL_QUESTOES', 'CERTIFICATE_LINK', 'SUPPORT_EMAIL'],
  EXAM_FAILED: ['NAME', 'LAST_NAME', 'EMAIL', 'EXAM_NAME', 'SCORE', 'CORRETAS', 'ERRADAS', 'TOTAL_QUESTOES', 'COOLDOWN_DATE', 'COOLDOWN_TIME', 'SUPPORT_EMAIL'],
  EXAM_ABANDONED: ['NAME', 'LAST_NAME', 'EMAIL', 'EXAM_NAME', 'SUPPORT_EMAIL'],
  COOLDOWN_RELEASED: ['NAME', 'LAST_NAME', 'EMAIL', 'EXAM_NAME', 'SUPPORT_EMAIL'],
  CERTIFICATE_SENT: ['NAME', 'EXAM_NAME', 'CERTIFICATE_CODE'],
};

// GET /api/email-templates
router.get('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      include: { bindings: true },
      orderBy: { name: 'asc' }
    });
    return res.json(templates);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar templates' });
  }
});

// GET /api/email-templates/bindings
router.get('/bindings', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const bindings = await prisma.emailEventBinding.findMany({
      include: { template: true, internalTemplate: true },
      orderBy: { eventKey: 'asc' }
    });
    return res.json(bindings);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar vínculos' });
  }
});

// POST /api/email-templates/bindings
router.post('/bindings', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const { eventKey, templateId, internalTemplateId, isActive } = req.body;

    if (!eventKey) {
      return res.status(400).json({ error: 'Evento é obrigatório' });
    }

    const binding = await prisma.emailEventBinding.upsert({
      where: { eventKey },
      update: { 
        templateId: templateId || null, 
        internalTemplateId: internalTemplateId || null,
        isActive: isActive ?? true 
      },
      create: { 
        eventKey, 
        templateId: templateId || null, 
        internalTemplateId: internalTemplateId || null,
        isActive: isActive ?? true 
      },
      include: { template: true, internalTemplate: true }
    });

    return res.status(201).json(binding);
  } catch (error) {
    console.error('[EmailTemplates] Binding error:', error);
    return res.status(500).json({ error: 'Erro ao salvar vínculo' });
  }
});

// PUT /api/email-templates/:id
router.put('/:id', authMiddleware, requireRole('ADMIN'), checkPermission('canEdit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, htmlContent, status } = req.body;

    const template = await prisma.emailTemplate.update({
      where: { id: id as string },
      data: {
        ...(name && { name }),
        ...(status && { status }),
        htmlContent: htmlContent !== undefined ? htmlContent : undefined,
      }
    });

    return res.json(template);
  } catch (error) {
    console.error('[EmailTemplates] Update Error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar template' });
  }
});

// POST /api/email-templates/test
router.post('/test', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const { toEmail, toName, templateSlug, internalTemplateId, dynamicData, subject, eventKey } = req.body;

    if (eventKey) {
      const success = await dispatchTemplateToMandrill(
        eventKey as EmailEventKey,
        toEmail,
        toName || 'Destinatário Teste',
        dynamicData || {},
        subject
      );
      return res.json({ message: 'E-mail de teste enviado!', success });
    }

    const provider = getEmailProvider();
    const { fromEmail, fromName } = await getAuthorizedSender();
    
    let htmlContent: string | undefined = undefined;
    let nameUsed = templateSlug || 'Teste';

    if (internalTemplateId) {
      const it = await prisma.internalTemplate.findUnique({ where: { id: internalTemplateId } });
      htmlContent = it?.htmlContent || undefined;
      nameUsed = it?.name || nameUsed;
    } else if (templateSlug) {
      // Fallback para EmailTemplate legado se ainda usado no teste
      const et = await prisma.emailTemplate.findUnique({ where: { slug: templateSlug } });
      htmlContent = et?.htmlContent || undefined;
    }
    
    const msgId = await provider.send({
      toEmail,
      toName,
      eventKey: 'MANUAL_TEST',
      subject: subject || 'E-mail de Teste - Elite Certify',
      dynamicData: dynamicData || {},
      fromEmail,
      fromName,
      htmlContent
    });

    // Registrar Log Manual
    await prisma.emailLog.create({
      data: {
        eventKey: 'MANUAL_TEST',
        templateUsed: nameUsed,
        recipient: toEmail,
        subject: subject || 'E-mail de Teste - Elite Certify',
        payloadJson: JSON.stringify(dynamicData || {}),
        provider: 'MANDRILL',
        mandrillMsgId: msgId,
        status: 'SENT',
        sentAt: new Date()
      }
    });

    return res.json({ message: 'E-mail de teste enviado!', mandrillMsgId: msgId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao enviar e-mail de teste' });
  }
});

// GET /api/email-templates/merge-tags
router.get('/merge-tags', authMiddleware, requireRole('ADMIN'), (_req: Request, res: Response) => {
  return res.json(EVENT_MERGE_TAGS);
});

// POST /api/email-templates/dispatch
router.post('/dispatch', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const { templateId, classId, filter = 'ALL' } = req.body;

    if (!templateId || !classId) {
      return res.status(400).json({ error: 'templateId e classId são obrigatórios' });
    }

    const template = await prisma.internalTemplate.findUnique({ where: { id: templateId } });
    if (!template || !template.htmlContent) {
      return res.status(404).json({ error: 'Template não encontrado ou sem conteúdo HTML' });
    }

    // Busca alunos da turma com dados necessários para filtro e substituição
    const classStudents = await prisma.classStudent.findMany({
      where: { classId },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            examAttempts: {
              where: { executionStatus: 'FINISHED' },
              orderBy: { finishedAt: 'desc' },
              take: 1,
              select: { resultStatus: true }
            },
            cooldowns: {
              where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
              take: 1
            }
          }
        }
      }
    });

    // Aplica filtro
    const filtered = classStudents.filter(({ student }) => {
      const latestAttempt = student.examAttempts[0];
      const hasCooldown = student.cooldowns.length > 0;

      if (filter === 'APPROVED') return latestAttempt?.resultStatus === 'PASSED';
      if (filter === 'REPROVED') return latestAttempt?.resultStatus === 'FAILED' || latestAttempt?.resultStatus === 'FAILED_TIMEOUT';
      if (filter === 'PENDING') return !latestAttempt;
      if (filter === 'COOLDOWN') return hasCooldown;
      return true; // ALL
    });

    const { fromEmail, fromName } = await getAuthorizedSender();
    const provider = getEmailProvider();
    const supportEmail = 'suporte@elitetraining.com.br';

    let sent = 0;
    let failed = 0;
    const BATCH_SIZE = 10;

    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async ({ student }) => {
        try {
          const name = student.user.name;
          const lastName = student.lastName || '';
          const email = student.user.email;

          let html = template.htmlContent!;
          const vars: Record<string, string> = { NAME: name, LAST_NAME: lastName, EMAIL: email, SUPPORT_EMAIL: supportEmail };
          Object.entries(vars).forEach(([key, val]) => {
            html = html.replace(new RegExp(`{{${key}}}`, 'g'), val);
          });

          await provider.send({
            toEmail: email,
            toName: name,
            eventKey: 'MANUAL_BLAST' as EmailEventKey,
            subject: template.name,
            dynamicData: vars,
            fromEmail,
            fromName,
            htmlContent: html,
          });

          await prisma.emailLog.create({
            data: {
              eventKey: 'MANUAL_BLAST',
              templateUsed: template.name,
              recipient: email,
              subject: template.name,
              payloadJson: JSON.stringify(vars),
              provider: 'MANDRILL',
              status: 'SENT',
              sentAt: new Date(),
              studentId: student.id,
            }
          });

          sent++;
        } catch (err: any) {
          console.error(`[Dispatch] Falha para ${student.user.email}:`, err.message);
          failed++;
        }
      }));

      // Delay entre lotes (exceto no último)
      if (i + BATCH_SIZE < filtered.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return res.json({ total: filtered.length, sent, failed });
  } catch (error: any) {
    console.error('[Dispatch] Error:', error);
    return res.status(500).json({ error: 'Erro ao processar disparo em massa' });
  }
});

export default router;
