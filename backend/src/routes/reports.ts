import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// ============================================================
// REPORTS: Exam Performance Overview
// GET /api/reports/exams
// ============================================================
router.get('/exams', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const exams = await prisma.exam.findMany({
      include: {
        _count: { select: { questions: true, attempts: true, certificates: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const report = await Promise.all(exams.map(async (exam: any) => {
      const attempts = await prisma.examAttempt.findMany({
        where: { examId: exam.id, executionStatus: 'FINISHED' },
      });

      const passed = attempts.filter((a: any) => a.resultStatus === 'PASSED').length;
      const failed = attempts.filter((a: any) => a.resultStatus === 'FAILED').length;
      const abandoned = await prisma.examAttempt.count({
        where: { examId: exam.id, executionStatus: 'ABANDONED' }
      });
      const avgScore = attempts.length > 0
        ? Math.round(attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attempts.length)
        : 0;

      return {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        questionCount: exam._count.questions,
        totalAttempts: attempts.length,
        passed,
        failed,
        abandoned,
        certificates: exam._count.certificates,
        avgScore,
        passRate: attempts.length > 0 ? Math.round((passed / attempts.length) * 100) : 0,
        createdAt: exam.createdAt,
      };
    }));

    return res.json(report);
  } catch (error) {
    console.error('Exam report error:', error);
    return res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// ============================================================
// REPORTS: Students Overview
// GET /api/reports/students
// ============================================================
router.get('/students', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        classes: { include: { class: { select: { name: true } } } },
        _count: { select: { attempts: true, certificates: true } } as any,
      },
      orderBy: { createdAt: 'desc' },
    });

    const report = await Promise.all(students.map(async (s: any) => {
      const attempts = await prisma.examAttempt.findMany({
        where: { studentId: s.id, executionStatus: 'FINISHED' },
      });
      const passed = attempts.filter((a: any) => a.resultStatus === 'PASSED').length;
      const avgScore = attempts.length > 0
        ? Math.round(attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attempts.length)
        : 0;

      return {
        id: s.id,
        name: s.user.name,
        email: s.user.email,
        classes: s.classes.map((c: any) => c.class.name).join(', ') || 'Nenhuma',
        totalAttempts: attempts.length,
        passed,
        failed: attempts.filter((a: any) => a.resultStatus === 'FAILED').length,
        avgScore,
        certificates: s._count.certificates,
        createdAt: s.createdAt,
      };
    }));

    return res.json(report);
  } catch (error) {
    console.error('Student report error:', error);
    return res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// ============================================================
// REPORTS: General stats
// GET /api/reports/stats
// ============================================================
router.get('/stats', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const [totalStudents, totalExams, totalAttempts, totalCertificates, totalClasses] = await Promise.all([
      prisma.student.count(),
      prisma.exam.count(),
      prisma.examAttempt.count({ where: { executionStatus: 'FINISHED' } }),
      prisma.certificate.count(),
      prisma.class.count(),
    ]);

    const passedAttempts = await prisma.examAttempt.count({ where: { resultStatus: 'PASSED' } });
    const failedAttempts = await prisma.examAttempt.count({ where: { resultStatus: 'FAILED' } });
    const globalPassRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;

    // Average score
    const allAttempts = await prisma.examAttempt.findMany({
      where: { executionStatus: 'FINISHED' },
      select: { score: true },
    });
    const avgScore = allAttempts.length > 0
      ? Math.round(allAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / allAttempts.length)
      : 0;

    // NPS stats
    const npsResponses = await prisma.npsResponse.count();
    const npsSurveys = await prisma.npsSurvey.count();

    return res.json({
      totalStudents, totalExams, totalAttempts, totalCertificates, totalClasses,
      passedAttempts, failedAttempts, globalPassRate, avgScore,
      npsResponses, npsSurveys,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Erro ao gerar estatísticas' });
  }
});

// ============================================================
// EXPORT CSV: Exams Report
// GET /api/reports/exams/export
// ============================================================
router.get('/exams/export', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const exams = await prisma.exam.findMany({
      include: {
        _count: { select: { questions: true, attempts: true, certificates: true } },
      },
    });

    const rows = await Promise.all(exams.map(async (exam: any) => {
      const attempts = await prisma.examAttempt.findMany({
        where: { examId: exam.id, executionStatus: 'FINISHED' },
      });
      const passed = attempts.filter((a: any) => a.resultStatus === 'PASSED').length;
      const avgScore = attempts.length > 0
        ? Math.round(attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attempts.length)
        : 0;

      return [
        exam.title,
        exam.status,
        exam._count.questions,
        attempts.length,
        passed,
        attempts.filter((a: any) => a.resultStatus === 'FAILED').length,
        avgScore + '%',
        exam._count.certificates,
        exam.createdAt.toISOString().split('T')[0],
      ].join(';');
    }));

    const headers = 'Prova;Status;Questões;Tentativas;Aprovados;Reprovados;Média;Certificados;Criação';
    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-provas.csv"');
    return res.send('\uFEFF' + csv);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao exportar' });
  }
});

// ============================================================
// EXPORT CSV: Students Report
// GET /api/reports/students/export
// ============================================================
router.get('/students/export', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        classes: { include: { class: { select: { name: true } } } },
        _count: { select: { attempts: true, certificates: true } } as any,
      },
    });

    const rows = await Promise.all(students.map(async (s: any) => {
      const attempts = await prisma.examAttempt.findMany({
        where: { studentId: s.id, executionStatus: 'FINISHED' },
      });
      const passed = attempts.filter((a: any) => a.resultStatus === 'PASSED').length;
      const avgScore = attempts.length > 0
        ? Math.round(attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attempts.length)
        : 0;

      return [
        s.user.name,
        s.user.email,
        s.classes.map((c: any) => c.class.name).join(', ') || 'Nenhuma',
        attempts.length,
        passed,
        attempts.filter((a: any) => a.resultStatus === 'FAILED').length,
        avgScore + '%',
        (s as any)._count.certificates,
        s.createdAt.toISOString().split('T')[0],
      ].join(';');
    }));

    const headers = 'Nome;Email;Turmas;Tentativas;Aprovados;Reprovados;Média;Certificados;Cadastro';
    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-alunos.csv"');
    return res.send('\uFEFF' + csv);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao exportar' });
  }
});

export default router;
