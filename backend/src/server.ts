import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import examRoutes from './routes/exams';
import questionRoutes from './routes/questions';
import classRoutes from './routes/classes';
import dashboardRoutes from './routes/dashboard';
import examEngineRoutes from './routes/examEngine';
import npsRoutes from './routes/nps';
import reportRoutes from './routes/reports';
import auditRoutes from './routes/audit';
import settingsRoutes from './routes/settings';
import webhooksRoutes from './routes/webhooks';
import emailTemplatesRoutes from './routes/emailTemplates';
import dispatchRoutes from './routes/dispatches';
import internalTemplatesRoutes from './routes/internalTemplates';
import eventsRoutes from './routes/events';
import certificateRoutes from './routes/certificates';
import certificateTemplatesRoutes from './routes/certificateTemplates';

const app = express();

// CORS - allow frontend origins
app.use(cors({
  origin: [
    env.FRONTEND_URL,
    env.PRODUCTION_URL,
    'http://localhost:5179',
    'https://certify.elitetraining.com.br',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/exams/:examId/questions', questionRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/exam-engine', examEngineRoutes);
app.use('/api/nps', npsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/email-templates', emailTemplatesRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/internal-templates', internalTemplatesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/certificate-templates', certificateTemplatesRoutes);

// Static assets
const systemAssetsPath = path.join(__dirname, 'assets/system');
if (!fs.existsSync(systemAssetsPath)) {
  fs.mkdirSync(systemAssetsPath, { recursive: true });
}
app.use('/assets/system', express.static(systemAssetsPath));
app.use('/uploads/certificates', express.static(path.join(__dirname, 'assets/certificates')));

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(env.PORT, () => {
  console.log(`🚀 Elite Certify API running on port ${env.PORT}`);
  console.log(`📚 Environment: ${env.NODE_ENV}`);
  console.log(`🌐 Frontend URL: ${env.FRONTEND_URL}`);
  console.log(`🔗 Production URL: ${env.PRODUCTION_URL}`);
});

export default app;
