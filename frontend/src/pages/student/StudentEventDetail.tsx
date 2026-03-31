import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  CalendarDays,
  MapPin,
  Wifi,
  Users,
  ArrowLeft,
  Share2,
  Heart,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface EventDetail {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  date: string;
  location: string;
  isOnline: boolean;
  coverImageUrl: string;
  totalSpots: number | null;
  price: number | null;
  hasInterest: boolean;
  _count: { interests: number };
}

export default function StudentEventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Interest Dialog
  const [showInterestDialog, setShowInterestDialog] = useState(false);
  const [interestNotes, setInterestNotes] = useState('');
  const [submittingInterest, setSubmittingInterest] = useState(false);

  // Referral Dialog
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [referralForm, setReferralForm] = useState({ name: '', email: '', phone: '' });
  const [submittingReferral, setSubmittingReferral] = useState(false);

  // Success Dialog
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchEvent = async () => {
      try {
        const { data } = await api.get(`/events/${id}`);
        setEvent(data);
      } catch (err) {
        toast.error('Erro ao carregar detalhes do evento');
        navigate('/student/exams');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, navigate]);

  const handleInterest = async () => {
    if (!id || !event) return;
    setSubmittingInterest(true);
    try {
      await api.post(`/events/${id}/interest`, { notes: interestNotes });
      setEvent({ ...event, hasInterest: true });
      setShowInterestDialog(false);
      setShowSuccessDialog(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao registrar interesse');
    } finally {
      setSubmittingInterest(false);
    }
  };

  const handleReferral = async () => {
    if (!referralForm.name || !referralForm.email || !referralForm.phone) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    setSubmittingReferral(true);
    try {
      await api.post(`/events/${id}/referral`, {
        referredName: referralForm.name,
        referredEmail: referralForm.email,
        referredPhone: referralForm.phone,
      });
      toast.success('Indicação enviada com sucesso!');
      setReferralForm({ name: '', email: '', phone: '' });
      setShowReferralDialog(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar indicação');
    } finally {
      setSubmittingReferral(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!event) return null;

  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = eventDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/student/exams')}
          className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Button>
      </div>

      {/* Hero Section */}
      <div className="relative group overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="aspect-[21/9] w-full relative overflow-hidden">
          <img
            src={event.coverImageUrl}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
            <Badge className="bg-blue-600 hover:bg-blue-700 border-none">
              {event.isOnline ? 'Evento Online' : 'Evento Presencial'}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{event.title}</h1>
            <p className="text-white/80 line-clamp-2 max-w-2xl">{event.shortDescription}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Info className="size-5 text-blue-600" /> Sobre o Evento
            </h3>
            <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed">
              {event.longDescription.split('\n').map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h3 className="text-xl font-bold">Por que participar?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card/50">
                <CardContent className="pt-6 space-y-2">
                  <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                    <Users className="size-5 text-blue-600" />
                  </div>
                  <h4 className="font-semibold">Networking</h4>
                  <p className="text-sm text-muted-foreground">Conecte-se com profissionais de elite e expanda sua rede.</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="pt-6 space-y-2">
                  <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                    <CalendarDays className="size-5 text-blue-600" />
                  </div>
                  <h4 className="font-semibold">Conteúdo Exclusivo</h4>
                  <p className="text-sm text-muted-foreground">Acesso a insights e tendências que você não encontra em nenhum outro lugar.</p>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>

        {/* Sidebar / Actions */}
        <div className="space-y-6">
          <Card className="border-blue-100 bg-blue-50/30 sticky top-24">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CalendarDays className="size-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{formattedDate}</p>
                    <p className="text-xs text-muted-foreground">Às {formattedTime}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  {event.isOnline ? (
                    <Wifi className="size-5 text-blue-600 shrink-0 mt-0.5" />
                  ) : (
                    <MapPin className="size-5 text-blue-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold text-sm">{event.location}</p>
                    <p className="text-xs text-muted-foreground">{event.isOnline ? 'Acesso via plataforma' : 'Local presencial'}</p>
                  </div>
                </div>
                {event.totalSpots && (
                  <div className="flex items-start gap-3">
                    <Users className="size-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">{event.totalSpots} vagas</p>
                      <p className="text-xs text-muted-foreground">{event._count.interests} interessados no momento</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <span className="font-bold text-blue-600 text-lg">
                    {event.price ? `R$ ${event.price.toLocaleString('pt-BR')}` : 'Gratuito'}
                  </span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {event.hasInterest ? (
                  <Button className="w-full bg-green-600 hover:bg-green-700" disabled>
                    <CheckCircle2 className="size-4 mr-2" /> Interesse Registrado
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => setShowInterestDialog(true)}>
                    <Heart className="size-4 mr-2" /> Tenho Interesse
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={() => setShowReferralDialog(true)}>
                  <Share2 className="size-4 mr-2" /> Indicar um Amigo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Interest Dialog */}
      <Dialog open={showInterestDialog} onOpenChange={setShowInterestDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Demonstrar Interesse</DialogTitle>
            <DialogDescription>
              Ficamos felizes em saber que você quer participar! Deixe uma observação se desejar (ex: restrições alimentares, dúvidas).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="interest-notes">Observações (opcional)</Label>
              <Textarea
                id="interest-notes"
                placeholder="Ex: Gostaria de saber mais sobre a programação..."
                value={interestNotes}
                onChange={(e) => setInterestNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterestDialog(false)} disabled={submittingInterest}>
              Cancelar
            </Button>
            <Button onClick={handleInterest} disabled={submittingInterest}>
              {submittingInterest ? 'Enviando...' : 'Confirmar Interesse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Referral Dialog */}
      <Dialog open={showReferralDialog} onOpenChange={setShowReferralDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Indicar um Amigo</DialogTitle>
            <DialogDescription>
              Envie um convite para um amigo que possa se interessar por este evento. Nós enviaremos um e-mail em seu nome.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ref-name">Nome do Amigo *</Label>
              <Input
                id="ref-name"
                placeholder="Ex: João Silva"
                value={referralForm.name}
                onChange={(e) => setReferralForm({ ...referralForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-phone">WhatsApp (DDD + Número) *</Label>
              <Input
                id="ref-phone"
                placeholder="Ex: 11999999999"
                value={referralForm.phone}
                onChange={(e) => setReferralForm({ ...referralForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-email">E-mail do Amigo *</Label>
              <Input
                id="ref-email"
                type="email"
                placeholder="exemplo@email.com"
                value={referralForm.email}
                onChange={(e) => setReferralForm({ ...referralForm, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReferralDialog(false)} disabled={submittingReferral}>
              Cancelar
            </Button>
            <Button onClick={handleReferral} disabled={submittingReferral}>
              {submittingReferral ? 'Enviando...' : 'Enviar Indicação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-[425px] text-center">
          <DialogHeader>
            <div className="mx-auto size-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="size-10 text-green-600" />
            </div>
            <DialogTitle className="text-2xl text-center">Obrigado pelo interesse!</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              Recebemos sua solicitação com sucesso. Alguém do nosso time entrará em contato em breve para fornecer mais detalhes sobre o evento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center mt-6">
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full sm:w-auto px-8">
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
