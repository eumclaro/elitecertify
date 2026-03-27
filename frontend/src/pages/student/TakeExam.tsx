import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

let examIsMounted = false;
let abandonTimeout: any = null;

export default function TakeExam() {
  useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [examData] = useState<any>(location.state || null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState<number | null>(null);
  const [violation, setViolation] = useState<string | null>(null);

  // Use refs to avoid triggering useEffect cleanup on state changes
  const submittingRef = useRef(false);
  const abandonedRef = useRef(false);

  useEffect(() => { submittingRef.current = submitting; }, [submitting]);

  const triggerAbandon = useCallback(async (reason: string) => {
    if (abandonedRef.current || submittingRef.current || !examData) return;
    abandonedRef.current = true;
    
    // OPTIMISTIC UI: Mask the attempt locally to defeat SPA race conditions
    localStorage.setItem('elt-cert-abandoned-attempt', examData.attempt.id);
    
    try {
      const token = localStorage.getItem('elt-cert-token');
      await fetch(`/api/exam-engine/abandon/${examData.attempt.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        keepalive: true
      });
    } catch (err) {}
    
    setViolation(reason);
  }, [examData]);

  // Anti-Cheat Engine & Unmount Detection
  useEffect(() => {
    if (!examData) return;

    // Fast-mount verification (Strict Mode)
    examIsMounted = true;
    if (abandonTimeout) {
      clearTimeout(abandonTimeout);
      abandonTimeout = null;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submittingRef.current && !abandonedRef.current) {
        triggerAbandon('BEFORE_UNLOAD');
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    // Trap the back button
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      triggerAbandon('TENTOU_VOLTAR');
    };

    const preventDefault = (e: Event) => e.preventDefault();

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('paste', preventDefault);
    
    return () => {
      // Unmount tracking (for external link clicks / hard unmounts)
      examIsMounted = false;
      abandonTimeout = setTimeout(() => {
        if (!examIsMounted && !submittingRef.current && !abandonedRef.current) {
          triggerAbandon('SAIU_DA_PROVA');
        }
      }, 100);

      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('paste', preventDefault);
    };
  }, [examData, triggerAbandon]);

  // Initialize from state or fetch
  useEffect(() => {
    if (!examData) {
      navigate('/student/exams');
      return;
    }

    const existing: Record<string, string> = {};
    examData.existingAnswers?.forEach((a: any) => {
      if (a.alternativeId) existing[a.questionId] = a.alternativeId;
    });
    setAnswers(existing);

    const startedAt = new Date(examData.attempt.startedAt).getTime();
    const duration = examData.exam.durationMinutes * 60 * 1000;
    const remaining = Math.max(0, Math.floor((startedAt + duration - Date.now()) / 1000));
    setTimeLeft(remaining);
  }, [examData, navigate]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const selectAnswer = useCallback(async (questionId: string, alternativeId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: alternativeId }));

    try {
      await api.post('/exam-engine/answer', {
        attemptId: examData.attempt.id,
        questionId,
        alternativeId,
      });
    } catch (err: any) {
      if (err.response?.data?.expired) {
        alert('Tempo esgotado!');
        navigate('/student/exams');
      }
    }
  }, [examData, navigate]);

  const handleSubmit = () => {
    if (submittingRef.current) return;
    const unanswered = examData.questions.length - Object.keys(answers).length;
    if (unanswered > 0) {
      setConfirmSubmit(unanswered);
      return;
    }
    executeSubmit();
  };

  const executeSubmit = async () => {
    setConfirmSubmit(null);
    setSubmitting(true);
    try {
      const { data } = await api.post(`/exam-engine/submit/${examData.attempt.id}`);
      navigate(`/student/result/${examData.attempt.id}`, { state: data });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao submeter prova');
      setSubmitting(false);
    }
  };

  if (!examData) return <div className="page-loading"><div className="spinner"></div></div>;

  const questions = examData.questions || [];
  const question = questions[currentQuestion];
  const isUrgent = timeLeft < 300; // less than 5 min

  return (
    <div className="take-exam" style={{ position: 'relative' }}>
      {/* Watermark */}
      <div className="watermark-overlay">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="watermark-text">{user?.name} - {user?.email}</div>
        ))}
      </div>

      {/* Header Bar */}
      <div className="exam-top-bar" style={{ position: 'relative', zIndex: 10 }}>
        <div className="exam-top-title">
          <h2>{examData.exam.title}</h2>
          <span className="exam-progress">Questão {currentQuestion + 1} de {questions.length}</span>
        </div>
        <div className={`exam-timer ${isUrgent ? 'urgent' : ''}`}>
          ⏱️ {formatTime(timeLeft)}
        </div>
      </div>

      {/* Question Navigator */}
      <div className="question-nav-bar" style={{ position: 'relative', zIndex: 10 }}>
        {questions.map((_: any, i: number) => (
          <button
            key={i}
            className={`qnav-btn ${i === currentQuestion ? 'current' : ''} ${answers[questions[i].id] ? 'answered' : ''}`}
            onClick={() => setCurrentQuestion(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question Content */}
      {question && (
        <div className="exam-question-card" style={{ position: 'relative', zIndex: 10, userSelect: 'none' }}>
          <div className="exam-question-number">Questão {currentQuestion + 1}</div>
          <div className="exam-question-text">{question.text}</div>

          <div className="exam-alternatives">
            {question.alternatives.map((alt: any, idx: number) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = answers[question.id] === alt.id;
              return (
                <button
                  key={alt.id}
                  className={`exam-alt-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => selectAnswer(question.id, alt.id)}
                >
                  <span className={`exam-alt-letter ${isSelected ? 'selected' : ''}`}>{letter}</span>
                  <span className="exam-alt-text">{alt.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="exam-nav-footer" style={{ position: 'relative', zIndex: 10 }}>
        <button
          className="btn btn-secondary"
          disabled={currentQuestion === 0}
          onClick={() => setCurrentQuestion(prev => prev - 1)}
        >
          ← Anterior
        </button>

        {currentQuestion < questions.length - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => setCurrentQuestion(prev => prev + 1)}
          >
            Próxima →
          </button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Enviando...' : '✅ Finalizar Prova'}
          </button>
        )}
      </div>

      {/* Custom Confirm Modal for Missing Answers */}
      {confirmSubmit !== null && (
        <div className="modal-overlay" onClick={() => setConfirmSubmit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Finalizar Prova</h3>
              <button className="modal-close" onClick={() => setConfirmSubmit(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Você tem <strong>{confirmSubmit} questão(ões) sem reposta</strong>.</p>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '1rem', color: '#9ca3af' }}>
                Tem certeza que deseja enviar sua prova mesmo assim? Essas questões serão consideradas erradas na sua nota final.
              </p>
              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmSubmit(null)} disabled={submitting}>
                  Voltar para a prova
                </button>
                <button className="btn btn-primary" onClick={executeSubmit} disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Sim, Finalizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Violation Modal */}
      {violation && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: '450px', textAlign: 'center' }}>
            <div className="modal-header" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0 }}>
              <h3 style={{ color: 'var(--danger)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '2rem' }}>🚨</span> Violação de Segurança
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#f3f4f6' }}>
                A sua prova foi permanentemente <strong>encerrada e desclassificada</strong> de acordo com as regras de segurança do sistema.
              </p>
              <div style={{ backgroundColor: '#2d3748', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'inline-block', border: '1px solid #4a5568' }}>
                <strong style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Motivo do bloqueio</strong>
                <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '1rem' }}>{violation}</span>
              </div>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                Tentativas de fechar a janela, usar o botão voltar do navegador ou clicar em links externos são estritamente proibidas durante a prova.
              </p>
              <div className="modal-footer" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => navigate('/student/exams')} style={{ width: '100%', padding: '12px' }}>
                  Retornar à página inicial
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
