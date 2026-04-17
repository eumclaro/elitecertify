import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { checkPermission } from '../middlewares/checkPermission';
import { sendEventReferralEmail } from '../services/mail';

const router = Router();

// ── ALUNO: Listar eventos publicados ─────────────────────────────────────────
// GET /api/events
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role ?? '');
    const events = await prisma.event.findMany({
      where: isAdmin ? {} : { status: 'PUBLISHED' },
      orderBy: { date: 'asc' },
      include: {
        _count: { select: { interests: true, referrals: true } },
      },
    });
    return res.json(events);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar eventos' });
  }
});

// ── ALUNO: Minhas indicações ──────────────────────────────────────────────────
// GET /api/events/my-referrals
router.get('/my-referrals', authMiddleware, async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findFirst({ where: { userId: req.user!.userId } });
    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    const referrals = await prisma.eventReferral.findMany({
      where: { referrerId: student.id },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(referrals);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar indicações' });
  }
});

// ── ALUNO/ADMIN: Detalhe do evento ───────────────────────────────────────────
// GET /api/events/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({
      where: { id: id as string },
      include: { _count: { select: { interests: true } } },
    });
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
    if (event.status !== 'PUBLISHED' && req.user?.role !== 'ADMIN') {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    let hasInterest = false;
    if (req.user?.role !== 'ADMIN') {
      const student = await prisma.student.findFirst({ where: { userId: req.user!.userId } });
      if (student) {
        const interest = await prisma.eventInterest.findUnique({
          where: { eventId_studentId: { eventId: id as string, studentId: student.id } },
        });
        hasInterest = !!interest;
      }
    }

    return res.json({ ...event, hasInterest });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar evento' });
  }
});

// ── ADMIN: Criar evento ───────────────────────────────────────────────────────
// POST /api/events
router.post('/', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const { title, shortDescription, longDescription, date, location, isOnline, coverImageUrl, totalSpots, price, status } = req.body;
    if (!title || !shortDescription || !longDescription || !date || !location || !coverImageUrl) {
      return res.status(400).json({ error: 'Campos obrigatórios: title, shortDescription, longDescription, date, location, coverImageUrl' });
    }
    const event = await prisma.event.create({
      data: {
        title,
        shortDescription,
        longDescription,
        date: new Date(date),
        location,
        isOnline: isOnline ?? false,
        coverImageUrl,
        totalSpots: totalSpots ?? null,
        price: price ?? null,
        status: status || 'DRAFT',
      },
    });
    return res.status(201).json(event);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

// ── ADMIN: Editar evento ──────────────────────────────────────────────────────
// PUT /api/events/:id
router.put('/:id', authMiddleware, requireRole('ADMIN'), checkPermission('canEdit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, shortDescription, longDescription, date, location, isOnline, coverImageUrl, totalSpots, price, status } = req.body;
    const event = await prisma.event.update({
      where: { id: id as string },
      data: {
        ...(title !== undefined && { title }),
        ...(shortDescription !== undefined && { shortDescription }),
        ...(longDescription !== undefined && { longDescription }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(location !== undefined && { location }),
        ...(isOnline !== undefined && { isOnline }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
        ...(totalSpots !== undefined && { totalSpots }),
        ...(price !== undefined && { price }),
        ...(status !== undefined && { status }),
      },
    });
    return res.json(event);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

// ── ADMIN: Remover evento ─────────────────────────────────────────────────────
// DELETE /api/events/:id
router.delete('/:id', authMiddleware, requireRole('ADMIN'), checkPermission('canDelete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.event.delete({ where: { id: id as string } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover evento' });
  }
});

// ── ALUNO: Demonstrar interesse ───────────────────────────────────────────────
// POST /api/events/:id/interest
router.post('/:id/interest', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const student = await prisma.student.findFirst({ where: { userId: req.user!.userId } });
    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    const event = await prisma.event.findUnique({ where: { id: id as string } });
    if (!event || event.status !== 'PUBLISHED') return res.status(404).json({ error: 'Evento não encontrado' });

    const existing = await prisma.eventInterest.findUnique({
      where: { eventId_studentId: { eventId: id as string, studentId: student.id } },
    });
    if (existing) return res.status(409).json({ error: 'Interesse já registrado para este evento' });

    const interest = await prisma.eventInterest.create({
      data: { eventId: id as string, studentId: student.id, notes: notes || null },
    });
    return res.status(201).json(interest);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao registrar interesse' });
  }
});

// ── ADMIN: Listar interesses ──────────────────────────────────────────────────
// GET /api/events/:id/interests
router.get('/:id/interests', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const interests = await prisma.eventInterest.findMany({
      where: { eventId: id as string },
      include: { student: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(interests);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar interesses' });
  }
});

// ── ALUNO: Registrar indicação ────────────────────────────────────────────────
// POST /api/events/:id/referral
router.post('/:id/referral', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { referredName, referredEmail, referredPhone } = req.body;

    if (!referredName || !referredEmail || !referredPhone) {
      return res.status(400).json({ error: 'Nome, e-mail e WhatsApp do indicado são obrigatórios' });
    }

    const student = await prisma.student.findFirst({
      where: { userId: req.user!.userId },
      include: { user: { select: { name: true } } },
    });
    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    const event = await prisma.event.findUnique({ where: { id: id as string } });
    if (!event || event.status !== 'PUBLISHED') return res.status(404).json({ error: 'Evento não encontrado' });

    const referral = await prisma.eventReferral.create({
      data: {
        eventId: id as string,
        referrerId: student.id,
        referredName,
        referredEmail,
        referredPhone,
      },
    });

    sendEventReferralEmail(
      student.user.name,
      referredName,
      referredEmail,
      event.title,
      event.date,
      event.location,
      event.isOnline
    ).catch((err) => console.error('[EVENTS] Referral email error:', err));

    return res.status(201).json(referral);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao registrar indicação' });
  }
});

// ── ADMIN: Listar indicações ──────────────────────────────────────────────────
// GET /api/events/:id/referrals
router.get('/:id/referrals', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const referrals = await prisma.eventReferral.findMany({
      where: { eventId: id as string },
      include: { referrer: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(referrals);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar indicações' });
  }
});

// ── ADMIN: Marcar indicação como convertida ───────────────────────────────────
// PATCH /api/events/:id/referrals/:referralId/convert
router.patch('/:id/referrals/:referralId/convert', authMiddleware, requireRole('ADMIN'), checkPermission('canEdit'), async (req: Request, res: Response) => {
  try {
    const { referralId } = req.params;
    const { converted } = req.body;
    const referral = await prisma.eventReferral.update({
      where: { id: referralId as string },
      data: { converted: converted ?? true },
    });
    return res.json(referral);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar indicação' });
  }
});

export default router;
