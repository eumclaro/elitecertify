import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function ExamResult() {
  const { attemptId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState<any>(location.state || null);
  const [loading, setLoading] = useState(!location.state);

  useEffect(() => {
    if (!result) {
      api.get(`/exam-engine/result/${attemptId}`)
        .then(r => setResult(r.data))
        .catch(() => navigate('/student/exams'))
        .finally(() => setLoading(false));
    }
  }, [attemptId, result, navigate]);

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!result) return null;

  const passed = result.passed ?? result.attempt?.resultStatus === 'PASSED';
  const score = result.score ?? result.attempt?.score ?? 0;
  const isAbandoned = result.attempt?.resultStatus === 'FAILED_ABANDONMENT';
  const isTimeout = result.attempt?.resultStatus === 'FAILED_TIMEOUT';

  let heroTitle = 'Não foi dessa vez...';
  let heroIcon = '😔';
  if (passed) {
    heroTitle = 'Parabéns! Você foi aprovado!';
    heroIcon = '🎉';
  } else if (isAbandoned) {
    heroTitle = 'Desclassificado por Violação de Regras';
    heroIcon = '⛔';
  } else if (isTimeout) {
    heroTitle = 'Tempo Esgotado';
    heroIcon = '⏱️';
  }

  return (
    <div>
      <button className="btn btn-outline" onClick={() => navigate('/student/exams')} style={{marginBottom: 16}}>
        ← Voltar às Provas
      </button>

      <div className={`result-hero ${passed ? 'passed' : 'failed'}`}>
        <div className="result-icon">{heroIcon}</div>
        <h2>{heroTitle}</h2>
        <div className="result-score-big">{isAbandoned ? 'Desclassificado' : `${score}%`}</div>
        <p className="result-detail">
          {isAbandoned ? 'Sua prova foi anulada devido ao descumprimento das regras de segurança.' : (
            <>{result.correctAnswers} de {result.totalQuestions} questões corretas {' — '}Mínimo: {result.exam?.passingScore}%</>
          )}
        </p>
        {result.certificate && (
          <div className="certificate-badge">
            🏆 Certificado: <strong>{result.certificate.code}</strong>
          </div>
        )}
      </div>

      {/* Review */}
      {result.review && result.review.length > 0 && (
        <div style={{marginTop: 24}}>
          <h3 style={{marginBottom: 16}}>
            {passed ? '📋 Gabarito Completo' : '❌ Questões que você errou'}
          </h3>
          <div className="questions-list">
            {result.review.map((q: any, idx: number) => (
              <div key={q.id} className="question-card">
                <div className="question-header">
                  <span className="question-number">Questão {q.order || idx + 1}</span>
                  <span className={`badge ${q.studentCorrect ? 'badge-success' : 'badge-danger'}`}>
                    {q.studentCorrect ? '✓ Correta' : '✗ Incorreta'}
                  </span>
                </div>
                <div className="question-text">{q.text}</div>
                <div className="alternatives-list">
                  {q.alternatives.map((a: any, i: number) => {
                    const letter = String.fromCharCode(65 + i);
                    
                    // Rules: If passed, reveal all correct answers. 
                    // If failed, only reveal correct answer if they actually got it right.
                    // Otherwise, only show their wrong choice.
                    const revealCorrect = passed || q.studentCorrect;
                    const showAsCorrect = a.isCorrect && revealCorrect;

                    let className = 'alternative-item';
                    if (showAsCorrect) className += ' correct';
                    if (a.wasSelected && !a.isCorrect) className += ' wrong';

                    return (
                      <div key={a.id} className={className}>
                        <span className="alt-letter">{letter}</span>
                        <span className="alt-text">{a.text}</span>
                        {showAsCorrect && <span className="alt-check">✓</span>}
                        {a.wasSelected && !a.isCorrect && <span style={{color:'var(--danger)', fontWeight: 700}}>✗</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
