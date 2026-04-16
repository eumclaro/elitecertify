import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Upload,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface Alternative {
  id?: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface Question {
  id: string;
  text: string;
  type: string;
  order: number;
  alternatives: Alternative[];
}

interface ExamInfo {
  id: string;
  title: string;
  questionCount: number;
}

export default function ExamQuestions() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteModalItem, setDeleteModalItem] = useState<Question | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  const [formText, setFormText] = useState('');
  const [formType, setFormType] = useState('SINGLE_CHOICE');
  const [formAlts, setFormAlts] = useState<Alternative[]>([
    { text: '', isCorrect: true, order: 1 },
    { text: '', isCorrect: false, order: 2 },
    { text: '', isCorrect: false, order: 3 },
    { text: '', isCorrect: false, order: 4 },
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [examRes, questRes] = await Promise.all([
        api.get(`/exams/${examId}`),
        api.get(`/exams/${examId}/questions`),
      ]);
      setExam(examRes.data);
      setQuestions(questRes.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [examId]);

  const openCreate = () => {
    setEditing(null);
    setFormText('');
    setFormType('SINGLE_CHOICE');
    setFormAlts([
      { text: '', isCorrect: true, order: 1 },
      { text: '', isCorrect: false, order: 2 },
      { text: '', isCorrect: false, order: 3 },
      { text: '', isCorrect: false, order: 4 },
    ]);
    setShowModal(true);
  };

  const openEdit = (q: Question) => {
    setEditing(q);
    setFormText(q.text);
    setFormType(q.type);
    setFormAlts(q.alternatives.map(a => ({ text: a.text, isCorrect: a.isCorrect, order: a.order })));
    setShowModal(true);
  };

  const addAlternative = () => {
    setFormAlts([...formAlts, { text: '', isCorrect: false, order: formAlts.length + 1 }]);
  };

  const removeAlternative = (index: number) => {
    if (formAlts.length <= 2) return;
    setFormAlts(formAlts.filter((_, i) => i !== index));
  };

  const updateAlt = (index: number, field: string, value: any) => {
    const updated = [...formAlts];
    if (field === 'isCorrect' && formType === 'SINGLE_CHOICE') {
      updated.forEach(a => a.isCorrect = false);
    }
    (updated[index] as any)[field] = value;
    setFormAlts(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let payloadAlts: any = [];

    if (formType !== 'ESSAY') {
      const altsFiltered = formAlts.filter(a => a.text.trim());
      if (altsFiltered.length < 2) { toast.error('Mínimo 2 alternativas'); return; }
      if (!altsFiltered.some(a => a.isCorrect)) { toast.error('Marque pelo menos uma alternativa correta'); return; }
      payloadAlts = altsFiltered.map((a, i) => ({ text: a.text, isCorrect: a.isCorrect, order: i + 1 }));
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/exams/${examId}/questions/${editing.id}`, { text: formText, type: formType, alternatives: payloadAlts });
        toast.success('Questão atualizada com sucesso!');
      } else {
        await api.post(`/exams/${examId}/questions`, { text: formText, type: formType, alternatives: payloadAlts });
        toast.success('Questão criada com sucesso!');
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar questão');
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (q: Question) => {
    setDeleteModalItem(q);
    setDeleteConfirmText('');
  };

  const confirmDelete = async () => {
    if (!deleteModalItem || deleteConfirmText !== 'EXCLUIR') return;
    setDeleting(true);
    try {
      await api.delete(`/exams/${examId}/questions/${deleteModalItem.id}`);
      toast.success('Questão excluída.');
      setDeleteModalItem(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir questão');
    } finally {
      setDeleting(false);
    }
  };

  const moveQuestion = async (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === questions.length - 1) return;

    const newQuestions = [...questions];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIndex];
    newQuestions[targetIndex] = temp;
    newQuestions.forEach((q, i) => { q.order = i + 1; });
    setQuestions(newQuestions);

    try {
      const orders = newQuestions.map(q => ({ id: q.id, order: q.order }));
      await api.post(`/exams/${examId}/questions/reorder`, { orders });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao reorganizar questões');
      loadData();
    }
  };

  const downloadTemplate = () => {
    const csv = 'texto_questao;tipo;alternativa_A;correta_A;alternativa_B;correta_B;alternativa_C;correta_C;alternativa_D;correta_D;alternativa_E;correta_E\n' +
      'Qual é a capital do Brasil?;SINGLE_CHOICE;Brasília;S;Buenos Aires;N;Rio de Janeiro;N;São Paulo;N;;\n' +
      'Descreva suas motivações para aprender TS.;ESSAY;;;;;;;;;;';
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_questoes.csv';
    a.click();
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    setImportErrors([]);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await api.post(`/exams/${examId}/questions/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportSuccessMsg(res.data.message);
      setShowImportModal(false);
      setImportFile(null);
      loadData();
    } catch (err: any) {
      if (err.response?.data?.details) {
        setImportErrors(err.response.data.details);
      } else {
        setImportErrors([err.response?.data?.error || 'Erro desconhecido ao importar o arquivo.']);
      }
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link to="/admin/exams" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
            <ArrowLeft className="w-4 h-4" /> Voltar para Provas
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">{exam?.title}</h2>
          <p className="text-sm text-muted-foreground">{questions.length} questão(ões) cadastrada(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowImportModal(true); setImportErrors([]); setImportFile(null); }}>
            <Upload className="w-4 h-4 mr-2" /> Importar CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nova Questão
          </Button>
        </div>
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma questão cadastrada.</p>
            <p className="text-sm text-muted-foreground">Clique em &quot;+ Nova Questão&quot; para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <Card key={q.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                      Questão {i + 1}
                    </span>
                    <Badge variant={q.type === 'ESSAY' ? 'secondary' : 'outline'} className="text-xs">
                      {q.type === 'SINGLE_CHOICE' ? 'Escolha Única' : q.type === 'MULTIPLE_CHOICE' ? 'Múltipla Escolha' : 'Dissertativa'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => moveQuestion(i, 'UP')}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === questions.length - 1} onClick={() => moveQuestion(i, 'DOWN')}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(q)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-sm leading-relaxed">{q.text}</p>
                {q.type === 'ESSAY' ? (
                  <p className="text-xs text-muted-foreground italic">Resposta em texto livre</p>
                ) : (
                  <div className="space-y-1">
                    {q.alternatives.map((a, j) => (
                      <div key={a.id || j} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${a.isCorrect ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted/40 text-muted-foreground'}`}>
                        <span className="font-semibold w-5 shrink-0">{String.fromCharCode(65 + j)}</span>
                        <span className="flex-1">{a.text}</span>
                        {a.isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Questão' : 'Nova Questão'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Enunciado *</Label>
              <Textarea
                value={formText}
                onChange={e => setFormText(e.target.value)}
                rows={4}
                required
                placeholder="Digite o enunciado da questão..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE_CHOICE">Escolha Única</SelectItem>
                  <SelectItem value="MULTIPLE_CHOICE">Múltipla Escolha</SelectItem>
                  <SelectItem value="ESSAY">Dissertativa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formType !== 'ESSAY' && (
              <div className="space-y-2">
                <Label>Alternativas</Label>
                <div className="space-y-2">
                  {formAlts.map((alt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-muted-foreground w-6 shrink-0">{String.fromCharCode(65 + i)}</span>
                      <Input
                        value={alt.text}
                        onChange={e => updateAlt(i, 'text', e.target.value)}
                        placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                        className="flex-1"
                      />
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer shrink-0">
                        <input
                          type={formType === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                          name="correct-alt"
                          checked={alt.isCorrect}
                          onChange={() => updateAlt(i, 'isCorrect', formType === 'SINGLE_CHOICE' ? true : !alt.isCorrect)}
                          className="accent-emerald-500"
                        />
                        Correta
                      </label>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" onClick={() => removeAlternative(i)} disabled={formAlts.length <= 2}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addAlternative}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Alternativa
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? 'Salvar' : 'Criar Questão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={!!deleteModalItem} onOpenChange={() => setDeleteModalItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir Questão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir esta questão? Esta ação não pode ser desfeita.</p>
            {deleteModalItem && (
              <blockquote className="border-l-4 border-destructive pl-3 text-sm text-muted-foreground italic">
                &ldquo;{deleteModalItem.text.substring(0, 100)}{deleteModalItem.text.length > 100 ? '...' : ''}&rdquo;
              </blockquote>
            )}
            <div className="space-y-2">
              <Label>Digite <strong>EXCLUIR</strong> para confirmar:</Label>
              <Input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="EXCLUIR"
                className={deleteConfirmText === 'EXCLUIR' ? 'border-emerald-500' : ''}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalItem(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteConfirmText !== 'EXCLUIR' || deleting} onClick={confirmDelete}>
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={(v) => { if (!importing) setShowImportModal(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Questões via CSV</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Envie um arquivo <code className="bg-muted px-1 rounded">.csv</code> com a estrutura esperada para inserção em lote.</p>
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Template CSV</p>
                <p className="text-xs text-muted-foreground">Separador: ponto-e-vírgula (;)</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>Baixar Template</Button>
            </div>
            <div className="space-y-2">
              <Label>Arquivo CSV *</Label>
              <Input type="file" accept=".csv" required onChange={e => setImportFile(e.target.files?.[0] || null)} />
            </div>
            {importErrors.length > 0 && (
              <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-sm font-semibold text-destructive mb-1">Atenção:</p>
                <ul className="text-xs text-destructive space-y-1 list-disc list-inside">
                  {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowImportModal(false)} disabled={importing}>Cancelar</Button>
              <Button type="submit" disabled={!importFile || importing}>
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {importing ? 'Importando...' : 'Iniciar Importação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Success Modal */}
      <Dialog open={!!importSuccessMsg} onOpenChange={() => setImportSuccessMsg('')}>
        <DialogContent className="max-w-sm text-center">
          <div className="text-5xl mb-2">🎉</div>
          <DialogTitle className="text-emerald-500 text-xl">Importação Concluída!</DialogTitle>
          <p className="text-muted-foreground text-sm mt-2">{importSuccessMsg}</p>
          <DialogFooter className="mt-4">
            <Button className="w-full" onClick={() => setImportSuccessMsg('')}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
