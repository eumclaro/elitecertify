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
  ArrowLeft,
  Mail,
  ArrowUpRight,
  FileJson,
  Unlock,
  Send
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
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { usePermission } from '../../hooks/usePermission';

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
  const [view, setView] = useState<'list' | 'manage'>('list');
  const { hasPermission } = usePermission();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [classSearch, setClassSearch] = useState('');

  // Manage Class View State
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classData, setClassData] = useState<{name: string, description: string} | null>(null);
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [metrics, setMetrics] = useState<ClassMetrics | null>(null);
  const [loadingManage, setLoadingManage] = useState(false);
  const [releases, setReleases] = useState<any[]>([]);
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  
  // Link Exam State
  const [examToLink, setExamToLink] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentPerformance | null>(null);
  const [dispatchFilter, setDispatchFilter] = useState<'ALL' | 'APPROVED' | 'REPROVED' | 'LIBERADO' | 'PENDING' | 'COOLDOWN'>('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [activeBindings, setActiveBindings] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);

  const setDispatchStep = (_step: number) => {}; // No longer needed but keeping for minimal JSX change if still referenced

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
    } catch (err: any) {
      console.error(err);
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
    if (!confirm("Remover o vínculo desta prova com a turma?")) return;
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
    } catch (err: any) {
      toast.error("Erro ao liberar cooldown");
    }
  };

  const handleDispatch = async () => {
    if (!selectedTemplate) return toast.error("Selecione um template");
    setIsSending(true);
    try {
      const payload = {
        templateId: selectedTemplate,
        classId: selectedClassId,
        studentId: selectedStudent?.id || null,
        filter: selectedStudent ? 'SINGLE' : dispatchFilter
      };
      await api.post('/email-templates/dispatch', payload);
      toast.success("Disparo iniciado com sucesso!");
      setIsDispatchOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao realizar disparo");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {view === 'list' ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Turmas</h1>
              <p className="text-muted-foreground mt-1">Gerencie grupos de alunos e liberação de provas.</p>
            </div>
            {hasPermission('canCreate') && (
              <Button onClick={openNew} className="gap-2 px-6">
                <Plus className="size-4" /> Nova Turma
              </Button>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2">
            <div className="relative flex-1 max-w-sm group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Buscar turmas..."
                className="pl-10 h-11 bg-background shadow-sm border-2 focus-visible:ring-primary/20"
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 py-4">Nome</TableHead>
                  <TableHead className="px-6">Descrição</TableHead>
                  <TableHead className="px-6">Alunos</TableHead>
                  <TableHead className="px-6">Criada em</TableHead>
                  <TableHead className="w-20 px-6 text-right">Ações</TableHead>
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
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors group">
                      <TableCell className="px-6">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                onClick={() => handleManageClass(c.id)}
                                className="font-bold text-blue-600 hover:text-blue-700 hover:underline text-left cursor-pointer transition-all"
                              >
                                {c.name}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Clique para gerenciar</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate px-6">{c.description || '-'}</TableCell>
                      <TableCell className="px-6">
                        <Badge variant="secondary" className="gap-1 font-bold">
                          <Users className="size-3" /> {c._count.students}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-6">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="px-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:bg-muted-foreground/10 h-8 w-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleManageClass(c.id)} className="gap-2 font-medium">
                              <Target className="size-4" /> Gerenciar
                            </DropdownMenuItem>
                            {hasPermission('canEdit') && (
                              <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2 font-medium">
                                <Edit2 className="size-4" /> Editar
                              </DropdownMenuItem>
                            )}
                            {hasPermission('canDelete') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(c.id)} className="gap-2 font-medium text-destructive focus:text-destructive">
                                  <Trash2 className="size-4" /> Excluir
                                </DropdownMenuItem>
                              </>
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
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={handleBackToList} className="gap-2 -ml-2 hover:bg-muted font-bold text-muted-foreground">
                  <ArrowLeft className="size-4" /> Voltar
                </Button>
                <div className="h-6 w-px bg-border" />
                <h1 className="text-2xl font-bold tracking-tight">{classData?.name}</h1>
             </div>
             {hasPermission('canSendEmails') && (
               <Button onClick={() => { setSelectedStudent(null); setDispatchStep(1); setIsDispatchOpen(true); fetchBindings(); }} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Mail className="size-4" /> Disparo em Massa
               </Button>
             )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg shadow-inner"><Users className="size-5" /></div>
                <div><p className="text-[10px] text-blue-600 uppercase font-black tracking-wider">Total</p><p className="text-2xl font-black text-blue-700">{metrics?.total || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="bg-green-50/50 border-green-100 shadow-sm">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-green-500/10 text-green-600 rounded-lg shadow-inner"><CheckCircle2 className="size-5" /></div>
                <div><p className="text-[10px] text-green-600 uppercase font-black tracking-wider">Aprov.</p><p className="text-2xl font-black text-green-700">{metrics?.approved || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="bg-red-50/50 border-red-100 shadow-sm">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-red-500/10 text-red-600 rounded-lg shadow-inner"><AlertCircle className="size-5" /></div>
                <div><p className="text-[10px] text-red-600 uppercase font-black tracking-wider">Reprov.</p><p className="text-2xl font-black text-red-700">{metrics?.reproved || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50/50 border-amber-100 shadow-sm">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg shadow-inner"><Clock className="size-5" /></div>
                <div><p className="text-[10px] text-amber-600 uppercase font-black tracking-wider">Cooldown</p><p className="text-2xl font-black text-amber-700">{metrics?.cooldown || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50/50 border-purple-100 shadow-sm">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg shadow-inner"><Target className="size-5" /></div>
                <div><p className="text-[10px] text-purple-600 uppercase font-black tracking-wider">Liberado</p><p className="text-2xl font-black text-purple-700">{metrics?.released || 0}</p></div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            <Card className="md:col-span-1 h-full shadow-sm border-none bg-muted/20">
              <CardHeader className="p-4 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ArrowUpRight className="size-4 text-blue-500" /> Provas Vinculadas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {hasPermission('canEdit') && (
                  <div className="p-3 bg-background rounded-xl border-2 border-dashed space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-60">Liberar Prova para Turma</p>
                    <div className="flex gap-2">
                      <Select value={examToLink} onValueChange={setExamToLink}>
                        <SelectTrigger className="bg-muted/30 h-10 border-none">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableExams.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" onClick={handleLinkExam} disabled={isLinking} className="shrink-0 bg-primary/20 text-primary hover:bg-primary/30 border-none shadow-none">
                        {isLinking ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                   {releases.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                        <FileJson className="size-8 opacity-20" />
                        <p className="text-xs italic">Nenhuma prova vinculada.</p>
                      </div>
                   ) : (
                     <div className="grid gap-2">
                        {releases.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between p-3 bg-background border rounded-xl hover:shadow-md transition-all group overflow-hidden relative">
                             <div className="flex flex-col min-w-0 mr-8">
                               <span className="text-sm font-bold truncate block">{r.exam.title}</span>
                               <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                             </div>
                             {hasPermission('canEdit') && (
                               <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-1 top-1/2 -translate-y-1/2 size-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                onClick={() => handleUnlinkExam(r.examId, r.id)}
                               >
                                <Trash2 className="size-3.5" />
                               </Button>
                             )}
                          </div>
                        ))}
                     </div>
                   )}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3 shadow-md border-none overflow-hidden">
               <CardHeader className="p-4 border-b flex flex-row items-center justify-between pb-4">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Users className="size-4 text-primary" /> Desempenho dos Alunos
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Status atualizado de progresso nas provas vinculadas.</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <Badge variant="outline" className="h-6 font-bold bg-muted/50">{students.length} Total</Badge>
                  </div>
               </CardHeader>
               <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-none">
                          <TableHead className="px-6 py-3 font-black text-[10px] uppercase tracking-widest text-muted-foreground/80">Aluno</TableHead>
                          <TableHead className="py-3 font-black text-[10px] uppercase tracking-widest text-muted-foreground/80">Status</TableHead>
                          <TableHead className="py-3 font-black text-[10px] uppercase tracking-widest text-muted-foreground/80 text-center">Nota (%)</TableHead>
                          <TableHead className="py-3 font-black text-[10px] uppercase tracking-widest text-muted-foreground/80 text-center">Tentativas</TableHead>
                          <TableHead className="py-3 font-black text-[10px] uppercase tracking-widest text-muted-foreground/80">Última Atividade</TableHead>
                          <TableHead className="px-6 py-3 font-black text-[10px] uppercase tracking-widest text-muted-foreground/80 text-right">Manutenção</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingManage ? (
                           <TableRow><TableCell colSpan={6} className="h-64 text-center"><Loader2 className="size-8 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                        ) : students.length === 0 ? (
                           <TableRow><TableCell colSpan={6} className="h-64 text-center text-muted-foreground">Turma vazia ou sem alunos matriculados.</TableCell></TableRow>
                        ) : (
                          students.map(s => (
                            <TableRow key={s.id} className="hover:bg-muted/20 transition-colors border-b last:border-none group">
                              <TableCell className="px-6 py-4">
                                <Link to={`/admin/students/${s.id}`} className="font-bold text-sm text-primary hover:underline">{s.name}</Link>
                                <p className="text-[11px] text-muted-foreground">{s.email}</p>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {s.status === 'APROVADO' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Aprovado</Badge>}
                                  {s.status === 'REPROVADO' && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Reprovado</Badge>}
                                  {s.status === 'PENDENTE' && <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200">Sem Vínculo</Badge>}
                                  {s.status === 'LIBERADO' && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Pendente</Badge>}
                                  {s.status === 'COOLDOWN' && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 cursor-help gap-1">
                                            <Clock className="size-3" /> Bloqueado
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>Liberado em: {s.cooldownUntil && new Date(s.cooldownUntil).toLocaleString()}</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-mono font-black text-sm">{s.grade === null ? '-' : `${s.grade}%`}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm font-medium">{s.attempts}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                   <span className="text-xs text-muted-foreground">{s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : 'Nunca'}</span>
                                   {s.lastActivity && <span className="text-[10px] text-muted-foreground/60">{new Date(s.lastActivity).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>}
                                </div>
                              </TableCell>
                              <TableCell className="px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {s.cooldownUntil && hasPermission('canDelete') && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="size-8 text-amber-600 hover:bg-amber-100 hover:text-amber-700 rounded-full"
                                            onClick={() => s.cooldownId && handleClearCooldown(s.id, s.cooldownId)}
                                          >
                                            <Unlock className="size-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Liberar Aluno Agora</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  
                                  {hasPermission('canSendEmails') && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="size-8 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-full"
                                            onClick={() => { setSelectedStudent(s); setDispatchStep(1); setIsDispatchOpen(true); fetchBindings(); }}
                                          >
                                            <Send className="size-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Enviar Comunicação Direta</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
               </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* CRUD Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
            <DialogDescription>
              As informações da turma são usadas para organizar alunos e emitir relatórios.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome da Turma</Label>
              <Input 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                placeholder="Ex: Turma Elite Março 2024"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (Opcional)</Label>
              <Input 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                placeholder="Ex: Alunos de graduação em segurança"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white font-bold">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Salvar Alterações' : 'Criar Turma'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dispatch Modal */}
      <Dialog open={isDispatchOpen} onOpenChange={setIsDispatchOpen}>
        <DialogContent className="sm:max-w-lg overflow-hidden p-0">
          <div className="p-5 bg-gradient-to-br from-primary/5 to-transparent border-b flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="p-2 bg-primary/10 text-primary rounded-lg"><Mail className="size-5" /></div>
                <h3 className="text-xl font-black tracking-tight">Disparar Comunicação</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedStudent
                  ? `Enviar e-mail personalizado diretamente para ${selectedStudent.name}.`
                  : `Disparar e-mail para alunos da turma ${classData?.name} com base em filtros.`
                }
              </p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {!selectedStudent && (
              <div className="space-y-3">
                {/* Contadores */}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold">
                  {([
                    { label: 'Total', count: students.length, filter: 'ALL' },
                    { label: 'Aprovados', count: students.filter(s => s.status === 'APROVADO').length, filter: 'APPROVED' },
                    { label: 'Reprovados', count: students.filter(s => s.status === 'REPROVADO').length, filter: 'REPROVED' },
                    { label: 'Bloqueados', count: students.filter(s => s.status === 'COOLDOWN').length, filter: 'COOLDOWN' },
                    { label: 'Pendentes', count: students.filter(s => s.status === 'LIBERADO').length, filter: 'LIBERADO' },
                    { label: 'Sem vínculo', count: students.filter(s => s.status === 'PENDENTE').length, filter: 'PENDING' },
                  ] as const).map(({ label, count, filter }) => (
                    <div
                      key={filter}
                      onClick={() => setDispatchFilter(filter)}
                      className={`cursor-pointer rounded-xl border-2 py-2 px-1 transition-all select-none ${dispatchFilter === filter ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted hover:border-muted-foreground/30'}`}
                    >
                      <div className={`text-xl font-black leading-none ${dispatchFilter === filter ? 'text-primary' : 'text-foreground'}`}>{count}</div>
                      <div className="text-muted-foreground mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Template de E-mail</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="h-11 border-2 bg-background font-medium">
                  <SelectValue placeholder="Selecione o template..." />
                </SelectTrigger>
                <SelectContent>
                  {activeBindings.filter(b => b?.internalTemplate?.name).map(b => (
                    <SelectItem key={b.internalTemplateId} value={b.internalTemplateId} className="py-2">
                      <div className="flex flex-col">
                        <span className="font-bold">{b.internalTemplate.name}</span>
                        <span className="text-[10px] text-muted-foreground">Gatilho: {b.eventKey}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] bg-amber-50 text-amber-700 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                <AlertCircle className="size-3 shrink-0" />
                <strong>Aviso:</strong> Confirme que o template possui as Merge Tags adequadas para o evento.
              </p>
            </div>

            <Button
              onClick={handleDispatch}
              disabled={isSending || !selectedTemplate}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black text-base gap-3 shadow-md shadow-primary/20 rounded-xl group"
            >
              {isSending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>Disparar Agora <Send className="size-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
