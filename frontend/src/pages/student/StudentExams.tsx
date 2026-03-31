import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle, Clock, FileText, Target, RefreshCw, CheckCircle2, Hourglass, XCircle, Rocket, Play, BarChart2, CalendarDays, ChevronRight, MapPin, Wifi } from 'lucide-react';
import { CardDescription } from '@/components/ui/card';

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
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmStart, setConfirmStart] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/exam-engine/available'),
      api.get('/events')
    ])
      .then(([examsRes, eventsRes]) => {
        const fetchedExams = examsRes.data;
        const abandonedAttemptId = localStorage.getItem('elt-cert-abandoned-attempt');

        if (abandonedAttemptId) {
          let flagCleared = false;
          fetchedExams.forEach((exam: any) => {
            if (exam.lastAttempt?.id === abandonedAttemptId) {
              if (exam.inProgress || exam.frontendStatus === 'IN_PROGRESS' || exam.lastAttempt.executionStatus === 'IN_PROGRESS') {
                exam.inProgress = false;
                exam.frontendStatus = 'EXHAUSTED';
                exam.lastAttempt.executionStatus = 'ABANDONED';
                exam.lastAttempt.resultStatus = 'FAILED_ABANDONMENT';
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
        setEvents(eventsRes.data.filter((e: any) => e.status === 'PUBLISHED'));
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

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Painel do Aluno</h2>
        <p className="text-muted-foreground">Continue sua jornada de certificação</p>
      </div>

      {/* Events Carousel */}
      {events.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="size-5 text-blue-600" /> Próximos Eventos
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
            {events.map((event) => (
              <Card
                key={event.id}
                className="flex-shrink-0 w-80 group cursor-pointer hover:border-blue-200 transition-all duration-300 shadow-sm hover:shadow-md"
                onClick={() => navigate(`/student/event/${event.id}`)}
              >
                <div className="relative aspect-[16/9] overflow-hidden rounded-t-xl">
                  <img
                    src={event.coverImageUrl}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-black/50 backdrop-blur-sm border-none">
                      {event.isOnline ? <Wifi className="size-3 mr-1" /> : <MapPin className="size-3 mr-1" />}
                      {event.isOnline ? 'Online' : 'Presencial'}
                    </Badge>
                  </div>
                </div>
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold mb-1">
                    <CalendarDays className="size-3" />
                    {new Date(event.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </div>
                  <CardTitle className="text-base line-clamp-1">{event.title}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">{event.shortDescription}</CardDescription>
                </CardHeader>
                <CardFooter className="px-4 pb-4 pt-2">
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1 group-hover:bg-blue-50 group-hover:text-blue-700">
                    Saber mais <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Exams Section Header */}
      <div className="pt-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="size-5 text-muted-foreground" /> Minhas Provas
        </h3>
      </div>

      {/* Empty state */}
      {exams.length === 0 ? (
        <Card className="flex items-center justify-center py-16">
          <CardContent className="text-center text-muted-foreground pt-6">
            <FileText className="mx-auto mb-3 size-10 opacity-40" />
            <p>Nenhuma prova disponível no momento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map(exam => (
            <Card key={exam.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{exam.title}</CardTitle>
                  {exam.class && (
                    <Badge variant="secondary" className="shrink-0 text-xs">{exam.class.name}</Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pb-3 flex-1">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5" />
                    <span className="font-medium text-foreground">{exam.durationMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="size-3.5" />
                    <span className="font-medium text-foreground">{exam.questionCount} questões</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Target className="size-3.5" />
                    <span className="font-medium text-foreground">{exam.passingScore}% mínimo</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <RefreshCw className="size-3.5" />
                    <span className="font-medium text-foreground">
                      {exam.attempts}{exam.maxAttempts > 0 ? `/${exam.maxAttempts}` : ' (Ilimitadas)'}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-2 pt-0">
                {exam.hasCertificate ? (
                  <div className="w-full flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span className="font-medium">Aprovado — {exam.certificateCode}</span>
                  </div>
                ) : exam.hasCooldown ? (
                  <div className="w-full flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                    <Hourglass className="size-4 shrink-0" />
                    <span>Cooldown até {new Date(exam.cooldownEndsAt!).toLocaleString('pt-BR')}</span>
                  </div>
                ) : (exam.maxAttempts > 0 && exam.attempts >= exam.maxAttempts) ? (
                  <div className="w-full flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    <XCircle className="size-4 shrink-0" />
                    <span className="font-medium">Tentativas esgotadas</span>
                  </div>
                ) : (
                  <Button className="w-full" onClick={() => setConfirmStart(exam.id)}>
                    {exam.inProgress
                      ? <><Play className="size-4 mr-2" /> Continuar Prova</>
                      : <><Rocket className="size-4 mr-2" /> Iniciar Prova</>
                    }
                  </Button>
                )}

                {exam.lastAttempt && exam.lastAttempt.executionStatus !== 'IN_PROGRESS' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/student/result/${exam.lastAttempt.id}`)}
                  >
                    <BarChart2 className="size-4 mr-2" />
                    Ver Último Resultado{' '}
                    {exam.lastAttempt.resultStatus === 'FAILED_ABANDONMENT'
                      ? '(Desclassificado)'
                      : exam.lastAttempt.resultStatus === 'FAILED_TIMEOUT'
                      ? '(Tempo Esgotado)'
                      : `(${exam.lastAttempt.score}%)`}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Pre-Exam Warning Dialog */}
      <Dialog open={!!confirmStart} onOpenChange={(open) => { if (!open && !starting) setConfirmStart(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Atenção: Regras da Prova</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-semibold">⚠️ LEIA COM ATENÇÃO ANTES DE INICIAR</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Você não pode fechar esta aba ou janela.</li>
                  <li>Você não pode usar o botão "Voltar" do navegador.</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Qualquer violação das regras acima fará com que sua prova seja{' '}
              <strong className="text-foreground">encerrada imediatamente e contabilizada como desclassificada/abandonada</strong>.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStart(null)} disabled={starting}>
              Cancelar
            </Button>
            <Button onClick={startExam} disabled={starting}>
              {starting ? 'Preparando...' : 'Estou ciente, Iniciar Prova'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
