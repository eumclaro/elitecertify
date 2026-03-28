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
  Card,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Eye, 
  Send, 
  Mail, 
  Layers,
  Trash2,
  Edit,
  Loader2,
  Search,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InternalTemplate {
  id: string;
  name: string;
  description: string | null;
  htmlContent: string | null;
  mergeVars: any;
  status: 'DRAFT' | 'ACTIVE';
  createdAt: string;
  updatedAt: string;
}

interface EmailBinding {
  id: string;
  eventKey: string;
  templateId: string | null;
  internalTemplateId: string | null;
  isActive: boolean;
  template?: any;
  internalTemplate?: InternalTemplate;
}

const MOCK_DATA_BY_EVENT: Record<string, Record<string, string>> = {
  EXAM_FAILED: {
    NAME: 'João Silva',
    EXAM_NAME: 'CHPC L1 MAIO 2026',
    SCORE: '45%',
    CORRETAS: '27',
    ERRADAS: '33',
    TOTAL_QUESTOES: '60',
    STATUS: 'REPROVADO',
    COOLDOWN_DATE: '01/04/2026',
    COOLDOWN_TIME: '14:30',
    RESULT_LINK: 'https://certify.elitetraining.com.br/student/result/abc123',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
  },
  STUDENT_CREATED: {
    NAME: 'João Silva',
    EMAIL: 'joao@exemplo.com.br',
    PASSWORD: 'Senha@2026',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
  },
  EXAM_PASSED: {
    NAME: 'João Silva',
    EXAM_NAME: 'CHPC L1 MAIO 2026',
    SCORE: '82%',
    CORRETAS: '49',
    ERRADAS: '11',
    TOTAL_QUESTOES: '60',
    STATUS: 'APROVADO',
    CERTIFICATE_LINK: 'https://certify.elitetraining.com.br/certificate/abc123',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
  },
  EXAM_RELEASED: {
    NAME: 'João Silva',
    EXAM_NAME: 'CHPC L1 MAIO 2026',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
  },
  AUTH_PASSWORD_RESET: {
    NAME: 'João Silva',
    RESET_LINK: 'https://certify.elitetraining.com.br/reset/token123',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
  },
  COOLDOWN_RELEASED: {
    NAME: 'João Silva',
    EXAM_NAME: 'CHPC L1 MAIO 2026',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
  },
  CERTIFICATE_AVAILABLE: {
    NAME: 'João Silva',
    EXAM_NAME: 'CHPC L1 MAIO 2026',
    CERTIFICATE_LINK: 'https://certify.elitetraining.com.br/certificate/abc123',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
  },
  EXAM_DEADLINE_REMINDER: {
    NAME: 'João Silva',
    EXAM_NAME: 'CHPC L1 MAIO 2026',
    EXAM_DATE: '15/04/2026',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
  },
};

const DEFAULT_MOCK_DATA = {
  NAME: 'João Silva',
  SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
};

const MERGE_TAGS = [
  { tag: 'NAME', label: 'Nome' },
  { tag: 'EMAIL', label: 'E-mail' },
  { tag: 'PASSWORD', label: 'Senha' },
  { tag: 'EXAM_NAME', label: 'Nome da Prova' },
  { tag: 'SCORE', label: 'Nota/Pontuação' },
  { tag: 'RESULT_LINK', label: 'Link do Resultado' },
  { tag: 'COOLDOWN_DATE', label: 'Data do Cooldown' },
  { tag: 'COOLDOWN_TIME', label: 'Hora do Cooldown' },
  { tag: 'CERTIFICATE_LINK', label: 'Link do Certificado' },
  { tag: 'SUPPORT_EMAIL', label: 'E-mail de Suporte' },
  { tag: 'RESET_LINK', label: 'Link de Reset de Senha' }
];

const EVENT_KEYS = [
  'STUDENT_CREATED',
  'AUTH_PASSWORD_RESET',
  'EXAM_RELEASED',
  'EXAM_PASSED',
  'EXAM_FAILED',
  'COOLDOWN_RELEASED',
  'EXAM_DEADLINE_REMINDER',
  'CERTIFICATE_AVAILABLE'
];

export default function EmailManagement() {
  const [internalTemplates, setInternalTemplates] = useState<InternalTemplate[]>([]);
  const [bindings, setBindings] = useState<EmailBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('templates');

  // Modal: Create/Edit Template
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<InternalTemplate> | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Modal: Binding
  const [showBindingModal, setShowBindingModal] = useState(false);
  const [editingBinding, setEditingBinding] = useState<Partial<EmailBinding> | null>(null);
  const [savingBinding, setSavingBinding] = useState(false);

  // Modal: Preview/Test
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [testData, setTestData] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [currentTestTemplate, setCurrentTestTemplate] = useState<InternalTemplate | null>(null);

  const getTestDataForTemplate = (template: InternalTemplate): string => {
    const binding = bindings.find(b => b.internalTemplateId === template.id);
    const mockData = (binding?.eventKey && MOCK_DATA_BY_EVENT[binding.eventKey]) || DEFAULT_MOCK_DATA;
    return JSON.stringify(mockData, null, 2);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, bRes] = await Promise.all([
        api.get('/internal-templates'),
        api.get('/email-templates/bindings')
      ]);
      setInternalTemplates(tRes.data);
      setBindings(bRes.data);
    } catch (err: any) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (status: 'DRAFT' | 'ACTIVE') => {
    if (!editingTemplate?.name) {
      toast.error('Nome do template é obrigatório');
      return;
    }
    setSavingTemplate(true);
    try {
      const payload = { ...editingTemplate, status };
      if (editingTemplate.id) {
        await api.put(`/internal-templates/${editingTemplate.id}`, payload);
        toast.success('Template atualizado!');
      } else {
        await api.post('/internal-templates', payload);
        toast.success('Template criado!');
      }
      fetchData();
      setShowTemplateModal(false);
    } catch (err) {
      toast.error('Erro ao salvar template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Deseja realmente excluir este template? Todos os vínculos serão removidos.')) return;
    try {
      await api.delete(`/internal-templates/${id}`);
      toast.success('Template excluído');
      fetchData();
    } catch (err) {
      toast.error('Erro ao excluir template');
    }
  };

  const handleSaveBinding = async () => {
    if (!editingBinding?.eventKey || (!editingBinding?.internalTemplateId && !editingBinding?.templateId)) {
      toast.error('Selecione o evento e um template');
      return;
    }
    setSavingBinding(true);
    try {
      await api.post('/email-templates/bindings', editingBinding);
      toast.success('Vínculo salvo!');
      fetchData();
      setShowBindingModal(false);
    } catch (err) {
      toast.error('Erro ao salvar vínculo');
    } finally {
      setSavingBinding(false);
    }
  };

  const handlePreview = (template: InternalTemplate) => {
    let rendered = template.htmlContent || '';
    const mock = { 
      NAME: 'João Silva', 
      EMAIL: 'joao@elite.com.br', 
      PASSWORD: 'SenhaTeste123',
      SUPPORT_EMAIL: 'suporte@elitetraining.com.br',
      EXAM_NAME: 'CHPC L1 MAIO',
      SCORE: '85%',
      RESULT_LINK: '#',
      CERTIFICATE_LINK: '#',
      COOLDOWN_DATE: '01/04/2026',
      COOLDOWN_TIME: '14:30',
      RESET_LINK: '#'
    };
    Object.entries(mock).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });
    setPreviewHtml(rendered);
    setShowPreviewModal(true);
  };

  const handleSendTest = async () => {
    if (!testEmail || !currentTestTemplate) return;
    setSendingTest(true);
    try {
      const parsedData = JSON.parse(testData);
      await api.post('/email-templates/test', {
        toEmail: testEmail,
        toName: testName || 'Destinatário Teste',
        internalTemplateId: currentTestTemplate.id,
        dynamicData: parsedData
      });
      toast.success('E-mail de teste enviado!');
      setShowTestModal(false);
    } catch (err: any) {
      toast.error('Erro no teste: ' + (err.response?.data?.error || err.message));
    } finally {
      setSendingTest(false);
    }
  };

  const insertMergeTag = (tag: string) => {
    if (!editingTemplate) return;
    const textarea = document.getElementById('html-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingTemplate.htmlContent || '';
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newVal = `${before}{{${tag}}}${after}`;
    
    setEditingTemplate({ ...editingTemplate, htmlContent: newVal });
    
    // Devolve o foco e ajusta o cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length + 4, start + tag.length + 4);
    }, 10);
  };

  if (loading) return <div className="flex h-[400px] items-center justify-center"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates de E-mail</h1>
          <p className="text-muted-foreground">Gestão interna de e-mails transacionais e vínculos de eventos.</p>
        </div>
      </div>

      <Tabs defaultValue="templates" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="size-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="bindings" className="gap-2">
            <Layers className="size-4" /> Vínculos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
             <div className="relative w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar templates..." className="pl-9" />
             </div>
             <Button onClick={() => { setEditingTemplate({ status: 'DRAFT', htmlContent: '' }); setShowTemplateModal(true); }} className="gap-2">
                <Plus className="size-4" /> Novo Template
             </Button>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Nome / Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-right px-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {internalTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                      Nenhum template interno cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  internalTemplates.map(t => (
                    <TableRow key={t.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold">{t.name}</span>
                          <span className="text-xs text-muted-foreground line-clamp-1">{t.description || 'Sem descrição'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {t.status === 'ACTIVE' ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 gap-1.5">
                            <CheckCircle2 className="size-3" /> Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1.5 opacity-70">
                            <Edit className="size-3" /> Rascunho
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm italic">
                        {format(new Date(t.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingTemplate(t); setShowTemplateModal(true); }} title="Editar">
                            <Edit className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePreview(t)} title="Visualizar">
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setCurrentTestTemplate(t); setTestData(getTestDataForTemplate(t)); setShowTestModal(true); }} title="Testar Envio">
                            <Send className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(t.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive" title="Excluir">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="bindings" className="space-y-4">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-orange-500" />
                <p className="text-sm text-muted-foreground">Cada evento do sistema pode ser disparado com um único template ativo.</p>
             </div>
             <Button variant="outline" onClick={() => { setEditingBinding({ isActive: true }); setShowBindingModal(true); }} className="gap-2">
                <Plus className="size-4" /> Configurar Vínculo
             </Button>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6">Evento do Sistema</TableHead>
                  <TableHead>Template Vinculado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right px-6">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bindings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                      Nenhum vínculo configurado.
                    </TableCell>
                  </TableRow>
                ) : (
                  bindings.map(b => (
                    <TableRow key={b.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="px-6">
                        <code className="text-[11px] font-bold bg-muted px-2 py-0.5 rounded text-orange-600">
                          {b.eventKey}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-medium bg-blue-500/5 border-blue-500/10">
                            {b.internalTemplate?.name || b.template?.name || '---'}
                          </Badge>
                          {!b.internalTemplate && b.template && <Badge variant="secondary" className="text-[9px] uppercase">Legado</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {b.isActive ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">Vinculado</Badge>
                        ) : (
                          <Badge variant="outline" className="opacity-50">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingBinding(b); setShowBindingModal(true); }}>
                          Alterar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: NOVO/EDITAR TEMPLATE */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl h-[95vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{editingTemplate?.id ? 'Editar Template' : 'Novo Template Externo'}</DialogTitle>
            <DialogDescription>Construa seu e-mail utilizando HTML puro e merge tags.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input value={editingTemplate?.name || ''} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} placeholder="Ex: Boas-vindas (Novo)" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={editingTemplate?.description || ''} onChange={e => setEditingTemplate({...editingTemplate, description: e.target.value})} placeholder="Onde este e-mail é usado?" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                Merge Tags Disponíveis 
                <span className="text-[10px] font-normal text-muted-foreground uppercase">(Clique para inserir)</span>
              </Label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-muted/30 rounded-lg border border-dashed">
                {MERGE_TAGS.map(item => (
                  <button 
                    key={item.tag} 
                    onClick={() => insertMergeTag(item.tag)}
                    className="px-2 py-1 bg-background border rounded-md text-[10px] font-bold hover:bg-primary hover:text-primary-foreground transition-all uppercase"
                  >
                    {item.tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 flex-1 flex flex-col min-h-[400px]">
              <Label>Conteúdo HTML (Inline CSS recomendado)</Label>
              <Textarea 
                id="html-editor"
                value={editingTemplate?.htmlContent || ''} 
                onChange={e => setEditingTemplate({...editingTemplate, htmlContent: e.target.value})}
                placeholder="<html><body><h1>Seu código aqui...</h1></body></html>" 
                className="flex-1 font-mono text-xs p-4 leading-relaxed resize-none h-[400px]"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/20 border-t flex items-center justify-between">
            <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>Cancelar</Button>
            <div className="flex gap-2">
              <Button variant="outline" disabled={savingTemplate} onClick={() => handleSaveTemplate('DRAFT')}>
                {savingTemplate ? <Loader2 className="size-4 animate-spin" /> : 'Salvar Rascunho'}
              </Button>
              <Button disabled={savingTemplate} onClick={() => handleSaveTemplate('ACTIVE')} className="bg-emerald-600 hover:bg-emerald-700">
                {savingTemplate ? <Loader2 className="size-4 animate-spin" /> : 'Salvar e Ativar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: VÍNCULOS */}
      <Dialog open={showBindingModal} onOpenChange={setShowBindingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Vínculo de Evento</DialogTitle>
            <DialogDescription>Associe um evento automático do sistema a um template interno ativo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Evento Gatilho</Label>
              <Select value={editingBinding?.eventKey} onValueChange={val => setEditingBinding({...editingBinding, eventKey: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o evento..." />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KEYS.map(key => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template Ativo</Label>
              <Select value={editingBinding?.internalTemplateId || undefined} onValueChange={val => setEditingBinding({...editingBinding, internalTemplateId: val, templateId: null})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template interno..." />
                </SelectTrigger>
                <SelectContent>
                  {internalTemplates.filter(t => t.status === 'ACTIVE').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBindingModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveBinding} disabled={savingBinding}>
              {savingBinding ? <Loader2 className="size-4 animate-spin" /> : 'Confirmar Vínculo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: PREVIEW */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
          <div className="h-full flex flex-col">
             <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/10">
                <div>
                   <h3 className="font-bold">Visualização do Template</h3>
                   <p className="text-xs text-muted-foreground italic">Renderizado com dados fictícios para teste de layout.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowPreviewModal(false)}>×</Button>
             </div>
             <div className="flex-1 bg-white">
                <iframe srcDoc={previewHtml} className="w-full h-full border-none" />
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: TESTE */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teste de Disparo Real</DialogTitle>
            <DialogDescription>Valide o template "{currentTestTemplate?.name}" enviando para um e-mail de teste.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Destinatário</Label>
                 <Input value={testName} onChange={e => setTestName(e.target.value)} placeholder="Ex: João" />
               </div>
               <div className="space-y-2">
                 <Label>E-mail</Label>
                 <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="Ex: joao@elt.com" />
               </div>
            </div>
            <div className="space-y-2">
              <Label>Dados mockados (JSON)</Label>
              <Textarea value={testData} onChange={e => setTestData(e.target.value)} className="font-mono text-xs" rows={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestModal(false)}>Cancelar</Button>
            <Button onClick={handleSendTest} disabled={sendingTest} className="gap-2">
              {sendingTest ? <Loader2 className="size-4 animate-spin" /> : <><Send className="size-4" /> Enviar Agora</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
