import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { env } from '../config/env';
import { authMiddleware, AuthPayload, requireRole } from '../middleware/auth';
import { getClientInfo } from '../middleware/audit';
import { checkPermission } from '../middlewares/checkPermission';
import { sendPasswordResetEmail } from '../services/mail';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = 'assets/avatars';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `avatar-${(req as any).user.userId}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Somente imagens são permitidas'));
  }
});

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
        role: userRole as any,
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
        avatarUrl: user.avatarUrl,
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
      avatarUrl: user.avatarUrl,
      studentId: user.student?.id || null,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

// PUT /api/auth/profile/details — Atualiza Nome/Email
router.put('/profile/details', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Campos obrigatórios' });

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name, email }
    });

    return res.json({ message: 'Dados atualizados!', user: { name: updated.name, email: updated.email } });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'E-mail em uso.' });
    return res.status(500).json({ error: 'Erro ao atualizar dados.' });
  }
});

// PUT /api/auth/profile/password — Alterar Senha com verificação
router.put('/profile/password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Senhas obrigatórias' });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta.' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionToken: null } // Desloga para segurança
    });

    return res.json({ message: 'Senha alterada com sucesso! Por favor, faça login novamente.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao trocar senha.' });
  }
});

// POST /api/auth/profile/avatar — Upload de Avatar
router.post('/profile/avatar', authMiddleware, upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const avatarUrl = `/assets/avatars/${req.file.filename}`;
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { 
        avatarUrl 
      }
    });

    return res.json({ message: 'Foto de perfil atualizada!', avatarUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao salvar avatar.' });
  }
});

// GET /api/auth/profile — Dados completos do aluno autenticado
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { student: true },
    });

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    return res.json({
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      lastName: user.student?.lastName || '',
      phone: user.student?.phone || '',
      cpf: user.student?.cpf || '',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

// PUT /api/auth/profile — Atualização do próprio perfil (aluno autenticado)
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, lastName, phone, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { student: true },
    });

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Atualiza user.name e password se fornecidos
    const userUpdate: any = {};
    if (name && name.trim()) userUpdate.name = name.trim();
    if (password && password.trim()) {
      userUpdate.passwordHash = await bcrypt.hash(password, 12);
    }
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: userUpdate });
    }

    // Atualiza student.lastName e student.phone se aluno existir
    if (user.student) {
      const studentUpdate: any = {};
      if (lastName !== undefined) studentUpdate.lastName = lastName;
      if (phone !== undefined) studentUpdate.phone = phone;
      if (Object.keys(studentUpdate).length > 0) {
        await prisma.student.update({ where: { id: user.student.id }, data: studentUpdate });
      }
    }

    return res.json({ message: 'Perfil atualizado com sucesso' });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

    const user = await prisma.user.findUnique({ where: { email }, include: { student: true } });
    
    if (!user) {
      return res.json({ message: 'Se o e-mail existir, você receberá um link de recuperação em breve.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires }
    });

    const resetLink = `${env.FRONTEND_URL || 'https://certify.elitetraining.com.br'}/reset-password?token=${resetToken}`;
    
    sendPasswordResetEmail(user.name, user.email, resetLink, user.student?.lastName || '').catch(() => {});

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
        resetTokenExpires: { gt: new Date() }
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
        sessionToken: null
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

// ==========================================
// TEAM & INVITE MANAGEMENT
// ==========================================

// PUT /api/auth/team/:id/password — Redefinir senha da equipe (SUPER_ADMIN apenas)
router.put('/team/:id/password', authMiddleware, requireRole('SUPER_ADMIN'), checkPermission('canManageAdmins'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Novas senhas são obrigatórias.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'As senhas não coincidem.' });
    }

    const user = await prisma.user.findUnique({ where: { id: id as string } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: id as string },
      data: { passwordHash, sessionToken: null } // Desloga o usuário por segurança
    });

    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: {
        userId: req.user!.userId,
        action: 'TEAM_PASSWORD_RESET',
        entity: 'user',
        entityId: id as string,
        ip,
        device,
        metadata: `Password reset by admin ${req.user!.userId}`
      }
    });

    return res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    console.error('[Team Password Reset Error]', err);
    return res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
});

// GET /api/auth/invite/validate — Validar Token de Convite
router.get('/invite/validate', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token obrigatório.' });

    const user = await prisma.user.findFirst({
      where: {
        // @ts-ignore
        inviteToken: token as string,
        // @ts-ignore
        inviteExpires: { gt: new Date() },
        active: false
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Link de convite inválido ou expirado.' });
    }

    return res.json({ name: user.name, email: user.email });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao validar convite.' });
  }
});

// POST /api/auth/invite/activate — Ativar conta com nova senha
router.post('/invite/activate', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Dados obrigatórios.' });

    const user = await prisma.user.findFirst({
      where: {
        // @ts-ignore
        inviteToken: token as string,
        // @ts-ignore
        inviteExpires: { gt: new Date() },
        active: false
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        active: true,
        // @ts-ignore
        inviteToken: null,
        // @ts-ignore
        inviteExpires: null
      }
    });

    const { ip, device } = getClientInfo(req);
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'INVITE_ACTIVATED',
        entity: 'user',
        entityId: user.id,
        ip,
        device
      }
    });

    return res.json({ message: 'Sua conta foi ativada com sucesso! Você já pode fazer login.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao ativar conta.' });
  }
});

export default router;
