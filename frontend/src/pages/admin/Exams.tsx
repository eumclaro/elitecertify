import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Exam releases are now managed in ExamReleases.tsx
// so we don't need the full Release interface, but we keep it minimal for count
interface ExamRelease {
  id: string;
}

interface Exam {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  durationMinutes: number;
  passingScore: number;
  maxAttempts: number;
  cooldownDays: number;
  questionOrder: 'FIXED' | 'RANDOM';
  status: string;
  releases: ExamRelease[];
  _count: { questions: number; attempts: number; releases: number };
  createdAt: string;
}

interface Option {
  id: string;
  name: string;
}

export default function Exams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);

  const [form, setForm] = useState({
    title: '', description: '',
    questionCount: 10, durationMinutes: 60, passingScore: 70,
    maxAttempts: 0, cooldownDays: 0, questionOrder: 'FIXED',
  });

  const loadExams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/exams', { params: { search } });
      setExams(res.data.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadExams(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', questionCount: 10, durationMinutes: 60, passingScore: 70, maxAttempts: 0, cooldownDays: 0, questionOrder: 'FIXED' });
    setShowModal(true);
  };

  const openEdit = (exam: Exam) => {
    setEditing(exam);
    setForm({
      title: exam.title,
      description: exam.description || '',
      questionCount: exam.questionCount,
      durationMinutes: exam.durationMinutes,
      passingScore: exam.passingScore,
      maxAttempts: exam.maxAttempts,
      cooldownDays: exam.cooldownDays,
      questionOrder: exam.questionOrder,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/exams/${editing.id}`, form);
      } else {
        await api.post('/exams', form);
      }
      setShowModal(false);
      loadExams();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar prova');
    }
  };

  const handleDelete = async (exam: Exam) => {
    if (!confirm(`Excluir a prova "${exam.title}"?`)) return;
    try {
      await api.delete(`/exams/${exam.id}`);
      loadExams();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir prova');
    }
  };

  const toggleStatus = async (exam: Exam) => {
    const newStatus = exam.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await api.put(`/exams/${exam.id}`, { status: newStatus });
      loadExams();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar status');
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      DRAFT: { label: 'Rascunho', cls: 'badge-warning' },
      PUBLISHED: { label: 'Publicada', cls: 'badge-success' },
      ARCHIVED: { label: 'Arquivada', cls: 'badge-secondary' },
    };
    const s = map[status] || { label: status, cls: 'badge-secondary' };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div className="crud-page">
      <div className="page-header">
        <div>
          <h2>Provas</h2>
          <p>{exams.length} prova(s)</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nova Prova</button>
      </div>

      <div className="search-bar">
        <input
          type="text" placeholder="Buscar provas..."
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadExams()}
        />
        <button className="btn btn-secondary" onClick={loadExams}>Buscar</button>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner"></div></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Liberações</th>
                <th>Questões</th>
                <th>Duração / Aprov.</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {exams.length === 0 ? (
                <tr><td colSpan={6} className="empty-text">Nenhuma prova encontrada</td></tr>
              ) : exams.map(e => (
                <tr key={e.id}>
                  <td><strong>{e.title}</strong><br/><small style={{color:'#666'}}>{e.maxAttempts > 0 ? `${e.maxAttempts} tent.` : 'Ilimitado'} • {e.cooldownDays}d CD</small></td>
                  <td>
                    <span className="badge badge-secondary">{e._count.releases}</span>
                    <button className="btn btn-sm btn-link" onClick={() => navigate(`/admin/exams/${e.id}/releases`)}>Gerenciar</button>
                  </td>
                  <td>{e._count.questions}/{e.questionCount} {e.questionOrder === 'RANDOM' && '🔄'}</td>
                  <td>{e.durationMinutes}m / {e.passingScore}%</td>
                  <td>{getStatusBadge(e.status)}</td>
                  <td className="actions">
                    <button className="btn btn-sm btn-outline" onClick={() => navigate(`/admin/exams/${e.id}/questions`)}>Questões</button>
                    <button className="btn btn-sm btn-outline" onClick={() => openEdit(e)}>Editar</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => toggleStatus(e)}>
                      {e.status === 'PUBLISHED' ? 'Despublicar' : 'Publicar'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(e)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova/Editar Prova */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Editar Prova' : 'Nova Prova'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Título *</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              
              <div className="form-row form-row-3">
                <div className="form-group">
                  <label>Nº de Questões</label>
                  <input type="number" value={form.questionCount} onChange={e => setForm({ ...form, questionCount: +e.target.value })} min={1} required />
                </div>
                <div className="form-group">
                  <label>Duração (min)</label>
                  <input type="number" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: +e.target.value })} min={1} required />
                </div>
                <div className="form-group">
                  <label>% Aprovação</label>
                  <input type="number" value={form.passingScore} onChange={e => setForm({ ...form, passingScore: +e.target.value })} min={0} max={100} required />
                </div>
              </div>

              <div className="form-row form-row-3">
                <div className="form-group">
                  <label>Máx. Tentativas (0 = Ilimitado)</label>
                  <input type="number" value={form.maxAttempts} onChange={e => setForm({ ...form, maxAttempts: +e.target.value })} min={0} required />
                </div>
                <div className="form-group">
                  <label>Cooldown por Falha (Dias Corridos)</label>
                  <input type="number" value={form.cooldownDays} onChange={e => setForm({ ...form, cooldownDays: +e.target.value })} min={0} required />
                </div>
                <div className="form-group">
                  <label>Ordem das Questões</label>
                  <select value={form.questionOrder} onChange={e => setForm({ ...form, questionOrder: e.target.value as 'FIXED'|'RANDOM' })}>
                    <option value="FIXED">Fixa</option>
                    <option value="RANDOM">Aleatória</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Salvar' : 'Criar Prova'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
