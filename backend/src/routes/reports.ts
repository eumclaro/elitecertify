import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import { startOfDay, endOfDay, subDays, format, startOfWeek } from 'date-fns';

const router = Router();

// Helper to get date range
const getDateRange = (req: Request) => {
  const { from, to, period } = req.query;

  let startDate = subDays(new Date(), 30);
  let endDate = new Date();

  if (period === '7d') startDate = subDays(new Date(), 7);
  else if (period === '30d') startDate = subDays(new Date(), 30);
  else if (period === '90d') startDate = subDays(new Date(), 90);
  else if (from && to) {
    startDate = new Date(from as string);
    endDate = new Date(to as string);
  }

  return {
    start: startOfDay(startDate),
    end: endOfDay(endDate)
  };
};

// ============================================================
// 1. OVERVIEW: General Stats
// GET /api/reports/stats
// ============================================================
router.get('/stats', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req);

    const [totalStudents, totalExams, totalAttempts, totalCertificates, totalClasses] = await Promise.all([
      prisma.student.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.exam.count({ where: { status: 'PUBLISHED' } }),
      prisma.examAttempt.count({ 
        where: { 
          executionStatus: 'FINISHED',
          finishedAt: { gte: start, lte: end }
        } 
      }),
      prisma.certificate.count({ where: { issuedAt: { gte: start, lte: end } } }),
      prisma.class.count({ where: { status: 'ACTIVE' } }),
    ]);

    const passedAttempts = await prisma.examAttempt.count({ 
      where: { 
        resultStatus: 'PASSED',
        finishedAt: { gte: start, lte: end }
      } 
    });

    const globalPassRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;

    // NPS Logic
    const npsDetails = await prisma.npsResponseDetail.findMany({
      where: {
        score: { not: null },
        response: { createdAt: { gte: start, lte: end } }
      },
      select: { score: true }
    });

    let npsScore = 0;
    if (npsDetails.length > 0) {
      const promoters = npsDetails.filter(d => (d.score || 0) >= 9).length;
      const detractors = npsDetails.filter(d => (d.score || 0) <= 6).length;
      npsScore = Math.round(((promoters - detractors) / npsDetails.length) * 100);
    }

    return res.json({
      totalStudents,
      totalExams,
      totalAttempts,
      totalCertificates,
      totalClasses,
      globalPassRate,
      npsScore,
      period: { start, end }
    });
  } catch (error) {
    console.error('Stats report error:', error);
    return res.status(500).json({ error: 'Erro ao gerar estatísticas macro' });
  }
});

// ============================================================
// 2. OVERVIEW: Performance Chart
// GET /api/reports/charts/performance
// ============================================================
router.get('/charts/performance', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req);

    const attempts = await prisma.examAttempt.findMany({
      where: {
        executionStatus: 'FINISHED',
        finishedAt: { gte: start, lte: end }
      },
      select: {
        finishedAt: true,
        resultStatus: true
      },
      orderBy: { finishedAt: 'asc' }
    });

    // Group by day
    const chartData: Record<string, { date: string, passed: number, failed: number }> = {};
    
    // Fill gaps
    let current = new Date(start);
    while (current <= end) {
      const day = format(current, 'yyyy-MM-dd');
      chartData[day] = { date: day, passed: 0, failed: 0 };
      current.setDate(current.getDate() + 1);
    }

    attempts.forEach(a => {
      if (!a.finishedAt) return;
      const day = format(a.finishedAt, 'yyyy-MM-dd');
      if (chartData[day]) {
        if (a.resultStatus === 'PASSED') chartData[day].passed++;
        else chartData[day].failed++;
      }
    });

    return res.json(Object.values(chartData));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao gerar dados do gráfico' });
  }
});

// ============================================================
// 3. BY CLASS: Specific Class Report
// GET /api/reports/class/:id
// ============================================================
router.get('/class/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { start, end } = getDateRange(req);

    const classData: any = await prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            student: {
              include: {
                user: { select: { name: true, email: true } },
                examAttempts: {
                  where: { finishedAt: { gte: start, lte: end } },
                  orderBy: { finishedAt: 'desc' }
                }
              }
            }
          }
        }
      }
    });

    if (!classData) return res.status(404).json({ error: 'Turma não encontrada' });

    const totalStudents = classData.students.length;
    const studentsWhoTookExams = classData.students.filter((cs: any) => cs.student.examAttempts.length > 0).length;
    
    const allAttempts = classData.students.flatMap((cs: any) => cs.student.examAttempts.filter((a: any) => a.executionStatus === 'FINISHED'));
    const passed = allAttempts.filter((a: any) => a.resultStatus === 'PASSED').length;
    const passRate = allAttempts.length > 0 ? Math.round((passed / allAttempts.length) * 100) : 0;
    const avgGrade = allAttempts.length > 0 
      ? Math.round(allAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / allAttempts.length)
      : 0;

    // NPS for this class
    const npsDetails = await prisma.npsResponseDetail.findMany({
      where: {
        score: { not: null },
        response: { 
          survey: { classId: id as string },
          createdAt: { gte: start, lte: end }
        }
      },
      select: { score: true }
    });

    let npsScore = 0;
    if (npsDetails.length > 0) {
      const promoters = npsDetails.filter(d => (d.score || 0) >= 9).length;
      const detractors = npsDetails.filter(d => (d.score || 0) <= 6).length;
      npsScore = Math.round(((promoters - detractors) / npsDetails.length) * 100);
    }

    const studentList = classData.students.map((cs: any) => {
      const s = cs.student;
      const latestAttempt = s.examAttempts[0];
      return {
        id: s.id,
        name: s.user.name,
        email: s.user.email,
        attempts: s.examAttempts.length,
        lastScore: latestAttempt?.score || null,
        status: latestAttempt?.resultStatus || 'PENDING'
      };
    });

    return res.json({
      className: classData.name,
      stats: {
        totalStudents,
        activeStudents: studentsWhoTookExams,
        passRate,
        avgGrade,
        npsScore
      },
      students: studentList
    });
  } catch (error) {
    console.error('Class report error:', error);
    return res.status(500).json({ error: 'Erro ao carregar relatório da turma' });
  }
});

// ============================================================
// 4. BY EXAM: Specific Exam Report
// GET /api/reports/exam/:id
// ============================================================
router.get('/exam/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { start, end } = getDateRange(req);

    const exam: any = await prisma.exam.findUnique({
      where: { id },
      include: {
        attempts: {
          where: { 
            executionStatus: 'FINISHED',
            finishedAt: { gte: start, lte: end }
          },
          include: { student: { include: { user: { select: { name: true } } } } }
        }
      }
    });

    if (!exam) return res.status(404).json({ error: 'Prova não encontrada' });

    const totalAttempts = exam.attempts.length;
    const passed = exam.attempts.filter((a: any) => a.resultStatus === 'PASSED').length;
    const failed = totalAttempts - passed;
    const avgGrade = totalAttempts > 0 
      ? Math.round(exam.attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / totalAttempts)
      : 0;

    // Histogram (0-10, 11-20, ..., 91-100)
    const histogram = Array(10).fill(0);
    exam.attempts.forEach((a: any) => {
      const bucket = Math.min(Math.floor((a.score || 0) / 10), 9);
      histogram[bucket]++;
    });

    // Most missed question
    const missedQuestions: any[] = await (prisma.answer as any).groupBy({
      by: ['questionId'],
      where: {
        attempt: { examId: id as string, finishedAt: { gte: start, lte: end } },
        isCorrect: false
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1
    });

    let mostMissed = null;
    if (missedQuestions.length > 0) {
      const q = await prisma.question.findUnique({ where: { id: missedQuestions[0].questionId } });
      mostMissed = { text: q?.text, count: missedQuestions[0]._count.id };
    }

    return res.json({
      examTitle: exam.title,
      stats: { totalAttempts, passed, failed, avgGrade, mostMissed },
      histogram: histogram.map((count, i) => ({ range: `${i*10}-${(i+1)*10}`, count })),
      students: exam.attempts.map((a: any) => ({
        name: a.student.user.name,
        score: a.score,
        status: a.resultStatus,
        date: a.finishedAt
      }))
    });
  } catch (error) {
    console.error('Exam report error:', error);
    return res.status(500).json({ error: 'Erro ao carregar relatório da prova' });
  }
});

// ============================================================
// 5. NPS: Consolidated NPS Report
// GET /api/reports/nps
// ============================================================
router.get('/nps', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req);
    const periodInDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);

    const responses: any[] = await prisma.npsResponseDetail.findMany({
      where: {
        score: { not: null },
        response: { createdAt: { gte: start, lte: end } }
      },
      include: {
        response: { include: { survey: { include: { class: { select: { name: true, id: true } } } } } }
      }
    });

    if (responses.length === 0) {
      return res.json({ 
        score: 0, 
        distribution: { promoters: 0, neutrals: 0, detractors: 0 },
        evolution: [],
        byClass: [],
        feedbacks: []
      });
    }

    const promoters = responses.filter(r => (r.score || 0) >= 9).length;
    const neutrals = responses.filter(r => (r.score || 0) >= 7 && (r.score || 0) <= 8).length;
    const detractors = responses.filter(r => (r.score || 0) <= 6).length;
    const score = Math.round(((promoters - detractors) / responses.length) * 100);

    // Distribution
    const distribution = { promoters, neutrals, detractors };

    // Evolution
    const evolution: any[] = [];
    if (periodInDays > 30) {
      // Group by month
      const groups: Record<string, { promoters: number, total: number, detractors: number }> = {};
      responses.forEach((r: any) => {
        const month = format(r.response.createdAt, 'yyyy-MM');
        if (!groups[month]) groups[month] = { promoters: 0, total: 0, detractors: 0 };
        groups[month].total++;
        if ((r.score || 0) >= 9) groups[month].promoters++;
        if ((r.score || 0) <= 6) groups[month].detractors++;
      });
      Object.entries(groups).forEach(([month, data]) => {
        evolution.push({ label: month, score: Math.round(((data.promoters - data.detractors) / data.total) * 100) });
      });
    } else {
      // Group by week
      const groups: Record<string, { promoters: number, total: number, detractors: number }> = {};
      responses.forEach((r: any) => {
        const week = format(startOfWeek(r.response.createdAt), 'dd/MM');
        if (!groups[week]) groups[week] = { promoters: 0, total: 0, detractors: 0 };
        groups[week].total++;
        if ((r.score || 0) >= 9) groups[week].promoters++;
        if ((r.score || 0) <= 6) groups[week].detractors++;
      });
      Object.entries(groups).forEach(([week, data]) => {
        evolution.push({ label: `Semana ${week}`, score: Math.round(((data.promoters - data.detractors) / data.total) * 100) });
      });
    }

    // Feedbacks (only text questions)
    const feedbacks: any[] = await prisma.npsResponseDetail.findMany({
      where: {
        AND: [
          { text: { not: null } },
          { text: { not: "" } }
        ],
        response: { createdAt: { gte: start, lte: end } }
      },
      include: { response: { include: { student: { include: { user: { select: { name: true } } } } } } },
      orderBy: { response: { createdAt: 'desc' } },
      take: 20
    });

    return res.json({
      score,
      distribution,
      evolution,
      feedbacks: feedbacks.map((f: any) => ({
        student: f.response.student.user.name,
        text: f.text,
        date: f.response.createdAt
      }))
    });
  } catch (error) {
    console.error('NPS report error:', error);
    return res.status(500).json({ error: 'Erro ao carregar relatório NPS' });
  }
});

// ============================================================
// 6. EXPORT: Excel
// GET /api/reports/export/excel
// ============================================================
router.get('/export/excel', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string;
    const id = req.query.id as string;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Relatório');

    if (type === 'class' && id) {
      const classData: any = await prisma.class.findUnique({
        where: { id: id as string },
        include: { students: { include: { student: { include: { user: { select: { name: true, email: true } }, examAttempts: true } } } } }
      });
      if (!classData) return res.status(404).json({ error: 'Turma não encontrada' });
      
      sheet.columns = [
        { header: 'Aluno', key: 'name', width: 30 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Tentativas', key: 'attempts', width: 15 },
        { header: 'Última Nota', key: 'score', width: 15 },
        { header: 'Status', key: 'status', width: 15 }
      ];

      classData.students.forEach((cs: any) => {
        const s = cs.student;
        sheet.addRow({
          name: s.user.name,
          email: s.user.email,
          attempts: s.examAttempts.length,
          score: s.examAttempts[0]?.score || '-',
          status: s.examAttempts[0]?.resultStatus || 'PENDING'
        });
      });
    } else if (type === 'exam' && id) {
      const exam: any = await prisma.exam.findUnique({
        where: { id: id as string },
        include: { attempts: { include: { student: { include: { user: { select: { name: true, email: true } } } } } } }
      });
      if (!exam) return res.status(404).json({ error: 'Prova não encontrada' });

      sheet.columns = [
        { header: 'Aluno', key: 'name', width: 30 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Nota', key: 'score', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Finalizado em', key: 'date', width: 20 }
      ];

      exam.attempts.forEach((a: any) => {
        sheet.addRow({
          name: a.student.user.name,
          email: a.student.user.email,
          score: a.score,
          status: a.resultStatus,
          date: a.finishedAt?.toLocaleDateString('pt-BR')
        });
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${type}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    return res.status(500).json({ error: 'Erro ao gerar Excel' });
  }
});

// ============================================================
// 7. EXPORT: PDF (Puppeteer)
// GET /api/reports/export/pdf
// ============================================================
router.get('/export/pdf', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  let browser;
  try {
    const type = req.query.type as string;
    const id = req.query.id as string;
    let title = 'Relatório Geral';
    let rows: any[] = [];
    let headers: string[] = [];

    if (type === 'class' && id) {
      const classData: any = await prisma.class.findUnique({
        where: { id: id as string },
        include: { students: { include: { student: { include: { user: { select: { name: true, email: true } }, examAttempts: true } } } } }
      });
      if (!classData) return res.status(404).json({ error: 'Turma não encontrada' });
      title = `Relatório da Turma: ${classData.name}`;
      headers = ['Aluno', 'Email', 'Tentativas', 'Nota', 'Status'];
      rows = classData.students.map((cs: any) => [
        cs.student.user.name,
        cs.student.user.email,
        cs.student.examAttempts.length,
        cs.student.examAttempts[0]?.score || '-',
        cs.student.examAttempts[0]?.resultStatus || 'PENDING'
      ]);
    } else if (type === 'exam' && id) {
      const exam: any = await prisma.exam.findUnique({
        where: { id: id as string },
        include: { attempts: { include: { student: { include: { user: { select: { name: true, email: true } } } } } } }
      });
      if (!exam) return res.status(404).json({ error: 'Prova não encontrada' });
      title = `Relatório da Prova: ${exam.title}`;
      headers = ['Aluno', 'Email', 'Nota', 'Status', 'Data'];
      rows = exam.attempts.map((a: any) => [
        a.student.user.name,
        a.student.user.email,
        a.score,
        a.resultStatus,
        a.finishedAt?.toLocaleDateString('pt-BR')
      ]);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: sans-serif; color: #333; margin: 40px; }
          .header { display: flex; justify-content: justify; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #000; }
          .info { text-align: right; font-size: 12px; color: #666; }
          h1 { font-size: 20px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f9fafb; text-align: left; padding: 12px 8px; border-bottom: 2px solid #eee; font-size: 13px; }
          td { padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
          .status { font-weight: bold; }
          .PASSED { color: #10b981; }
          .FAILED { color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Elite Certify</div>
          <div class="info">
            Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
          </div>
        </div>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map((cell: any) => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio.pdf"`);
    return res.end(pdf);
  } catch (error) {
    console.error('PDF error:', error);
    return res.status(500).json({ error: 'Erro ao gerar PDF' });
  } finally {
    if (browser) await browser.close();
  }
});

export default router;
