import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { checkPermission } from '../middlewares/checkPermission';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.resolve(process.cwd(), 'assets/certificates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

// POST /api/certificate-templates
router.post('/', authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { name, nameTop, nameLeft, codeTop, codeLeft, dateBottom, dateLeft } = req.body;
    const file = req.file;

    if (!name || !file) {
      return res.status(400).json({ error: 'Nome e arquivo (file) são obrigatórios.' });
    }

    const template = await prisma.certificateTemplate.create({
      data: {
        name,
        fileName: file.filename,
        nameTop: nameTop ? parseFloat(nameTop) : undefined,
        nameLeft: nameLeft ? parseFloat(nameLeft) : undefined,
        codeTop: codeTop ? parseFloat(codeTop) : undefined,
        codeLeft: codeLeft ? parseFloat(codeLeft) : undefined,
        dateBottom: dateBottom ? parseFloat(dateBottom) : undefined,
        dateLeft: dateLeft ? parseFloat(dateLeft) : undefined,
      }
    });

    return res.status(201).json(template);
  } catch (error) {
    console.error('Error creating certificate template:', error);
    return res.status(500).json({ error: 'Erro ao criar template de certificado.' });
  }
});

// GET /api/certificate-templates
router.get('/', authMiddleware, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.certificateTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(templates);
  } catch (error) {
    console.error('Error listing certificate templates:', error);
    return res.status(500).json({ error: 'Erro ao listar templates de certificado.' });
  }
});

// PUT /api/certificate-templates/:id
router.put('/:id', authMiddleware, requireRole('ADMIN'), checkPermission('canEdit'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, nameTop, nameLeft, codeTop, codeLeft, dateBottom, dateLeft } = req.body;
    const file = req.file;

    const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Template não encontrado.' });
    }

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (nameTop !== undefined) dataToUpdate.nameTop = parseFloat(nameTop);
    if (nameLeft !== undefined) dataToUpdate.nameLeft = parseFloat(nameLeft);
    if (codeTop !== undefined) dataToUpdate.codeTop = parseFloat(codeTop);
    if (codeLeft !== undefined) dataToUpdate.codeLeft = parseFloat(codeLeft);
    if (dateBottom !== undefined) dataToUpdate.dateBottom = parseFloat(dateBottom);
    if (dateLeft !== undefined) dataToUpdate.dateLeft = parseFloat(dateLeft);

    if (file) {
      dataToUpdate.fileName = file.filename;
      try {
        const oldFilePath = path.join(uploadDir, existing.fileName);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      } catch (err) {
        console.error('Failed to clear old tempalte file:', err);
      }
    }

    const template = await prisma.certificateTemplate.update({
      where: { id },
      data: dataToUpdate
    });

    return res.json(template);
  } catch (error) {
    console.error('Error updating certificate template:', error);
    return res.status(500).json({ error: 'Erro ao atualizar template de certificado.' });
  }
});

// DELETE /api/certificate-templates/:id
router.delete('/:id', authMiddleware, requireRole('ADMIN'), checkPermission('canDelete'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const template = await prisma.certificateTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: { exams: true }
        }
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado.' });
    }

    if (template._count.exams > 0) {
      return res.status(400).json({ error: 'Não é possível deletar, pois existem provas vinculadas a este template.' });
    }

    // Deletar do banco
    await prisma.certificateTemplate.delete({ where: { id } });

    // Deletar o arquivo físico
    const filePath = path.join(uploadDir, template.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.json({ message: 'Template deletado com sucesso.' });
  } catch (error) {
    console.error('Error deleting certificate template:', error);
    return res.status(500).json({ error: 'Erro ao deletar template.' });
  }
});

export default router;
