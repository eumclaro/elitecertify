import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';

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
      if (altsFiltered.length < 2) { alert('Mínimo 2 alternativas'); return; }
      if (!altsFiltered.some(a => a.isCorrect)) { alert('Marque pelo menos uma alternativa correta'); return; }
      payloadAlts = altsFiltered.map((a, i) => ({ text: a.text, isCorrect: a.isCorrect, order: i + 1 }));
    }

    try {
      if (editing) {
        await api.put(`/exams/${examId}/questions/${editing.id}`, {
          text: formText, type: formType,
          alternatives: payloadAlts,
        });
      } else {
        await api.post(`/exams/${examId}/questions`, {
          text: formText, type: formType,
          alternatives: payloadAlts,
        });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar questão');
    }
  };

  const openDelete = (q: Question) => {
    setDeleteModalItem(q);
    setDeleteConfirmText('');
  };

  const confirmDelete = async () => {
    if (!deleteModalItem || deleteConfirmText !== 'EXCLUIR') return;
    try {
      await api.delete(`/exams/${examId}/questions/${deleteModalItem.id}`);
      setDeleteModalItem(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir questão');
    }
  };

  const moveQuestion = async (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === questions.length - 1) return;

    const newQuestions = [...questions];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;

    // Swap
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIndex];
    newQuestions[targetIndex] = temp;

    // Update orders locally
    newQuestions.forEach((q, i) => { q.order = i + 1; });
    setQuestions(newQuestions);

    try {
      const orders = newQuestions.map(q => ({ id: q.id, order: q.order }));
      await api.post(`/exams/${examId}/questions/reorder`, { orders });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao reorganizar questões');
      loadData(); // Revert on failure
    }
  };

  const downloadTemplate = () => {
    const csv = 'texto_questao;tipo;alternativa_A;correta_A;alternativa_B;correta_B;alternativa_C;correta_C;alternativa_D;correta_D;alternativa_E;correta_E\n' +
                'Qual é a capital do Brasil?;SINGLE_CHOICE;Brasília;S;Buenos Aires;N;Rio de Janeiro;N;São Paulo;N;;\n' +
                'Descreva suas motivações para aprender TS.;ESSAY;;;;;;;;;;';
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' }); // UTF-8 BOM para Excel
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

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="crud-page">
      <div className="page-header">
        <div>
          <Link to="/admin/exams" className="back-link">← Voltar para Provas</Link>
          <h2>Questões: {exam?.title}</h2>
          <p>{questions.length}/{exam?.questionCount} questão(ões)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => { setShowImportModal(true); setImportErrors([]); setImportFile(null); }}>
            📥 Importar CSV
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ Nova Questão</button>
        </div>
      </div>

      {/* Question Cards */}
      <div className="questions-list">
        {questions.length === 0 ? (
          <div className="empty-card">
            <p>📝 Nenhuma questão cadastrada. Clique em "+ Nova Questão" para começar.</p>
          </div>
        ) : questions.map((q, i) => (
          <div key={q.id} className="question-card">
            <div className="question-header">
              <span className="question-number">Questão {i + 1}</span>
              <div className="actions" style={{ display: 'flex', gap: '5px' }}>
                <button className="btn btn-sm btn-outline" disabled={i === 0} onClick={() => moveQuestion(i, 'UP')} title="Mover para cima">↑</button>
                <button className="btn btn-sm btn-outline" disabled={i === questions.length - 1} onClick={() => moveQuestion(i, 'DOWN')} title="Mover para baixo">↓</button>
                <div style={{ width: '10px' }}></div> {/* Spacer */}
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(q)}>Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => openDelete(q)}>Excluir</button>
              </div>
            </div>
            <p className="question-text">{q.text}</p>
            <div className="alternatives-list">
              {q.type === 'ESSAY' ? (
                <div className="alternative-item"><span className="alt-text" style={{ fontStyle: 'italic', color: '#9ca3af' }}>Questão Dissertativa (Resposta em texto livre)</span></div>
              ) : q.alternatives.map((a, j) => (
                <div key={a.id || j} className={`alternative-item ${a.isCorrect ? 'correct' : ''}`}>
                  <span className="alt-letter">{String.fromCharCode(65 + j)}</span>
                  <span className="alt-text">{a.text}</span>
                  {a.isCorrect && <span className="alt-check">✓</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Editar Questão' : 'Nova Questão'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Enunciado *</label>
                <textarea value={formText} onChange={e => setFormText(e.target.value)} rows={4} required placeholder="Digite o enunciado da questão..." />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={formType} onChange={e => setFormType(e.target.value)}>
                  <option value="SINGLE_CHOICE">Escolha Única</option>
                  <option value="MULTIPLE_CHOICE">Múltipla Escolha</option>
                  <option value="ESSAY">Dissertativa</option>
                </select>
              </div>

              {formType !== 'ESSAY' && (
                <div className="form-group">
                  <label>Alternativas</label>
                  {formAlts.map((alt, i) => (
                    <div key={i} className="alt-input-row">
                      <span className="alt-letter-input">{String.fromCharCode(65 + i)}</span>
                      <input
                        type="text" value={alt.text}
                        onChange={e => updateAlt(i, 'text', e.target.value)}
                        placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                      />
                      <label className="alt-correct-label">
                        <input
                          type={formType === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                          name="correct-alt"
                          checked={alt.isCorrect}
                          onChange={() => updateAlt(i, 'isCorrect', formType === 'SINGLE_CHOICE' ? true : !alt.isCorrect)}
                        />
                        Correta
                      </label>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => removeAlternative(i)} disabled={formAlts.length <= 2}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm btn-outline" onClick={addAlternative}>+ Adicionar Alternativa</button>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Salvar' : 'Criar Questão'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalItem && (
        <div className="modal-overlay" onClick={() => setDeleteModalItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>Excluir Questão</h3>
              <button className="modal-close" onClick={() => setDeleteModalItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Tem certeza que deseja excluir esta questão?</p>
              <blockquote style={{ margin: '1rem 0', padding: '1rem', background: '#2a1a1a', borderLeft: '4px solid #ef4444', color: '#fca5a5', borderRadius: '4px', fontStyle: 'italic' }}>
                "{deleteModalItem.text.substring(0, 100)}..."
              </blockquote>
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label>Digite <strong>EXCLUIR</strong> para confirmar:</label>
                <input 
                  type="text" 
                  value={deleteConfirmText} 
                  onChange={e => setDeleteConfirmText(e.target.value)} 
                  placeholder="EXCLUIR"
                  style={{ borderColor: deleteConfirmText === 'EXCLUIR' ? '#22c55e' : '' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteModalItem(null)}>Cancelar</button>
              <button 
                type="button" 
                className="btn btn-danger" 
                disabled={deleteConfirmText !== 'EXCLUIR'}
                onClick={confirmDelete}
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importing && setShowImportModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Importar Questões via CSV</h3>
              <button className="modal-close" onClick={() => !importing && setShowImportModal(false)}>✕</button>
            </div>
            <form onSubmit={handleImportSubmit} className="modal-body">
              <p>Envie um arquivo <code>.csv</code> contendo a estrutura esperada para inserção em lote de questões.</p>
              
              <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Formato Opcional/Template</strong>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af' }}>Recomendamos baixar o nosso template para evitar erros de formatação (separador usado: ';').</p>
                </div>
                <button type="button" className="btn btn-sm btn-secondary" onClick={downloadTemplate}>Baixar Template</button>
              </div>

              <div className="form-group">
                <label>Arquivo CSV *</label>
                <input 
                  type="file" 
                  accept=".csv" 
                  required
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  style={{ display: 'block', padding: '0.5rem 0' }}
                />
              </div>

              {importErrors.length > 0 && (
                <div style={{ background: '#2a1a1a', borderLeft: '4px solid #ef4444', padding: '1rem', marginTop: '1rem', color: '#fca5a5', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                  <p style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>Atenção:</p>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
                    {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)} disabled={importing}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!importFile || importing}>
                  {importing ? 'Importando...' : 'Iniciar Importação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Success Modal */}
      {importSuccessMsg && (
        <div className="modal-overlay" onClick={() => setImportSuccessMsg('')}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '3.5rem', margin: '0.5rem 0', color: '#10b981' }}>🎉</div>
            <h3 style={{ marginBottom: '1rem', color: '#10b981', fontSize: '1.5rem' }}>Importação Concluída!</h3>
            <p style={{ color: '#d1d5db', marginBottom: '2rem', fontSize: '1.1rem' }}>{importSuccessMsg}</p>
            <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} onClick={() => setImportSuccessMsg('')}>
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
