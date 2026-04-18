import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft, Star, Eye } from 'lucide-react';
import NpsScoreSelector from '@/components/NpsScoreSelector';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

export default function NpsPreview() {
  const { id } = useParams();
  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { score?: number; text?: string }>>({});
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    api.get(`/nps/surveys/${id}/preview`)
      .then(({ data }) => setSurvey(data))
      .catch(() => toast.error('Erro ao carregar pesquisa'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleScore = (questionId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], score } }));
  };

  const handleText = (questionId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], text } }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
        questionId: qId,
        ...val,
      }));
      await api.post(`/nps/surveys/${id}/preview`, { answers: formattedAnswers });
      setCompleted(true);
      toast.success('Resposta de teste registrada');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar resposta de teste');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Carregando preview...</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-none shadow-2xl text-center p-8 space-y-6">
          <div className="flex justify-center">
            <div className="size-20 rounded-full bg-amber-100 flex items-center justify-center">
              <CheckCircle2 className="size-12 text-amber-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Resposta de teste registrada</h2>
            <p className="text-muted-foreground text-sm">
              Esta resposta ficará marcada como <strong>Teste</strong> nos resultados e pode ser excluída a qualquer momento.
            </p>
          </div>
          <Button variant="outline" onClick={() => window.close()} className="w-full">
            Fechar
          </Button>
        </Card>
      </div>
    );
  }

  if (!survey) return null;

  const questions = survey.questions || [];
  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const renderQuestion = (q: any) => {
    const answer = answers[q.id];

    switch (q.type) {
      case 'SCORE':
        return (
          <NpsScoreSelector
            value={answer?.score ?? null}
            onChange={(score) => handleScore(q.id, score)}
          />
        );

      case 'RATING_5':
        return (
          <div className="flex justify-center gap-4 py-8">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleScore(q.id, star)}
                className={`transition-transform hover:scale-125 ${
                  (answer?.score || 0) >= star ? 'text-amber-500 fill-amber-500' : 'text-muted'
                }`}
              >
                <Star className="size-12" />
              </button>
            ))}
          </div>
        );

      case 'MULTIPLE_CHOICE':
        const options = q.options?.split(',').map((o: string) => o.trim()) || [];
        return (
          <RadioGroup
            value={answer?.text}
            onValueChange={(v) => handleText(q.id, v)}
            className="space-y-3 py-4"
          >
            {options.map((option: string) => (
              <Label
                key={option}
                className={`flex items-center space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  answer?.text === option ? 'border-primary bg-primary/5' : 'border-muted hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value={option} id={option} />
                <span className="font-medium text-base">{option}</span>
              </Label>
            ))}
          </RadioGroup>
        );

      case 'TEXT':
        return (
          <div className="pt-4">
            <Textarea
              placeholder="Digite sua resposta aqui..."
              value={answer?.text || ''}
              onChange={(e) => handleText(q.id, e.target.value)}
              className="min-h-[150px] text-base resize-none"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-6">

        {/* Preview banner */}
        <div className="flex items-center gap-2 justify-center bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-xl px-4 py-3">
          <Eye className="size-4 shrink-0" />
          <p className="text-sm font-bold">Modo Preview — Esta é a visão do aluno. Respostas enviadas aqui ficam marcadas como <em>Teste</em>.</p>
        </div>

        <header className="space-y-4 text-center">
          <Badge variant="outline" className="px-3 py-1 bg-background">Feedback NPS</Badge>
          <h1 className="text-3xl font-black text-foreground">{survey.title}</h1>
        </header>

        <Card className="border-none shadow-xl overflow-hidden ring-1 ring-black/5">
          <CardHeader className="px-8 pt-8 pb-0">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">
                {currentStep + 1} / {questions.length}
              </Badge>
              <Progress value={progress} className="w-24 h-1.5" />
            </div>
            <CardTitle className="text-xl font-black leading-snug">
              {currentQuestion?.text}
            </CardTitle>
          </CardHeader>

          <CardContent className="px-8 py-6">
            {currentQuestion && renderQuestion(currentQuestion)}
          </CardContent>

          <CardFooter className="px-8 pb-8 flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="size-4" /> Anterior
            </Button>

            {currentStep < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(s => s + 1)}
                className="gap-2"
              >
                Próxima <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Enviar Teste
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
