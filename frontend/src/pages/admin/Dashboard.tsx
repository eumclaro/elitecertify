import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Stats {
  overview: {
    totalStudents: number;
    activeStudents: number;
    totalClasses: number;
    totalExams: number;
    publishedExams: number;
    totalAttempts: number;
    passedAttempts: number;
    failedAttempts: number;
    approvalRate: number;
    totalCertificates: number;
    totalNpsSurveys: number;
  };
  recentAttempts: Array<{
    id: string;
    studentName: string;
    examTitle: string;
    status: string;
    score: number | null;
    startedAt: string;
  }>;
  recentStudents: Array<{
    id: string;
    name: string;
    email: string;
    enrollmentDate: string;
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error('Dashboard error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div></div>;
  }

  if (!stats) {
    return <div className="page-error">Erro ao carregar dashboard</div>;
  }

  const cards = [
    { label: 'Alunos', value: stats.overview.totalStudents, icon: '👥', color: '#6366f1' },
    { label: 'Turmas', value: stats.overview.totalClasses, icon: '🏫', color: '#8b5cf6' },
    { label: 'Provas', value: stats.overview.totalExams, icon: '📝', color: '#ec4899' },
    { label: 'Tentativas', value: stats.overview.totalAttempts, icon: '🎯', color: '#f59e0b' },
    { label: 'Aprovação', value: `${stats.overview.approvalRate}%`, icon: '✅', color: '#10b981' },
    { label: 'Certificados', value: stats.overview.totalCertificates, icon: '🏆', color: '#06b6d4' },
  ];

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      PASSED: { label: 'Aprovado', cls: 'badge-success' },
      FAILED: { label: 'Reprovado', cls: 'badge-danger' },
      IN_PROGRESS: { label: 'Em andamento', cls: 'badge-warning' },
      ABANDONED: { label: 'Abandonado', cls: 'badge-secondary' },
    };
    const s = map[status] || { label: status, cls: 'badge-secondary' };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Visão geral da plataforma de certificações</p>
      </div>

      <div className="stats-grid">
        {cards.map((card, i) => (
          <div key={i} className="stat-card" style={{ '--card-color': card.color } as any}>
            <div className="stat-icon">{card.icon}</div>
            <div className="stat-info">
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        {/* Recent Attempts */}
        <div className="dashboard-card">
          <h3>Tentativas Recentes</h3>
          {stats.recentAttempts.length === 0 ? (
            <p className="empty-text">Nenhuma tentativa registrada</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Prova</th>
                    <th>Status</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentAttempts.map(a => (
                    <tr key={a.id}>
                      <td>{a.studentName}</td>
                      <td>{a.examTitle}</td>
                      <td>{getStatusBadge(a.status)}</td>
                      <td>{a.score !== null ? `${a.score}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Students */}
        <div className="dashboard-card">
          <h3>Alunos Recentes</h3>
          {stats.recentStudents.length === 0 ? (
            <p className="empty-text">Nenhum aluno cadastrado</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentStudents.map(s => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
