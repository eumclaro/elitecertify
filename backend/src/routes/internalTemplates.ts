import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { EmailEventKey } from '../constants/emailEvents';

const router = Router();

// GET /api/internal-templates
router.get('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const templates = await prisma.internalTemplate.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    return res.json(templates);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar templates internos' });
  }
});

// GET /api/internal-templates/:id
router.get('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await prisma.internalTemplate.findUnique({
      where: { id: id as string }
    });
    if (!template) return res.status(404).json({ error: 'Template não encontrado' });
    return res.json(template);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar template interno' });
  }
});

// POST /api/internal-templates
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, description, htmlContent, mergeVars, status } = req.body;
    const template = await prisma.internalTemplate.create({
      data: {
        name,
        description,
        htmlContent,
        mergeVars: mergeVars || {},
        status: status || 'DRAFT'
      }
    });
    return res.status(201).json(template);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar template interno' });
  }
});

// PUT /api/internal-templates/:id
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, htmlContent, mergeVars, status } = req.body;
    const template = await prisma.internalTemplate.update({
      where: { id: id as string },
      data: {
        name,
        description,
        htmlContent,
        mergeVars,
        status
      }
    });
    return res.json(template);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar template interno' });
  }
});

// DELETE /api/internal-templates/:id
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.internalTemplate.delete({ where: { id: id as string } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir template interno' });
  }
});

export default router;
