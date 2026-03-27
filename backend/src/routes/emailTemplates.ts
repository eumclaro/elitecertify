import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getEmailProvider, getAuthorizedSender, dispatchTemplateToMandrill } from '../services/mail';
import { EmailEventKey } from '../constants/emailEvents';

const router = Router();

// GET /api/email-templates/mandrill/sync
// Sincroniza templates do Mandrill para o banco local
router.get('/mandrill/sync', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const provider = getEmailProvider();
    const remoteTemplates = await provider.listTemplates();

    const results = { created: 0, updated: 0 };

    for (const remote of remoteTemplates) {
      // Mandrill template object usually has 'name', 'slug', 'publish_name', etc.
      // We use 'slug' as the unique identifier (template_name in Mandrill API)
      const slug = remote.slug;
      const name = remote.name || slug;

      const existing = await prisma.emailTemplate.findUnique({ where: { slug } });

      if (existing) {
        await prisma.emailTemplate.update({
          where: { slug },
          data: {
            name,
            lastSyncedAt: new Date(),
            // No Mandrill SDK response, merge vars might be in templates.info
          }
        });
        results.updated++;
      } else {
        await prisma.emailTemplate.create({
          data: {
            slug,
            name,
            provider: 'MANDRILL',
            status: 'active',
            lastSyncedAt: new Date()
          }
        });
        results.created++;
      }
    }

    return res.json({ message: 'Sincronização concluída', ...results });
  } catch (error: any) {
    console.error('[EmailTemplates] Sync Error:', error);
    return res.status(500).json({ error: 'Erro ao sincronizar templates do Mandrill' });
  }
});

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
      include: { template: true },
      orderBy: { eventKey: 'asc' }
    });
    return res.json(bindings);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar vínculos' });
  }
});

// POST /api/email-templates/bindings
router.post('/bindings', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { eventKey, templateId, isActive } = req.body;

    if (!eventKey || !templateId) {
      return res.status(400).json({ error: 'Evento e Template são obrigatórios' });
    }

    const binding = await prisma.emailEventBinding.upsert({
      where: { eventKey },
      update: { templateId, isActive: isActive ?? true },
      create: { eventKey, templateId, isActive: isActive ?? true },
      include: { template: true }
    });

    return res.status(201).json(binding);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao salvar vínculo' });
  }
});

// POST /api/email-templates/render
router.post('/render', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { slug, mergeVars } = req.body;
    if (!slug) return res.status(400).json({ error: 'Slug do template é obrigatório' });

    const provider = getEmailProvider();
    const html = await provider.renderTemplate(slug, mergeVars || {});

    return res.json({ html });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao renderizar template' });
  }
});

// POST /api/email-templates/test
router.post('/test', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { toEmail, toName, templateSlug, dynamicData, subject, eventKey } = req.body;

    if (eventKey) {
      // Se um evento for fornecido, usamos a lógica oficial de vínculo (valida se há template vinculado)
      const success = await dispatchTemplateToMandrill(
        eventKey as EmailEventKey,
        toEmail,
        toName || 'Destinatário Teste',
        dynamicData || {},
        subject
      );
      return res.json({ message: 'E-mail de teste (via vínculo) enviado!', success });
    }

    // Se NÃO houver evento, enviamos direto pelo slug mas registramos como MANUAL_TEST
    const provider = getEmailProvider();
    const { fromEmail, fromName } = await getAuthorizedSender();
    
    const msgId = await provider.sendTemplate({
      toEmail,
      toName,
      templateSlug,
      eventKey: 'MANUAL_TEST',
      subject: subject || 'E-mail de Teste - ELT CERT',
      dynamicData: dynamicData || {},
      fromEmail,
      fromName
    });

    // Registrar Log Manual
    await prisma.emailLog.create({
      data: {
        eventKey: 'MANUAL_TEST',
        templateUsed: templateSlug,
        recipient: toEmail,
        subject: subject || 'E-mail de Teste - ELT CERT',
        payloadJson: JSON.stringify(dynamicData || {}),
        provider: 'MANDRILL',
        mandrillMsgId: msgId,
        status: 'SENT',
        sentAt: new Date()
      }
    });

    return res.json({ message: 'E-mail de teste (direto) enviado!', mandrillMsgId: msgId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao enviar e-mail de teste' });
  }
});

export default router;
