import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { checkPermission } from '../middlewares/checkPermission';
import { getEmailProvider, getAuthorizedSender, dispatchTemplateToMandrill } from '../services/mail';
import { EmailEventKey } from '../constants/emailEvents';

const router = Router();

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

export default router;
