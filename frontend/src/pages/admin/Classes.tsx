import { useState, useEffect, type FormEvent } from 'react';
import api from '../../services/api';

interface ClassItem {
  id: string;
  name: string;
  description: string;
  _count: { students: number };
  createdAt: string;
}

export default function Classes() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [classSearch, setClassSearch] = useState('');

  // Modal de Alunos da Turma
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [activeClass, setActiveClass] = useState<ClassItem | null>(null);
  const [initialClassStudents, setInitialClassStudents] = useState<any[]>([]);
  const [newlyAddedStudents, setNewlyAddedStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [savingStudents, setSavingStudents] = useState(false);

  // Debounce search de alunos
  useEffect(() => {
    if (studentSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get('/students', { params: { search: studentSearch, limit: 10 } });
        setSearchResults(res.data.data);
      } catch (err) { } 
      finally { setSearchLoading(false); }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [studentSearch]);

  const fetchClasses = async () => {
    try {
      const { data } = await api.get('/classes', { params: { search: classSearch } });
      setClasses(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClasses(); }, [classSearch]);

  const openNew = () => { setEditing(null); setForm({ name: '', description: '' }); setShowModal(true); };
  const openEdit = (c: ClassItem) => { setEditing(c); setForm({ name: c.name, description: c.description || '' }); setShowModal(true); };

  const openStudentsModal = async (c: ClassItem) => {
    setActiveClass(c);
    setInitialClassStudents([]);
    setNewlyAddedStudents([]);
    setStudentSearch('');
    setSearchResults([]);
    setShowStudentsModal(true);
    
    try {
      const res = await api.get(`/classes/${c.id}/students`);
      setInitialClassStudents(res.data);
    } catch (err) {
      alert('Erro ao carregar alunos');
    }
  };

  const saveStudents = async () => {
    if (!activeClass) return;
    setSavingStudents(true);
    try {
      await api.put(`/classes/${activeClass.id}/students`, {
        studentIds: [...initialClassStudents, ...newlyAddedStudents].map((s: any) => s.id)
      });
      setShowStudentsModal(false);
      fetchClasses();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao persistir alunos');
    } finally {
      setSavingStudents(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/classes/${editing.id}`, form);
      } else {
        await api.post('/classes', form);
      }
      setShowModal(false);
      fetchClasses();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta turma?')) return;
    await api.delete(`/classes/${id}`);
    fetchClasses();
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Turmas</h2>
          <p>Gerencie turmas e vínculos com alunos</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nova Turma</button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar turma por nome..."
          value={classSearch}
          onChange={e => setClassSearch(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={fetchClasses}>Buscar</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Alunos</th>
              <th>Criada em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr><td colSpan={5} className="empty-text">Nenhuma turma cadastrada</td></tr>
            ) : classes.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.description || '—'}</td>
                <td>
                  <span className="badge badge-secondary" style={{ cursor: 'pointer' }} onClick={() => openStudentsModal(c)}>
                    {c._count.students} alunos
                  </span>
                </td>
                <td>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                <td className="actions" style={{ whiteSpace: 'nowrap', minWidth: '220px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', alignItems: 'center', minWidth: 'max-content' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => openStudentsModal(c)}>Alunos</button>
                    <button className="btn btn-sm btn-outline" onClick={() => openEdit(c)}>✏️ Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>🗑️ Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Editar Turma' : 'Nova Turma'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nome da Turma *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Descrição</label>
                  <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">{editing ? 'Salvar' : 'Criar Turma'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Alunos da Turma */}
      {showStudentsModal && activeClass && (
        <div className="modal-overlay" onClick={() => !savingStudents && setShowStudentsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', width: '100%' }}>
            <div className="modal-header">
              <h3>Gerenciar Alunos da Turma</h3>
              <button className="modal-close" onClick={() => !savingStudents && setShowStudentsModal(false)} disabled={savingStudents}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Turma Info */}
              <div style={{ padding: '1rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TURMA</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>{activeClass.name}</div>
                {activeClass.description && <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.25rem' }}>{activeClass.description}</div>}
              </div>

              {/* Alunos Vinculados Resumo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '1.25rem', borderRadius: '8px', border: '1px solid #334155' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#e2e8f0' }}>Alunos Vinculados</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>Para remover alunos, acesse a gestão completa da turma.</p>
                </div>
                <span style={{ backgroundColor: '#3b82f6', color: '#fff', padding: '0.25rem 0.8rem', borderRadius: '16px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {initialClassStudents.length + newlyAddedStudents.length}
                </span>
              </div>

              {/* Novos Alunos (Se houver) */}
              {newlyAddedStudents.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Adicionados nesta sessão</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {newlyAddedStudents.map(student => (
                      <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px dashed #3b82f6' }}>
                        <div>
                          <div style={{ color: '#f8fafc', fontWeight: 500 }}>{student.name}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{student.email}</div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setNewlyAddedStudents(prev => prev.filter(s => s.id !== student.id))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                          title="Remover"
                          disabled={savingStudents}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buscar e Adicionar Aluno */}
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#e2e8f0' }}>Adicionar Aluno</h4>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', marginBottom: '0.5rem' }}
                    placeholder="Buscar aluno por nome ou email (min. 2 caracteres)..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    disabled={savingStudents}
                  />
                  {searchLoading && (
                    <span style={{ position: 'absolute', right: '10px', top: '12px', color: '#94a3b8', fontSize: '0.85rem' }}>Buscando...</span>
                  )}
                </div>
                
                {studentSearch.trim().length >= 2 && !searchLoading && (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', border: '1px solid #334155', borderRadius: '8px', backgroundColor: '#0f172a', padding: '0.25rem' }}>
                    {searchResults.filter(s => !initialClassStudents.some(cs => cs.id === s.id) && !newlyAddedStudents.some(cs => cs.id === s.id)).length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                        Nenhum aluno encontrado ou já vinculado.
                      </div>
                    ) : (
                      searchResults
                        .filter(s => !initialClassStudents.some(cs => cs.id === s.id) && !newlyAddedStudents.some(cs => cs.id === s.id))
                        .map(s => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '4px', borderBottom: '1px solid #1e293b' }}>
                            <div>
                              <div style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 500 }}>{s.user.name}</div>
                              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{s.user.email}</div>
                            </div>
                            <button 
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => {
                                setNewlyAddedStudents(prev => [{ id: s.id, name: s.user.name, email: s.user.email }, ...prev]);
                                setStudentSearch('');
                                setSearchResults([]);
                              }}
                              disabled={savingStudents}
                            >
                              + Adicionar
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>

            </div>
            <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowStudentsModal(false)} disabled={savingStudents}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveStudents} disabled={savingStudents}>
                {savingStudents ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
