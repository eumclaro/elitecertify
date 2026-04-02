import { useState, useEffect, type FormEvent } from 'react';
import api from '../../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2,
  MoreHorizontal,
  Target,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Unlock,
  FileJson,
  Send,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  Mail
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, Link } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EMAIL_TEMPLATES as TEMPLATES } from '@/constants/email-templates';

interface ClassItem {
  id: string;
  name: string;
  description: string;
  _count: { students: number };
  createdAt: string;
}

interface StudentPerformance {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  grade: number | null;
  status: string;
  attempts: number;
  cooldownUntil: string | null;
  cooldownId: string | null;
  lastActivity: string | null;
}

interface ClassMetrics {
  total: number;
  approved: number;
  reproved: number;
  pending: number;
  cooldown: number;
  released: number;
}

export default function Classes() {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'manage'>('list');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [classSearch, setClassSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Selected Class Management State
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classData, setClassData] = useState<{name: string, description: string} | null>(null);
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [metrics, setMetrics] = useState<ClassMetrics | null>(null);
  const [loadingManage, setLoadingManage] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'grade', direction: 'desc' });
  const [releases, setReleases] = useState<any[]>([]);
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  const [examToLink, setExamToLink] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Dispatch Modal State
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [dispatchStep, setDispatchStep] = useState(1);
  const [dispatchFilter, setDispatchFilter] = useState<'ALL' | 'APPROVED' | 'REPROVED' | 'LIBERADO' | 'PENDING' | 'COOLDOWN'>('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [activeBindings, setActiveBindings] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);

  const fetchClasses = async (search = classSearch) => {
    setLoading(true);
    try {
      const { data } = await api.get('/classes', { params: { search } });
      setClasses(data);
    } catch (e) { 
      toast.error("Erro ao carregar turmas");
    } finally { setLoading(false); }
  };

  const fetchClassDetails = async (id: string) => {
    setLoadingManage(true);
    try {
      const [{ data: std }, { data: rel }, { data: exs }] = await Promise.all([
        api.get(`/classes/${id}/students`),
        api.get(`/classes/${id}/releases`),
        api.get('/exams', { params: { search: '', status: 'PUBLISHED' } })
      ]);
      setStudents(std.students);
      setMetrics(std.metrics);
      setReleases(rel);
      const boundIds = rel.map((r: any) => r.examId);
      setAvailableExams(exs.data.filter((e: any) => !boundIds.includes(e.id)));
    } catch (e) {
      toast.error("Erro ao carregar detalhes da turma");
    } finally {
      setLoadingManage(false);
    }
  };

  const handleLinkExam = async () => {
    if (!examToLink) return toast.error("Selecione uma prova");
    setIsLinking(true);
    try {
      await api.post(`/exams/${examToLink}/releases`, { classId: selectedClassId });
      toast.success("Prova vinculada à turma!");
      setExamToLink('');
      if (selectedClassId) fetchClassDetails(selectedClassId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao vincular prova");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkExam = async (examId: string, releaseId: string) => {
    if (!confirm("Remover o vínculo desta prova com a turma? Alunos com cooldown ativo e tentativas finalizadas não serão restritos, mas não terão liberação automática nova.")) return;
    try {
      await api.delete(`/exams/${examId}/releases/${releaseId}`);
      toast.success("Vínculo removido");
      if (selectedClassId) fetchClassDetails(selectedClassId);
    } catch (err) {
      toast.error("Erro ao remover vínculo");
    }
  };

  const fetchBindings = async () => {
    try {
      const { data } = await api.get('/email-templates/bindings');
      setActiveBindings(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchClasses(classSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [classSearch]);

  const handleManageClass = (id: string) => {
    setSelectedClassId(id);
    const cls = classes.find(c => c.id === id);
    if (cls) setClassData({ name: cls.name, description: cls.description });
    setView('manage');
    fetchClassDetails(id);
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedClassId(null);
    setClassData(null);
    setStudents([]);
    setMetrics(null);
  };

  const openNew = () => { setEditing(null); setForm({ name: '', description: '' }); setShowModal(true); };
  const openEdit = (c: ClassItem) => { setEditing(c); setForm({ name: c.name, description: c.description || '' }); setShowModal(true); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editing) {
        await api.put(`/classes/${editing.id}`, form);
        toast.success("Turma atualizada");
      } else {
        await api.post('/classes', form);
        toast.success("Turma criada");
      }
      setShowModal(false);
      fetchClasses();
    } catch (err) { 
      toast.error("Erro ao salvar");
    } finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta turma?')) return;
    try {
      await api.delete(`/classes/${id}`);
      toast.success("Turma excluída");
      fetchClasses();
    } catch (err) { toast.error("Erro ao excluir"); }
  };

  const handleClearCooldown = async (_sId: string, cId: string) => {
    try {
      await api.put(`/exams/cooldowns/${cId}/clear`);
      toast.success("Cooldown liberado com sucesso!");
      if (selectedClassId) fetchClassDetails(selectedClassId);
    } catch (err) {
      toast.error("Erro ao liberar cooldown");
    }
  };

  const handleExportCSV = () => {
    if (!selectedClassId) return;
    const url = `${api.defaults.baseURL}/classes/${selectedClassId}/export`;
    window.open(url, '_blank');
  };

  const handleOpenDispatch = () => {
    setDispatchStep(1);
    setDispatchFilter('ALL');
    setSelectedTemplate('');
    setIsDispatchOpen(true);
    fetchBindings();
  };

  const handleStartDispatch = async () => {
    if (!selectedTemplate) return toast.error("Selecione um template");
    setIsSending(true);
    try {
      let recipientIds: string[] = [];
      if (dispatchFilter === 'ALL') {
        recipientIds = students.map(s => s.id);
      } else {
        recipientIds = students
          .filter(s => s.status === dispatchFilter)
          .map(s => s.id);
      }

      if (recipientIds.length === 0) {
        toast.error("Nenhum aluno encontrado para este filtro");
        setIsSending(false);
        return;
      }

      await api.post('/dispatches', {
        templateSlug: selectedTemplate,
        recipientGroup: 'manual',
        recipientIds
      });

      toast.success(`${recipientIds.length} e-mails disparados com sucesso!`);
      setIsDispatchOpen(false);
    } catch (err) {
      toast.error("Erro ao realizar disparo");
    } finally {
      setIsSending(false);
    }
  };

  const sortedStudents = [...students]
    .filter(s => (statusFilter === 'ALL' || s.status === statusFilter))
    .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.email.toLowerCase().includes(studentSearch.toLowerCase()))
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      const aVal = (a as any)[key] || 0;
      const bVal = (b as any)[key] || 0;
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Aprovado</Badge>;
      case 'REPROVED': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Reprovado</Badge>;
      case 'COOLDOWN': return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Em Cooldown</Badge>;
      case 'LIBERADO': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Liberado</Badge>;
      default: return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <TooltipProvider>
      {view === 'list' ? (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Turmas</h1>
              <p className="text-muted-foreground">Gerencie turmas e vínculos com alunos</p>
            </div>
            <Button onClick={openNew} className="gap-2">
              <Plus className="size-4" /> Nova Turma
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome da turma..."
                className="pl-9 h-11 bg-muted/50"
		autoComplete="off"
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6">Nome</TableHead>
                  <TableHead className="px-6">Descrição</TableHead>
                  <TableHead className="px-6">Alunos</TableHead>
                  <TableHead className="px-6">Criada em</TableHead>
                  <TableHead className="w-20 px-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : classes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center text-muted-foreground">
                      Nenhuma turma encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  classes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="px-6">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => handleManageClass(c.id)}
                              className="font-semibold text-blue-600 hover:underline text-left cursor-pointer transition-all"
                            >
                              {c.name}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Clique para gerenciar</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate px-6">{c.description || '-'}</TableCell>
                      <TableCell className="px-6">
                        <Badge variant="secondary" className="gap-1">
                          <Users className="size-3" /> {c._count.students}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-6">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="px-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleManageClass(c.id)} className="gap-2">
                              <Target className="size-4" /> Gerenciar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2">
                              <Edit2 className="size-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(c.id)} className="gap-2 text-red-600 focus:text-red-600">
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
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackToList} className="gap-2 -ml-2">
              <ArrowLeft className="size-4" /> Voltar para Turmas
            </Button>
            <div className="h-4 w-px bg-border" />
            <h1 className="text-2xl font-bold">{classData?.name}</h1>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card className="bg-muted/30">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Users className="size-5" /></div>
                <div><p className="text-xs text-muted-foreground uppercase font-bold">Total</p><p className="text-xl font-bold">{metrics?.total || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><CheckCircle2 className="size-5" /></div>
                <div><p className="text-xs text-muted-foreground uppercase font-bold">Aprovados</p><p className="text-xl font-bold">{metrics?.approved || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-red-500/10 text-red-500 rounded-lg"><AlertCircle className="size-5" /></div>
                <div><p className="text-xs text-muted-foreground uppercase font-bold">Reprovados</p><p className="text-xl font-bold">{metrics?.reproved || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg"><Unlock className="size-5" /></div>
                <div><p className="text-xs text-muted-foreground uppercase font-bold">Liberados</p><p className="text-xl font-bold">{metrics?.released || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-slate-500/10 text-slate-500 rounded-lg"><Target className="size-5" /></div>
                <div><p className="text-xs text-muted-foreground uppercase font-bold">Pendentes</p><p className="text-xl font-bold">{metrics?.pending || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg"><Clock className="size-5" /></div>
                <div><p className="text-xs text-muted-foreground uppercase font-bold">Cooldown</p><p className="text-xl font-bold">{metrics?.cooldown || 0}</p></div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
             <Card className="bg-card shadow-sm border">
               <CardHeader className="py-4 border-b">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base font-bold flex items-center gap-2"><Target className="size-4 text-primary"/> Provas Vinculadas</CardTitle>
                    <div className="flex gap-2">
                       <Select value={examToLink} onValueChange={setExamToLink}>
                         <SelectTrigger className="w-[180px] h-8 bg-muted/50"><SelectValue placeholder="Selecione a prova"/></SelectTrigger>
                         <SelectContent>{availableExams.length ? availableExams.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>) : <SelectItem disabled value="_">Nenhuma disp.</SelectItem>}</SelectContent>
                       </Select>
                       <Button size="sm" onClick={handleLinkExam} disabled={!examToLink || examToLink === '_' || isLinking}>
                         {isLinking ? <Loader2 className="size-3 animate-spin"/> : 'Vincular'}
                       </Button>
                    </div>
                  </div>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                       <TableRow>
                          <TableHead className="px-4">Prova</TableHead>
                          <TableHead className="w-20 px-4">Questões</TableHead>
                          <TableHead className="w-16 px-4 text-right">Ação</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                        {releases.length === 0 ? (
                           <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">Nenhuma prova liberada para esta turma no momento.</TableCell></TableRow>
                        ) : releases.map(r => (
                           <TableRow key={r.id}>
                              <TableCell className="px-4 font-semibold text-sm">{r.exam.title}</TableCell>
                              <TableCell className="px-4 text-muted-foreground text-sm">{r.exam.questionCount}q</TableCell>
                              <TableCell className="px-4 text-right">
                                 <Button variant="ghost" size="icon" className="text-red-600 size-8 hover:bg-red-500/10" onClick={() => handleUnlinkExam(r.examId, r.id)}><Trash2 className="size-4"/></Button>
                              </TableCell>
                           </TableRow>
                        ))}
                    </TableBody>
                  </Table>
               </CardContent>
             </Card>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex flex-wrap gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Filtrar aluno..." className="pl-9 bg-muted/50 h-9" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              </div>
              <div className="flex bg-muted p-1 rounded-lg border">
                {['ALL', 'APPROVED', 'REPROVED', 'LIBERADO', 'PENDING', 'COOLDOWN'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${statusFilter === s ? 'bg-background shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                  >
                    {s === 'ALL' ? 'Todos' : s === 'APPROVED' ? 'Aprovado' : s === 'REPROVED' ? 'Reprovado' : s === 'LIBERADO' ? 'Liberado' : s === 'PENDING' ? 'Pendente' : 'Cooldown'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}><FileJson className="size-4" /> Exportar CSV</Button>
              <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleOpenDispatch}><Send className="size-4" /> Disparar E-mail</Button>
            </div>
          </div>

          <div className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6">Nome</TableHead>
                  <TableHead className="px-6">
                    <button 
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => setSortConfig({ key: 'grade', direction: sortConfig?.direction === 'desc' ? 'asc' : 'desc' })}
                    >
                      Nota {sortConfig?.key === 'grade' && (sortConfig.direction === 'desc' ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />)}
                    </button>
                  </TableHead>
                  <TableHead className="px-6">Status</TableHead>
                  <TableHead className="px-6">Tentativas</TableHead>
                  <TableHead className="px-6">Cooldown</TableHead>
                  <TableHead className="px-6">Última Atividade</TableHead>
                  <TableHead className="w-20 px-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingManage ? (
                  <TableRow><TableCell colSpan={7} className="h-64 text-center"><Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : sortedStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-64 text-center text-muted-foreground">Nenhum aluno encontrado.</TableCell></TableRow>
                ) : (
                  sortedStudents.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="px-6">
                        <div className="flex flex-col">
                          <Link 
                            to={`/admin/students/${s.id}`}
                            className="font-medium text-sm hover:underline hover:text-primary transition-colors"
                          >
                            {s.name}
                          </Link>
                          <span className="text-[10px] text-muted-foreground">{s.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs px-6">{s.grade !== null ? `${s.grade}%` : '-'}</TableCell>
                      <TableCell className="px-6">{getStatusBadge(s.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground px-6">{s.attempts} {s.attempts === 1 ? 'tentativa' : 'tentativas'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground px-6">
                        {s.cooldownUntil ? new Date(s.cooldownUntil).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground px-6">
                        {s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="px-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/students/${s.id}`)} className="gap-2">
                              <Users className="size-4" /> Ver Aluno
                            </DropdownMenuItem>
                            {s.status === 'COOLDOWN' && s.cooldownId && (
                              <DropdownMenuItem onClick={() => handleClearCooldown(s.id, s.cooldownId!)} className="gap-2 text-green-600 focus:text-green-600">
                                <History className="size-4" /> Liberar Cooldown
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      </TooltipProvider>

      <Dialog open={isDispatchOpen} onOpenChange={setIsDispatchOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Disparar E-mail para Turma</DialogTitle>
            <DialogDescription>
              {dispatchStep === 1 && "Passo 1: Selecione o grupo de destinatários."}
              {dispatchStep === 2 && "Passo 2: Escolha o template que deseja enviar."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {dispatchStep === 1 && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'ALL', label: 'Todos', count: metrics?.total || 0, icon: <Users className="size-4" />, color: 'blue' },
                  { id: 'APPROVED', label: 'Aprovados', count: metrics?.approved || 0, icon: <CheckCircle2 className="size-4" />, color: 'green' },
                  { id: 'REPROVED', label: 'Reprovados', count: metrics?.reproved || 0, icon: <AlertCircle className="size-4" />, color: 'red' },
                  { id: 'LIBERADO', label: 'Liberados', count: metrics?.released || 0, icon: <Unlock className="size-4" />, color: 'blue' },
                  { id: 'PENDING', label: 'Pendentes', count: metrics?.pending || 0, icon: <Target className="size-4" />, color: 'slate' },
                  { id: 'COOLDOWN', label: 'Em Cooldown', count: metrics?.cooldown || 0, icon: <Clock className="size-4" />, color: 'orange' },
                ].map(group => (
                  <button
                    key={group.id}
                    onClick={() => setDispatchFilter(group.id as any)}
                    className={`p-4 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${
                      dispatchFilter === group.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50 border-transparent bg-muted/30'
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-${group.color}-500/10 text-${group.color}-500`}>
                      {group.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm leading-tight">{group.label}</p>
                      <p className="text-2xl font-black mt-1">{group.count}</p>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Alunos</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {dispatchStep === 2 && (
              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                {TEMPLATES.map(t => {
                  const isSynced = Array.isArray(t.eventSlug)
                    ? t.eventSlug.every(slug => activeBindings.some(b => b.eventKey === slug && b.isActive))
                    : activeBindings.some(b => b.eventKey === t.eventSlug && b.isActive);
                  
                  return (
                    <button
                      key={t.slug}
                      onClick={() => setSelectedTemplate(t.slug)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all text-left flex flex-col gap-2 ${
                        selectedTemplate === t.slug ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50 border-transparent bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg ${selectedTemplate === t.slug ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          <Mail className="size-4" />
                        </div>
                        {isSynced ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] h-5">Vinculado</Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-[10px] h-5">Pendente</Badge>
                        )}
                      </div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {dispatchStep === 2 && (
              <Button variant="ghost" onClick={() => setDispatchStep(1)} disabled={isSending}>Anterior</Button>
            )}
            {dispatchStep === 1 ? (
              <Button onClick={() => setDispatchStep(2)} disabled={metrics?.total === 0}>Próximo</Button>
            ) : (
              <Button onClick={handleStartDispatch} disabled={!selectedTemplate || isSending} className="gap-2 min-w-[120px]">
                {isSending ? <Loader2 className="size-4 animate-spin" /> : <><Send className="size-4" /> Disparar</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                placeholder="Ex: Turma A - 2024"
                value={form.name}
                className="bg-muted/50"
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Input
                placeholder="Descrição opcional..."
                value={form.description}
                className="bg-muted/50"
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
