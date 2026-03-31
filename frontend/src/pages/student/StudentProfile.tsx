import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, Star, ExternalLink, Pencil, Lock, Eye, EyeOff, Share2, Circle, CheckCircle2, UserCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentProfile() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [npsHistory, setNpsHistory] = useState<any[]>([]);
  const [pendingNps, setPendingNps] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit profile modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    phone: '',
    email: '',
    cpf: '',
    password: '',
  });

  const openEditModal = async () => {
    setEditOpen(true);
    setEditLoading(true);
    try {
      const { data } = await api.get('/auth/profile');
      setForm({
        name: data.name || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        email: data.email || '',
        cpf: data.cpf || '',
        password: '',
      });
    } catch {
      toast.error('Erro ao carregar dados do perfil');
      setEditOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/auth/profile', {
        name: form.name,
        lastName: form.lastName,
        phone: form.phone,
        ...(form.password.trim() ? { password: form.password } : {}),
      });
      toast.success('Perfil atualizado com sucesso!');
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get('/exam-engine/certificates').catch(() => ({ data: [] })),
      api.get('/nps/history').catch(() => ({ data: [] })),
      api.get('/nps/my-pending').catch(() => ({ data: [] })),
      api.get('/events/my-referrals').catch(() => ({ data: [] }))
    ])
    .then(([certRes, npsRes, pendingRes, refRes]) => {
      setCertificates(certRes.data);
      setNpsHistory(npsRes.data);
      setPendingNps(pendingRes.data);
      setReferrals(refRes.data);
    })
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="space-y-1">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Meu Painel</h2>
        <p className="text-muted-foreground">Gerencie sua conta, certificados e interações</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="profile" className="gap-2"><UserCircle className="size-4" /> Perfil</TabsTrigger>
          <TabsTrigger value="certificates" className="gap-2"><Award className="size-4" /> Certificados</TabsTrigger>
          <TabsTrigger value="referrals" className="gap-2"><Share2 className="size-4" /> Indicações</TabsTrigger>
          <TabsTrigger value="nps" className="gap-2"><Star className="size-4" /> Avaliações</TabsTrigger>
        </TabsList>

        {/* Tab: Profile */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardContent className="pt-6 pb-6 flex items-center gap-5">
              <Avatar className="size-16">
                <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <h3 className="text-lg font-semibold leading-tight">{user?.name}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge variant="secondary">Aluno</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={openEditModal}>
                <Pencil className="size-4 mr-2" /> Editar Perfil
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="pt-6 space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Membro desde</p>
                <p className="text-2xl font-bold">Março 2024</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="pt-6 space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Certificados Ativos</p>
                <p className="text-2xl font-bold text-blue-600">{certificates.length}</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Edit Profile Dialog */}
          <Dialog open={editOpen} onOpenChange={(open) => { if (!saving) setEditOpen(open); }}>
            <DialogContent className="sm:max-w-[460px]">
              <DialogHeader>
                <DialogTitle>Editar Perfil</DialogTitle>
              </DialogHeader>

              {editLoading ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <div className="space-y-4 py-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-name">Nome</Label>
                      <Input
                        id="edit-name"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nome"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-lastname">Sobrenome</Label>
                      <Input
                        id="edit-lastname"
                        value={form.lastName}
                        onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                        placeholder="Sobrenome"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-phone">Telefone / WhatsApp</Label>
                    <Input
                      id="edit-phone"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-email" className="flex items-center gap-1.5">
                      <Lock className="size-3 text-muted-foreground" /> Email
                    </Label>
                    <Input id="edit-email" value={form.email} disabled className="bg-muted text-muted-foreground" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-cpf" className="flex items-center gap-1.5">
                      <Lock className="size-3 text-muted-foreground" /> CPF
                    </Label>
                    <Input id="edit-cpf" value={form.cpf} disabled className="bg-muted text-muted-foreground" />
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-password">Nova Senha <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <div className="relative">
                      <Input
                        id="edit-password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Deixe em branco para não alterar"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving || editLoading}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Tab: Certificates */}
        <TabsContent value="certificates">
          <div className="space-y-4">
            {certificates.length === 0 ? (
              <Card>
                <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
                  <Award className="size-10 opacity-30" />
                  <p className="text-sm text-center">
                    Nenhum certificado emitido ainda.<br />Realize suas provas e seja aprovado!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {certificates.map(cert => (
                  <Card key={cert.id} className="border-green-200 bg-green-50/40">
                    <CardContent className="pt-5 pb-5 flex items-start gap-4">
                      <div className="flex-shrink-0 size-10 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                        <Award className="size-5 text-green-700" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold text-sm leading-snug">{cert.exam?.title || 'Prova'}</p>
                        <p className="text-xs text-muted-foreground font-mono">Código: {cert.code}</p>
                        <p className="text-xs text-muted-foreground">
                          Emitido em {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                            Aprovado
                          </Badge>
                          {cert.url && (
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-green-700 underline underline-offset-2 hover:text-green-900"
                            >
                              <ExternalLink className="size-3" /> Ver certificado
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Referrals */}
        <TabsContent value="referrals">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Histórico de Indicações</CardTitle>
                <CardDescription>Acompanhe amigos que você indicou para nossos eventos.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {referrals.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground border-t">
                    <Share2 className="size-10 opacity-30" />
                    <p className="text-sm text-center">Você ainda não indicou nenhum amigo.</p>
                  </div>
                ) : (
                  <div className="divide-y border-t">
                    {referrals.map((ref: any) => (
                      <div key={ref.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{ref.referredName}</p>
                          <p className="text-xs text-muted-foreground truncate">{ref.referredEmail} • {ref.referredPhone}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold bg-muted px-1.5 py-0.5 rounded">
                              {ref.event?.title || 'Evento'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(ref.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                          {ref.converted ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1 h-6">
                              <CheckCircle2 className="size-3" /> Convertido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground gap-1 h-6">
                              <Circle className="size-3" /> Pendente
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: NPS */}
        <TabsContent value="nps">
          <div className="space-y-8">
            {/* Pending Section */}
            {pendingNps.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Clock className="size-5 text-amber-500" /> Pesquisas Pendentes
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {pendingNps.map((invite: any) => (
                    <Card key={invite.id} className="border-amber-200 bg-amber-50/30 overflow-hidden">
                      <CardContent className="p-5 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-sm leading-tight">{invite.survey.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {invite.survey._count.questions} perguntas • Expira em breve
                          </p>
                        </div>
                        <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700">
                          <a href={`/student/nps/${invite.survey.id}`}>Responder agora</a>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* History Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-500" /> Histórico de Respostas
              </h3>
              {npsHistory.length === 0 ? (
                <Card>
                  <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground border-dashed">
                    <Star className="size-10 opacity-30" />
                    <p className="text-sm text-center">
                      Nenhuma pesquisa respondida anteriormente.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {npsHistory.map((resp: any) => (
                    <Card key={resp.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-sm font-semibold">{resp.survey.title}</CardTitle>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(resp.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </CardHeader>
                      <Separator />
                      <CardContent className="pt-4 space-y-3">
                        {resp.details.map((d: any) => (
                          <div key={d.id} className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">{d.question.text}</p>
                            <div className="flex items-center gap-2">
                              {d.score !== null ? (
                                <Badge variant={d.score >= 9 ? 'default' : d.score <= 6 ? 'destructive' : 'secondary'} className="h-6">
                                  {d.score}
                                </Badge>
                              ) : (
                                <p className="text-sm italic text-muted-foreground border-l-2 border-muted pl-2">
                                  {d.text || '—'}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>


    </div>
  );
}
