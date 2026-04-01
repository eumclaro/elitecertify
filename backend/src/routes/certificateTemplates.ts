import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.resolve(__dirname, '../assets/certificates');
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
router.post('/', authMiddleware, requireRole('ADMIN'), upload.single('file'), async (req: Request, res: Response) => {
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

// DELETE /api/certificate-templates/:id
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
