import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// ============================================================
// AUDIT LOGS — List with filters
// GET /api/audit
// ============================================================
router.get('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { action, userId, entity, page = '1', limit = '50' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (action) where.action = String(action);
    if (userId) where.userId = String(userId);
    if (entity) where.entity = String(entity);

    const [logs, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return res.json({
      logs,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    console.error('Audit list error:', error);
    return res.status(500).json({ error: 'Erro ao listar logs' });
  }
});

// ============================================================
// AUDIT: Get distinct actions for filter
// GET /api/audit/actions
// ============================================================
router.get('/actions', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const actions = await prisma.auditEvent.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return res.json(actions.map(a => a.action));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar ações' });
  }
});

export default router;
