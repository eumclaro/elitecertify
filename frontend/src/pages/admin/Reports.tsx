import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function Reports() {
  const [tab, setTab] = useState<'exams' | 'students'>('exams');
  const [stats, setStats] = useState<any>(null);
  const [examReport, setExamReport] = useState<any[]>([]);
  const [studentReport, setStudentReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/stats'),
      api.get('/reports/exams'),
      api.get('/reports/students'),
    ]).then(([s, e, st]) => {
      setStats(s.data);
      setExamReport(e.data);
      setStudentReport(st.data);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📊 Relatórios</h2>
          <p>Visão consolidada de desempenho</p>
        </div>
        <div style={{display: 'flex', gap: 8}}>
          <a href="/api/reports/exams/export" className="btn btn-outline">📥 CSV Provas</a>
          <a href="/api/reports/students/export" className="btn btn-outline">📥 CSV Alunos</a>
        </div>
      </div>

      {/* Global Stats */}
      {stats && (
        <div className="stats-grid" style={{marginBottom: 24}}>
          <div className="stat-card" style={{'--card-color': '#6366f1'} as any}>
            <div className="stat-icon">👥</div>
            <div><span className="stat-value">{stats.totalStudents}</span><span className="stat-label">ALUNOS</span></div>
          </div>
          <div className="stat-card" style={{'--card-color': '#f59e0b'} as any}>
            <div className="stat-icon">📝</div>
            <div><span className="stat-value">{stats.totalAttempts}</span><span className="stat-label">TENTATIVAS</span></div>
          </div>
          <div className="stat-card" style={{'--card-color': '#10b981'} as any}>
            <div className="stat-icon">✅</div>
            <div><span className="stat-value">{stats.globalPassRate}%</span><span className="stat-label">APROVAÇÃO</span></div>
          </div>
          <div className="stat-card" style={{'--card-color': '#06b6d4'} as any}>
            <div className="stat-icon">🏆</div>
            <div><span className="stat-value">{stats.totalCertificates}</span><span className="stat-label">CERTIFICADOS</span></div>
          </div>
          <div className="stat-card" style={{'--card-color': '#8b5cf6'} as any}>
            <div className="stat-icon">📈</div>
            <div><span className="stat-value">{stats.avgScore}%</span><span className="stat-label">MÉDIA GERAL</span></div>
          </div>
          <div className="stat-card" style={{'--card-color': '#ec4899'} as any}>
            <div className="stat-icon">🏫</div>
            <div><span className="stat-value">{stats.totalClasses}</span><span className="stat-label">TURMAS</span></div>
          </div>
        </div>
      )}

      {/* Tab Switch */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'exams' ? 'active' : ''}`} onClick={() => setTab('exams')}>📝 Provas</button>
        <button className={`tab-btn ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>👥 Alunos</button>
      </div>

      {/* Exams Table */}
      {tab === 'exams' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Prova</th>
                <th>Turma</th>
                <th>Status</th>
                <th>Tentativas</th>
                <th>Aprovados</th>
                <th>Reprovados</th>
                <th>Média</th>
                <th>Taxa Aprovação</th>
                <th>Certificados</th>
              </tr>
            </thead>
            <tbody>
              {examReport.length === 0 ? (
                <tr><td colSpan={9} className="empty-text">Nenhuma prova registrada</td></tr>
              ) : examReport.map(e => (
                <tr key={e.id}>
                  <td><strong>{e.title}</strong></td>
                  <td>{e.className}</td>
                  <td><span className={`badge ${e.status === 'PUBLISHED' ? 'badge-success' : 'badge-warning'}`}>{e.status}</span></td>
                  <td>{e.totalAttempts}</td>
                  <td><span style={{color:'var(--success)'}}>{e.passed}</span></td>
                  <td><span style={{color:'var(--danger)'}}>{e.failed}</span></td>
                  <td><strong>{e.avgScore}%</strong></td>
                  <td>
                    <div className="progress-bar-mini">
                      <div className="progress-fill" style={{width: `${e.passRate}%`, background: e.passRate >= 70 ? 'var(--success)' : e.passRate >= 40 ? 'var(--warning)' : 'var(--danger)'}}></div>
                    </div>
                    <span style={{fontSize: 12}}>{e.passRate}%</span>
                  </td>
                  <td><span className="badge badge-secondary">{e.certificates}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Students Table */}
      {tab === 'students' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Email</th>
                <th>Turmas</th>
                <th>Tentativas</th>
                <th>Aprovados</th>
                <th>Reprovados</th>
                <th>Média</th>
                <th>Certificados</th>
              </tr>
            </thead>
            <tbody>
              {studentReport.length === 0 ? (
                <tr><td colSpan={8} className="empty-text">Nenhum aluno registrado</td></tr>
              ) : studentReport.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.email}</td>
                  <td><span className="badge badge-secondary">{s.classes || 'Nenhuma'}</span></td>
                  <td>{s.totalAttempts}</td>
                  <td><span style={{color:'var(--success)'}}>{s.passed}</span></td>
                  <td><span style={{color:'var(--danger)'}}>{s.failed}</span></td>
                  <td><strong>{s.avgScore}%</strong></td>
                  <td><span className="badge badge-secondary">{s.certificates}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
