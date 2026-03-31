import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

export default function StudentNps() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { score?: number; text?: string }>>({});
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const { data } = await api.get(`/nps/surveys/${id}/student-details`);
        setSurvey(data);
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Erro ao carregar pesquisa');
        navigate('/student/profile');
      } finally {
        setLoading(false);
      }
    };
    fetchSurvey();
  }, [id, navigate]);

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
      await api.post('/nps/responses/submit', { 
        surveyId: id, 
        answers: formattedAnswers 
      });
      setCompleted(true);
      toast.success('Pesquisa enviada com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar respostas');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Carregando pesquisa...</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-none shadow-2xl text-center p-8 space-y-6">
          <div className="flex justify-center">
            <div className="size-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="size-12 text-green-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Obrigado pelo feedback!</h2>
            <p className="text-muted-foreground text-sm">
              Sua opinião é fundamental para continuarmos evoluindo e entregando a melhor experiência possível.
            </p>
          </div>
          <Button onClick={() => navigate('/student/profile')} className="w-full">
            Voltar para o Painel
          </Button>
        </Card>
      </div>
    );
  }

  const questions = survey.questions || [];
  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const renderQuestion = (q: any) => {
    const answer = answers[q.id];

    switch (q.type) {
      case 'SCORE':
        return (
          <div className="space-y-6 pt-4">
            <div className="flex justify-between gap-1">
              {[...Array(11)].map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleScore(q.id, i)}
                  className={`size-10 sm:size-12 rounded-lg border-2 font-bold transition-all flex items-center justify-center ${
                    answer?.score === i 
                      ? 'bg-primary border-primary text-primary-foreground shadow-lg scale-110' 
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground px-1">
               <span>Pouco Provável</span>
               <span>Muito Provável</span>
            </div>
          </div>
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
        <header className="space-y-4 text-center">
          <Badge variant="outline" className="px-3 py-1 bg-background">Feedback NPS</Badge>
          <h1 className="text-3xl font-black text-foreground">{survey.title}</h1>
        </header>

        <Card className="border-none shadow-xl overflow-hidden ring-1 ring-black/5">
          <div className="h-2 bg-muted">
            <Progress value={progress} className="h-full rounded-none transition-all" />
          </div>
          
          <CardHeader className="px-8 pt-8">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                Pergunta {currentStep + 1} de {questions.length}
              </span>
            </div>
            <CardTitle className="text-xl md:text-2xl pt-2 leading-tight">
              {currentQuestion.text}
            </CardTitle>
          </CardHeader>

          <CardContent className="px-8 pb-10">
            {renderQuestion(currentQuestion)}
          </CardContent>

          <CardFooter className="px-8 py-6 bg-muted/20 flex justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={currentStep === 0 || submitting}
              className="font-bold uppercase tracking-wider text-xs"
            >
              <ChevronLeft className="size-4 mr-2" /> Anterior
            </Button>

            {currentStep < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(s => s + 1)}
                className="font-bold uppercase tracking-wider text-xs"
              >
                Próxima <ChevronRight className="size-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 font-bold uppercase tracking-wider text-xs px-8"
              >
                {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
                Finalizar Feedback
              </Button>
            )}
          </CardFooter>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground uppercase font-bold spacing-wider opacity-50">
          Sua resposta é segura e ajuda o ELITE training a crescer.
        </p>
      </div>
    </div>
  );
}
