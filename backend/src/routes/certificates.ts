import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { generateCertificatePdf, sendCertificateByEmail } from '../services/certificateService';

const router = Router();

// GET /api/certificates/:code/pdf
router.get('/:code/pdf', authMiddleware, async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;

    const certificate = await prisma.certificate.findUnique({
      where: { code },
      include: {
        student: {
          include: { user: true }
        },
        exam: {
          include: { certificateTemplate: true }
        },
      },
    }) as any;

    if (!certificate) {
      return res.status(404).json({ error: 'Certificado não encontrado.' });
    }

    // Apenas o próprio aluno ou admin podem baixar
    const requestingUserId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    
    const isOwner = certificate.student.userId === requestingUserId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const tpl = certificate.exam.certificateTemplate;
    if (!tpl) {
      return res.status(400).json({ error: 'Esta prova não possui um template de certificado vinculado.' });
    }

    const templateFile = tpl.fileName;
    const studentName = `${certificate.student.user.name} ${certificate.student.lastName ?? ''}`.trim();

    const pdfBuffer = await generateCertificatePdf({
      studentName,
      certifiedId: certificate.code,
      issuedAt: certificate.issuedAt,
      templateFile,
      nameTop: tpl.nameTop,
      nameLeft: tpl.nameLeft,
      codeTop: tpl.codeTop,
      codeLeft: tpl.codeLeft,
      dateBottom: tpl.dateBottom,
      dateLeft: tpl.dateLeft,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificado-${certificate.code}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);

  } catch (error: any) {
    console.error('[CertificatePDF] CRITICAL ERROR:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Full Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return res.status(500).json({ error: 'Erro ao gerar certificado.' });
  }
});

// GET /api/certificates/validate/:code (Público)
router.get('/validate/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;

    const certificate = await prisma.certificate.findUnique({
      where: { code },
      include: {
        student: {
          include: { user: true }
        },
        exam: true,
      },
    }) as any;

    if (!certificate) {
      return res.status(404).json({ 
        valid: false,
        error: 'Certificado não encontrado.' 
      });
    }

    return res.json({
      valid: true,
      studentName: `${certificate.student.user.name} ${certificate.student.lastName ?? ''}`.trim(),
      examTitle: certificate.exam.title,
      issuedAt: certificate.issuedAt,
      code: certificate.code
    });

  } catch (error) {
    console.error('[CertificateValidate]', error);
    return res.status(500).json({ error: 'Erro ao validar certificado.' });
  }
});

// POST /api/certificates/:code/send-email — Reenviar certificado por e-mail
router.post('/:code/send-email', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;

    const certificate = await prisma.certificate.findUnique({
      where: { code },
      include: {
        student: { include: { user: true } },
        exam: true,
      },
    }) as any;

    if (!certificate) {
      return res.status(404).json({ error: 'Certificado não encontrado.' });
    }

    const studentName = `${certificate.student.user.name} ${certificate.student.lastName ?? ''}`.trim();
    const studentEmail = certificate.student.user.email;

    await sendCertificateByEmail(code, studentEmail, studentName);

    return res.json({ message: 'Certificado reenviado por e-mail com sucesso.' });
  } catch (error: any) {
    console.error('[CertificateResend] Error:', error.message);
    return res.status(500).json({ error: 'Erro ao reenviar certificado por e-mail.' });
  }
});

export default router;
