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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  Mail, 
  School,
  ShieldCheck,
  Download,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Edit2,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

interface Student {
  id: string;
  cpf: string | null;
  phone: string | null;
  lastName: string;
  status: string;
  enrollmentDate: string;
  user: { id: string; name: string; email: string; active: boolean; lastLoginAt: string | null };
  classes: Array<{ class: { id: string; name: string } }>;
  cooldowns?: Array<{ endsAt: string }>;
  examAttempts?: Array<{ score: number; resultStatus: string; exam: { title: string } }>;
}

interface Cooldown {
  id: string;
  status: string;
  endsAt: string;
  examId: string;
  exam: { id: string; title: string };
}

interface ClassOption {
  id: string;
  name: string;
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Modal de Dados (CPF e Telefone)
  const [showDataModal, setShowDataModal] = useState(false);
  const [activeDataStudent, setActiveDataStudent] = useState<Student | null>(null);

  // Modal de Turmas (Classes)
  const [showClassesModal, setShowClassesModal] = useState(false);
  const [activeClassesStudent, setActiveClassesStudent] = useState<Student | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classSearch, setClassSearch] = useState('');
  const [savingClasses, setSavingClasses] = useState(false);


  // Cooldowns Modal
  const [showCooldownsModal, setShowCooldownsModal] = useState(false);
  const [cooldowns, setCooldowns] = useState<Cooldown[]>([]);
  
  // States for confirmation dialogs (using Shadcn Dialog)
  const [confirmCooldown, setConfirmCooldown] = useState<Cooldown | null>(null);
  const [confirmResend, setConfirmResend] = useState<Student | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  
  const [actionLoading, setActionLoading] = useState(false);

  // States for CSV Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({ name: '', lastName: '', email: '', password: '', cpf: '', phone: '' });
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // State for missing template warning
  const [showNoTemplateDialog, setShowNoTemplateDialog] = useState(false);

  const loadStudents = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/students', { params: { search, page, limit: 15 } });
      setStudents(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadClasses = async () => {
    try { const res = await api.get('/classes'); setClasses(res.data); } catch {}
  };

  useEffect(() => { loadClasses(); }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      // Don't search on initial empty load if we already loaded in the class effect? 
      // Actually, loading on mount is good.
      loadStudents(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);


  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', lastName: '', email: '', password: '', cpf: '', phone: '' });
    setShowModal(true);
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    setForm({
      name: student.user.name,
      lastName: student.lastName || '',
      email: student.user.email,
      password: '',
      cpf: student.cpf || '',
      phone: student.phone || '',
    });
    setNewPassword('');
    setShowPassword(false);
    setShowModal(true);
  };
  const openDataModal = (student: Student) => {
    setActiveDataStudent(student);
    setShowDataModal(true);
  };

  const openClassesModal = (student: Student) => {
    setActiveClassesStudent(student);
    setSelectedClassIds(student.classes.map(c => c.class.id));
    setClassSearch('');
    setShowClassesModal(true);
  };

  const saveClasses = async () => {
    if (!activeClassesStudent) return;
    setSavingClasses(true);
    try {
      await api.put(`/students/${activeClassesStudent.id}`, { classIds: selectedClassIds });
      setShowClassesModal(false);
      loadStudents(pagination.page);
      toast.success("Turmas atualizadas com sucesso!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao vincular turmas');
    } finally {
      setSavingClasses(false);
    }
  };

  const openCooldowns = async (student: Student) => {
    setShowCooldownsModal(true);
    try {
      const res = await api.get(`/students/${student.id}/cooldowns`);
      setCooldowns(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const executeClearCooldown = async () => {
    if (!confirmCooldown) return;
    setActionLoading(true);
    try {
      await api.put(`/exams/cooldowns/${confirmCooldown.id}/clear`);
      
      // Update local state for immediate UI feedback in the Cooldown Tab
      setStudents(prev => prev.map(s => {
        const studentId = (confirmCooldown as any).student?.id || (confirmCooldown as any).studentId;
        if (s.id === studentId) {
          return {
            ...s,
            cooldowns: s.cooldowns?.filter((c: any) => c.id !== confirmCooldown.id)
          };
        }
        return s;
      }));

      // Update local state for the modal (if open)
      setCooldowns(prev => prev.filter(c => c.id !== confirmCooldown.id));

      setConfirmCooldown(null);
      toast.success("Cooldown liberado com sucesso");
    } catch (err: any) {
      toast.error("Erro ao liberar cooldown. Tente novamente");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editing) {
        const payload: any = {
          name: form.name, 
          lastName: form.lastName, 
          email: form.email, 
          cpf: form.cpf || null, 
          phone: form.phone || null,
        };
        if (newPassword) {
          payload.password = newPassword;
        }
        await api.put(`/students/${editing.id}`, payload);
        toast.success("Alterações salvas com sucesso");
      } else {
        await api.post('/students', {
          name: form.name, lastName: form.lastName, email: form.email, password: form.password, cpf: form.cpf || null, phone: form.phone || null,
        });
        toast.success("Aluno criado com sucesso");
      }
      setShowModal(false);
      loadStudents(pagination.page);
    } catch (err: any) {
      toast.error("Erro ao salvar. Tente novamente");
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/students/${confirmDelete.id}`);
      setConfirmDelete(null);
      loadStudents(pagination.page);
      toast.success(`Aluno ${confirmDelete.user.name} excluído com sucesso.`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir aluno');
    }
  };
  
  const executeResendAccess = async () => {
    if (!confirmResend) return;
    setActionLoading(true);
    try {
      await api.post(`/students/${confirmResend.id}/resend-access`);
      setConfirmResend(null);
      toast.success(`E-mail de acesso para ${confirmResend.user.name} enviado com sucesso!`);
    } catch (err: any) {
      if (err.response?.status === 412 && err.response?.data?.error === 'TEMPLATE_NOT_CONFIGURED') {
        setConfirmResend(null);
        setShowNoTemplateDialog(true);
      } else {
        toast.error(err.response?.data?.error || 'Erro ao reenviar acesso');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alunos</h1>
          <p className="text-muted-foreground mt-1">
            Gestão total de {pagination.total} aluno(s) na plataforma.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Download className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Aluno
          </Button>
        </div>
      </div>

      <Tabs defaultValue="alunos" className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-muted/50 p-1 h-11 w-full md:w-auto">
            <TabsTrigger value="alunos" className="px-8 data-[state=active]:bg-background data-[state=active]:shadow-sm">Alunos</TabsTrigger>
            <TabsTrigger value="cooldown" className="px-8 data-[state=active]:bg-background data-[state=active]:shadow-sm">Cooldown</TabsTrigger>
          </TabsList>

          <div className="relative w-full md:max-w-md group">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoComplete="off"
              className="pl-11 h-11 bg-background border-2 border-muted hover:border-muted-foreground/20 focus-visible:border-primary focus-visible:ring-primary/20 transition-all rounded-xl shadow-sm"
            />
          </div>
        </div>

        <TabsContent value="alunos" className="space-y-4 outline-none">
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[30%] px-6">Nome</TableHead>
                    <TableHead className="w-[30%]">Email</TableHead>
                    <TableHead className="w-[20%]">WhatsApp</TableHead>
                    <TableHead className="text-right px-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={4} className="h-16">
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                           <Users className="size-8 opacity-20" />
                           <p>Nenhum aluno encontrado.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : students.map(s => (
                    <TableRow key={s.id} className="hover:bg-muted/30 transition-colors group">
                      <TableCell className="px-6">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {s.user.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-sm">{s.user.name} {s.lastName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{s.user.email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{s.phone || '-'}</span>
                      </TableCell>

                      <TableCell className="text-right px-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 px-3 gap-1 font-semibold">
                              Ações <ChevronDown className="size-3.5 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase opacity-40 px-3 py-1.5 tracking-wider">Gestão do Aluno</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDataModal(s)}>
                              <CreditCard className="mr-2 size-4" /> Dados Pessoais
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openClassesModal(s)}>
                              <School className="mr-2 size-4" /> Matricular
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCooldowns(s)}>
                              <ShieldCheck className="mr-2 size-4" /> Ver Cooldowns
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setConfirmResend(s)}>
                              <Mail className="mr-2 size-4" /> Reenviar Acesso
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(s)}>
                              <Edit2 className="mr-2 size-4" /> Editar Aluno
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setConfirmDelete(s)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 size-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-end gap-2 py-4">
               <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadStudents(pagination.page - 1)}
                disabled={pagination.page === 1}
               >
                 <ChevronLeft className="size-4 mr-1" /> Anterior
               </Button>
               <div className="text-sm font-medium">
                 Página {pagination.page} de {pagination.pages}
               </div>
               <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadStudents(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
               >
                  Próxima <ChevronRight className="size-4 ml-1" />
               </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cooldown" className="outline-none">
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">Aluno</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Prova</TableHead>
                    <TableHead>Bloqueado até</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right px-6">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.every(s => !s.cooldowns || s.cooldowns.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                        Nenhum bloqueio ativo no momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.flatMap(s => 
                      (s.cooldowns || []).map((c: any, i) => ({
                        ...c,
                        student: s,
                        key: `${s.id}-${i}`
                      }))
                    ).map(entry => (
                      <TableRow key={entry.key}>
                        <TableCell className="px-6 font-medium">{entry.student.user.name} {entry.student.lastName}</TableCell>
                        <TableCell className="text-muted-foreground">{entry.student.user.email}</TableCell>
                        <TableCell>{entry.exam?.title || 'Prova'}</TableCell>
                        <TableCell>{new Date(entry.endsAt).toLocaleDateString()} {new Date(entry.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell>
                          <Badge variant="warning" className="text-[10px]">Bloqueado</Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                           <Button size="sm" variant="destructive" onClick={() => setConfirmCooldown(entry)}>Liberar</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal CRUD (Create/Edit) */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Aluno' : 'Novo Aluno'}</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para {editing ? 'atualizar' : 'cadastrar'} o aluno.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Sobrenome *</Label>
                <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Senha *</Label>
                <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
            </div>

            {editing && (
              <>
                <div className="py-2">
                  <Separator className="bg-muted/60" />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-60">Segurança de Acesso</Label>
                  <div className="space-y-2 pt-1">
                    <Label>Nova Senha (opcional)</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        className="pl-10 pr-10"
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
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? (editing ? 'Salvando...' : 'Criando...') : (editing ? 'Salvar Alterações' : 'Criar Aluno')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Modal de Dados Complementares */}
      <Dialog open={showDataModal} onOpenChange={setShowDataModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Dados do Aluno</DialogTitle>
            <DialogDescription>Informações detalhadas de cadastro.</DialogDescription>
          </DialogHeader>
          {activeDataStudent && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Nome</p>
                  <p className="text-sm font-semibold">{activeDataStudent.user.name} {activeDataStudent.lastName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Email</p>
                  <p className="text-sm">{activeDataStudent.user.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">CPF</p>
                  <p className="text-sm">{activeDataStudent.cpf || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Telefone</p>
                  <p className="text-sm">{activeDataStudent.phone || '-'}</p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <p className="text-sm font-bold">Acesso do Aluno</p>
                     <p className="text-xs text-muted-foreground">Forçar geração de nova senha.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setConfirmResend(activeDataStudent); setShowDataModal(false); }}>
                    Reenviar E-mail
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setShowDataModal(false)} className="w-full">Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Gestão de Turmas */}
      <Dialog open={showClassesModal} onOpenChange={setShowClassesModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Vincular Turmas</DialogTitle>
            <DialogDescription>Gerencie as turmas as quais este aluno pertence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
             {activeClassesStudent && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                   <p className="text-xs font-bold text-primary uppercase opacity-60">Aluno Selecionado</p>
                   <p className="text-lg font-bold">{activeClassesStudent.user.name}</p>
                   <p className="text-sm text-muted-foreground">{activeClassesStudent.user.email}</p>
                </div>
             )}

             <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center justify-between">
                  Turmas Vinculadas 
                  <Badge variant="default" className="h-5">{selectedClassIds.length}</Badge>
                </h4>
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                   {selectedClassIds.map(id => {
                     const c = classes.find((cls: any) => cls.id === id);
                     return (
                       <Badge key={id} variant="secondary" className="px-3 py-1 gap-1 border">
                         {c?.name}
                         <button onClick={() => setSelectedClassIds(prev => prev.filter(i => i !== id))} className="ml-1 hover:text-destructive transition-colors">✕</button>
                       </Badge>
                     );
                   })}
                   {selectedClassIds.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhuma turma vinculada.</p>}
                </div>
             </div>

             <div className="space-y-3">
                <Label>Adicionar Nova Turma</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 opacity-50" />
                  <Input 
                    placeholder="Filtrar turmas..." 
                    value={classSearch} 
                    onChange={e => setClassSearch(e.target.value)} 
                    className="pl-10"
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto border rounded-xl divide-y">
                   {classes
                    .filter((c: any) => !selectedClassIds.includes(c.id))
                    .filter((c: any) => c.name.toLowerCase().includes(classSearch.toLowerCase()))
                    .map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                        <span className="text-sm font-medium">{c.name}</span>
                        <Button size="sm" variant="ghost" className="text-primary hover:text-primary h-8" onClick={() => { setSelectedClassIds([...selectedClassIds, c.id]); setClassSearch(''); }}>
                          <Plus className="size-4 mr-1" /> Adicionar
                        </Button>
                      </div>
                    ))
                   }
                </div>
             </div>

             <DialogFooter>
                <Button variant="ghost" onClick={() => setShowClassesModal(false)} disabled={savingClasses}>Cancelar</Button>
                <Button onClick={saveClasses} disabled={savingClasses}>
                  {savingClasses && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Salvar Alterações
                </Button>
             </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>


      {/* Modal Cooldowns */}
      <Dialog open={showCooldownsModal} onOpenChange={setShowCooldownsModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Gestão de Cooldowns</DialogTitle>
            <DialogDescription>Libere o aluno para refazer provas bloqueadas.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {cooldowns.length === 0 ? (
               <div className="h-40 flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-xl gap-2">
                  <ShieldCheck className="size-8 opacity-20" />
                  <p>Este aluno não possui bloqueios ativos.</p>
               </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Prova</TableHead>
                      <TableHead>Liberação</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cooldowns.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold">{c.exam.title}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(c.endsAt).toLocaleDateString()} às {new Date(c.endsAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="destructive" onClick={() => setConfirmCooldown(c)}>Liberar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowCooldownsModal(false)} className="w-full">Fechar</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Importação em Massa</DialogTitle>
            <DialogDescription>Carregue um arquivo CSV para cadastrar múltiplos alunos.</DialogDescription>
          </DialogHeader>
          
          {!importResults ? (
            <form onSubmit={async (e: any) => {
              e.preventDefault();
              const file = e.target.file.files[0];
              if (!file) return;
              setImportLoading(true);
              try {
                const text = await file.text();
                const lines = text.split('\n');
                const studentsData = [];
                const headerLine = lines[0].toLowerCase();
                const delimiter = headerLine.includes(';') ? ';' : ',';
                const headers = headerLine.split(delimiter).map((h: string) => h.trim());
                
                const idxNome = headers.findIndex((h: string) => h.includes('nome'));
                const idxEmail = headers.findIndex((h: string) => h.includes('email'));
                const idxSobrenome = headers.findIndex((h: string) => h.includes('sobrenome') || h.includes('last name') || h.includes('lastname'));
                const idxSenha = headers.findIndex((h: string) => h.includes('senha'));
                const idxCpf = headers.findIndex((h: string) => h.includes('cpf'));
                const idxTelefone = headers.findIndex((h: string) => h.includes('telefone') || h.includes('celular'));
                const idxTurma = headers.findIndex((h: string) => h.includes('turma') || h.includes('class'));

                if (idxNome === -1 || idxEmail === -1) throw new Error('Colunas "Nome" e "Email" são obrigatórias.');

                for (let i = 1; i < lines.length; i++) {
                  if (!lines[i].trim()) continue;
                  const cols = lines[i].split(delimiter).map((c: string) => c.trim().replace(/^"|"$/g, ''));
                  studentsData.push({
                    name: cols[idxNome],
                    sobrenome: idxSobrenome !== -1 && cols[idxSobrenome] ? cols[idxSobrenome] : '',
                    email: cols[idxEmail],
                    password: idxSenha !== -1 && cols[idxSenha] ? cols[idxSenha] : '',
                    cpf: idxCpf !== -1 && cols[idxCpf] ? cols[idxCpf] : '',
                    phone: idxTelefone !== -1 && cols[idxTelefone] ? cols[idxTelefone] : '',
                    className: idxTurma !== -1 && cols[idxTurma] ? cols[idxTurma] : ''
                  });
                }
                const { data } = await api.post('/students/import', { students: studentsData });
                setImportResults(data);
                if (data.success > 0) loadStudents(pagination.page);
              } catch (err: any) { toast.error(err.message); }
              finally { setImportLoading(false); }
            }} className="space-y-6 pt-4">
              <div className="p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-primary/50 transition-colors group relative">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Download className="size-6" />
                </div>
                <div className="text-center">
                   <p className="text-sm font-semibold">Arraste seu CSV aqui</p>
                   <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
                </div>
                <Input type="file" name="file" accept=".csv" required className="cursor-pointer opacity-0 absolute inset-0 w-full h-full" disabled={importLoading} />
              </div>
              <div className="flex justify-between items-center">
                <Button type="button" variant="link" size="sm" onClick={() => {
                   const csvTemplate = "nome,sobrenome,email,senha,cpf,telefone,turma\nJoao,Silva,joao@email.com,,12345678909,11999999999,Turma A";
                   const blob = new Blob([csvTemplate], { type: 'text/csv' });
                   const url = window.URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = "modelo_alunos.csv";
                   a.click();
                }}>Baixar Modelo</Button>
                <div className="flex gap-2">
                   <Button type="button" variant="ghost" onClick={() => setShowImportModal(false)}>Cancelar</Button>
                   <Button type="submit" disabled={importLoading}>
                     {importLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Importar"}
                   </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6 pt-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-success/5 text-center">
                    <p className="text-2xl font-bold text-success">{importResults.success}</p>
                    <p className="text-[10px] uppercase font-bold opacity-60">Sucesso</p>
                  </div>
                  <div className="p-4 rounded-xl border bg-destructive/5 text-center">
                    <p className="text-2xl font-bold text-destructive">{importResults.errors}</p>
                    <p className="text-[10px] uppercase font-bold opacity-60">Falhas</p>
                  </div>
               </div>
               <DialogFooter>
                 <Button onClick={() => { setShowImportModal(false); setImportResults(null); }} className="w-full">Concluído</Button>
               </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialogs */}
      <Dialog open={!!confirmCooldown} onOpenChange={() => setConfirmCooldown(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Liberar Prova?</DialogTitle>
            <DialogDescription>O tempo de espera será zerado para este aluno.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmCooldown(null)} disabled={actionLoading}>Cancelar</Button>
            <Button variant="destructive" onClick={executeClearCooldown} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {actionLoading ? 'Liberando...' : 'Confirmar Liberação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmResend} onOpenChange={() => setConfirmResend(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5 text-primary" /> Reenviar Acesso
            </DialogTitle>
            <DialogDescription>
              Uma nova senha será gerada e enviada para o e-mail do aluno.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl">
             <p className="text-xs text-warning-foreground font-medium leading-relaxed">
               <strong>Atenção:</strong> A senha anterior deixará de funcionar imediatamente. Certifique-se de que o aluno solicitou esta ação.
             </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmResend(null)} disabled={actionLoading}>Cancelar</Button>
            <Button onClick={executeResendAccess} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : "Reenviar Agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir Aluno?</DialogTitle>
            <DialogDescription>Esta ação é irreversível e apagará todo o histórico.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={executeDelete}>Excluir permanentemente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal de Alerta de Template Não Configurado */}
      <Dialog open={showNoTemplateDialog} onOpenChange={setShowNoTemplateDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-5" /> Atenção
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 font-bold">Template não configurado</AlertTitle>
              <AlertDescription className="text-amber-700 text-xs">
                O evento <strong>STUDENT_CREATED</strong> não possui um template de e-mail vinculado ou ativo no momento.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setShowNoTemplateDialog(false)} className="sm:flex-1">
              Fechar
            </Button>
            <Button 
              onClick={() => {
                setShowNoTemplateDialog(false);
                window.location.href = '/admin/emails';
              }} 
              className="sm:flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              Configurar Templates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
