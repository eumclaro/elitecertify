import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { checkPermission } from '../middlewares/checkPermission';
import { sendInviteEmail } from '../services/mail';

const router = Router();

// GET /api/users - listar equipe
router.get('/', authMiddleware, requireRole('ADMIN'), checkPermission('canManageAdmins'), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] as any }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar usuários do sistema.' });
  }
});

// POST /api/users/invite - convidar novo admin
router.post('/invite', authMiddleware, requireRole('ADMIN'), checkPermission('canManageAdmins'), async (req: Request, res: Response) => {
  try {
    const { name, email, role } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Não é possível convidar novos SUPER_ADMIN.' });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    const inviteToken = crypto.randomUUID();
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: '', // Será definida na ativação
        role: role as any,
        active: false,
        // @ts-ignore
        inviteToken,
        // @ts-ignore
        inviteExpires
      }
    });

    const inviteLink = `${process.env.FRONTEND_URL}/criar-senha?token=${inviteToken}`;
    await sendInviteEmail(name, email, role, inviteLink);

    return res.status(201).json({ message: 'Convite enviado com sucesso!', user: { id: user.id, email: user.email } });
  } catch (err: any) {
    console.error('[Invite Error]', err);
    return res.status(500).json({ error: 'Erro ao convidar usuário.' });
  }
});

// PUT /api/users/:id - editar admin
router.put('/:id', authMiddleware, requireRole('ADMIN'), checkPermission('canManageAdmins'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id: id as string } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    if ((user.role as string) === 'SUPER_ADMIN' && role && role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Não é possível alterar a role de um SUPER_ADMIN.' });
    }

    if (role === 'SUPER_ADMIN' && (user.role as string) !== 'SUPER_ADMIN') {
       return res.status(403).json({ error: 'Não é possível promover um usuário para SUPER_ADMIN.' });
    }

    const updated = await prisma.user.update({
      where: { id: id as string },
      data: { name, email, role: role as any }
    });

    return res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'E-mail em uso.' });
    return res.status(500).json({ error: 'Erro ao editar usuário.' });
  }
});

// PUT /api/users/:id/deactivate
router.put('/:id/deactivate', authMiddleware, requireRole('ADMIN'), checkPermission('canManageAdmins'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const user = await prisma.user.findUnique({ where: { id: id as string } });
    if ((user?.role as string) === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Não é possível desativar um SUPER_ADMIN.' });
    }

    await prisma.user.update({ where: { id: id as string }, data: { active } });
    return res.json({ success: true, active });
  } catch(err) {
    return res.status(500).json({ error: 'Erro ao alterar status.' });
  }
});

export default router;
