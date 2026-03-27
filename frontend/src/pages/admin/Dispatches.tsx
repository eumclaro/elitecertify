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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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
  Download,
  FileJson,
  Filter,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from 'sonner';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

  // Log Tab State
  const [selectedLogId, setSelectedLogId] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<'ALL' | 'SENT' | 'FAILED'>('ALL');

  // Period Filter State (30, 60, 90, custom days)
  const [period, setPeriod] = useState<'30' | '60' | '90' | 'custom'>('30');
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined } | null>(null);

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

  const fetchLogs = async (dispatchId: string) => {
    if (!dispatchId) return;
    setLoadingLogs(true);
    try {
      const response = await api.get(`/dispatches/${dispatchId}/logs`);
      setLogs(response.data);
    } catch (error) {
      toast.error('Erro ao carregar logs do disparo');
    } finally {
      setLoadingLogs(false);
    }
  };

  const filteredDispatches = dispatches.filter(d => {
    const dispatchDate = new Date(d.createdAt);

    if (period === 'custom' && customRange?.from && customRange?.to) {
      const start = startOfDay(customRange.from);
      const end = endOfDay(customRange.to);
      return dispatchDate >= start && dispatchDate <= end;
    }

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    const start = new Date();
    start.setDate(now.getDate() - parseInt(period));
    start.setHours(0, 0, 0, 0);

    return dispatchDate >= start && dispatchDate <= now;
  });

  useEffect(() => {
    if (selectedLogId && !filteredDispatches.find(d => d.id === selectedLogId)) {
      setSelectedLogId('');
      setLogs([]);
    }
  }, [filteredDispatches, selectedLogId, period]);

  const handleExport = (dispatchId: string, format: 'csv' | 'pdf') => {
    window.open(`${import.meta.env.VITE_API_URL}/dispatches/${dispatchId}/export?format=${format}`, '_blank');
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border shadow-sm">
            <span className="text-[10px] uppercase font-bold opacity-50 px-2">Período</span>
            <ToggleGroup 
              type="single" 
              value={period === 'custom' ? undefined : period} 
              onValueChange={(val) => {
                if (val) {
                  setPeriod(val as any);
                  setCustomRange(null);
                }
              }} 
              variant="outline" 
              size="sm"
              className="bg-background rounded-md"
            >
              <ToggleGroupItem value="30" className="text-xs h-7 px-3">30 dias</ToggleGroupItem>
              <ToggleGroupItem value="60" className="text-xs h-7 px-3">60 dias</ToggleGroupItem>
              <ToggleGroupItem value="90" className="text-xs h-7 px-3">90 dias</ToggleGroupItem>
            </ToggleGroup>

            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`h-7 px-3 text-xs gap-2 ${period === 'custom' ? 'border-primary bg-primary/5 text-primary' : ''}`}
                >
                  <CalendarIcon className="size-3" />
                  {customRange?.from && customRange?.to 
                    ? `${format(customRange.from, 'dd/MM')} → ${format(customRange.to, 'dd/MM')}`
                    : 'Personalizado'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 flex gap-4 shadow-xl border-primary/20" align="end">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold opacity-60">De</Label>
                  <Calendar
                    mode="single"
                    selected={customRange?.from}
                    onSelect={(date) => {
                      setCustomRange(prev => ({ from: date, to: prev?.to }));
                      setPeriod('custom');
                    }}
                    locale={ptBR}
                    className="border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold opacity-60">Até</Label>
                  <Calendar
                    mode="single"
                    selected={customRange?.to}
                    onSelect={(date) => {
                      setCustomRange(prev => ({ from: prev?.from, to: date }));
                      setPeriod('custom');
                    }}
                    locale={ptBR}
                    className="border rounded-md bg-background"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={() => setIsWizardOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Novo Disparo
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
            <Send className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Enviados</p>
            <p className="text-2xl font-bold">{filteredDispatches.reduce((acc, d) => acc + (d.totalCount || 0), 0)}</p>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-green-500/10 text-green-500 rounded-lg">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sucesso</p>
            <p className="text-2xl font-bold">{filteredDispatches.reduce((acc, d) => acc + d.successCount, 0)}</p>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Falhas</p>
            <p className="text-2xl font-bold">{filteredDispatches.reduce((acc, d) => acc + d.errorCount, 0)}</p>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 text-orange-500 rounded-lg">
            <History className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lotes Processados</p>
            <p className="text-2xl font-bold">{filteredDispatches.length}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Search className="size-4" /> Consultar Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
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
                ) : filteredDispatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum disparo realizado no período selecionado.</TableCell>
                  </TableRow>
                ) : (
                  filteredDispatches.map((d) => (
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
        </TabsContent>

        <TabsContent value="logs">
          <div className="space-y-4">
            <div className="p-4 bg-muted/10 border rounded-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-4 flex-1 max-w-md">
                  <div className="space-y-1 flex-1">
                    <Label className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-2">
                      Lote de Disparo ({filteredDispatches.length})
                      {filteredDispatches.length === 0 && (
                        <span className="text-red-600 text-xs font-bold normal-case">— Sem Evento para este período</span>
                      )}
                    </Label>
                    <Select value={selectedLogId} onValueChange={(val) => { setSelectedLogId(val); fetchLogs(val); }}>
                      <SelectTrigger className={`w-full bg-background min-h-[40px] ${filteredDispatches.length === 0 ? 'border-red-500/50' : ''}`}>
                        <div className="flex items-center gap-2 flex-1 text-left">
                          {filteredDispatches.length === 0 ? (
                            <span className="text-red-500 font-medium text-sm">Sem evento</span>
                          ) : (
                            <SelectValue placeholder="Escolha um disparo..." />
                          )}
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {filteredDispatches.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {TEMPLATES.find(t => t.slug === d.templateSlug)?.name || d.templateSlug} — {format(new Date(d.createdAt), "dd/MM/yy HH:mm")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedLogId && (
                  <div className="flex items-center gap-2 self-end">
                    <Button variant="outline" size="sm" onClick={() => handleExport(selectedLogId, 'csv')} className="gap-2">
                      <FileJson className="size-3" /> Exportar CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport(selectedLogId, 'pdf')} className="gap-2">
                      <Download className="size-3" /> Exportar PDF
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {selectedLogId ? (
              <div className="bg-card rounded-xl border overflow-hidden">
                <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="size-4 text-muted-foreground" />
                    <h2 className="font-semibold text-sm">Destinatários do Lote</h2>
                  </div>
                  <div className="flex bg-muted p-0.5 rounded-lg border">
                    <button 
                      onClick={() => setLogFilter('ALL')}
                      className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${logFilter === 'ALL' ? 'bg-background shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                    >
                      Todos
                    </button>
                    <button 
                      onClick={() => setLogFilter('SENT')}
                      className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${logFilter === 'SENT' ? 'bg-background shadow-sm text-green-600' : 'opacity-40 hover:opacity-100'}`}
                    >
                      Sucesso
                    </button>
                    <button 
                      onClick={() => setLogFilter('FAILED')}
                      className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${logFilter === 'FAILED' ? 'bg-background shadow-sm text-red-600' : 'opacity-40 hover:opacity-100'}`}
                    >
                      Falhas
                    </button>
                  </div>
                </div>

                <div className="relative">
                  {loadingLogs && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <Clock className="size-6 text-primary animate-pulse" />
                    </div>
                  )}
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">E-mail</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Horário</TableHead>
                        <TableHead className="text-xs">MsgID Mandrill</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs
                        .filter(l => logFilter === 'ALL' || l.status === logFilter)
                        .map((log, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{log.recipientName}</TableCell>
                            <TableCell className="text-muted-foreground">{log.recipientEmail}</TableCell>
                            <TableCell>
                              {log.status === 'SENT' ? (
                                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Enviado</Badge>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Falha</Badge>
                                  {log.failureReason && <span className="text-[10px] text-red-400 max-w-[150px] truncate" title={log.failureReason}>{log.failureReason}</span>}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(log.sentAt), "HH:mm:ss")}
                            </TableCell>
                            <TableCell className="text-[10px] font-mono text-muted-foreground">
                              {log.mandrillMsgId || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      {logs.filter(l => logFilter === 'ALL' || l.status === logFilter).length === 0 && !loadingLogs && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                            Nenhum registro encontrado para este filtro.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center border border-dashed rounded-xl bg-muted/10">
                <Search className="size-10 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground">Selecione um disparo acima para visualizar o detalhamento individual.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

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
