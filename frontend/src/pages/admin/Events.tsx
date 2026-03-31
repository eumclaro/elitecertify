import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  CalendarDays, Plus, Edit2, Trash2, Loader2, ArrowLeft,
  Users, ExternalLink, MoreHorizontal, MapPin, Wifi, FileJson,
  CheckCircle2, Circle,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface EventItem {
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
  status: 'DRAFT' | 'PUBLISHED';
  _count: { interests: number; referrals: number };
}

interface InterestItem {
  id: string;
  notes: string | null;
  createdAt: string;
  student: { id: string; user: { name: string; email: string } };
}

interface ReferralItem {
  id: string;
  referredName: string;
  referredEmail: string;
  referredPhone: string | null;
  converted: boolean;
  createdAt: string;
  referrer: { id: string; user: { name: string; email: string } };
}

const emptyForm = {
  title: '',
  shortDescription: '',
  longDescription: '',
  date: '',
  location: '',
  isOnline: false,
  coverImageUrl: '',
  totalSpots: '',
  price: '',
  status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
};

export default function Events() {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  // Detail tabs
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/events');
      setEvents(data);
    } catch {
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const openDetail = async (event: EventItem) => {
    setSelectedEvent(event);
    setView('detail');
    setLoadingDetail(true);
    try {
      const [intRes, refRes] = await Promise.all([
        api.get(`/events/${event.id}/interests`),
        api.get(`/events/${event.id}/referrals`),
      ]);
      setInterests(intRes.data);
      setReferrals(refRes.data);
    } catch {
      toast.error('Erro ao carregar detalhes');
    } finally {
      setLoadingDetail(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (e: EventItem) => {
    setEditing(e);
    setForm({
      title: e.title,
      shortDescription: e.shortDescription,
      longDescription: e.longDescription,
      date: new Date(e.date).toISOString().slice(0, 16),
      location: e.location,
      isOnline: e.isOnline,
      coverImageUrl: e.coverImageUrl,
      totalSpots: e.totalSpots != null ? String(e.totalSpots) : '',
      price: e.price != null ? String(e.price) : '',
      status: e.status,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.shortDescription || !form.longDescription || !form.date || !form.location || !form.coverImageUrl) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        shortDescription: form.shortDescription,
        longDescription: form.longDescription,
        date: form.date,
        location: form.location,
        isOnline: form.isOnline,
        coverImageUrl: form.coverImageUrl,
        totalSpots: form.totalSpots !== '' ? Number(form.totalSpots) : null,
        price: form.price !== '' ? Number(form.price) : null,
        status: form.status,
      };
      if (editing) {
        await api.put(`/events/${editing.id}`, payload);
        toast.success('Evento atualizado');
      } else {
        await api.post('/events', payload);
        toast.success('Evento criado');
      }
      setShowModal(false);
      fetchEvents();
    } catch {
      toast.error('Erro ao salvar evento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este evento?')) return;
    try {
      await api.delete(`/events/${id}`);
      toast.success('Evento excluído');
      fetchEvents();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleToggleConvert = async (referralId: string, current: boolean) => {
    try {
      await api.patch(`/events/${selectedEvent!.id}/referrals/${referralId}/convert`, { converted: !current });
      setReferrals(prev => prev.map(r => r.id === referralId ? { ...r, converted: !current } : r));
      toast.success(current ? 'Indicação desmarcada' : 'Indicação marcada como convertida');
    } catch {
      toast.error('Erro ao atualizar indicação');
    }
  };

  const exportInterestsCSV = () => {
    if (!selectedEvent) return;
    let csv = 'Nome,Email,Observação,Data\n';
    interests.forEach(i => {
      csv += `"${i.student.user.name}","${i.student.user.email}","${i.notes || ''}","${new Date(i.createdAt).toLocaleDateString('pt-BR')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interesses-${selectedEvent.title.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReferralsCSV = () => {
    if (!selectedEvent) return;
    let csv = 'Indicador,Nome Indicado,Email Indicado,WhatsApp,Data,Convertido\n';
    referrals.forEach(r => {
      csv += `"${r.referrer.user.name}","${r.referredName}","${r.referredEmail}","${r.referredPhone || ''}","${new Date(r.createdAt).toLocaleDateString('pt-BR')}","${r.converted ? 'Sim' : 'Não'}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indicacoes-${selectedEvent.title.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Eventos</h1>
            <p className="text-muted-foreground">Gerencie eventos e acompanhe interesses e indicações</p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="size-4" /> Novo Evento
          </Button>
        </div>

        <div className="bg-card rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Nome</TableHead>
                <TableHead className="px-6">Data</TableHead>
                <TableHead className="px-6">Local</TableHead>
                <TableHead className="px-6">Vagas</TableHead>
                <TableHead className="px-6">Interesses</TableHead>
                <TableHead className="px-6">Status</TableHead>
                <TableHead className="w-16 px-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                    Nenhum evento criado.
                  </TableCell>
                </TableRow>
              ) : (
                events.map(ev => (
                  <TableRow key={ev.id}>
                    <TableCell className="px-6">
                      <button
                        onClick={() => openDetail(ev)}
                        className="font-semibold text-blue-600 hover:underline text-left"
                      >
                        {ev.title}
                      </button>
                    </TableCell>
                    <TableCell className="px-6 text-sm text-muted-foreground">
                      {new Date(ev.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="px-6 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {ev.isOnline ? <Wifi className="size-3" /> : <MapPin className="size-3" />}
                        {ev.isOnline ? 'Online' : ev.location}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 text-sm text-muted-foreground">
                      {ev.totalSpots != null ? ev.totalSpots : '∞'}
                    </TableCell>
                    <TableCell className="px-6">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="size-3" /> {ev._count.interests}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6">
                      {ev.status === 'PUBLISHED'
                        ? <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Publicado</Badge>
                        : <Badge variant="outline">Rascunho</Badge>
                      }
                    </TableCell>
                    <TableCell className="px-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetail(ev)} className="gap-2">
                            <ExternalLink className="size-4" /> Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(ev)} className="gap-2">
                            <Edit2 className="size-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(ev.id)} className="gap-2 text-red-600 focus:text-red-600">
                            <Trash2 className="size-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Modal Criar/Editar */}
        <Dialog open={showModal} onOpenChange={open => { if (!saving) setShowModal(open); }}>
          <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
              <DialogDescription>Preencha os dados do evento.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nome do evento" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição Curta *</Label>
                <Input value={form.shortDescription} onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))} placeholder="Resumo em uma linha" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição Completa *</Label>
                <Textarea rows={4} value={form.longDescription} onChange={e => setForm(f => ({ ...f, longDescription: e.target.value }))} placeholder="Descrição detalhada do evento..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Data e Hora *</Label>
                  <Input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Local *</Label>
                  <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Cidade ou link" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>URL da Imagem de Capa *</Label>
                <Input value={form.coverImageUrl} onChange={e => setForm(f => ({ ...f, coverImageUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Vagas (deixe vazio = ilimitado)</Label>
                  <Input type="number" min="1" value={form.totalSpots} onChange={e => setForm(f => ({ ...f, totalSpots: e.target.value }))} placeholder="Ex: 50" />
                </div>
                <div className="space-y-1.5">
                  <Label>Preço (R$) — vazio = gratuito</Label>
                  <Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0,00" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isOnline"
                    checked={form.isOnline}
                    onChange={e => setForm(f => ({ ...f, isOnline: e.target.checked }))}
                    className="size-4"
                  />
                  <Label htmlFor="isOnline">Evento Online</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Status:</Label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as 'DRAFT' | 'PUBLISHED' }))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="DRAFT">Rascunho</option>
                    <option value="PUBLISHED">Publicado</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setView('list')} className="gap-2 -ml-2">
          <ArrowLeft className="size-4" /> Voltar para Eventos
        </Button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-2xl font-bold truncate">{selectedEvent?.title}</h1>
        <Badge className={selectedEvent?.status === 'PUBLISHED' ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''} variant={selectedEvent?.status === 'PUBLISHED' ? 'outline' : 'outline'}>
          {selectedEvent?.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
        </Badge>
      </div>

      {selectedEvent && (
        <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-4" />
            {new Date(selectedEvent.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="flex items-center gap-1">
            {selectedEvent.isOnline ? <Wifi className="size-4" /> : <MapPin className="size-4" />}
            {selectedEvent.isOnline ? 'Online' : selectedEvent.location}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-4" />
            {selectedEvent._count.interests} interesse(s)
          </span>
        </div>
      )}

      <Tabs defaultValue="interests">
        <TabsList>
          <TabsTrigger value="interests">Interesses ({interests.length})</TabsTrigger>
          <TabsTrigger value="referrals">Indicações ({referrals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="interests" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" className="gap-2" onClick={exportInterestsCSV}>
              <FileJson className="size-4" /> Exportar CSV
            </Button>
          </div>
          <div className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6">Nome</TableHead>
                  <TableHead className="px-6">Email</TableHead>
                  <TableHead className="px-6">Observação</TableHead>
                  <TableHead className="px-6">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingDetail ? (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : interests.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">Nenhum interesse registrado.</TableCell></TableRow>
                ) : (
                  interests.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="px-6">
                        <Link to={`/admin/students/${i.student.id}`} className="font-semibold text-primary hover:underline transition-colors">
                          {i.student.user.name}
                        </Link>
                      </TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">{i.student.user.email}</TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">{i.notes || '—'}</TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">{new Date(i.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" className="gap-2" onClick={exportReferralsCSV}>
              <FileJson className="size-4" /> Exportar CSV
            </Button>
          </div>
          <div className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6">Indicador</TableHead>
                  <TableHead className="px-6">Nome Indicado</TableHead>
                  <TableHead className="px-6">Email Indicado</TableHead>
                  <TableHead className="px-6">WhatsApp</TableHead>
                  <TableHead className="px-6">Data</TableHead>
                  <TableHead className="px-6">Convertido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingDetail ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : referrals.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Nenhuma indicação registrada.</TableCell></TableRow>
                ) : (
                  referrals.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="px-6">
                        <Link to={`/admin/students/${r.referrer.id}`} className="font-semibold text-primary hover:underline transition-colors text-sm">
                          {r.referrer.user.name}
                        </Link>
                      </TableCell>
                      <TableCell className="px-6 text-sm">{r.referredName}</TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">{r.referredEmail}</TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">{r.referredPhone || '-'}</TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="px-6">
                        <button
                          onClick={() => handleToggleConvert(r.id, r.converted)}
                          className="flex items-center gap-1.5 text-sm"
                        >
                          {r.converted
                            ? <CheckCircle2 className="size-5 text-green-500" />
                            : <Circle className="size-5 text-muted-foreground" />
                          }
                          <span className={r.converted ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                            {r.converted ? 'Convertido' : 'Pendente'}
                          </span>
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
