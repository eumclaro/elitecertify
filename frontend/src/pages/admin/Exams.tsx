import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Loader2,
  BookOpen,
  Settings,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  MoreVertical
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ExamRelease {
  id: string;
}

interface Exam {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  durationMinutes: number;
  passingScore: number;
  maxAttempts: number;
  cooldownDays: number;
  questionOrder: 'FIXED' | 'RANDOM';
  status: string;
  certificateTemplateId: string | null;
  releases: ExamRelease[];
  _count: { questions: number; attempts: number; releases: number };
  createdAt: string;
}

export default function Exams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<{id: string, name: string}[]>([]);
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);

  const [form, setForm] = useState({
    title: '', description: '',
    questionCount: 10, durationMinutes: 60, passingScore: 70,
    maxAttempts: 0, cooldownDays: 0, questionOrder: 'FIXED' as 'FIXED' | 'RANDOM',
    certificateTemplateId: null as string | null,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [resExams, resTpls] = await Promise.all([
        api.get('/exams', { params: { search } }),
        api.get('/certificate-templates')
      ]);
      setExams(resExams.data.data);
      setTemplates(resTpls.data);
    } catch (err) { console.error(err); toast.error("Erro ao carregar dados"); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [search]); // Depend on search here if we want but actually the original had loadExams in enter but search was manually triggered.

  // Restore the original behavior for search
  const triggerSearch = () => { loadData(); };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', questionCount: 10, durationMinutes: 60, passingScore: 70, maxAttempts: 0, cooldownDays: 0, questionOrder: 'FIXED', certificateTemplateId: null });
    setShowModal(true);
  };

  const openEdit = (exam: Exam) => {
    setEditing(exam);
    setForm({
      title: exam.title,
      description: exam.description || '',
      questionCount: exam.questionCount,
      durationMinutes: exam.durationMinutes,
      passingScore: exam.passingScore,
      maxAttempts: exam.maxAttempts,
      cooldownDays: exam.cooldownDays,
      questionOrder: exam.questionOrder as 'FIXED' | 'RANDOM',
      certificateTemplateId: exam.certificateTemplateId,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editing) {
        await api.put(`/exams/${editing.id}`, form);
        await api.patch(`/exams/${editing.id}/certificate-template`, {
          certificateTemplateId: form.certificateTemplateId
        });
        toast.success("Prova atualizada");
      } else {
        const res = await api.post('/exams', form);
        const newExamId = res.data.id || res.data._id || res.data.examId;
        if (newExamId) {
          await api.patch(`/exams/${newExamId}/certificate-template`, {
            certificateTemplateId: form.certificateTemplateId
          });
        }
        toast.success("Prova criada");
      }
      setShowModal(false);
      triggerSearch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar prova');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (exam: Exam) => {
    if (!confirm(`Excluir a prova "${exam.title}"?`)) return;
    try {
      await api.delete(`/exams/${exam.id}`);
      toast.success("Prova excluída");
      triggerSearch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir prova');
    }
  };

  const toggleStatus = async (exam: Exam) => {
    const newStatus = exam.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await api.put(`/exams/${exam.id}`, { status: newStatus });
      toast.success(newStatus === 'PUBLISHED' ? "Prova publicada" : "Prova movida para rascunho");
      triggerSearch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao alterar status');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1"><CheckCircle2 className="size-3" /> Publicada</Badge>;
      case 'DRAFT':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1"><Clock className="size-3" /> Rascunho</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><AlertCircle className="size-3" /> {status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provas</h1>
          <p className="text-muted-foreground">{exams.length} prova(s) cadastradas no sistema</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Nova Prova
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar provas..."
            className="pl-9 bg-muted/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
          />
        </div>
        <Button variant="secondary" onClick={triggerSearch}>Buscar</Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6">Título</TableHead>
                <TableHead>Liberações</TableHead>
                <TableHead>Questões</TableHead>
                <TableHead>Duração / Aprov.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : exams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                    Nenhuma prova encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                exams.map((e) => (
                  <TableRow key={e.id} className="hover:bg-muted/20 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-base group-hover:text-primary transition-colors">{e.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px] font-medium h-5">
                            {e.maxAttempts > 0 ? `${e.maxAttempts} tent.` : 'Ilimitado'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-medium h-5 border-dashed">
                             {e.cooldownDays}d CD
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="h-6 px-2 font-bold bg-blue-500/10 text-blue-600 border-blue-500/20">
                          {e._count.releases}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-[11px] font-bold uppercase tracking-wider gap-1"
                          onClick={() => navigate(`/admin/exams/${e.id}/releases`)}
                        >
                          Gerenciar <ArrowUpRight className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <span className={e._count.questions < e.questionCount ? "text-amber-600" : "text-green-600"}>
                          {e._count.questions}
                        </span>
                        <span className="text-muted-foreground">/ {e.questionCount}</span>
                        {e.questionOrder === 'RANDOM' && <div title="Aleatória"><Settings className="size-3 text-blue-500 rotate-45" /></div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 font-medium">
                        <div className="flex items-center gap-1.5 text-xs">
                           <Clock className="size-3 text-muted-foreground" /> {e.durationMinutes}m
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                           <CheckCircle2 className="size-3 text-muted-foreground" /> {e.passingScore}%
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(e.status)}</TableCell>
                    <TableCell className="text-right px-6">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="group-hover:bg-background">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => navigate(`/admin/exams/${e.id}/questions`)} className="gap-2">
                            <BookOpen className="size-4" /> Gerenciar Questões
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(e)} className="gap-2">
                            <Edit2 className="size-4" /> Editar Prova
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatus(e)} className="gap-2">
                            {e.status === 'PUBLISHED' ? (
                              <><Clock className="size-4" /> Mover para Rascunho</>
                            ) : (
                              <><CheckCircle2 className="size-4 text-green-500" /> Publicar Prova</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(e)} className="gap-2 text-destructive focus:text-destructive">
                            <Trash2 className="size-4" /> Excluir Prova
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Prova' : 'Nova Prova'}</DialogTitle>
            <DialogDescription>
              {editing ? `Editando as configurações da prova "${editing.title}"` : 'Crie uma nova prova de certificação definindo as regras básicas.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Ex: Certificação Master Nível 1" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Breve resumo da prova..." />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nº de Questões</Label>
                <Input type="number" value={form.questionCount} onChange={e => setForm({ ...form, questionCount: +e.target.value })} min={1} required />
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input type="number" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: +e.target.value })} min={1} required />
              </div>
              <div className="space-y-2">
                <Label>% Aprovação</Label>
                <Input type="number" value={form.passingScore} onChange={e => setForm({ ...form, passingScore: +e.target.value })} min={0} max={100} required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Máx. Tentativas</Label>
                <Input type="number" value={form.maxAttempts} onChange={e => setForm({ ...form, maxAttempts: +e.target.value })} min={0} required />
                <p className="text-[10px] text-muted-foreground leading-tight">0 = Ilimitado</p>
              </div>
              <div className="space-y-2">
                <Label>Cooldown (Dias)</Label>
                <Input type="number" value={form.cooldownDays} onChange={e => setForm({ ...form, cooldownDays: +e.target.value })} min={0} required />
                <p className="text-[10px] text-muted-foreground leading-tight">Bloqueio após falha</p>
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Select value={form.questionOrder} onValueChange={(v: any) => setForm({ ...form, questionOrder: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixa</SelectItem>
                    <SelectItem value="RANDOM">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template de Certificado</Label>
              <Select value={form.certificateTemplateId || "none"} onValueChange={(v) => setForm({ ...form, certificateTemplateId: v === "none" ? null : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum Template (Não emite certificado)</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editing ? 'Salvar Alterações' : 'Criar Prova'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
