import { useState, useEffect } from 'react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { 
  Send, 
  Mail, 
  Users, 
  History, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Search,
  School,
} from "lucide-react";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface Template {
  slug: string;
  name: string;
  description: string;
  eventSlug: string | string[];
}

const TEMPLATES: Template[] = [
  { slug: 'welcome', name: 'Boas-vindas', description: 'Enviado ao criar um novo aluno', eventSlug: 'STUDENT_CREATED' },
  { slug: 'password-reset', name: 'Recuperação de Senha', description: 'Instruções para reset de senha', eventSlug: 'AUTH_PASSWORD_RESET' },
  { slug: 'exam-available', name: 'Prova Disponível', description: 'Notifica que uma nova prova foi liberada', eventSlug: 'EXAM_RELEASED' },
  { slug: 'exam-result', name: 'Resultado de Prova', description: 'Envia a nota e status após conclusão', eventSlug: ['EXAM_PASSED', 'EXAM_FAILED'] },
  { slug: 'cooldown-released', name: 'Cooldown Liberado', description: 'Avisa que o aluno pode refazer a prova', eventSlug: 'COOLDOWN_RELEASED' },
  { slug: 'new-class', name: 'Nova Turma', description: 'Notifica entrada em uma nova turma', eventSlug: 'EXAM_RELEASED' },
  { slug: 'retake-reminder', name: 'Lembrete de Refação', description: 'Lembrete para provas pendentes', eventSlug: 'EXAM_DEADLINE_REMINDER' },
  { slug: 'congratulations', name: 'Parabéns!', description: 'Enviado após aprovação com certificado', eventSlug: 'CERTIFICATE_AVAILABLE' },
];

export default function Dispatches() {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);

  // Form State
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [recipientGroup, setRecipientGroup] = useState<'import' | 'turma' | 'manual' | 'not-attempted' | 'release'>('manual');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New State for Enhancements
  const [activeBindings, setActiveBindings] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [recipientPreview, setRecipientPreview] = useState<any[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    fetchHistory();
    fetchInitialData();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/dispatches');
      setDispatches(response.data);
    } catch (error) {
      console.error('Fetch history error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [classesRes, studentsRes, bindingsRes, examsRes] = await Promise.all([
        api.get('/classes'),
        api.get('/students?limit=999'),
        api.get('/email-templates/bindings'),
        api.get('/dispatches/exams-with-releases')
      ]);
      setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
      setStudents(studentsRes.data?.data || []);
      setActiveBindings(bindingsRes.data || []);
      setExams(examsRes.data);
    } catch (error) {
      console.error('Fetch data error:', error);
    }
  };

  const handleResolveRecipients = async () => {
    if (!recipientGroup || recipientGroup === 'import') return;
    
    // Manual already has selectedStudentIds
    if (recipientGroup === 'manual') {
      const selected = students.filter(s => selectedStudentIds.includes(s.id));
      setRecipientPreview(selected);
      return;
    }

    // Turma (legacy simple)
    if (recipientGroup === 'turma' && selectedClassId) {
      const selected = students.filter(s => s.classes?.some((c: any) => c.classId === selectedClassId));
      setRecipientPreview(selected);
      return;
    }

    // Advanced Filters
    setIsResolving(true);
    try {
      const filterType = recipientGroup === 'not-attempted' ? 'NOT_ATTEMPTED' : 'RELEASE_SPECIFIC';
      const response = await api.post('/dispatches/recipients/resolve', {
        type: filterType,
        classId: selectedClassId,
        examId: selectedExamId,
        releaseId: selectedReleaseId
      });
      setRecipientPreview(response.data.students);
      setSelectedStudentIds(response.data.students.map((s: any) => s.id));
    } catch (error) {
      toast.error('Erro ao resolver lista de destinatários');
    } finally {
      setIsResolving(false);
    }
  };

  const handleStartDispatch = async () => {
    if (!selectedTemplate) return toast.error('Selecione um template');
    if (recipientGroup === 'turma' && !selectedClassId) return toast.error('Selecione uma turma');
    if (recipientGroup === 'manual' && selectedStudentIds.length === 0) return toast.error('Selecione pelo menos um aluno');

    setStep(3);
    setSending(true);
    setProgress(10);

    try {
      const payload = {
        templateSlug: selectedTemplate,
        recipientGroup,
        recipientIds: (recipientGroup === 'manual' || !!recipientPreview.length) ? selectedStudentIds : [],
        classId: recipientGroup === 'turma' ? selectedClassId : undefined
      };

      await api.post('/dispatches', payload);
      setProgress(100);
      toast.success('Disparo concluído com sucesso!');
      fetchHistory();
      setTimeout(() => {
        setIsWizardOpen(false);
        resetForm();
      }, 2000);
    } catch (error) {
      console.error('Dispatch error:', error);
      toast.error('Erro ao realizar disparo');
      setSending(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedTemplate('');
    setRecipientGroup('manual');
    setSelectedClassId('');
    setSelectedExamId('');
    setSelectedReleaseId('');
    setSelectedStudentIds([]);
    setRecipientPreview([]);
    setSearchTerm('');
    setSending(false);
    setProgress(0);
  };

  const filteredStudents = students.filter(s => 
    s.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disparos de E-mail</h1>
          <p className="text-muted-foreground">Gerencie envios em massa e acompanhe o histórico de comunicações.</p>
        </div>
        <Button onClick={() => setIsWizardOpen(true)} className="gap-2">
          <Plus className="size-4" />
          Novo Disparo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
            <Send className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Enviados</p>
            <p className="text-2xl font-bold">{dispatches.reduce((acc, d) => acc + d.successCount, 0)}</p>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-green-500/10 text-green-500 rounded-lg">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sucesso</p>
            <p className="text-2xl font-bold">{dispatches.reduce((acc, d) => acc + d.successCount, 0)}</p>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Falhas</p>
            <p className="text-2xl font-bold">{dispatches.reduce((acc, d) => acc + d.errorCount, 0)}</p>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 text-orange-500 rounded-lg">
            <History className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lotes Processados</p>
            <p className="text-2xl font-bold">{dispatches.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h2 className="font-semibold">Histórico de Disparos</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Destinatários</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : dispatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum disparo realizado ainda.</TableCell>
              </TableRow>
            ) : (
              dispatches.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-blue-500">{TEMPLATES.find(t => t.slug === d.templateSlug)?.name || d.templateSlug}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{d.templateSlug}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit">{d.recipientGroup === 'turma' ? 'Turma' : d.recipientGroup === 'manual' ? 'Manual' : 'Importação'}</Badge>
                      <span className="text-xs text-muted-foreground">{d.successCount} enviados / {d.totalCount} total</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {d.status === 'COMPLETED' ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Concluído</Badge>
                    ) : d.status === 'PARTIAL' ? (
                      <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Parcial</Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Erro</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(d.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isWizardOpen} onOpenChange={(open) => !sending && setIsWizardOpen(open)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Novo Disparo em Massa</DialogTitle>
            <DialogDescription>
              {step === 1 && "Escolha o template que deseja enviar."}
              {step === 2 && "Selecione quem deve receber este e-mail."}
              {step === 3 && "Processando envio dos e-mails..."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {step === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((template) => {
                    const isSynced = Array.isArray(template.eventSlug)
                      ? template.eventSlug.every(slug => activeBindings.some(b => b.eventKey === slug && b.isActive))
                      : activeBindings.some(b => b.eventKey === template.eventSlug && b.isActive);

                    return (
                      <div
                        key={template.slug}
                        onClick={() => setSelectedTemplate(template.slug)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all hover:bg-muted/50 ${
                          selectedTemplate === template.slug ? 'border-primary ring-1 ring-primary bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${selectedTemplate === template.slug ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                              <Mail className="size-4" />
                            </div>
                            <span className="font-semibold text-sm">{template.name}</span>
                          </div>
                          {isSynced && <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">Vinculado</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{template.description}</p>
                        <div className="flex items-center gap-1">
                           {isSynced ? (
                             <span className="text-[10px] text-green-600 flex items-center gap-1 font-medium"><CheckCircle2 className="size-3" /> Pronto</span>
                           ) : (
                             <span className="text-[10px] text-amber-600 flex items-center gap-1 font-medium"><AlertCircle className="size-3" /> Sem vínculo</span>
                           )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedTemplate && (() => {
                  const template = TEMPLATES.find(t => t.slug === selectedTemplate);
                  if (!template) return null;

                  const missingEvents = Array.isArray(template.eventSlug)
                    ? template.eventSlug.filter(slug => !activeBindings.some(b => b.eventKey === slug && b.isActive))
                    : (!activeBindings.some(b => b.eventKey === template.eventSlug && b.isActive) ? [template.eventSlug] : []);

                  if (missingEvents.length > 0) {
                    return (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800">Vínculo Pendente</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          {template.slug === 'exam-result' ? (
                            <span>Faltam os eventos: <strong>{missingEvents.join(' e ')}</strong>. </span>
                          ) : (
                            <span>Este template não possui um evento de sistema vinculado. </span>
                          )}
                          Configure o vínculo na tela de 
                          <Link to="/admin/emails" className="font-bold underline ml-1 text-amber-900 hover:text-amber-950">E-mails Transacionais</Link>.
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={recipientGroup === 'manual' ? 'default' : 'outline'}
                      onClick={() => { setRecipientGroup('manual'); setRecipientPreview([]); }}
                      size="sm"
                      className="gap-2"
                    >
                      <Users className="size-3" /> Manual
                    </Button>
                    <Button
                      variant={recipientGroup === 'turma' ? 'default' : 'outline'}
                      onClick={() => { setRecipientGroup('turma'); setRecipientPreview([]); }}
                      size="sm"
                      className="gap-2"
                    >
                      <School className="size-3" /> Turma
                    </Button>
                    <Button
                      variant={recipientGroup === 'not-attempted' ? 'default' : 'outline'}
                      onClick={() => { setRecipientGroup('not-attempted'); setRecipientPreview([]); }}
                      size="sm"
                      className="gap-2"
                    >
                      <AlertCircle className="size-3" /> Filtro A (Pendentes)
                    </Button>
                    <Button
                      variant={recipientGroup === 'release' ? 'default' : 'outline'}
                      onClick={() => { setRecipientGroup('release'); setRecipientPreview([]); }}
                      size="sm"
                      className="gap-2"
                    >
                      <Clock className="size-3" /> Filtro B (Liberação)
                    </Button>
                  </div>
                </div>

                {recipientGroup === 'turma' && (
                  <div className="space-y-3">
                    <Label>Selecione a Turma</Label>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha uma turma..." />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {recipientGroup === 'manual' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <Label>Selecionar Alunos ({selectedStudentIds.length})</Label>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0"
                        onClick={() => setSelectedStudentIds(selectedStudentIds.length === filteredStudents.length ? [] : filteredStudents.map(s => s.id))}
                      >
                        {selectedStudentIds.length === filteredStudents.length ? 'Deselecionar todos' : 'Selecionar visíveis'}
                      </Button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar aluno por nome ou e-mail..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y bg-muted/20">
                      {filteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</div>
                      ) : (
                        filteredStudents.map(s => (
                          <div 
                            key={s.id} 
                            className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-all"
                            onClick={() => {
                              setSelectedStudentIds(prev => 
                                prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                              );
                            }}
                          >
                            <div className={`size-4 rounded border flex items-center justify-center transition-all ${
                              selectedStudentIds.includes(s.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                            }`}>
                              {selectedStudentIds.includes(s.id) && <CheckCircle2 className="size-3" />}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-sm font-medium truncate">{s.user.name}</span>
                              <span className="text-[10px] text-muted-foreground truncate">{s.user.email}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {(recipientGroup === 'not-attempted' || recipientGroup === 'release') && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-dashed">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold opacity-60">Turma</Label>
                          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                            <SelectTrigger className="h-9 bg-background">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold opacity-60">Prova</Label>
                          <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                            <SelectTrigger className="h-9 bg-background">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {exams.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                       </div>
                    </div>

                    {recipientGroup === 'release' && (
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold opacity-60">Liberação Específica</Label>
                          <Select value={selectedReleaseId} onValueChange={setSelectedReleaseId}>
                            <SelectTrigger className="h-9 bg-background">
                              <SelectValue placeholder="Escolha a ativação..." />
                            </SelectTrigger>
                            <SelectContent>
                              {exams.find(e => e.id === selectedExamId)?.releases.map((r: any) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.class?.name || 'Individual'} - {format(new Date(r.releasedAt), "dd/MM/yy")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                       </div>
                    )}

                    <Button 
                      className="w-full h-9 gap-2" 
                      onClick={handleResolveRecipients}
                      disabled={isResolving || !selectedClassId || !selectedExamId || (recipientGroup === 'release' && !selectedReleaseId)}
                    >
                      {isResolving ? 'Buscando...' : 'Ver Destinatários'}
                    </Button>
                  </div>
                )}

                {recipientPreview.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <Label className="text-primary font-bold">Destinatários Encontrados ({recipientPreview.length})</Label>
                       <Badge variant="outline" className="text-[10px]">{recipientPreview.length} alvos</Badge>
                    </div>
                    <div className="max-h-[150px] overflow-y-auto border rounded-lg bg-background">
                       <Table>
                          <TableHeader className="bg-muted/50">
                             <TableRow>
                                <TableHead className="h-8 text-[10px] py-0 px-3">Nome</TableHead>
                                <TableHead className="h-8 text-[10px] py-0">Email</TableHead>
                             </TableRow>
                          </TableHeader>
                          <TableBody>
                             {recipientPreview.map(s => (
                               <TableRow key={s.id} className="h-10">
                                  <TableCell className="py-1 px-3 text-xs font-medium">{s.user.name} {s.lastName}</TableCell>
                                  <TableCell className="py-1 text-xs text-muted-foreground">{s.user.email}</TableCell>
                               </TableRow>
                             ))}
                          </TableBody>
                       </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Mail className="size-8 text-primary animate-bounce" />
                  </div>
                  <svg className="size-24 animate-spin-slow">
                    <circle
                      cx="48"
                      cy="48"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      className="text-muted/20"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeDasharray="282.7"
                      strokeDashoffset={282.7 - (282.7 * progress) / 100}
                      className="text-primary transition-all duration-500"
                    />
                  </svg>
                </div>
                
                <div className="w-full max-w-[300px] space-y-2 text-center">
                  <h3 className="font-bold text-lg">Enviando e-mails...</h3>
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground">Lote processado: {progress}% concluído</p>
                </div>

                <div className="p-4 bg-muted/50 rounded-xl border w-full text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Template:</span>
                    <span className="font-medium">{TEMPLATES.find(t => t.slug === selectedTemplate)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modo:</span>
                    <span className="font-medium capitalize">{recipientGroup}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="text-blue-500 flex items-center gap-1">
                      <Clock className="size-3 animate-pulse" /> Em progresso
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {step > 1 && step < 3 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={sending}>
                <ChevronLeft className="size-4 mr-2" /> Voltar
              </Button>
            )}
            {step < 2 && (
              <Button 
                onClick={() => setStep(step + 1)} 
                disabled={!selectedTemplate || !(() => {
                  const template = TEMPLATES.find(t => t.slug === selectedTemplate);
                  if (!template) return false;
                  return Array.isArray(template.eventSlug)
                    ? template.eventSlug.every(slug => activeBindings.some(b => b.eventKey === slug && b.isActive))
                    : activeBindings.some(b => b.eventKey === template.eventSlug && b.isActive);
                })()}
              >
                Continuar <ChevronRight className="size-4 ml-2" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleStartDispatch} disabled={sending}>
                <Send className="size-4 mr-2" /> Iniciar Disparo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
