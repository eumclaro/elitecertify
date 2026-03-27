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
  CardContent,
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
import { Separator } from "@/components/ui/separator";
import { 
  RefreshCw, 
  Plus, 
  Eye, 
  Send, 
  Mail, 
  Layers
} from "lucide-react";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  provider: string;
  status: string;
  lastSyncedAt: string;
}

interface EmailBinding {
  id: string;
  eventKey: string;
  templateId: string;
  isActive: boolean;
  template?: EmailTemplate;
}

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
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [bindings, setBindings] = useState<EmailBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Modais
  const [showBindingModal, setShowBindingModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // States de Formulário
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Test Email States
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [testSlug, setTestSlug] = useState('');
  const [testData, setTestData] = useState('{\n  "NAME": "Usuário Teste",\n  "SUPPORT_EMAIL": "suporte@elt.com.br"\n}');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, bRes] = await Promise.all([
        api.get('/email-templates'),
        api.get('/email-templates/bindings')
      ]);
      setTemplates(tRes.data);
      setBindings(bRes.data);
    } catch (err: any) {
      toast.error('Erro ao carregar dados do servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.get('/email-templates/mandrill/sync');
      toast.success(`Sincronização concluída! Criados: ${res.data.created}, Atualizados: ${res.data.updated}`);
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao sincronizar com Mandrill');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveBinding = async () => {
    if (!selectedEvent || !selectedTemplateId) return;
    try {
      await api.post('/email-templates/bindings', {
        eventKey: selectedEvent,
        templateId: selectedTemplateId,
        isActive: true
      });
      toast.success('Vínculo salvo com sucesso!');
      fetchData();
      setShowBindingModal(false);
    } catch (err) {
      toast.error('Erro ao salvar vínculo');
    }
  };

  const handlePreview = async (slug: string) => {
    setPreviewHtml('');
    setShowPreviewModal(true);
    setPreviewLoading(true);
    try {
      const defaultVars = { NAME: 'Exemplo de Nome', SUPPORT_EMAIL: 'suporte@elt.com.br' };
      const res = await api.post('/email-templates/render', { slug, mergeVars: defaultVars });
      setPreviewHtml(res.data.html);
    } catch (err) {
      toast.error('Erro ao renderizar preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !testSlug) return;
    try {
      const parsedData = JSON.parse(testData);
      await api.post('/email-templates/test', {
        toEmail: testEmail,
        toName: testName || 'Destinatário Teste',
        templateSlug: testSlug,
        dynamicData: parsedData
      });
      toast.success('E-mail de teste enviado com sucesso!');
      setShowTestModal(false);
    } catch (err: any) {
      toast.error('Erro ao enviar teste: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div className="flex h-[400px] items-center justify-center"><RefreshCw className="size-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">E-mails Transacionais</h1>
          <p className="text-muted-foreground">Governança de templates Mandrill e vínculos com eventos do sistema.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2">
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Mandrill'}
          </Button>
          <Button onClick={() => setShowBindingModal(true)} className="gap-2">
            <Plus className="size-4" />
            Novo Vínculo
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="size-5 text-blue-500" />
            <h2 className="text-xl font-semibold">Templates Integrados</h2>
            <Badge variant="secondary" className="ml-2">{templates.length}</Badge>
          </div>
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">Nome / Slug</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead className="text-right px-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum template sincronizado. Clique em Sincronizar Mandrill.
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map(t => (
                      <TableRow key={t.id} className="hover:bg-muted/30 transition-colors group">
                        <TableCell className="px-6">
                          <div className="flex flex-col">
                            <span className="font-medium">{t.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{t.slug}</span>
                        </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/20">
                            {t.provider}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {t.lastSyncedAt ? format(new Date(t.lastSyncedAt), "dd 'de' MMM, HH:mm", { locale: ptBR }) : 'Nunca'}
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handlePreview(t.slug)} className="gap-2">
                              <Eye className="size-3" /> Preview
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setTestSlug(t.slug); setShowTestModal(true); }} className="gap-2">
                              <Send className="size-3" /> Teste
                            </Button>
                          </div>
                   </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="size-5 text-orange-500" />
            <h2 className="text-xl font-semibold">Vínculos Ativos</h2>
            <Badge variant="secondary" className="ml-2">{bindings.length}</Badge>
          </div>
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">Evento do Sistema</TableHead>
                    <TableHead>Template Vinculado</TableHead>
                    <TableHead className="px-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bindings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhum vínculo configurado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    bindings.map(b => (
                      <TableRow key={b.id} className="hover:bg-muted/30 transition-colors group">
                        <TableCell className="px-6">
                          <code className="px-2 py-1 bg-muted rounded text-xs font-semibold text-orange-600">
                            {b.eventKey}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="size-3 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {b.template?.name || b.template?.slug || 'Template não localizado'}
                            </span>
                          </div>
                    </TableCell>
                        <TableCell className="px-6">
                          {b.isActive ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Ativo</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal: Novo Vínculo */}
      <Dialog open={showBindingModal} onOpenChange={setShowBindingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Evento a Template</DialogTitle>
            <DialogDescription>
              Selecione um evento do sistema e o template Mandrill correspondente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Evento do Sistema</Label>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um evento..." />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KEYS.map(key => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template Mandrill</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.slug})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBindingModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveBinding}>Salvar Vínculo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Preview */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b">
            <DialogTitle>Visualização do Template</DialogTitle>
            <DialogDescription>
              Renderização do template utilizando variáveis de teste.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 bg-white relative">
            {previewLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <RefreshCw className="size-8 animate-spin text-primary" />
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full border-none"
                title="Mandrill Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Teste de Disparo */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disparar E-mail de Teste</DialogTitle>
            <DialogDescription>
              Envie um e-mail real para validar as merge tags e o layout no seu inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>E-mail do Destinatário</Label>
              <Input 
                type="email" 
                value={testEmail} 
                onChange={e => setTestEmail(e.target.value)} 
                placeholder="ex: seu@email.com" 
              />
            </div>
            <div className="space-y-2">
              <Label>Nome do Destinatário</Label>
              <Input 
                type="text" 
                value={testName} 
                onChange={e => setTestName(e.target.value)} 
                placeholder="ex: João Silva" 
              />
            </div>
            <div className="space-y-2">
              <Label>Variáveis de Teste (JSON)</Label>
              <Textarea 
                rows={5} 
                value={testData} 
                onChange={e => setTestData(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestModal(false)}>Cancelar</Button>
            <Button onClick={handleSendTest} className="gap-2">
              <Send className="size-4" /> Enviar Teste Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
