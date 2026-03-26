import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router({ mergeParams: true });

// GET /api/exams/:examId/questions — List questions for an exam
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;

    const questions = await prisma.question.findMany({
      where: { examId },
      include: {
        alternatives: { orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });

    // If student, hide correct answers
    if (req.user?.role === 'STUDENT') {
      questions.forEach(q => {
        q.alternatives.forEach(a => {
          (a as any).isCorrect = undefined;
        });
      });
    }

    return res.json(questions);
  } catch (error) {
    console.error('List questions error:', error);
    return res.status(500).json({ error: 'Erro ao listar questões' });
  }
});

// GET /api/exams/:examId/questions/:id — Get single question
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: {
        alternatives: { orderBy: { order: 'asc' } },
      },
    });

    if (!question || question.examId !== req.params.examId) {
      return res.status(404).json({ error: 'Questão não encontrada' });
    }

    return res.json(question);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar questão' });
  }
});

// POST /api/exams/:examId/questions/import — Import questions via CSV
router.post('/import', authMiddleware, requireRole('ADMIN'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const results: any[] = [];
    const errors: string[] = [];
    
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ error: 'Prova não encontrada' });

    let bufferString = req.file.buffer.toString('utf-8');
    // Remove BOM (Byte Order Mark) if it exists
    bufferString = bufferString.replace(/^\uFEFF/, '');
    
    // Auto-detect separator (Google Sheets vs Excel)
    const firstLine = bufferString.split(/\r?\n/)[0];
    const separator = firstLine.includes(';') ? ';' : ',';

    const stream = Readable.from(bufferString);
    
    stream
      .pipe(csv({ 
        separator,
        mapHeaders: ({ header, index }) => header.trim()
      })) 
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const questionsToCreate: any[] = [];
        let rowCount = 1; 

        for (const row of results) {
          rowCount++;
          const text = row['texto_questao'];
          const type = row['tipo']?.trim().toUpperCase() || 'SINGLE_CHOICE';
          
          if (!text) {
            errors.push(`Linha ${rowCount}: Texto da questão é obrigatório.`);
            continue;
          }

          if (!['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'ESSAY'].includes(type)) {
            errors.push(`Linha ${rowCount}: Tipo inválido (${type}). Use SINGLE_CHOICE, MULTIPLE_CHOICE ou ESSAY.`);
            continue;
          }

          const alternativesData: any[] = [];
          
          if (type !== 'ESSAY') {
            const letters = ['A', 'B', 'C', 'D', 'E'];
            let hasCorrect = false;

            for (let i = 0; i < letters.length; i++) {
              const letter = letters[i];
              const altText = row[`alternativa_${letter}`];
              const altCorrectRaw = row[`correta_${letter}`];
              
              if (altText) {
                const isCorrect = altCorrectRaw?.trim().toUpperCase() === 'S';
                if (isCorrect) hasCorrect = true;

                alternativesData.push({
                  text: altText,
                  isCorrect,
                  order: i + 1
                });
              }
            }

            if (alternativesData.length < 2) {
              errors.push(`Linha ${rowCount}: Mínimo de 2 alternativas necessárias para questões objetivas.`);
              continue;
            }

            if (!hasCorrect) {
              errors.push(`Linha ${rowCount}: Nenhuma alternativa foi marcada como correta (S).`);
              continue;
            }
          }

          questionsToCreate.push({ text, type, alternatives: alternativesData });
        }

        if (errors.length > 0) {
          return res.status(400).json({ 
            error: 'O arquivo contém erros de validação nas linhas listadas.', 
            details: errors 
          });
        }

        if (questionsToCreate.length === 0) {
          return res.status(400).json({ error: 'Nenhuma questão válida encontrada no arquivo.' });
        }

        const lastQuestion = await prisma.question.findFirst({
          where: { examId },
          orderBy: { order: 'desc' },
        });
        let currentOrder = (lastQuestion?.order || 0);

        try {
          const createPromises = questionsToCreate.map((q) => {
            currentOrder++;
            return prisma.question.create({
              data: {
                examId,
                text: q.text,
                type: q.type,
                order: currentOrder,
                alternatives: q.type === 'ESSAY' ? undefined : {
                  create: q.alternatives
                }
              }
            });
          });

          await prisma.$transaction(createPromises);
          return res.status(200).json({ message: `${questionsToCreate.length} questões importadas com sucesso.` });
        } catch (dbError) {
          console.error(dbError);
          return res.status(500).json({ error: 'Erro ao salvar as questões no banco de dados.' });
        }
      })
      .on('error', (err) => {
        console.error('CSV parse error:', err);
        return res.status(500).json({ error: 'Erro ao processar o arquivo CSV.' });
      });

  } catch (error: any) {
    console.error('Import error:', error);
    return res.status(500).json({ error: 'Erro interno ao importar questões' });
  }
});

// POST /api/exams/:examId/questions — Create question with alternatives
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const { text, type, order, alternatives } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Texto da questão é obrigatório' });
    }

    if (type !== 'ESSAY') {
      if (!alternatives || alternatives.length < 2) {
        return res.status(400).json({ error: 'Mínimo de 2 alternativas' });
      }

      const hasCorrect = alternatives.some((a: any) => a.isCorrect);
      if (!hasCorrect) {
        return res.status(400).json({ error: 'Pelo menos uma alternativa deve ser correta' });
      }
    }

    // Auto-calculate order if not provided
    let questionOrder = order;
    if (questionOrder === undefined) {
      const lastQuestion = await prisma.question.findFirst({
        where: { examId },
        orderBy: { order: 'desc' },
      });
      questionOrder = (lastQuestion?.order || 0) + 1;
    }

    const question = await prisma.question.create({
      data: {
        examId,
        text,
        type: type || 'SINGLE_CHOICE',
        order: questionOrder,
        alternatives: type === 'ESSAY' ? undefined : {
          create: alternatives.map((alt: any, index: number) => ({
            text: alt.text,
            isCorrect: alt.isCorrect || false,
            order: alt.order ?? index + 1,
          })),
        },
      },
      include: {
        alternatives: { orderBy: { order: 'asc' } },
      },
    });

    return res.status(201).json(question);
  } catch (error: any) {
    console.error('Create question error:', error);
    return res.status(500).json({ error: 'Erro ao criar questão' });
  }
});

// PUT /api/exams/:examId/questions/:id — Update question
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { text, type, order, alternatives } = req.body;

    const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.examId !== req.params.examId) {
      return res.status(404).json({ error: 'Questão não encontrada' });
    }

    // Update question
    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        ...(text !== undefined && { text }),
        ...(type !== undefined && { type }),
        ...(order !== undefined && { order }),
      },
    });

    // If alternatives provided, replace all
    if (type === 'ESSAY') {
      await prisma.alternative.deleteMany({ where: { questionId: req.params.id } });
    } else if (alternatives && alternatives.length > 0) {
      await prisma.alternative.deleteMany({ where: { questionId: req.params.id } });
      await prisma.alternative.createMany({
        data: alternatives.map((alt: any, index: number) => ({
          questionId: req.params.id,
          text: alt.text,
          isCorrect: alt.isCorrect || false,
          order: alt.order ?? index + 1,
        })),
      });
    }

    const updated = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { alternatives: { orderBy: { order: 'asc' } } },
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('Update question error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar questão' });
  }
});

// DELETE /api/exams/:examId/questions/:id — Delete question
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.examId !== req.params.examId) {
      return res.status(404).json({ error: 'Questão não encontrada' });
    }

    await prisma.question.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Questão excluída com sucesso' });
  } catch (error) {
    console.error('Delete question error:', error);
    return res.status(500).json({ error: 'Erro ao excluir questão' });
  }
});

// POST /api/exams/:examId/questions/reorder — Reorder questions
router.post('/reorder', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { orders } = req.body; // [{ id: 'xxx', order: 1 }, ...]

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Array de ordens é obrigatório' });
    }

    await Promise.all(
      orders.map((item: { id: string; order: number }) =>
        prisma.question.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );

    return res.json({ message: 'Ordem atualizada com sucesso' });
  } catch (error) {
    console.error('Reorder error:', error);
    return res.status(500).json({ error: 'Erro ao reordenar questões' });
  }
});

export default router;
