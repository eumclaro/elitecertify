import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Calendar, 
  Mail, 
  User as UserIcon, 
  History, 
  Users, 
  Edit3, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Lock,
  EyeOff,
  Eye,
  Trash2,
  Save,
  Trophy as TrophyIcon,
  Download as DownloadIcon,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StudentInfo {
  id: string;
  lastName: string;
  cpf: string | null;
  phone: string | null;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
    active: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  };
  classes: Array<{
    class: {
      id: string;
      name: string;
    };
    joinedAt: string;
  }>;
  examAttempts?: any[];
  cooldowns?: any[];
  referrals?: any[];
  certificates?: any[];
}

interface TimelineItem {
  type: string;
  date: string;
  title: string;
  description: string;
  color: string;
  metadata?: any;
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [timelinePage, setTimelinePage] = useState(1);
  const [hasMoreTimeline, setHasMoreTimeline] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Edit form state
  const [form, setForm] = useState({ name: '', lastName: '', phone: '', email: '', cpf: '' });
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentRes, timelineRes, referralsRes, allClassesRes] = await Promise.all([
        api.get(`/students/${id}`),
        api.get(`/students/${id}/timeline`),
        api.get(`/students/${id}/referrals`).catch(() => ({ data: [] })),
        api.get('/classes')
      ]);
      
      setStudent(studentRes.data);
      setTimeline(timelineRes.data.data);
      setHasMoreTimeline(timelineRes.data.pagination.hasMore);
      setReferrals(referralsRes.data);
      setAllClasses(allClassesRes.data);
      setTimelinePage(1);
      
      setForm({
        name: studentRes.data.user.name,
        lastName: studentRes.data.lastName || '',
        phone: studentRes.data.phone || '',
        email: studentRes.data.user.email,
        cpf: studentRes.data.cpf || '',
      });
    } catch (error) {
      toast.error("Erro ao carregar dados do aluno");
      // navigate('/admin/students');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTimeline = async () => {
    if (loadingMore || !hasMoreTimeline) return;
    setLoadingMore(true);
    try {
      const nextPage = timelinePage + 1;
      const res = await api.get(`/students/${id}/timeline?page=${nextPage}`);
      setTimeline(prev => [...prev, ...res.data.data]);
      setHasMoreTimeline(res.data.pagination.hasMore);
      setTimelinePage(nextPage);
    } catch (error) {
      toast.error("Erro ao carregar mais itens");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleDownloadCertificate = async (code: string) => {
    setDownloading(code);
    try {
      const token = localStorage.getItem('elt-cert-token');
      const response = await fetch(`/api/certificates/${code}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Erro ao baixar certificado');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${code}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download iniciado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar o PDF do certificado');
    } finally {
      setDownloading(null);
    }
  };

  const handleResendCertificate = async (code: string) => {
    setSendingEmail(code);
    try {
      const token = localStorage.getItem('elt-cert-token');
      const response = await fetch(`/api/certificates/${code}/send-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao reenviar certificado');
      }

      toast.success('Certificado reenviado por e-mail com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao reenviar certificado por e-mail');
    } finally {
      setSendingEmail(null);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: any = {
        name: form.name,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        cpf: form.cpf,
      };
      if (newPassword) payload.password = newPassword;

      await api.put(`/students/${id}`, payload);
      toast.success("Perfil atualizado com sucesso");
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedClassId) return;
    setIsEnrolling(true);
    try {
      await api.post(`/students/${id}/enroll`, { classId: selectedClassId });
      toast.success("Aluno matriculado com sucesso!");
      setIsEnrollDialogOpen(false);
      setSelectedClassId("");
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Erro ao matricular aluno");
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleUnenroll = async (classId: string) => {
    try {
      await api.delete(`/students/${id}/unenroll/${classId}`);
      toast.success("Aluno desmatriculado com sucesso!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao desmatricular aluno");
    }
  };

  const getStudentStatus = (_studentClasses: any[], _classId: string): string => {
    const s = student;
    if (!s) return 'PENDENTE';

    const attempts = s.examAttempts || [];
    const lastAttempt = attempts[0] || null;
    const hasPassed = attempts.some((a: any) => a.resultStatus === 'PASSED');
    const lastExamHasCooldown = (lastAttempt?.exam?.cooldownDays ?? 0) > 0;
    
    // Check for cooldown (active)
    const activeCooldown = student?.cooldowns?.find((c: any) => c.status === 'ACTIVE' && new Date(c.endsAt) > new Date());

    if (hasPassed) return 'APPROVED';
    if (activeCooldown) return 'COOLDOWN';
    if (attempts.length > 0 && lastExamHasCooldown) return 'LIBERADO';
    if (attempts.length > 0) return 'REPROVED';
    
    return 'PENDING';
  };

  const handleToggleConvert = async (referralId: string, eventId: string, current: boolean) => {
    try {
      await api.patch(`/events/${eventId}/referrals/${referralId}/convert`, { converted: !current });
      
      // Update local state
      setReferrals(prev => prev.map(r => r.id === referralId ? { ...r, converted: !current } : r));
      
      if (!current) {
        toast.success("Indicação marcada como convertida");
      }
    } catch (error) {
      toast.error("Erro ao atualizar indicação");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) return null;

  const initials = student.user.name.charAt(0) + (student.lastName?.charAt(0) || '');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header / Breadcrumb */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/students')} className="gap-2 -ml-2">
          <ArrowLeft className="size-4" /> Voltar para Alunos
        </Button>
      </div>

      {/* Hero Section */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <UserIcon size={160} />
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
          <Avatar className="size-24 border-4 border-background shadow-xl">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {initials.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-2 mt-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight">{student.user.name} {student.lastName}</h1>
              <Badge variant={student.user.active ? "success" : "destructive"}>
                {student.user.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm text-muted-foreground pt-1">
              <div className="flex items-center gap-2">
                <Mail className="size-4 opacity-70" />
                <span>{student.user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 opacity-70" />
                <span>{student.phone || 'Sem WhatsApp'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 opacity-70" />
                <span>Desde {format(new Date(student.user.createdAt), "MMMM 'de' yyyy", { locale: ptBR })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="bg-muted/50 p-1 h-11 w-full md:w-auto">
          <TabsTrigger value="timeline" className="px-8 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <History className="size-4" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="referrals" className="px-8 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <Users className="size-4" /> Indicações
          </TabsTrigger>
          <TabsTrigger value="classes" className="px-8 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <Calendar className="size-4" /> Turmas
          </TabsTrigger>
          <TabsTrigger value="certificates" className="px-8 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <TrophyIcon className="size-4" /> Certificados
          </TabsTrigger>
          <TabsTrigger value="edit" className="px-8 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <Edit3 className="size-4" /> Editar Perfil
          </TabsTrigger>
        </TabsList>

        {/* --- Aba Timeline --- */}
        <TabsContent value="timeline" className="outline-none py-4">
          <div className="max-w-4xl space-y-8 relative">
            {/* Linha Vertical da Timeline */}
            <div className="absolute left-[20px] top-4 bottom-4 w-0.5 bg-muted/60 z-0" />
            
            {timeline.length === 0 ? (
              <div className="bg-muted/20 border border-dashed rounded-xl p-20 text-center text-muted-foreground ml-10">
                <History className="size-10 opacity-20 mx-auto mb-4" />
                <p>Nenhuma atividade registrada para este aluno ainda.</p>
              </div>
            ) : (
              timeline.map((item, idx) => (
                <div key={idx} className="relative pl-12 z-10 animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                  {/* Ponto / Ícone */}
                  <div className={`absolute left-0 size-10 rounded-full border-4 border-background flex items-center justify-center shadow-sm bg-muted text-foreground/70`}>
                     {getTimelineIcon(item.type)}
                  </div>
                  
                  {/* Conteúdo */}
                  <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-bold text-sm">{item.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      </div>
                      <div className="text-[10px] font-bold uppercase opacity-40 whitespace-nowrap bg-muted px-2 py-1 rounded">
                        {formatDateTime(item.date)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {hasMoreTimeline && (
              <div className="flex justify-center pt-4 ml-10">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadMoreTimeline} 
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />}
                  Carregar mais
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* --- Aba Indicações --- */}
        <TabsContent value="referrals" className="outline-none py-4 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/10">
               <CardHeader className="pb-2">
                 <CardDescription className="text-[10px] uppercase font-bold opacity-60">Total de Indicações</CardDescription>
                 <CardTitle className="text-4xl font-black">{referrals.length}</CardTitle>
               </CardHeader>
            </Card>
            <Card className="bg-emerald-500/5 border-emerald-500/10">
               <CardHeader className="pb-2">
                 <CardDescription className="text-[10px] uppercase font-bold opacity-60">Matrículas Convertidas</CardDescription>
                 <CardTitle className="text-4xl font-black text-emerald-600">
                    {referrals.filter(r => r.converted).length}
                 </CardTitle>
               </CardHeader>
            </Card>
            <Card className="bg-muted/30">
               <CardHeader className="pb-2">
                 <CardDescription className="text-[10px] uppercase font-bold opacity-60">Ranking de Indicações</CardDescription>
                 <CardTitle className="text-4xl font-black">#--</CardTitle>
               </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Amigos Indicados</CardTitle>
              <CardDescription>Lista de pessoas que este aluno indicou para eventos.</CardDescription>
            </CardHeader>
            <CardContent>
              {referrals.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground opacity-50 italic">
                  Este aluno ainda não fez nenhuma indicação.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Nome</th>
                        <th className="px-4 py-3 text-left font-semibold">E-mail</th>
                        <th className="px-4 py-3 text-left font-semibold">Evento</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {referrals.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{r.referredName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.referredEmail}</td>
                          <td className="px-4 py-3">{r.event?.title || 'Evento'}</td>
                          <td className="px-4 py-3">
                             <div className="flex items-center gap-3">
                               <Switch 
                                 checked={r.converted} 
                                 onCheckedChange={() => handleToggleConvert(r.id, r.event?.id, r.converted)}
                               />
                               {r.converted ? (
                                 <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-2 py-0 h-5">Convertida</Badge>
                               ) : (
                                 <Badge variant="outline" className="opacity-60 text-[10px] px-2 py-0 h-5">Pendente</Badge>
                               )}
                             </div>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Aba Turmas --- */}
        <TabsContent value="classes" className="outline-none py-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
              <div>
                <CardTitle className="text-lg">Matrículas em Turmas</CardTitle>
                <CardDescription>Visualize e gerencie o vínculo do aluno com as turmas.</CardDescription>
              </div>

              <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Calendar className="size-4" /> + Matricular em Turma
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Matricular em Nova Turma</DialogTitle>
                    <DialogDescription>
                      Selecione uma turma disponível para adicionar o aluno.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Selecione a Turma</Label>
                      <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha uma turma..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allClasses
                            .filter(c => !student.classes.some(sc => sc.class.id === c.id))
                            .map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))
                          }
                          {allClasses.filter(c => !student.classes.some(sc => sc.class.id === c.id)).length === 0 && (
                            <div className="p-2 text-center text-xs text-muted-foreground">
                              Nenhuma turma disponível (aluno já matriculado em todas).
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEnrollDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleEnroll} disabled={!selectedClassId || isEnrolling}>
                      {isEnrolling ? <Loader2 className="animate-spin size-4 mr-2" /> : null}
                      Confirmar Matrícula
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="rounded-xl border overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground border-b uppercase text-[10px] font-black tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left">Turma</th>
                      <th className="px-6 py-3 text-left">Data de Matrícula</th>
                      <th className="px-6 py-3 text-left">Status Performance</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {student.classes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground italic">
                          O aluno ainda não possui matrículas em nenhuma turma.
                        </td>
                      </tr>
                    ) : (
                      student.classes.map((sc, i) => {
                        const status = getStudentStatus(student.classes, sc.class.id);
                        return (
                          <tr key={i} className="hover:bg-muted/20 transition-colors group">
                            <td className="px-6 py-4 font-semibold group-hover:text-primary">
                              {sc.class.name}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {format(new Date(sc.joinedAt), "dd/MM/yyyy", { locale: ptBR })}
                            </td>
                            <td className="px-6 py-4">
                              {status === 'APPROVED' && (
                                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Aprovado</Badge>
                              )}
                              {status === 'REPROVED' && (
                                <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Reprovado</Badge>
                              )}
                              {status === 'COOLDOWN' && (
                                <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Em Cooldown</Badge>
                              )}
                              {status === 'LIBERADO' && (
                                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Liberado</Badge>
                              )}
                              {status === 'PENDING' && (
                                <Badge variant="outline">Pendente</Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive opacity-40 hover:opacity-100 hover:bg-destructive/10">
                                    <Trash2 className="size-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover Matrícula?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover o aluno da turma <strong>{sc.class.name}</strong>? 
                                      Isso não apagará as tentativas de prova dele, mas mudará seu status no portal do aluno.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Não, manter</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleUnenroll(sc.class.id)} className="bg-destructive hover:bg-destructive/90">
                                      Sim, Remover Aluno
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* --- Aba Certificados --- */}
        <TabsContent value="certificates" className="outline-none py-4">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Certificados Emitidos</CardTitle>
              <CardDescription>Lista de certificados de aprovação conquistados pelo aluno.</CardDescription>
            </CardHeader>
            <CardContent>
              {(!student.certificates || student.certificates.length === 0) ? (
                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground opacity-50 italic">
                  Este aluno ainda não possui certificados emitidos.
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground border-b uppercase text-[10px] font-black tracking-wider">
                      <tr>
                        <th className="px-6 py-3 text-left">Prova / Curso</th>
                        <th className="px-6 py-3 text-left">Código</th>
                        <th className="px-6 py-3 text-left">Data de Emissão</th>
                        <th className="px-6 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(student as any).certificates.map((cert: any) => (
                        <tr key={cert.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4 font-semibold">
                            {cert.exam?.title || 'Exame'}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs opacity-70">
                            {cert.code}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {format(new Date(cert.issuedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="gap-2 h-8 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                onClick={() => handleDownloadCertificate(cert.code)}
                                disabled={downloading === cert.code}
                              >
                                {downloading === cert.code ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <DownloadIcon className="size-3" />
                                )}
                                Baixar PDF
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="gap-2 h-8 font-bold border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                onClick={() => handleResendCertificate(cert.code)}
                                disabled={sendingEmail === cert.code}
                              >
                                {sendingEmail === cert.code ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Send className="size-3" />
                                )}
                                Reenviar Certificado
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Aba Editar Perfil --- */}
        <TabsContent value="edit" className="outline-none py-4 max-w-3xl">
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Dados Pessoais</CardTitle>
                <CardDescription>Atualize as informações cadastrais e de acesso do aluno.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Sobrenome *</Label>
                    <Input id="lastName" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required className="bg-muted/30" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">WhatsApp <Smartphone className="size-3 opacity-50" /></Label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" className="bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">CPF <ShieldCheck className="size-3 text-primary" /></Label>
                    <Input 
                      value={form.cpf} 
                      onChange={e => setForm({ ...form, cpf: e.target.value })} 
                      placeholder="000.000.000-00" 
                      className="bg-muted/30"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">Email de Acesso <Mail className="size-3 text-primary" /></Label>
                  <Input 
                    value={form.email} 
                    onChange={e => setForm({ ...form, email: e.target.value })} 
                    placeholder="email@exemplo.com" 
                    className="bg-muted/30 w-full"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Segurança</CardTitle>
                <CardDescription>Redefina a senha de acesso se necessário.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nova Senha (opcional)</Label>
                  <div className="relative group w-full">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      className="pl-10 pr-10 bg-muted/30 w-full"
                      placeholder="Deixe vazio para manter a atual"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between pt-6 border-t mt-4">
               <Button 
                 type="button" 
                 size="sm" 
                 variant="ghost" 
                 className="text-destructive hover:text-red-700 hover:bg-red-50 transition-colors"
               >
                  <Trash2 className="size-4 mr-2" /> Desativar Conta
               </Button>

               <div className="flex items-center gap-3">
                 <Button type="button" variant="outline" onClick={() => fetchData()} disabled={isSaving}>
                   Descartar
                 </Button>
                 <Button type="submit" disabled={isSaving} className="min-w-[180px] shadow-lg shadow-primary/20">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Alterações
                 </Button>
               </div>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatDateTime(date: string | Date) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format as dd/MM/yyyy HH:mm with Sao Paulo timezone
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d).replace(',', '');
}

function getTimelineIcon(type: string) {
  switch (type) {
    case 'REGISTRATION': return <CheckCircle2 className="size-5" />;
    case 'ENROLLMENT': return <Users className="size-5" />;
    case 'EXAM_STARTED': return <Smartphone className="size-5" />;
    case 'EXAM_RESULT': return <ShieldCheck className="size-5" />;
    case 'EXAM_ABANDONED': return <AlertCircle className="size-5" />;
    case 'COOLDOWN_APPLIED': return <Clock className="size-5" />;
    case 'COOLDOWN_RELEASED': return <History className="size-5" />;
    case 'EMAIL_SENT': return <Mail className="size-5" />;
    case 'REFERRAL': return <Users className="size-5" />;
    case 'INTEREST': return <Clock className="size-5" />;
    default: return <ChevronRight className="size-5" />;
  }
}
