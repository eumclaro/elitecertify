import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, CheckCircle2, XCircle, Award, Trophy, ShieldAlert, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }
  if (!result) return null;

  const passed = result.passed ?? result.attempt?.resultStatus === 'PASSED';
  const score = result.score ?? result.attempt?.score ?? 0;
  const isAbandoned = result.attempt?.resultStatus === 'FAILED_ABANDONMENT';
  const isTimeout = result.attempt?.resultStatus === 'FAILED_TIMEOUT';

  let HeroIcon = XCircle;
  if (passed) {
    HeroIcon = CheckCircle2;
  } else if (isAbandoned) {
    HeroIcon = ShieldAlert;
  } else if (isTimeout) {
    HeroIcon = Clock;
  }

  const heroBg = passed
    ? 'bg-green-50 border-green-200'
    : isAbandoned
    ? 'bg-orange-50 border-orange-200'
    : 'bg-red-50 border-red-200';

  const heroIconColor = passed
    ? 'text-green-600'
    : isAbandoned
    ? 'text-orange-600'
    : 'text-red-600';

  const scoreColor = passed ? 'text-green-700' : isAbandoned ? 'text-orange-700' : 'text-red-700';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Back Button */}
      <Button variant="outline" onClick={() => navigate('/student/exams')}>
        <ChevronLeft className="size-4 mr-1" /> Voltar às Provas
      </Button>

      {/* Hero + Metrics — centralizados com largura mínima */}
      <div className="w-full max-w-2xl mx-auto min-w-[600px] space-y-6">

      {/* Hero Card */}
      <Card className={cn('border-2', heroBg)}>
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-3">
          <HeroIcon className={cn('size-14', heroIconColor)} strokeWidth={1.5} />

          <Badge
            className={cn(
              'text-sm px-3 py-1',
              passed
                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100'
                : isAbandoned
                ? 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-100'
                : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-100'
            )}
            variant="outline"
          >
            {passed ? 'Aprovado' : isAbandoned ? 'Desclassificado' : 'Reprovado'}
          </Badge>

          <div className={cn('text-6xl font-extrabold tabular-nums', scoreColor)}>
            {isAbandoned ? '—' : `${score}%`}
          </div>

          {result.exam?.title && (
            <p className="font-semibold text-lg text-foreground">{result.exam.title}</p>
          )}

          {isAbandoned ? (
            <p className="text-sm text-muted-foreground max-w-md">
              Sua prova foi anulada devido ao descumprimento das regras de segurança.
            </p>
          ) : (
            <div className="space-y-1 text-sm text-center">
              <p className={cn('font-medium', passed ? 'text-green-600' : 'text-muted-foreground')}>
                Você acertou {result.correctAnswers} de {result.totalQuestions} questões ({score}%)
              </p>
              {!passed && result.exam?.passingScore != null && result.totalQuestions > 0 && (() => {
                const questoesNecessarias = Math.ceil(result.totalQuestions * (result.exam.passingScore / 100));
                return (
                  <p className="font-medium text-red-600">
                    Para aprovação: mínimo de {questoesNecessarias} questões ({result.exam.passingScore}%)
                  </p>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Row */}
      {!isAbandoned && result.totalQuestions > 0 && (
        <div className="grid grid-cols-3 gap-4 w-full">
          <Card className="flex-1">
            <CardContent className="py-12 text-center">
              <p className="text-4xl font-extrabold text-green-600 tabular-nums">{result.correctAnswers ?? 0}</p>
              <p className="text-base text-muted-foreground mt-3 font-semibold uppercase tracking-wide">Corretas</p>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="py-12 text-center">
              <p className="text-4xl font-extrabold text-red-600 tabular-nums">
                {(result.totalQuestions ?? 0) - (result.correctAnswers ?? 0)}
              </p>
              <p className="text-base text-muted-foreground mt-3 font-semibold uppercase tracking-wide">Erradas</p>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="py-12 text-center">
              <p className="text-4xl font-extrabold text-foreground tabular-nums">{result.totalQuestions ?? 0}</p>
              <p className="text-base text-muted-foreground mt-3 font-semibold uppercase tracking-wide">Total</p>
            </CardContent>
          </Card>
        </div>
      )}

      </div>{/* end hero+metrics wrapper */}

      {/* Certificate */}
      {result.certificate && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <Trophy className="size-8 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800 flex items-center gap-2">
                Certificado emitido
                <Badge className="bg-green-100 text-green-800 border-green-300 hover:bg-green-100" variant="outline">
                  Disponível
                </Badge>
              </p>
              <p className="text-sm text-green-700 font-mono mt-0.5">{result.certificate.code}</p>
              {result.certificate.url && (
                <a
                  href={result.certificate.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-700 underline underline-offset-2 hover:text-green-900 mt-1 inline-block"
                >
                  <Award className="inline size-3.5 mr-1" />
                  Acessar certificado
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review */}
      {result.review && result.review.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base">
            {passed ? 'Gabarito Completo' : 'Questões que você errou'}
          </h3>

          {result.review.map((q: any, idx: number) => (
            <Card key={q.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Questão {q.order || idx + 1}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 text-xs',
                      q.studentCorrect
                        ? 'bg-green-50 text-green-700 border-green-300'
                        : 'bg-red-50 text-red-700 border-red-300'
                    )}
                  >
                    {q.studentCorrect
                      ? <><CheckCircle2 className="inline size-3 mr-1" />Correta</>
                      : <><XCircle className="inline size-3 mr-1" />Incorreta</>
                    }
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-foreground mt-1">{q.text}</p>
              </CardHeader>

              <Separator />

              <CardContent className="pt-4 space-y-2">
                {q.alternatives.map((a: any, i: number) => {
                  const letter = String.fromCharCode(65 + i);

                  // Rules: If passed, reveal all correct answers.
                  // If failed, only reveal correct answer if they actually got it right.
                  // Otherwise, only show their wrong choice.
                  const revealCorrect = passed || q.studentCorrect;
                  const showAsCorrect = a.isCorrect && revealCorrect;
                  const showAsWrong = a.wasSelected && !a.isCorrect;

                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm',
                        showAsCorrect
                          ? 'bg-green-50 border-green-300 text-green-800'
                          : showAsWrong
                          ? 'bg-red-50 border-red-300 text-red-800'
                          : 'bg-muted/30 border-border text-muted-foreground'
                      )}
                    >
                      <span className={cn(
                        'flex-shrink-0 size-6 rounded-full flex items-center justify-center text-xs font-bold border',
                        showAsCorrect
                          ? 'bg-green-600 text-white border-green-600'
                          : showAsWrong
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-background border-border text-muted-foreground'
                      )}>
                        {letter}
                      </span>
                      <span className="leading-snug pt-0.5 flex-1">{a.text}</span>
                      {showAsCorrect && <CheckCircle2 className="size-4 shrink-0 text-green-600 mt-0.5" />}
                      {showAsWrong && <XCircle className="size-4 shrink-0 text-red-600 mt-0.5" />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
