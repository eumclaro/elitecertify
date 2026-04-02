import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { checkPermission } from '../middlewares/checkPermission';
import { encrypt } from '../utils/crypto';
import nodemailer from 'nodemailer';
import { getEmailProvider } from '../services/mail';
import { EMAIL_MAPPINGS } from '../constants/emailEvents';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../assets/system');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, 'login-cover.jpg');
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = Router();

// GET /api/settings/smtp
router.get('/smtp', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_config' } });
    if (!setting) {
      return res.json({ hasConfig: false });
    }
    const config = JSON.parse(setting.value);
    
    // Do not return raw password to frontend
    return res.json({
      host: config.host || '',
      port: config.port || '',
      user: config.user || '',
      fromEmail: config.fromEmail || '',
      fromName: config.fromName || '',
      hasPassword: !!config.pass
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar configurações SMTP' });
  }
});

// PUT /api/settings/smtp
router.put('/smtp', authMiddleware, requireRole('ADMIN'), checkPermission('canEdit'), async (req: Request, res: Response) => {
  try {
    const { host, port, user, pass, fromEmail, fromName } = req.body;
    
    // Obter config existente caso a senha venha vazia (ou seja, manteve a hasPassword = true)
    let finalPass = '';
    const existingSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_config' } });
    if (existingSetting) {
      const existingConfig = JSON.parse(existingSetting.value);
      finalPass = pass ? encrypt(pass) : existingConfig.pass;
    } else {
      finalPass = pass ? encrypt(pass) : '';
    }

    const payload = JSON.stringify({
      host, port, user, pass: finalPass, fromEmail, fromName
    });

    await prisma.systemSetting.upsert({
      where: { key: 'smtp_config' },
      update: { value: payload, updatedBy: req.user?.userId },
      create: { key: 'smtp_config', value: payload, updatedBy: req.user?.userId }
    });

    return res.json({ message: 'Configurações atualizadas' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao persistir configuração SMTP' });
  }
});

// POST /api/settings/smtp/test
router.post('/smtp/test', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const { host, port, user, pass, fromEmail, fromName } = req.body;
    let fallbackPass = pass;
    
    if (!pass) {
      const existingSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_config' } });
      if (existingSetting) {
        const config = JSON.parse(existingSetting.value);
        // Descriptografaremos no mail.ts global, mas pro teste cru, precisamos do raw ou do desencriptado 
        // Importar a funcao decrypt seria melhor
        const { decrypt } = require('../utils/crypto');
        fallbackPass = decrypt(config.pass);
      }
    }

    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465,
      auth: { user, pass: fallbackPass }
    });

    await transporter.verify();

    const fromLine = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
    await transporter.sendMail({
      from: fromLine,
      to: req.user?.email || fromEmail,
      subject: 'Teste de Conexão SMTP - ELT Training',
      text: 'Se você está recebendo este e-mail, sua configuração SMTP foi testada com sucesso no painel administrativo!'
    });

    return res.json({ message: 'Teste concluído! Verifique a sua caixa de e-mail.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Falha de comunicação com SMTP.' });
  }
});

// POST /api/settings/mandrill/test
router.post('/mandrill/test', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const provider = getEmailProvider();
    
    // We'll try to send a simple HTML test
    const dummyAt = new Date().toLocaleDateString('pt-BR');
    await provider.send({
      toEmail: user.email,
      toName: user.name,
      eventKey: 'STUDENT_CREATED', 
      subject: `Teste de Conexão Mandrill - ${dummyAt}`,
      dynamicData: {
        NAME: user.name,
        EMAIL: user.email,
        PASSWORD: '----',
        SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
      },
      htmlContent: `<h1>Teste de Conexão</h1><p>Olá ${user.name}, o seu servidor SMTP (Mandrill) está funcionando corretamente via Elite Certify.</p><p>Data: ${dummyAt}</p>`
    });

    return res.json({ message: 'Conexão com Mandrill validada! Template de boas-vindas enviado para seu e-mail.' });
  } catch (err: any) {
    console.error('[SETTINGS] Mandrill Test Error:', err);
    return res.status(400).json({ error: err.message || 'Falha ao conectar com a API do Mandrill.' });
  }
});
// GET /api/settings/login-cover
router.get('/login-cover', async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'login_cover_image' } });
    if (setting && setting.value) {
      return res.json({ url: setting.value });
    }
    return res.json({ url: null });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar imagem de login' });
  }
});

// POST /api/settings/login-cover
router.post('/login-cover', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const url = `/assets/system/${req.file.filename}?t=${Date.now()}`;
    await prisma.systemSetting.upsert({
      where: { key: 'login_cover_image' },
      update: { value: url, updatedBy: req.user?.userId },
      create: { key: 'login_cover_image', value: url, updatedBy: req.user?.userId }
    });
    return res.json({ message: 'Imagem atualizada', url });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao fazer upload de imagem' });
  }
});

export default router;
