import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { env } from '../config/env';
import { authMiddleware, AuthPayload } from '../middleware/auth';
import { getClientInfo } from '../middleware/audit';
import { sendPasswordResetEmail } from '../services/mail';
import crypto from 'crypto';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, cpf, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userRole = role === 'ADMIN' ? 'ADMIN' : 'STUDENT';

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: userRole,
        ...(userRole === 'STUDENT' && {
          student: {
            create: {
              cpf: cpf || null,
              phone: phone || null,
            },
          },
        }),
      },
      include: { student: true },
    });

    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        entity: 'user',
        entityId: user.id,
        ip,
        device,
      },
    });

    const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' });

    await prisma.user.update({
      where: { id: user.id },
      data: { sessionToken: token, lastLoginIp: ip, lastLoginDevice: device, lastLoginAt: new Date() },
    });

    return res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { student: true } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Conta desativada. Contate o administrador.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const { ip, device } = getClientInfo(req);
    const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' });

    // Update session token (invalidates previous sessions - blocks multiple logins)
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionToken: token, lastLoginIp: ip, lastLoginDevice: device, lastLoginAt: new Date() },
    });

    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'user',
        entityId: user.id,
        ip,
        device,
      },
    });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.student?.id || null,
      },
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { student: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.student?.id || null,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

// =========================================================
// PASSWORD RECOVERY
// =========================================================

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Sempre retorna mensagem de sucesso para evitar user enumeration
    if (!user) {
      return res.json({ message: 'Se o e-mail existir, você receberá um link de recuperação em breve.' });
    }

    // Gera um token criptograficamente seguro e expiração (1h)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires }
    });

    const resetLink = `${env.FRONTEND_URL || 'https://certify.elitetraining.com.br'}/reset-password?token=${resetToken}`;
    
    // Envia o e-mail sem aguardar para evitar que um atacante meça o tempo de resposta
    sendPasswordResetEmail(user.name, user.email, resetLink).catch(() => {});

    // Registra evento para segurança
    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: { userId: user.id, action: 'PASSWORD_RESET_REQUESTED', entity: 'user', entityId: user.id, ip, device }
    });

    return res.json({ message: 'Se o e-mail existir, você receberá um link de recuperação em breve.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Erro ao processar recuperação' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() } // Expiração válida
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        sessionToken: null // Desloga de todos os dispositivos
      }
    });

    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: { userId: user.id, action: 'PASSWORD_RESET_COMPLETED', entity: 'user', entityId: user.id, ip, device }
    });

    return res.json({ message: 'Senha redefinida com sucesso. Faça o login.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Erro ao redefinir a senha' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { sessionToken: null },
    });

    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: {
        userId: req.user!.userId,
        action: 'LOGOUT',
        entity: 'user',
        entityId: req.user!.userId,
        ip,
        device,
      },
    });

    return res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao fazer logout' });
  }
});

export default router;
