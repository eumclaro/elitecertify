import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentProfile() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [npsHistory, setNpsHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/exam-engine/certificates').catch(() => ({ data: [] })),
      api.get('/nps/history').catch(() => ({ data: [] }))
    ])
    .then(([certRes, npsRes]) => {
      setCertificates(certRes.data);
      setNpsHistory(npsRes.data);
    })
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Meu Perfil</h2>
          <p>Informações da conta, certificados e avaliações</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="profile-card">
        <div className="profile-avatar">{user?.name?.charAt(0) || 'U'}</div>
        <div className="profile-info">
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>
          <span className="badge badge-secondary">Aluno</span>
        </div>
      </div>

      {/* Certificates */}
      <div style={{marginTop: 32}}>
        <h3 style={{marginBottom: 16}}>🏆 Meus Certificados</h3>
        {certificates.length === 0 ? (
          <div className="empty-card">Nenhum certificado emitido ainda. Realize suas provas e seja aprovado!</div>
        ) : (
          <div className="certificates-grid">
            {certificates.map(cert => (
              <div key={cert.id} className="certificate-card">
                <div className="cert-icon">🏅</div>
                <div className="cert-info">
                  <h4>{cert.exam?.title || 'Prova'}</h4>
                  <p className="cert-code">Código: <strong>{cert.code}</strong></p>
                  <p className="cert-date">Emitido em: {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NPS History */}
      <div style={{marginTop: 32}}>
        <h3 style={{marginBottom: 16}}>⭐ Minhas Avaliações (NPS)</h3>
        {npsHistory.length === 0 ? (
          <div className="empty-card">Você ainda não respondeu a nenhuma pesquisa de satisfação.</div>
        ) : (
          <div className="nps-history-list" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            {npsHistory.map((resp: any) => (
              <div key={resp.id} className="dashboard-card" style={{padding: '16px'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px'}}>
                  <h4 style={{margin: 0, color: 'var(--text-primary)'}}>{resp.survey.title}</h4>
                  <small style={{color: 'var(--text-muted)'}}>{new Date(resp.createdAt).toLocaleDateString()}</small>
                </div>
                <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                  {resp.details.map((d: any) => (
                    <li key={d.id} style={{marginBottom: '8px'}}>
                      <div style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px'}}>{d.question.text}</div>
                      <div style={{fontWeight: 600, color: d.score && d.score >= 9 ? 'var(--success)' : d.score && d.score <= 6 ? 'var(--danger)' : 'var(--warning)'}}>
                        {d.question.type === 'SCORE' ? `Nota: ${d.score}` : `${d.text || '-'}`}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
