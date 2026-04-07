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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Loader2,
  BarChart3,
  Send,
  ArrowLeft,
  Users,
  MessageSquare,
  TrendingUp,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck2,
  UserX2,
  HelpCircle,
  Search,
  ListOrdered,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface Survey { 
  id: string; 
  title: string; 
  status: string; 
  classId: string | null; 
  class: any; 
  npsScore: number | null;
  _count: { questions: number; invites: number; responses: number }; 
  createdAt: string; 
}

export default function NpsSurveys() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Survey | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState({ 
    title: '', 
    classId: '', 
    questions: [{ text: '', type: 'SCORE', options: '' }] 
  });
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sendingIndividual, setSendingIndividual] = useState<string | null>(null);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [editableQuestions, setEditableQuestions] = useState<any[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [externalSearch, setExternalSearch] = useState('');
  const [externalResults, setExternalResults] = useState<any[]>([]);
  const [searchingExternal, setSearchingExternal] = useState(false);
  const [sendingExternalId, setSendingExternalId] = useState<string | null>(null);

  const fetchSurveys = async () => {
    try {
      const { data } = await api.get('/nps/surveys');
      setSurveys(data);
    } catch (e) { 
      console.error(e); 
      toast.error("Erro ao carregar pesquisas");
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchSurveys();
    api.get('/classes')
      .then(r => setClasses(r.data))
      .catch(console.error);
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ 
      title: '', 
      classId: '', 
      questions: [{ text: 'De 0 a 10, qual sua satisfação com o curso?', type: 'SCORE', options: '' }] 
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editing) {
        await api.put(`/nps/surveys/${editing.id}`, { title: form.title, classId: form.classId || null });
        toast.success("Pesquisa atualizada");
      } else {
        await api.post('/nps/surveys', { 
          title: form.title, 
          classId: form.classId || null, 
          questions: form.questions.filter(q => q.text.trim()).map(q => ({
            ...q,
            options: q.type === 'MULTIPLE_CHOICE' ? q.options : null
          })) 
        });
        toast.success("Pesquisa criada");
      }
      setShowModal(false);
      fetchSurveys();
    } catch (err) { 
      console.error(err); 
      toast.error("Erro ao salvar pesquisa");
    } finally {
      setIsSaving(false);
    }
  };

  const sendSurvey = async (id: string) => {
    try {
      const { data } = await api.post(`/nps/surveys/${id}/send`);
      toast.success(data.message || "Pesquisa enviada com sucesso!");
      fetchSurveys();
      if (selectedSurvey?.survey.id === id) {
        viewResults(id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar');
    }
  };

  const sendIndividualInvite = async (studentId: string) => {
    if (!selectedSurvey) return;
    setSendingIndividual(studentId);
    try {
      await api.post(`/nps/surveys/${selectedSurvey.survey.id}/send-individual`, { studentId });
      toast.success("Convite enviado com sucesso!");
      viewResults(selectedSurvey.survey.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao enviar convite");
    } finally {
      setSendingIndividual(null);
    }
  };

  const viewResults = async (id: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/nps/surveys/${id}/results`);
      setSelectedSurvey(data);
      setEditableQuestions(data.questions?.map((q: any) => ({ ...q, _key: q.id })) || []);
      setExternalSearch('');
      setExternalResults([]);
    } catch (err) { 
      console.error(err); 
      toast.error("Erro ao carregar resultados");
    } finally {
      setLoading(false);
    }
  };

  const deleteSurvey = async (id: string) => {
    if (!confirm('Excluir pesquisa NPS?')) return;
    try {
      await api.delete(`/nps/surveys/${id}`);
      toast.success("Pesquisa excluída");
      fetchSurveys();
    } catch (err) {
      toast.error("Erro ao excluir pesquisa");
    }
  };

  const searchExternalStudents = async (q: string) => {
    setExternalSearch(q);
    if (!q.trim()) { setExternalResults([]); return; }
    setSearchingExternal(true);
    try {
      const { data } = await api.get('/students', { params: { search: q, limit: 8 } });
      setExternalResults(data.data || []);
    } catch { /* silent */ } finally { setSearchingExternal(false); }
  };

  const sendExternalInvite = async (studentId: string) => {
    if (!selectedSurvey) return;
    setSendingExternalId(studentId);
    try {
      await api.post(`/nps/surveys/${selectedSurvey.survey.id}/send-individual`, { studentId });
      toast.success('Convite enviado!');
      setExternalSearch('');
      setExternalResults([]);
      viewResults(selectedSurvey.survey.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar convite');
    } finally {
      setSendingExternalId(null);
    }
  };

  const addEditableQuestion = () => {
    setEditableQuestions(prev => [...prev, {
      _key: `new-${Date.now()}`,
      id: null,
      text: '',
      type: 'TEXT',
      options: null,
    }]);
  };

  const addQuestion = () => setForm(f => ({ ...f, questions: [...f.questions, { text: '', type: 'SCORE', options: '' }] }));
  const removeQuestion = (i: number) => setForm(f => ({ ...f, questions: f.questions.filter((_, idx) => idx !== i) }));
  const updateQuestion = (i: number, field: string, val: string) => {
    setForm(f => ({ ...f, questions: f.questions.map((q, idx) => idx === i ? { ...q, [field]: val } : q) }));
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleExport = async (surveyId: string, title: string) => {
    try {
      const response = await api.get(`/nps/surveys/${surveyId}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = `NPS_${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Erro ao exportar dados");
    }
  };

  // Results view
  if (selectedSurvey) {
    const s = selectedSurvey;
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSurvey(null)} className="gap-2 -ml-2">
            <ArrowLeft className="size-4" /> Voltar
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" /> Pesquisa: {s.survey.title}
          </h1>
        </div>

        {s.stats.totalResponses > 0 && (
          <Alert className="border-blue-200 bg-blue-50/50">
            <AlertCircle className="size-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm font-medium">
              Esta pesquisa já possui respostas e não pode ser editada.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-muted/30 border-none">
            <CardContent className="p-4 pt-4 flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg"><Users className="size-5" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Convidados</p>
                <p className="text-2xl font-bold">{s.stats.totalInvites}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-none">
            <CardContent className="p-4 pt-4 flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg"><MessageSquare className="size-5" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Respostas</p>
                <p className="text-2xl font-bold">{s.stats.totalResponses}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-none">
            <CardContent className="p-4 pt-4 flex items-center gap-4">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg"><TrendingUp className="size-5" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Taxa Resposta</p>
                <p className="text-2xl font-bold">{s.stats.responseRate}%</p>
              </div>
            </CardContent>
          </Card>
          {s.stats.npsScore !== null && (
            <Card className="bg-muted/30 border-none">
              <CardContent className="p-4 pt-4 flex items-center gap-4">
                <div className={`p-2 rounded-lg ${
                  s.stats.npsScore >= 50 ? 'bg-emerald-500/10 text-emerald-600' : 
                  s.stats.npsScore >= 0 ? 'bg-amber-500/10 text-amber-600' : 
                  'bg-rose-500/10 text-rose-600'
                }`}>
                  <BarChart3 className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Score NPS</p>
                  <p className={`text-2xl font-bold ${
                    s.stats.npsScore >= 50 ? 'text-emerald-600' : 
                    s.stats.npsScore >= 0 ? 'text-amber-600' : 
                    'text-rose-600'
                  }`}>
                    {s.stats.npsScore}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="results" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="results" className="gap-2"><BarChart3 className="size-4" /> Resultados Detalhados</TabsTrigger>
            <TabsTrigger value="questions" className="gap-2"><ListOrdered className="size-4" /> Perguntas</TabsTrigger>
            <TabsTrigger value="students" className="gap-2"><Users className="size-4" /> Alunos da Turma</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-6">
            {s.stats.npsScore !== null && (
              <Card className="border-none shadow-sm">
                <CardHeader className="px-6 pt-6 pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-tight opacity-60 flex items-center gap-2">
                    Distribuição NPS (Perguntas Decisivas)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col justify-center border-l-4 border-emerald-500 pl-4 bg-emerald-500/5 py-4 rounded-r-lg">
                      <span className="text-2xl font-black text-emerald-600">{s.stats.promoters}</span>
                      <span className="text-[10px] font-bold uppercase text-emerald-600/70">Promotores (9-10)</span>
                    </div>
                    <div className="flex flex-col justify-center border-l-4 border-amber-500 pl-4 bg-amber-500/5 py-4 rounded-r-lg">
                      <span className="text-2xl font-black text-amber-600">{s.stats.passives}</span>
                      <span className="text-[10px] font-bold uppercase text-amber-600/70">Neutros (7-8)</span>
                    </div>
                    <div className="flex flex-col justify-center border-l-4 border-rose-500 pl-4 bg-rose-500/5 py-4 rounded-r-lg">
                      <span className="text-2xl font-black text-rose-600">{s.stats.detractors}</span>
                      <span className="text-[10px] font-bold uppercase text-rose-600/70">Detratores (0-6)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" /> Feedback dos Alunos
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 font-bold h-9"
                onClick={() => handleExport(s.survey.id, s.survey.title)}
              >
                <Download className="size-4" /> Exportar CSV
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail do aluno..."
                value={feedbackSearch}
                onChange={e => setFeedbackSearch(e.target.value)}
                className="pl-10 h-10"
              />
            </div>

            {(() => {
              const term = feedbackSearch.toLowerCase().trim();
              const filtered = term
                ? s.responses.filter((r: any) =>
                    r.studentName.toLowerCase().includes(term) ||
                    r.studentEmail.toLowerCase().includes(term)
                  )
                : s.responses;
              return (
            <div className="space-y-4">
              {filtered.length === 0 ? (
                <Card className="border-none shadow-sm">
                  <CardContent className="py-20 text-center text-muted-foreground italic">
                    {term ? 'Nenhum aluno encontrado para esta busca.' : 'Nenhuma resposta recebida até o momento.'}
                  </CardContent>
                </Card>
              ) : filtered.map((r: any) => (
                <Card key={r.id} className="border-none shadow-sm overflow-hidden">
                  <CardHeader className="bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs uppercase">
                        {r.studentName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm leading-none">{r.studentName}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{r.studentEmail}</p>
                      </div>
                    </div>
                    <time className="text-[10px] text-muted-foreground font-medium uppercase">
                      Respondido em: {new Date(r.createdAt).toLocaleString('pt-BR')}
                    </time>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {s.questions.map((q: any, idx: number) => {
                      const answer = r.answers.find((a: any) => a.questionId === q.id);
                      return (
                        <div key={q.id} className="space-y-2">
                          <p className="text-xs font-bold text-muted-foreground flex items-start gap-2">
                            <span className="flex-shrink-0 size-5 rounded-full bg-muted flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            {q.text}
                          </p>
                          <div className="pl-7">
                            {answer && answer.score !== null && (
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  q.type === 'RATING_5' 
                                    ? (answer.score >= 4 ? 'default' : answer.score >= 3 ? 'secondary' : 'destructive')
                                    : (answer.score >= 9 ? 'default' : answer.score >= 7 ? 'secondary' : 'destructive')
                                } className="px-3 py-0.5 rounded-full font-black text-sm">
                                  {answer.score} / {q.type === 'RATING_5' ? '5' : '10'}
                                </Badge>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                                  {q.type === 'RATING_5' ? 'Escala 1–5' : 'Score NPS'}
                                </span>
                              </div>
                            )}
                            {answer?.text && (
                              <div className="bg-muted/30 p-3 rounded-lg border border-muted text-sm leading-relaxed italic text-black/80 font-medium">
                                "{answer.text}"
                              </div>
                            )}
                            {!answer?.score && !answer?.text && (
                              <span className="text-xs text-muted-foreground italic">Pularam esta pergunta.</span>
                            )}
                          </div>
                          {idx < s.questions.length - 1 && <Separator className="mt-4 opacity-50" />}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="students" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Monitoramento de Participação</h2>
              {s.survey.status === 'DRAFT' && (
                <Button size="sm" onClick={() => sendSurvey(s.survey.id)} className="gap-2">
                  <Send className="size-4" /> Disparar para Todos (Turma)
                </Button>
              )}
            </div>

            <Card className="border-none shadow-sm">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Convidar aluno individualmente</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar aluno por nome ou e-mail..."
                    value={externalSearch}
                    onChange={e => searchExternalStudents(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                  {searchingExternal && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-muted-foreground" />}
                </div>
                {externalResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {externalResults.map((st: any) => (
                      <div key={st.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30">
                        <div>
                          <p className="text-sm font-semibold">{st.user?.name}</p>
                          <p className="text-xs text-muted-foreground">{st.user?.email}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[11px] font-bold uppercase tracking-wider gap-1"
                          onClick={() => sendExternalInvite(st.id)}
                          disabled={sendingExternalId === st.id}
                        >
                          {sendingExternalId === st.id ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                          Convidar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm overflow-hidden">
               <Table>
                 <TableHeader className="bg-muted/30">
                   <TableRow>
                     <TableHead className="px-6">Aluno</TableHead>
                     <TableHead>Email</TableHead>
                     <TableHead className="text-center">Status</TableHead>
                     <TableHead className="text-right px-6">Ação</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {!s.studentsStatus || s.studentsStatus.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">
                         Nenhum aluno vinculado a esta turma.
                       </TableCell>
                     </TableRow>
                   ) : s.studentsStatus.map((st: any) => (
                     <TableRow key={st.id} className="hover:bg-muted/20">
                       <TableCell className="px-6 font-semibold">{st.name}</TableCell>
                       <TableCell className="text-muted-foreground text-sm">{st.email}</TableCell>
                       <TableCell className="text-center">
                         <Badge className={`gap-1.5 ${
                           st.status === 'RESPONDED' ? 'bg-green-500/10 text-green-600 border-green-200' : 
                           st.status === 'PENDING' ? 'bg-blue-500/10 text-blue-600 border-blue-200' : 
                           'bg-slate-500/10 text-slate-500 border-slate-200'
                         }`}>
                           {st.status === 'RESPONDED' ? <UserCheck2 className="size-3" /> : st.status === 'PENDING' ? <Clock className="size-3" /> : <UserX2 className="size-3" />}
                           {st.status === 'RESPONDED' ? 'Concluído' : st.status === 'PENDING' ? 'Convidado' : 'Não Convidado'}
                         </Badge>
                       </TableCell>
                       <TableCell className="px-6 text-right py-4">
                         {st.status === 'NOT_INVITED' ? (
                           <Button 
                             variant="secondary" 
                             size="sm" 
                             className="h-8 text-[11px] font-bold uppercase tracking-wider"
                             onClick={() => sendIndividualInvite(st.id)}
                             disabled={sendingIndividual === st.id}
                           >
                             {sendingIndividual === st.id ? <Loader2 className="size-3 animate-spin mr-2" /> : <Send className="size-3 mr-2" />}
                             Disparar individual
                           </Button>
                         ) : (
                           <span className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase">Processado</span>
                         )}
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ListOrdered className="size-5 text-primary" /> Perguntas da Pesquisa
              </h2>
              {s.stats.totalResponses === 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 font-bold h-9"
                    onClick={addEditableQuestion}
                    disabled={savingQuestions}
                  >
                    <Plus className="size-4" /> Pergunta
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2 font-bold h-9"
                    disabled={savingQuestions}
                    onClick={async () => {
                      setSavingQuestions(true);
                      try {
                        await api.put(`/nps/surveys/${s.survey.id}`, {
                          questions: editableQuestions.map((q: any) => ({
                            ...(q.id ? { id: q.id } : {}),
                            text: q.text,
                            type: q.type,
                            options: q.options,
                          })),
                        });
                        toast.success('Perguntas atualizadas com sucesso!');
                        viewResults(s.survey.id);
                      } catch (err: any) {
                        if (err.response?.status === 403) {
                          toast.error(err.response.data.error);
                          viewResults(s.survey.id);
                        } else {
                          toast.error('Erro ao salvar perguntas');
                        }
                      } finally {
                        setSavingQuestions(false);
                      }
                    }}
                  >
                    {savingQuestions ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Salvar Alterações
                  </Button>
                </div>
              )}
            </div>

            {s.stats.totalResponses > 0 && (
              <Alert className="border-blue-200 bg-blue-50/50">
                <AlertCircle className="size-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm font-medium">
                  Esta pesquisa já possui respostas e não pode ser editada.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {(s.stats.totalResponses > 0 ? s.questions : editableQuestions).map((q: any, idx: number) => (
                <Card key={q._key ?? q.id ?? idx} className="border-none shadow-sm overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 size-8 rounded-full bg-muted flex items-center justify-center text-xs font-black text-muted-foreground">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-3">
                        {s.stats.totalResponses > 0 ? (
                          <p className="text-sm font-semibold leading-relaxed pt-1">{q.text}</p>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              value={q.text}
                              placeholder="Texto da pergunta..."
                              onChange={e => {
                                const key = q._key;
                                setEditableQuestions(prev =>
                                  prev.map((p: any) => p._key === key ? { ...p, text: e.target.value } : p)
                                );
                              }}
                              className="font-medium"
                            />
                            {!q.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  const key = q._key;
                                  setEditableQuestions(prev => prev.filter((p: any) => p._key !== key));
                                }}
                              >
                                <X className="size-4" />
                              </Button>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.stats.totalResponses === 0 && !q.id ? (
                            <Select
                              value={q.type}
                              onValueChange={val => {
                                const key = q._key;
                                setEditableQuestions(prev =>
                                  prev.map((p: any) => p._key === key ? { ...p, type: val } : p)
                                );
                              }}
                            >
                              <SelectTrigger className="h-7 text-[11px] w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SCORE">Régua 0–10 (NPS)</SelectItem>
                                <SelectItem value="RATING_5">Escala 1–5 (Estrelas)</SelectItem>
                                <SelectItem value="MULTIPLE_CHOICE">Múltipla Escolha</SelectItem>
                                <SelectItem value="TEXT">Texto Aberto</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                              {q.type === 'SCORE' ? 'Régua 0–10 (NPS)' :
                               q.type === 'RATING_5' ? 'Escala 1–5 (Estrelas)' :
                               q.type === 'MULTIPLE_CHOICE' ? 'Múltipla Escolha' : 'Texto Aberto'}
                            </Badge>
                          )}
                          {q.type === 'MULTIPLE_CHOICE' && q.options && (
                            <span className="text-[10px] text-muted-foreground italic">
                              Opções: {q.options}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

        </Tabs>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NPS</h1>
          <p className="text-muted-foreground">Gerencie pesquisas de satisfação e analise o NPS das turmas</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" /> Nova Pesquisa
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6">Título</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead className="text-center">Respostas</TableHead>
                <TableHead className="text-center">Score NPS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                    Nenhuma pesquisa NPS encontrada.
                  </TableCell>
                </TableRow>
              ) : surveys.map(s => (
                <TableRow key={s.id} className="hover:bg-muted/20 transition-colors group">
                  <TableCell className="px-6 font-bold group-hover:text-primary transition-colors">{s.title}</TableCell>
                  <TableCell className="text-muted-foreground">{s.class?.name || 'Todas (Global)'}</TableCell>
                  <TableCell className="text-center">
                     <span className="font-bold text-sm">
                       {s._count.responses} de {s._count.invites}{' '}
                       <span className="text-muted-foreground font-medium">
                         ({s._count.invites > 0 ? Math.round((s._count.responses / s._count.invites) * 100) : '—'}
                         {s._count.invites > 0 ? '%' : ''})
                       </span>
                     </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {s.npsScore !== null ? (
                      <Badge className={`px-3 py-0.5 rounded-full font-black text-sm ${
                        s.npsScore >= 50 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' :
                        s.npsScore >= 0 ? 'bg-amber-500/10 text-amber-600 border-amber-200' :
                        'bg-rose-500/10 text-rose-600 border-rose-200'
                      }`}>
                        {s.npsScore}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`gap-1 ${
                      s.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                      s.status === 'CLOSED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 
                      'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    }`}>
                      {s.status === 'ACTIVE' ? <CheckCircle2 className="size-3" /> : s.status === 'CLOSED' ? <AlertCircle className="size-3" /> : <Clock className="size-3" />}
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 text-right flex justify-end gap-2 py-4">
                    <Button variant="ghost" size="sm" onClick={() => viewResults(s.id)} className="gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                      <BarChart3 className="size-3" /> Resultados
                    </Button>
                    <Button size="sm" onClick={() => sendSurvey(s.id)} className="gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                      <Send className="size-3" /> Enviar
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteSurvey(s.id)} className="text-destructive h-8 w-8 hover:bg-destructive/10">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>Nova Pesquisa NPS</DialogTitle>
            <DialogDescription>
              Personalize sua pesquisa com múltiplos tipos de respostas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título da Pesquisa *</Label>
                <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="Ex: Feedback do Curso de Especialização" />
              </div>

              <div className="space-y-2">
                <Label>Turma Alvo</Label>
                <Select value={form.classId} onValueChange={(v) => setForm({...form, classId: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas as Turmas (Global)</SelectItem>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground italic">Se não selecionar, a pesquisa será enviada para todos os alunos do sistema.</p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <Label className="text-base font-bold">Perguntas</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="h-8 gap-1">
                    <Plus className="size-3" /> Adicionar Pergunta
                  </Button>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {form.questions.map((q, i) => (
                    <div key={i} className="space-y-3 p-4 bg-muted/30 rounded-xl relative group border border-transparent hover:border-primary/20 transition-all">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 space-y-2">
                          <Input 
                            value={q.text} 
                            onChange={e => updateQuestion(i, 'text', e.target.value)} 
                            placeholder="Texto da pergunta..." 
                            className="bg-background font-medium"
                          />
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground">Tipo de Resposta:</span>
                              <Select value={q.type} onValueChange={(v) => updateQuestion(i, 'type', v)}>
                                <SelectTrigger className="h-7 text-[11px] w-[200px] px-2 py-0 bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="SCORE">Régua 0 a 10 (NPS)</SelectItem>
                                  <SelectItem value="RATING_5">Escala 1 a 5 (Estrelas)</SelectItem>
                                  <SelectItem value="MULTIPLE_CHOICE">Múltipla Escolha</SelectItem>
                                  <SelectItem value="TEXT">Resposta em Texto (Aberto)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        {form.questions.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeQuestion(i)}
                            className="text-destructive h-8 w-8"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>

                      {q.type === 'MULTIPLE_CHOICE' && (
                        <div className="space-y-1.5 pl-2 border-l-2 border-primary/30">
                          <Label className="text-[10px] uppercase font-black tracking-widest text-primary flex items-center gap-1">
                            Opções de Escolha <HelpCircle className="size-3 opacity-50" />
                          </Label>
                          <Input 
                            value={q.options} 
                            onChange={e => updateQuestion(i, 'options', e.target.value)} 
                            placeholder="Separe as opções por vírgula. Ex: Excelente, Bom, Regular, Ruim" 
                            className="bg-background text-xs h-8"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving || form.questions.some(q => q.type === 'MULTIPLE_CHOICE' && !q.options?.trim())}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editing ? "Salvar Alterações" : "Criar e Publicar Pesquisa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

