import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/stats — Admin dashboard statistics
router.get('/stats', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const [
      totalStudents,
      activeStudents,
      totalClasses,
      totalExams,
      publishedExams,
      totalAttempts,
      passedAttempts,
      failedAttempts,
      totalCertificates,
      totalNpsSurveys,
      recentAttempts,
      recentStudents,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.class.count(),
      prisma.exam.count(),
      prisma.exam.count({ where: { status: 'PUBLISHED' } }),
      prisma.examAttempt.count(),
      prisma.examAttempt.count({ where: { resultStatus: 'PASSED' } }),
      prisma.examAttempt.count({ where: { resultStatus: 'FAILED' } }),
      prisma.certificate.count(),
      prisma.npsSurvey.count(),
      prisma.examAttempt.findMany({
        take: 10,
        orderBy: { startedAt: 'desc' },
        include: {
          student: { include: { user: { select: { name: true } } } },
          exam: { select: { title: true } },
        },
      }),
      prisma.student.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    const approvalRate = totalAttempts > 0
      ? Math.round((passedAttempts / totalAttempts) * 100)
      : 0;

    return res.json({
      overview: {
        totalStudents,
        activeStudents,
        totalClasses,
        totalExams,
        publishedExams,
        totalAttempts,
        passedAttempts,
        failedAttempts,
        approvalRate,
        totalCertificates,
        totalNpsSurveys,
      },
      recentAttempts: recentAttempts.map(a => ({
        id: a.id,
        studentName: a.student.user.name,
        examTitle: a.exam.title,
        status: a.resultStatus,
        score: a.score,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
      })),
      recentStudents: recentStudents.map(s => ({
        id: s.id,
        name: s.user.name,
        email: s.user.email,
        enrollmentDate: s.enrollmentDate,
      })),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

export default router;
