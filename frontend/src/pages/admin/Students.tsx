import { useState, useEffect, type FormEvent } from 'react';
import api from '../../services/api';

interface Student {
  id: string;
  cpf: string | null;
  phone: string | null;
  status: string;
  enrollmentDate: string;
  user: { id: string; name: string; email: string; active: boolean; lastLoginAt: string | null };
  classes: Array<{ class: { id: string; name: string } }>;
  cooldowns?: Array<{ endsAt: string }>;
  examAttempts?: Array<{ score: number; resultStatus: string; exam: { title: string } }>;
}

interface Cooldown {
  id: string;
  status: string;
  endsAt: string;
  examId: string;
  exam: { id: string; title: string };
}

interface ClassOption {
  id: string;
  name: string;
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Modal de Dados (CPF e Telefone)
  const [showDataModal, setShowDataModal] = useState(false);
  const [activeDataStudent, setActiveDataStudent] = useState<Student | null>(null);

  // Modal de Turmas (Classes)
  const [showClassesModal, setShowClassesModal] = useState(false);
  const [activeClassesStudent, setActiveClassesStudent] = useState<Student | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classSearch, setClassSearch] = useState('');
  const [savingClasses, setSavingClasses] = useState(false);

  // Cooldowns Modal
  const [showCooldownsModal, setShowCooldownsModal] = useState(false);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [cooldowns, setCooldowns] = useState<Cooldown[]>([]);
  const [confirmCooldown, setConfirmCooldown] = useState<Cooldown | null>(null);
  const [confirmResend, setConfirmResend] = useState<Student | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // States for CSV Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({ name: '', email: '', password: '', cpf: '', phone: '' });

  const loadStudents = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/students', { params: { search, page, limit: 20 } });
      setStudents(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadClasses = async () => {
    try { const res = await api.get('/classes'); setClasses(res.data); } catch {}
  };

  useEffect(() => { loadStudents(); loadClasses(); }, []);

  const handleSearch = () => loadStudents(1);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', cpf: '', phone: '' });
    setShowModal(true);
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    setForm({
      name: student.user.name,
      email: student.user.email,
      password: '',
      cpf: student.cpf || '',
      phone: student.phone || '',
    });
    setShowModal(true);
  };

  const openDataModal = (student: Student) => {
    setActiveDataStudent(student);
    setShowDataModal(true);
  };

  const openClassesModal = (student: Student) => {
    setActiveClassesStudent(student);
    setSelectedClassIds(student.classes.map(c => c.class.id));
    setClassSearch('');
    setShowClassesModal(true);
  };

  const saveClasses = async () => {
    if (!activeClassesStudent) return;
    setSavingClasses(true);
    try {
      await api.put(`/students/${activeClassesStudent.id}`, { classIds: selectedClassIds });
      setShowClassesModal(false);
      loadStudents(pagination.page);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Erro ao vincular turmas');
    } finally {
      setSavingClasses(false);
    }
  };

  const openCooldowns = async (student: Student) => {
    setActiveStudent(student);
    setShowCooldownsModal(true);
    try {
      const res = await api.get(`/students/${student.id}/cooldowns`);
      setCooldowns(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleClearCooldown = (cooldown: Cooldown) => {
    setConfirmCooldown(cooldown);
  };

  const executeClearCooldown = async () => {
    if (!confirmCooldown) return;
    setActionLoading(true);
    try {
      await api.put(`/exams/cooldowns/${confirmCooldown.id}/clear`);
      // refresh cooldowns
      if (activeStudent) openCooldowns(activeStudent);
      setConfirmCooldown(null);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Erro ao liberar cooldown');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/students/${editing.id}`, {
          name: form.name, email: form.email, cpf: form.cpf || null, phone: form.phone || null,
        });
      } else {
        await api.post('/students', {
          name: form.name, email: form.email, password: form.password, cpf: form.cpf || null, phone: form.phone || null,
        });
      }
      setShowModal(false);
      loadStudents(pagination.page);
      setSuccessMessage(`Aluno ${editing ? 'atualizado' : 'criado'} com sucesso!`);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Erro ao salvar aluno');
    }
  };

  const handleDelete = async (student: Student) => {
    setConfirmDelete(student);
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/students/${confirmDelete.id}`);
      setConfirmDelete(null);
      loadStudents(pagination.page);
      setSuccessMessage(`Aluno ${confirmDelete.user.name} excluído com sucesso.`);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Erro ao excluir aluno');
    }
  };
  
  const handleResendAccess = async (student: Student) => {
    setConfirmResend(student);
    setShowDataModal(false);
  };

  const executeResendAccess = async () => {
    if (!confirmResend) return;
    setActionLoading(true);
    try {
      await api.post(`/students/${confirmResend.id}/resend-access`);
      setConfirmResend(null);
      setSuccessMessage(`E-mail de acesso para ${confirmResend.user.name} enviado com sucesso!`);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Erro ao reenviar acesso');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="crud-page">
      <div className="page-header">
        <div>
          <h2>Alunos</h2>
          <p>{pagination.total} aluno(s) cadastrado(s)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>Importar CSV</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Novo Aluno</button>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className="btn btn-secondary" onClick={handleSearch}>Buscar</button>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner"></div></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Turmas</th>
                <th>Última Nota</th>
                <th>Cooldown</th>
                <th style={{ minWidth: '340px', whiteSpace: 'nowrap' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={8} className="empty-text">Nenhum aluno encontrado</td></tr>
              ) : students.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.user.name}</strong></td>
                  <td>{s.user.email}</td>
                  <td>{s.classes.map(c => c.class.name).join(', ') || '-'}</td>
                  
                  <td>
                    {s.examAttempts && s.examAttempts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: s.examAttempts[0].resultStatus === 'PASSED' ? '#22c55e' : '#ef4444' }}>
                          {s.examAttempts[0].score}%
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.examAttempts[0].exam.title}>
                          {s.examAttempts[0].exam.title}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: '#64748b' }}>-</span>
                    )}
                  </td>

                  <td>
                    {s.cooldowns && s.cooldowns.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#f97316', fontWeight: 'bold', fontSize: '0.85rem' }}>Bloqueado</span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          Até {new Date(s.cooldowns[0].endsAt).toLocaleDateString('pt-BR')} {new Date(s.cooldowns[0].endsAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: '#64748b' }}>-</span>
                    )}
                  </td>

                  <td className="actions" style={{ whiteSpace: 'nowrap', minWidth: '340px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'nowrap', alignItems: 'center', minWidth: 'max-content' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => openDataModal(s)}>Dados</button>
                      <button className="btn btn-sm btn-outline" onClick={() => openClassesModal(s)}>Turmas</button>
                      <button 
                        className={`btn btn-sm ${s.cooldowns && s.cooldowns.length > 0 ? '' : 'btn-outline'}`} 
                        style={s.cooldowns && s.cooldowns.length > 0 ? { backgroundColor: '#fff7ed', color: '#ea580c', borderColor: '#fed7aa', fontWeight: 'bold' } : {}}
                        onClick={() => openCooldowns(s)}
                      >
                        Cooldowns
                      </button>
                      <button className="btn btn-sm btn-outline" onClick={() => handleResendAccess(s)} disabled={actionLoading}>Reenviar</button>
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(s)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="pagination">
          {Array.from({ length: pagination.pages }, (_, i) => (
            <button
              key={i}
              className={`btn btn-sm ${pagination.page === i + 1 ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => loadStudents(i + 1)}
            >{i + 1}</button>
          ))}
        </div>
      )}

      {/* Modal CRUD */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Editar Aluno' : 'Novo Aluno'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Nome *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
              </div>
              {!editing && (
                <div className="form-group">
                  <label>Senha *</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>CPF</label>
                  <input type="text" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
                </div>
                <div className="form-group">
                  <label>Telefone</label>
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Salvar' : 'Criar Aluno'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cooldowns */}
      {showCooldownsModal && activeStudent && (
        <div className="modal-overlay" onClick={() => setShowCooldownsModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cooldowns Ativos de {activeStudent.user.name}</h3>
              <button className="modal-close" onClick={() => setShowCooldownsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {cooldowns.length === 0 ? (
                <div className="empty-state">Este aluno não está bloqueado em nenhuma prova atualmente.</div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Prova Bloqueada</th>
                        <th>Data de Liberação (Fim do Cooldown)</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cooldowns.map(c => (
                        <tr key={c.id}>
                          <td><strong>{c.exam.title}</strong></td>
                          <td>{new Date(c.endsAt).toLocaleDateString()} às {new Date(c.endsAt).toLocaleTimeString()}</td>
                          <td className="actions">
                            <button className="btn btn-sm btn-primary" onClick={() => handleClearCooldown(c)}>Liberar Prova</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Modals moved to the end for better layering */}


      {/* Modal de Dados Complementares */}
      {showDataModal && activeDataStudent && (
        <div className="modal-overlay" onClick={() => setShowDataModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Dados do Aluno</h3>
              <button className="modal-close" onClick={() => setShowDataModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>NOME</div>
                  <div style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 500 }}>{activeDataStudent.user.name || 'Não informado'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>EMAIL</div>
                  <div style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{activeDataStudent.user.email || 'Não informado'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>CPF</div>
                  <div style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{activeDataStudent.cpf || 'Não informado'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>WHATSAPP / TELEFONE</div>
                  <div style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{activeDataStudent.phone || 'Não informado'}</div>
                </div>
              </div>
              <div style={{ padding: '1rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9rem' }}>Acesso do Aluno</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Gera uma nova senha e envia por e-mail</div>
                </div>
                <button 
                  className="btn btn-sm btn-outline" 
                  onClick={() => handleResendAccess(activeDataStudent)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Enviando...' : 'Reenviar E-mail de Boas-vindas'}
                </button>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setShowDataModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestão de Turmas */}
      {showClassesModal && activeClassesStudent && (
        <div className="modal-overlay" onClick={() => !savingClasses && setShowClassesModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
            <div className="modal-header">
              <h3>Gerenciar Turmas do Aluno</h3>
              <button className="modal-close" onClick={() => !savingClasses && setShowClassesModal(false)} disabled={savingClasses}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Aluno Info */}
              <div style={{ padding: '1rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ALUNO</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>{activeClassesStudent.user.name}</div>
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>{activeClassesStudent.user.email}</div>
              </div>

              {/* Turmas Atuais */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#e2e8f0' }}>Turmas Vinculadas</h4>
                  <span style={{ fontSize: '0.8rem', backgroundColor: '#3b82f6', color: '#fff', padding: '0.1rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }}>
                    {selectedClassIds.length}
                  </span>
                </div>
                
                {selectedClassIds.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px dashed #334155', color: '#64748b' }}>
                    Nenhuma turma vinculada a este aluno.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                    {selectedClassIds.map(classId => {
                      const c = classes.find(cls => cls.id === classId);
                      return (
                        <div key={classId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                          <span style={{ color: '#f8fafc', fontWeight: 500 }}>{c?.name || 'Carregando...'}</span>
                          <button 
                            type="button"
                            onClick={() => setSelectedClassIds(prev => prev.filter(id => id !== classId))}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                            title="Remover"
                            disabled={savingClasses}
                          >
                            Remover ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Adicionar Nova Turma */}
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#e2e8f0' }}>Adicionar Turma</h4>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', marginBottom: '0.5rem' }}
                  placeholder="Buscar turma por nome..."
                  value={classSearch}
                  onChange={e => setClassSearch(e.target.value)}
                  disabled={savingClasses}
                />
                
                {classSearch.trim().length > 0 && (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', border: '1px solid #334155', borderRadius: '8px', backgroundColor: '#0f172a', padding: '0.25rem' }}>
                    {classes
                      .filter(c => !selectedClassIds.includes(c.id))
                      .filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase()))
                      .map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '4px', borderBottom: '1px solid #1e293b' }}>
                          <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{c.name}</span>
                          <button 
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setSelectedClassIds(prev => [...prev, c.id]);
                              setClassSearch('');
                            }}
                            disabled={savingClasses}
                          >
                            + Adicionar
                          </button>
                        </div>
                      ))
                    }
                    {classes.filter(c => !selectedClassIds.includes(c.id) && c.name.toLowerCase().includes(classSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                        Nenhuma turma encontrada.
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
            <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowClassesModal(false)} disabled={savingClasses}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveClasses} disabled={savingClasses}>
                {savingClasses ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importLoading && setShowImportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
            <div className="modal-header">
              <h3>Importar Alunos (CSV)</h3>
              <button className="modal-close" onClick={() => !importLoading && setShowImportModal(false)} disabled={importLoading}>✕</button>
            </div>
            
            {!importResults ? (
              <form onSubmit={async (e: any) => {
                e.preventDefault();
                const file = e.target.file.files[0];
                if (!file) return;

                setImportLoading(true);
                setImportResults(null);

                try {
                  const text = await file.text();
                  const lines = text.split('\n');
                  const students = [];

                  const headerLine = lines[0].toLowerCase();
                  const isSemicolon = headerLine.includes(';');
                  const delimiter = isSemicolon ? ';' : ',';
                  
                  const headers = headerLine.split(delimiter).map((h: string) => h.trim());
                  
                  const idxNome = headers.findIndex((h: string) => h.includes('nome'));
                  const idxEmail = headers.findIndex((h: string) => h.includes('email'));
                  const idxSenha = headers.findIndex((h: string) => h.includes('senha'));
                  const idxCpf = headers.findIndex((h: string) => h.includes('cpf'));
                  const idxTelefone = headers.findIndex((h: string) => h.includes('telefone') || h.includes('celular'));
                  const idxTurma = headers.findIndex((h: string) => h.includes('turma') || h.includes('class'));

                  if (idxNome === -1 || idxEmail === -1) {
                    throw new Error('O CSV deve conter as colunas "Nome" e "Email".');
                  }

                  for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const columns = lines[i].split(delimiter).map((c: string) => c.trim().replace(/^"|"$/g, ''));
                    students.push({
                      name: columns[idxNome],
                      email: columns[idxEmail],
                      password: idxSenha !== -1 && columns[idxSenha] ? columns[idxSenha] : '',
                      cpf: idxCpf !== -1 && columns[idxCpf] ? columns[idxCpf] : '',
                      phone: idxTelefone !== -1 && columns[idxTelefone] ? columns[idxTelefone] : '',
                      className: idxTurma !== -1 && columns[idxTurma] ? columns[idxTurma] : ''
                    });
                  }

                  if (students.length === 0) throw new Error('O arquivo CSV está vazio ou inválido.');

                  const { data } = await api.post('/students/import', { students });
                  setImportResults(data);
                  if (data.success > 0) loadStudents(pagination.page);

                } catch (err: any) {
                  alert(err.message || 'Erro ao ler ou processar arquivo CSV.');
                } finally {
                  setImportLoading(false);
                }
              }}>
                <div className="modal-body">
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
                    Selecione um arquivo CSV com cabeçalho contendo as colunas obrigatórias <strong>Nome, Email</strong> e opcionais <strong>Senha, CPF, Telefone, Turma</strong>.
                  </p>
                  <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
                    <button type="button" className="btn btn-sm btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8,nome,email,senha,cpf,telefone,turma\nJoao Silva,joao@email.com,,12345678909,11999999999,Turma A";
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", "modelo_importacao_alunos.csv");
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}>📥 Baixar modelo CSV</button>
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <input type="file" name="file" accept=".csv" required disabled={importLoading} style={{ padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', width: '100%', color: '#f8fafc' }} />
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)} disabled={importLoading}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={importLoading}>
                    {importLoading ? 'Processando...' : 'Importar Lote'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="modal-body">
                <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', border: '1px solid #334155' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e2e8f0' }}>{importResults.total}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Processados</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{importResults.success}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Sucesso</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{importResults.ignoredEmail}</div>
                    <div style={{ fontSize: '0.8rem', color: '#f59e0b', textTransform: 'uppercase' }}>E-mails Existentes</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{importResults.errors}</div>
                    <div style={{ fontSize: '0.8rem', color: '#ef4444', textTransform: 'uppercase' }}>Falhas de Criação</div>
                  </div>
                </div>

                {importResults.details?.length > 0 && (
                  <div style={{ marginTop: '1rem', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#0f172a', border: '1px solid #ef4444', borderRadius: '6px', padding: '1rem' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#ef4444' }}>Logs de processamento:</h5>
                    <ul style={{ margin: 0, padding: '0 0 0 1rem', color: '#cbd5e1', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {importResults.details.map((detail: string, i: number) => (
                        <li key={i}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-primary" onClick={() => { setShowImportModal(false); setImportResults(null); }}>
                    Entendido, Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Feedback Modals - DECLARED LAST with high z-index */}
      {confirmCooldown && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setConfirmCooldown(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Confirmar Liberação</h3>
              <button className="modal-close" onClick={() => setConfirmCooldown(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Tem certeza que deseja liberar o aluno para tentar a prova <strong>{confirmCooldown.exam.title}</strong> novamente agora?</p>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '1rem', color: '#9ca3af' }}>
                Isso irá zerar o tempo obrigatório de espera dele para esta prova especificamente.
              </p>
              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmCooldown(null)} disabled={actionLoading}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={executeClearCooldown} disabled={actionLoading}>
                  {actionLoading ? 'Liberando...' : 'Sim, Liberar Prova'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmResend && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setConfirmResend(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem' }}>📧</span>
                <h3 style={{ margin: 0 }}>Reenviar Acesso</h3>
              </div>
              <button className="modal-close" onClick={() => setConfirmResend(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem 1.25rem' }}>
              <p style={{ lineHeight: '1.5', color: '#e2e8f0', marginBottom: '1.25rem' }}>
                Deseja reenviar as instruções de acesso para <strong>{confirmResend.user.name}</strong>?
              </p>
              
              <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: '0.9rem', marginBottom: '4px' }}>Atenção</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      Uma <strong>NOVA senha</strong> será gerada automaticamente e enviada para o e-mail cadastrado. A senha anterior deixará de funcionar imediatamente.
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmResend(null)} disabled={actionLoading} style={{ padding: '0.6rem 1.2rem' }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={executeResendAccess} disabled={actionLoading} style={{ padding: '0.6rem 1.2rem' }}>
                  {actionLoading ? 'Enviando...' : 'Sim, Reenviar E-mail'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>Excluir Aluno</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Tem certeza que deseja excluir o aluno <strong>{confirmDelete.user.name}</strong>?</p>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '1rem', color: '#9ca3af' }}>
                Esta ação é irreversível e removerá todos os logs e tentativas deste aluno do sistema.
              </p>
              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={executeDelete}>Excluir Agora</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setErrorMessage(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-body" style={{ padding: '2.5rem 1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
              <h3 style={{ marginBottom: '0.5rem', color: '#ef4444' }}>Ops! Algo deu errado</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                {errorMessage}
              </p>
              <button className="btn btn-primary" onClick={() => setErrorMessage(null)} style={{ width: '100%', padding: '0.75rem' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setSuccessMessage(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-body" style={{ padding: '2.5rem 1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h3 style={{ marginBottom: '0.5rem', color: '#10b981' }}>Tudo certo!</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                {successMessage}
              </p>
              <button className="btn btn-primary" onClick={() => setSuccessMessage(null)} style={{ width: '100%', padding: '0.75rem' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
