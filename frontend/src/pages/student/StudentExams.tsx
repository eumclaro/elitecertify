import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface ExamItem {
  id: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
  passingScore: number;
  attempts: number;
  maxAttempts: number;
  hasCooldown: boolean;
  cooldownEndsAt: string | null;
  hasCertificate: boolean;
  certificateCode: string | null;
  inProgress: boolean;
  lastAttempt: any;
  class: { id: string; name: string } | null;
}

export default function StudentExams() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmStart, setConfirmStart] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/exam-engine/available')
      .then(r => {
        const fetchedExams = r.data;
        const abandonedAttemptId = localStorage.getItem('elt-cert-abandoned-attempt');
        
        if (abandonedAttemptId) {
          let flagCleared = false;
          fetchedExams.forEach((exam: any) => {
            if (exam.lastAttempt?.id === abandonedAttemptId) {
              if (exam.inProgress || exam.frontendStatus === 'IN_PROGRESS' || exam.lastAttempt.executionStatus === 'IN_PROGRESS') {
                // Força o encerramento no Frontend se o Backend estiver atrasado
                exam.inProgress = false;
                exam.frontendStatus = 'EXHAUSTED'; 
                exam.lastAttempt.executionStatus = 'ABANDONED';
                exam.lastAttempt.resultStatus = 'FAILED_ABANDONMENT';
                // Presume cooldown genérico até limpar
                exam.hasCooldown = true;
                exam.cooldownEndsAt = new Date(Date.now() + 86400000).toISOString();
              } else {
                flagCleared = true;
              }
            }
          });
          if (flagCleared) localStorage.removeItem('elt-cert-abandoned-attempt');
        }
        
        setExams(fetchedExams);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const startExam = async () => {
    if (!confirmStart) return;
    setStarting(true);
    try {
      const { data } = await api.post(`/exam-engine/start/${confirmStart}`);
      navigate(`/student/exam/${data.attempt.id}`, { state: data });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao iniciar prova');
      setStarting(false);
      setConfirmStart(null);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Minhas Provas</h2>
          <p>Provas disponíveis para você</p>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="empty-card">Nenhuma prova disponível no momento</div>
      ) : (
        <div className="exams-grid">
          {exams.map(exam => (
            <div key={exam.id} className="exam-card-student">
              <div className="exam-card-header">
                <h3>{exam.title}</h3>
                {exam.class && <span className="badge badge-secondary">{exam.class.name}</span>}
              </div>

              <div className="exam-card-info">
                <div className="exam-info-item">
                  <span className="info-label">⏱️ Duração</span>
                  <span className="info-value">{exam.durationMinutes} min</span>
                </div>
                <div className="exam-info-item">
                  <span className="info-label">📝 Questões</span>
                  <span className="info-value">{exam.questionCount}</span>
                </div>
                <div className="exam-info-item">
                  <span className="info-label">🎯 Mínimo</span>
                  <span className="info-value">{exam.passingScore}%</span>
                </div>
                <div className="exam-info-item">
                  <span className="info-label">🔄 Tentativas</span>
                  <span className="info-value">{exam.attempts}{exam.maxAttempts > 0 ? `/${exam.maxAttempts}` : ' (Ilimitadas)'}</span>
                </div>
              </div>

              <div className="exam-card-footer">
                {exam.hasCertificate ? (
                  <div className="exam-status-bar success">
                    <span>✅ Aprovado — Certificado: {exam.certificateCode}</span>
                  </div>
                ) : exam.hasCooldown ? (
                  <div className="exam-status-bar warning">
                    <span>⏳ Cooldown até {new Date(exam.cooldownEndsAt!).toLocaleString('pt-BR')}</span>
                  </div>
                ) : (exam.maxAttempts > 0 && exam.attempts >= exam.maxAttempts) ? (
                  <div className="exam-status-bar danger">
                    <span>❌ Tentativas esgotadas</span>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-full" onClick={() => setConfirmStart(exam.id)}>
                    {exam.inProgress ? '▶ Continuar Prova' : '🚀 Iniciar Prova'}
                  </button>
                )}

                {exam.lastAttempt && exam.lastAttempt.executionStatus !== 'IN_PROGRESS' && (
                  <button className="btn btn-outline btn-sm" style={{marginTop: 8, width:'100%'}} onClick={() => navigate(`/student/result/${exam.lastAttempt.id}`)}>
                    📊 Ver Último Resultado {exam.lastAttempt.resultStatus === 'FAILED_ABANDONMENT' ? '(Desclassificado)' : exam.lastAttempt.resultStatus === 'FAILED_TIMEOUT' ? '(Tempo Esgotado)' : `(${exam.lastAttempt.score}%)`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pre-Exam Warning Modal */}
      {confirmStart && (
        <div className="modal-overlay" onClick={() => !starting && setConfirmStart(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Atenção: Regras da Prova</h3>
              <button className="modal-close" onClick={() => !starting && setConfirmStart(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning" style={{ marginBottom: '1rem', backgroundColor: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '8px', border: '1px solid #ffeeba' }}>
                <strong>⚠️ LEIA COM ATENÇÃO ANTES DE INICIAR</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                  <li>Você não pode fechar esta aba ou janela.</li>
                  <li>Você não pode usar o botão "Voltar" do navegador.</li>
                </ul>
              </div>
              <p>
                Qualquer violação das regras acima fará com que sua prova seja <strong>encerrada imediatamente e contabilizada como desclassificada/abandonada</strong>.
              </p>
              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmStart(null)} disabled={starting}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={startExam} disabled={starting}>
                  {starting ? 'Preparando...' : 'Estou ciente, Iniciar Prova'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
