import { useState, useEffect, type FormEvent } from 'react';
import api from '../../services/api';

interface Survey { id: string; title: string; status: string; classId: string | null; class: any; _count: { questions: number; invites: number; responses: number }; createdAt: string; }

export default function NpsSurveys() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Survey | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', classId: '', questions: [{ text: '', type: 'SCORE' }] });
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);

  const fetchSurveys = async () => {
    try {
      const { data } = await api.get('/nps/surveys');
      setSurveys(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchSurveys();
    api.get('/classes').then(r => setClasses(r.data)).catch(console.error);
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', classId: '', questions: [{ text: 'De 0 a 10, qual sua satisfação com o curso?', type: 'SCORE' }] });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/nps/surveys/${editing.id}`, { title: form.title, classId: form.classId || null });
      } else {
        await api.post('/nps/surveys', { title: form.title, classId: form.classId || null, questions: form.questions.filter(q => q.text.trim()) });
      }
      setShowModal(false);
      fetchSurveys();
    } catch (err) { console.error(err); }
  };

  const sendSurvey = async (id: string) => {
    try {
      const { data } = await api.post(`/nps/surveys/${id}/send`);
      alert(data.message);
      fetchSurveys();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao enviar');
    }
  };

  const viewResults = async (id: string) => {
    try {
      const { data } = await api.get(`/nps/surveys/${id}/results`);
      setSelectedSurvey(data);
    } catch (err) { console.error(err); }
  };

  const deleteSurvey = async (id: string) => {
    if (!confirm('Excluir pesquisa NPS?')) return;
    await api.delete(`/nps/surveys/${id}`);
    fetchSurveys();
  };

  const addQuestion = () => setForm(f => ({ ...f, questions: [...f.questions, { text: '', type: 'SCORE' }] }));
  const removeQuestion = (i: number) => setForm(f => ({ ...f, questions: f.questions.filter((_, idx) => idx !== i) }));
  const updateQuestion = (i: number, field: string, val: string) => {
    setForm(f => ({ ...f, questions: f.questions.map((q, idx) => idx === i ? { ...q, [field]: val } : q) }));
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  // Results view
  if (selectedSurvey) {
    const s = selectedSurvey;
    return (
      <div>
        <button className="btn btn-outline" onClick={() => setSelectedSurvey(null)} style={{marginBottom: 16}}>← Voltar</button>
        <div className="page-header"><div><h2>📊 Resultados: {s.survey.title}</h2></div></div>

        <div className="stats-grid">
          <div className="stat-card" style={{'--card-color': '#6366f1'} as any}>
            <div><span className="stat-value">{s.stats.totalInvites}</span><span className="stat-label">Convidados</span></div>
          </div>
          <div className="stat-card" style={{'--card-color': '#10b981'} as any}>
            <div><span className="stat-value">{s.stats.totalResponses}</span><span className="stat-label">Respostas</span></div>
          </div>
          <div className="stat-card" style={{'--card-color': '#f59e0b'} as any}>
            <div><span className="stat-value">{s.stats.responseRate}%</span><span className="stat-label">Taxa Resposta</span></div>
          </div>
          {s.stats.npsScore !== null && (
            <div className="stat-card" style={{'--card-color': s.stats.npsScore >= 50 ? '#10b981' : s.stats.npsScore >= 0 ? '#f59e0b' : '#ef4444'} as any}>
              <div><span className="stat-value">{s.stats.npsScore}</span><span className="stat-label">Score NPS</span></div>
            </div>
          )}
        </div>

        {s.stats.npsScore !== null && (
          <div className="dashboard-card" style={{marginBottom: 20}}>
            <h3>Distribuição NPS</h3>
            <div style={{display:'flex', gap: 24, marginTop: 12}}>
              <div><span style={{color:'var(--success)', fontWeight: 700, fontSize: 20}}>{s.stats.promoters}</span><br/><small>Promotores (9-10)</small></div>
              <div><span style={{color:'var(--warning)', fontWeight: 700, fontSize: 20}}>{s.stats.passives}</span><br/><small>Neutros (7-8)</small></div>
              <div><span style={{color:'var(--danger)', fontWeight: 700, fontSize: 20}}>{s.stats.detractors}</span><br/><small>Detratores (0-6)</small></div>
            </div>
          </div>
        )}

        <div className="dashboard-card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16}}>
            <h3>Respostas Individuais</h3>
            <a href={`/api/nps/surveys/${s.survey.id}/export`} className="btn btn-sm btn-outline">📥 Exportar CSV</a>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  {s.questions.map((q: any) => <th key={q.id}>{q.text.substring(0, 30)}...</th>)}
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {s.responses.length === 0 ? (
                  <tr><td colSpan={s.questions.length + 2} className="empty-text">Nenhuma resposta ainda</td></tr>
                ) : s.responses.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.studentName}</td>
                    {s.questions.map((q: any) => {
                      const detail = r.answers.find((a: any) => a.questionId === q.id);
                      return <td key={q.id}>{detail?.score ?? detail?.text ?? '—'}</td>;
                    })}
                    <td>{new Date(r.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>NPS — Pesquisas de Satisfação</h2><p>Gerencie pesquisas e visualize resultados</p></div>
        <button className="btn btn-primary" onClick={openNew}>+ Nova Pesquisa</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Título</th><th>Turma</th><th>Perguntas</th><th>Convites</th><th>Respostas</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {surveys.length === 0 ? (
              <tr><td colSpan={7} className="empty-text">Nenhuma pesquisa NPS</td></tr>
            ) : surveys.map(s => (
              <tr key={s.id}>
                <td><strong>{s.title}</strong></td>
                <td>{s.class?.name || '—'}</td>
                <td>{s._count.questions}</td>
                <td>{s._count.invites}</td>
                <td>{s._count.responses}</td>
                <td><span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : s.status === 'CLOSED' ? 'badge-danger' : 'badge-warning'}`}>{s.status}</span></td>
                <td className="actions">
                  <button className="btn btn-sm btn-outline" onClick={() => viewResults(s.id)}>📊 Resultados</button>
                  <button className="btn btn-sm btn-primary" onClick={() => sendSurvey(s.id)}>📤 Enviar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteSurvey(s.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Nova Pesquisa NPS</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Título *</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></div>
                <div className="form-group">
                  <label>Turma (opcional)</label>
                  <select value={form.classId} onChange={e => setForm({...form, classId: e.target.value})}>
                    <option value="">Todas</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div style={{marginBottom: 16}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
                    <label style={{fontWeight: 600}}>Perguntas</label>
                    <button type="button" className="btn btn-sm btn-outline" onClick={addQuestion}>+ Pergunta</button>
                  </div>
                  {form.questions.map((q, i) => (
                    <div key={i} style={{display:'flex', gap: 8, marginBottom: 8, alignItems: 'center'}}>
                      <input value={q.text} onChange={e => updateQuestion(i, 'text', e.target.value)} placeholder="Texto da pergunta" style={{flex: 1, padding: '8px 12px', background:'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13}} />
                      <select value={q.type} onChange={e => updateQuestion(i, 'type', e.target.value)} style={{padding: '8px', background:'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12}}>
                        <option value="SCORE">Score (0-10)</option>
                        <option value="TEXT">Texto livre</option>
                      </select>
                      {form.questions.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => removeQuestion(i)}>✕</button>}
                    </div>
                  ))}
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Criar Pesquisa</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
