import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const submittingRef = useRef(false);
  const abandonedRef = useRef(false);
  const alerted33Ref = useRef(false);

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
      else if (a.textAnswer) existing[a.questionId] = a.textAnswer;
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

    // Alerta de 33%
    const totalSeconds = (examData?.exam?.durationMinutes || 0) * 60;
    if (totalSeconds > 0 && !alerted33Ref.current) {
      const pct = (timeLeft / totalSeconds) * 100;
      if (pct <= 33) {
        alerted33Ref.current = true;
        const minsRemaining = Math.ceil(timeLeft / 60);
        alert(`⚠️ Atenção: Menos de ${minsRemaining} minutos restantes!`);
      }
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          executeSubmit(); // <--- Força o envio direto sem modal
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, examData, executeSubmit]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const debouncedSave = useRef<Record<string, any>>({});

  const saveAnswer = useCallback(async (questionId: string, value: string, isEssay = false) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    if (isEssay) {
      if (debouncedSave.current[questionId]) {
        clearTimeout(debouncedSave.current[questionId]);
      }
      debouncedSave.current[questionId] = setTimeout(async () => {
        try {
          await api.post('/exam-engine/answer', {
            attemptId: examData.attempt.id,
            questionId,
            textAnswer: value,
          });
        } catch (err: any) {
          if (err.response?.data?.expired) {
             alert('Tempo esgotado!');
             navigate('/student/exams');
          }
        }
      }, 1000);
    } else {
      try {
        await api.post('/exam-engine/answer', {
          attemptId: examData.attempt.id,
          questionId,
          alternativeId: value,
        });
      } catch (err: any) {
        if (err.response?.data?.expired) {
          alert('Tempo esgotado!');
          navigate('/student/exams');
        }
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

  if (!examData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  const questions = examData.questions || [];
  const question = questions[currentQuestion];
  const isUrgent = timeLeft < 300;
  const totalSeconds = examData.exam.durationMinutes * 60;
  const progressPct = totalSeconds > 0 ? (timeLeft / totalSeconds) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="relative min-h-screen bg-muted/30 select-none">

      {/* Watermark Overlay */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden opacity-[0.04] z-0"
        aria-hidden="true"
      >
        <div className="absolute inset-0 flex flex-wrap content-start gap-x-16 gap-y-8 p-8 -rotate-[30deg] scale-150 origin-center">
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} className="text-sm font-semibold whitespace-nowrap text-foreground">
              {user?.name} — {user?.email}
            </span>
          ))}
        </div>
      </div>

      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">{examData.exam.title}</h2>
            <p className="text-xs text-muted-foreground">
              Questão {currentQuestion + 1} de {questions.length} · {answeredCount} respondidas
            </p>
          </div>

          <div className={cn(
            'flex items-center gap-2 font-mono font-bold text-lg tabular-nums px-3 py-1 rounded-lg border',
            isUrgent ? 'animate-pulse' : '',
            progressPct > 66 
              ? 'text-emerald-600 bg-emerald-50 border-emerald-200' 
              : progressPct > 33 
                ? 'text-orange-500 bg-orange-50 border-orange-200' 
                : 'text-rose-600 bg-rose-50 border-rose-200'
          )}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>

        {/* Timer Progress Bar */}
        <div className="max-w-3xl mx-auto mt-2">
          <Progress
            value={progressPct}
            className={cn('h-1.5', isUrgent && '[&>div]:bg-red-500')}
          />
        </div>
      </div>

      {/* Question Navigator */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {questions.map((_: any, i: number) => {
            const isAnswered = !!answers[questions[i].id];
            const isCurrent = i === currentQuestion;
            return (
              <button
                key={i}
                onClick={() => setCurrentQuestion(i)}
                className={cn(
                  'size-8 rounded-md text-xs font-semibold border transition-colors',
                  isCurrent
                    ? 'bg-primary text-primary-foreground border-primary'
                    : isAnswered
                    ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Card */}
      {question && (
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-28">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Questão {currentQuestion + 1}
                </span>
                <p className="mt-2 text-base leading-relaxed font-medium">{question.text}</p>
              </div>

                {question.type === 'ESSAY' ? (
                  <div className="space-y-4">
                    <textarea
                      className="w-full min-h-[200px] p-4 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-sm leading-relaxed"
                      placeholder="Digite sua resposta aqui..."
                      value={answers[question.id] || ''}
                      onChange={(e) => saveAnswer(question.id, e.target.value, true)}
                    />
                    <p className="text-[10px] text-muted-foreground text-right italic">
                      As alterações são salvas automaticamente enquanto você digita.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {question.alternatives.map((alt: any, idx: number) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = answers[question.id] === alt.id;
                      return (
                        <button
                          key={alt.id}
                          onClick={() => saveAnswer(question.id, alt.id)}
                          className={cn(
                            'w-full flex items-start gap-3 rounded-lg border p-4 text-left text-sm transition-all',
                            isSelected
                              ? 'bg-primary/10 border-primary text-foreground font-medium'
                              : 'bg-background border-border hover:bg-muted/60 text-foreground'
                          )}
                        >
                          <span className={cn(
                            'flex-shrink-0 size-6 rounded-full flex items-center justify-center text-xs font-bold border',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted text-muted-foreground border-border'
                          )}>
                            {letter}
                          </span>
                          <span className="leading-snug pt-0.5">{alt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-background border-t px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={currentQuestion === 0}
            onClick={() => setCurrentQuestion(prev => prev - 1)}
          >
            <ChevronLeft className="size-4 mr-1" /> Anterior
          </Button>

          {currentQuestion < questions.length - 1 ? (
            <Button onClick={() => setCurrentQuestion(prev => prev + 1)}>
              Próxima <ChevronRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button
              disabled={submitting}
              onClick={handleSubmit}
            >
              <CheckCircle2 className="size-4 mr-2" />
              {submitting ? 'Enviando...' : 'Finalizar Prova'}
            </Button>
          )}
        </div>
      </div>

      {/* Confirm Submit Dialog (unanswered questions) */}
      <Dialog open={confirmSubmit !== null} onOpenChange={(open) => { if (!open) setConfirmSubmit(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Finalizar Prova</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você tem <strong>{confirmSubmit} questão(ões) sem resposta</strong>.
            </p>
            <p className="text-muted-foreground">
              Tem certeza que deseja enviar sua prova mesmo assim? Essas questões serão consideradas erradas na sua nota final.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(null)} disabled={submitting}>
              Voltar para a prova
            </Button>
            <Button onClick={executeSubmit} disabled={submitting}>
              {submitting ? 'Enviando...' : 'Sim, Finalizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security Violation Modal (não fechável — sem onOpenChange) */}
      <Dialog open={!!violation}>
        <DialogContent
          className="sm:max-w-[450px] text-center [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-red-600 text-xl">
              <ShieldAlert className="size-7" /> Violação de Segurança
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-base">
              A sua prova foi permanentemente <strong>encerrada e desclassificada</strong> de acordo com as regras de segurança do sistema.
            </p>
            <div className="rounded-lg bg-muted border px-4 py-3 font-mono text-xs text-muted-foreground">
              <span className="block uppercase tracking-widest text-[10px] mb-1">Motivo do bloqueio</span>
              <span className="text-foreground font-semibold">{violation}</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Tentativas de fechar a janela, usar o botão voltar do navegador ou clicar em links externos são estritamente proibidas durante a prova.
            </p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => navigate('/student/exams')}>
              Retornar à página inicial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
