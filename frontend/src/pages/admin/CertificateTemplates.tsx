import { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface CertificateTemplate {
  id: string;
  name: string;
  fileName: string;
  nameTop: number;
  nameLeft: number;
  codeTop: number;
  codeLeft: number;
  dateBottom: number;
  dateLeft: number;
  createdAt: string;
}

const defaultForm = {
  name: '',
  nameTop: '53.1',
  nameLeft: '14.2',
  codeTop: '72.1',
  codeLeft: '59.1',
  dateBottom: '12.0',
  dateLeft: '16.2',
};

export default function CertificateTemplates() {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/certificate-templates');
      setTemplates(data);
    } catch {
      toast.error('Erro ao carregar templates de certificado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const openNew = () => {
    setForm(defaultForm);
    setFile(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('O nome do template é obrigatório');
      return;
    }
    if (!file) {
      toast.error('Você deve selecionar um arquivo de imagem (JPG)');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('file', file);
      formData.append('nameTop', form.nameTop);
      formData.append('nameLeft', form.nameLeft);
      formData.append('codeTop', form.codeTop);
      formData.append('codeLeft', form.codeLeft);
      formData.append('dateBottom', form.dateBottom);
      formData.append('dateLeft', form.dateLeft);

      await api.post('/certificate-templates', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success('Template criado com sucesso');
      setShowModal(false);
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir o template "${name}"?\nEsta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/certificate-templates/${id}`);
      toast.success('Template excluído');
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao excluir template');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates de Certificado</h1>
          <p className="text-muted-foreground">Gerencie os designs em JPG e coordenadas dos certificados gerados</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" /> Novo Template
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-6 w-16">Preview</TableHead>
              <TableHead className="px-6">Nome</TableHead>
              <TableHead className="px-6">Arquivo</TableHead>
              <TableHead className="px-6">Criado em</TableHead>
              <TableHead className="w-16 px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                  Nenhum template criado até o momento.
                </TableCell>
              </TableRow>
            ) : (
              templates.map(tpl => (
                <TableRow key={tpl.id}>
                  <TableCell className="px-6">
                    <div className="size-10 bg-muted rounded flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  </TableCell>
                  <TableCell className="px-6 font-medium">
                    {tpl.name}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-muted-foreground">
                    {tpl.fileName}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-muted-foreground">
                    {new Date(tpl.createdAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="px-6">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(tpl.id, tpl.name)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Criar */}
      <Dialog open={showModal} onOpenChange={open => { if (!saving) setShowModal(open); }}>
        <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Template</DialogTitle>
            <DialogDescription>
              Faça o upload da imagem de fundo (JPG/PNG tamanho A4 Paisagem) e ajuste as coordenadas absolutas (em %).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome Interno *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Certificado CHPC Nível 1" />
            </div>
            
            <div className="space-y-1.5">
              <Label>Imagem do Template *</Label>
              <Input type="file" accept="image/jpeg, image/png" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>

            <Separator className="my-2" />
            <h4 className="font-semibold text-sm">Posicionamento (Valores em %)</h4>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome do Aluno (Top)</Label>
                  <Input type="text" value={form.nameTop} onChange={e => setForm(f => ({ ...f, nameTop: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome do Aluno (Left)</Label>
                  <Input type="text" value={form.nameLeft} onChange={e => setForm(f => ({ ...f, nameLeft: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Certified ID (Top)</Label>
                  <Input type="text" value={form.codeTop} onChange={e => setForm(f => ({ ...f, codeTop: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Certified ID (Left)</Label>
                  <Input type="text" value={form.codeLeft} onChange={e => setForm(f => ({ ...f, codeLeft: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data (Bottom)</Label>
                  <Input type="text" value={form.dateBottom} onChange={e => setForm(f => ({ ...f, dateBottom: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data (Left)</Label>
                  <Input type="text" value={form.dateLeft} onChange={e => setForm(f => ({ ...f, dateLeft: e.target.value }))} />
                </div>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : 'Criar Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
