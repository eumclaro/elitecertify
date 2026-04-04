import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Upload,
  Download,
  ChevronUp,
  ChevronDown,
  Edit2,
  Trash2,
  CheckCircle2,
  Loader2,
  FileText,
  GripVertical,
  X,
  AlertCircle,
} from "lucide-react";

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

  const [deleteModalItem, setDeleteModalItem] = useState<Question | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar questões');
    }
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

    try {
      if (editing) {
        await api.put(`/exams/${examId}/questions/${editing.id}`, {
          text: formText, type: formType, alternatives: payloadAlts,
        });
        toast.success('Questão atualizada');
      } else {
        await api.post(`/exams/${examId}/questions`, {
          text: formText, type: formType, alternatives: payloadAlts,
        });
        toast.success('Questão criada');
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar questão');
    }
  };

  const confirmDelete = async () => {
    if (!deleteModalItem || deleteConfirmText !== 'EXCLUIR') return;
    try {
      await api.delete(`/exams/${examId}/questions/${deleteModalItem.id}`);
      setDeleteModalItem(null);
      toast.success('Questão excluída');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir questão');
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
      toast.success(res.data.message || 'Importação concluída!');
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

  const typeLabel = (type: string) => {
    switch (type) {
      case 'SINGLE_CHOICE': return 'Escolha Única';
      case 'MULTIPLE_CHOICE': return 'Múltipla Escolha';
      case 'ESSAY': return 'Dissertativa';
      default: return type;
    }
  };

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case 'SINGLE_CHOICE': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'MULTIPLE_CHOICE': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'ESSAY': return 'bg-violet-500/10 text-violet-500 border-violet-500/20';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Link
            to="/admin/exams"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="size-3.5" />
            Voltar para Provas
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Questões</h1>
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground">{exam?.title}</p>
            <Badge variant="outline" className="font-mono text-xs">
              {questions.length}/{exam?.questionCount}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowImportModal(true); setImportErrors([]); setImportFile(null); }}
            className="gap-2"
          >
            <Upload className="size-3.5" />
            Importar CSV
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="size-3.5" />
            Nova Questão
          </Button>
        </div>
      </div>

      {/* Question Cards */}
      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-xl bg-muted/10">
          <FileText className="size-12 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground font-medium">Nenhuma questão cadastrada</p>
          <p className="text-sm text-muted-foreground/60 mb-6">Clique em "Nova Questão" para começar</p>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" />
            Criar Primeira Questão
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className="bg-card rounded-xl border overflow-hidden hover:border-primary/20 transition-colors"
            >
              {/* Question Header */}
              <div className="flex items-center justify-between p-4 border-b bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <GripVertical className="size-4" />
                    <span className="text-sm font-bold tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <Badge className={typeBadgeColor(q.type)}>{typeLabel(q.type)}</Badge>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="icon"
                    className="size-8"
                    disabled={i === 0}
                    onClick={() => moveQuestion(i, 'UP')}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="size-8"
                    disabled={i === questions.length - 1}
                    onClick={() => moveQuestion(i, 'DOWN')}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <div className="w-px h-5 bg-border mx-1" />
                  <Button
                    variant="ghost" size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(q)}
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="size-8 text-muted-foreground hover:text-red-500"
                    onClick={() => { setDeleteModalItem(q); setDeleteConfirmText(''); }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Question Body */}
              <div className="p-4">
                <p className="text-sm leading-relaxed mb-3">{q.text}</p>

                {q.type === 'ESSAY' ? (
                  <p className="text-xs italic text-muted-foreground border rounded-lg p-3 bg-muted/10">
                    Questão dissertativa — resposta em texto livre
                  </p>
                ) : (
                  <div className="grid gap-1.5">
                    {q.alternatives.map((a, j) => (
                      <div
                        key={a.id || j}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          a.isCorrect
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : 'bg-muted/30 border border-transparent'
                        }`}
                      >
                        <span className={`flex items-center justify-center size-6 rounded-md text-xs font-bold ${
                          a.isCorrect
                            ? 'bg-emerald-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {String.fromCharCode(65 + j)}
                        </span>
                        <span className="flex-1">{a.text}</span>
                        {a.isCorrect && <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showModal} onOpenChange={(open) => !open && setShowModal(false)}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Questão' : 'Nova Questão'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Altere o enunciado e alternativas da questão.' : 'Preencha o enunciado e configure as alternativas.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Alternativas</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addAlternative} className="gap-1.5 h-7 text-xs">
                    <Plus className="size-3" />
                    Adicionar
                  </Button>
                </div>

                <div className="space-y-2">
                  {formAlts.map((alt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex items-center justify-center size-8 rounded-md bg-muted text-xs font-bold text-muted-foreground shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <Input
                        value={alt.text}
                        onChange={e => updateAlt(i, 'text', e.target.value)}
                        placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                        className="flex-1"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap select-none">
                        <input
                          type={formType === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                          name="correct-alt"
                          checked={alt.isCorrect}
                          onChange={() => updateAlt(i, 'isCorrect', formType === 'SINGLE_CHOICE' ? true : !alt.isCorrect)}
                          className="accent-emerald-500"
                        />
                        Correta
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-red-500 shrink-0"
                        onClick={() => removeAlternative(i)}
                        disabled={formAlts.length <= 2}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">{editing ? 'Salvar Alterações' : 'Criar Questão'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteModalItem} onOpenChange={(open) => !open && setDeleteModalItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Excluir Questão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta questão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteModalItem && (
            <div className="my-2 p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-sm italic text-muted-foreground">
              "{deleteModalItem.text.substring(0, 120)}{deleteModalItem.text.length > 120 ? '...' : ''}"
            </div>
          )}

          <div className="space-y-2">
            <Label>Digite <strong>EXCLUIR</strong> para confirmar:</Label>
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="EXCLUIR"
              className={deleteConfirmText === 'EXCLUIR' ? 'border-emerald-500 ring-1 ring-emerald-500' : ''}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteConfirmText !== 'EXCLUIR'}
              className="bg-red-500 hover:bg-red-600"
            >
              Excluir Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={showImportModal} onOpenChange={(open) => !importing && setShowImportModal(open)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Importar Questões via CSV</DialogTitle>
            <DialogDescription>
              Envie um arquivo <code className="text-xs bg-muted px-1 py-0.5 rounded">.csv</code> para inserção em lote de questões.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Template de Referência</p>
                <p className="text-xs text-muted-foreground">Baixe o nosso template para evitar erros (separador: ;)</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 shrink-0">
                <Download className="size-3" />
                Baixar
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Arquivo CSV *</Label>
              <Input
                type="file"
                accept=".csv"
                required
                onChange={e => setImportFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>

            {importErrors.length > 0 && (
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg space-y-2 max-h-[200px] overflow-y-auto">
                <p className="text-sm font-medium text-red-500 flex items-center gap-1.5">
                  <AlertCircle className="size-3.5" />
                  Atenção
                </p>
                <ul className="text-xs text-red-400 space-y-1 list-disc pl-4">
                  {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowImportModal(false)} disabled={importing}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!importFile || importing} className="gap-2">
                {importing && <Loader2 className="size-3.5 animate-spin" />}
                {importing ? 'Importando...' : 'Iniciar Importação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
