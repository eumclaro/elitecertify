import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface ExamRelease {
  id: string;
  classId: string | null;
  studentId: string | null;
}

interface ExamAttemptSummary {
  studentId: string;
  score: number | null;
  resultStatus: 'PENDING' | 'PASSED' | 'FAILED' | 'FAILED_TIMEOUT' | 'FAILED_ABANDONMENT';
  executionStatus: string;
  startedAt: string;
}

interface CooldownSummary {
  id: string;
  studentId: string;
  endsAt: string;
}

interface Exam {
  id: string;
  title: string;
  maxAttempts: number;
  releases: ExamRelease[];
  attempts: ExamAttemptSummary[];
  cooldowns: CooldownSummary[];
}

interface ClassItem {
  id: string;
  name: string;
  _count: { students: number };
}

interface StudentItem {
  id: string;
  user: { name: string; email: string };
  cpf?: string;
  classes?: { classId: string; class: { name: string } }[];
}

export default function ExamReleases() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'classes' | 'students'>('classes');
  const [search, setSearch] = useState('');
  const [showOnlyReleased, setShowOnlyReleased] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<{ id: string; name: string; type: 'class' | 'student'; releaseId: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [examRes, classesRes, studentsRes] = await Promise.all([
        api.get(`/exams/${examId}`),
        api.get('/classes'),
        api.get('/students')
      ]);
      setExam(examRes.data);
      setClasses(classesRes.data.data || classesRes.data); // handles both pagination object or array
      setStudents(studentsRes.data.data || studentsRes.data);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar dados da liberação.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [examId]);

  const toggleReleaseClass = async (cls: ClassItem) => {
    if (!exam) return;
    const existingRelease = exam.releases.find(r => r.classId === cls.id);
    
    if (existingRelease) {
      setConfirmRevoke({ id: cls.id, name: cls.name, type: 'class', releaseId: existingRelease.id });
      return;
    }

    setActionLoading(cls.id);
    try {
      await api.post(`/exams/${examId}/releases`, { classId: cls.id });
      const examRes = await api.get(`/exams/${examId}`);
      setExam(examRes.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar liberação');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleReleaseStudent = async (stu: StudentItem) => {
    if (!exam) return;
    const existingRelease = exam.releases.find(r => r.studentId === stu.id);
    
    if (existingRelease) {
      setConfirmRevoke({ id: stu.id, name: stu.user.name, type: 'student', releaseId: existingRelease.id });
      return;
    }

    setActionLoading(stu.id);
    try {
      await api.post(`/exams/${examId}/releases`, { studentId: stu.id });
      const examRes = await api.get(`/exams/${examId}`);
      setExam(examRes.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar liberação');
    } finally {
      setActionLoading(null);
    }
  };

  const executeRevoke = async () => {
    if (!confirmRevoke) return;
    setActionLoading(confirmRevoke.id);
    try {
      await api.delete(`/exams/${examId}/releases/${confirmRevoke.releaseId}`);
      const examRes = await api.get(`/exams/${examId}`);
      setExam(examRes.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao revogar liberação');
    } finally {
      setActionLoading(null);
      setConfirmRevoke(null);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!exam) return <div className="empty-text">Prova não encontrada</div>;

  const filteredClasses = classes.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const isReleased = exam.releases.some(r => r.classId === c.id);
    return matchesSearch && (!showOnlyReleased || isReleased);
  });

  const filteredStudents = students.filter(s => {
    const name = s.user?.name || '';
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
    const isReleased = exam.releases.some(r => r.studentId === s.id);
    return matchesSearch && (!showOnlyReleased || isReleased);
  });

  return (
    <div className="crud-page">
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <button className="btn btn-sm btn-link" onClick={() => navigate('/admin/exams')} style={{ paddingLeft: 0, marginBottom: '0.5rem' }}>
            ← Voltar para Provas
          </button>
          <h2>Liberações: {exam.title}</h2>
          <p>Gerencie quais turmas e alunos individuais podem acessar esta prova.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1.5rem' }}>
           <input 
              type="checkbox" 
              id="showOnly" 
              checked={showOnlyReleased} 
              onChange={e => setShowOnlyReleased(e.target.checked)} 
              style={{ width: '18px', height: '18px' }}
           />
           <label htmlFor="showOnly" style={{ cursor: 'pointer', margin: 0 }}>Mostrar apenas liberados</label>
        </div>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #374151', marginBottom: '1.5rem' }}>
        <button 
          className={`tab-btn ${activeTab === 'classes' ? 'active' : ''}`}
          onClick={() => { setActiveTab('classes'); setSearch(''); }}
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', color: activeTab === 'classes' ? '#a78bfa' : '#9ca3af', borderBottom: activeTab === 'classes' ? '2px solid #a78bfa' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Turmas
        </button>
        <button 
          className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => { setActiveTab('students'); setSearch(''); }}
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', color: activeTab === 'students' ? '#a78bfa' : '#9ca3af', borderBottom: activeTab === 'students' ? '2px solid #a78bfa' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Alunos Individuais
        </button>
      </div>

      <div className="search-bar" style={{ marginBottom: '1rem' }}>
        <input
          type="text" 
          placeholder={activeTab === 'classes' ? 'Buscar turma por nome...' : 'Buscar aluno por nome...'}
          value={search} 
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            {activeTab === 'classes' ? (
              <tr>
                <th>Nome da Turma</th>
                <th>Qtd. Alunos</th>
                <th style={{ width: '120px' }}>Acesso</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Ação Rápida</th>
              </tr>
            ) : (
              <tr>
                <th>Nome do Aluno</th>
                <th>Email</th>
                <th>Tentativas</th>
                <th>Último Resultado</th>
                <th>Cooldown</th>
                <th style={{ width: '120px' }}>Acesso</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Ação Rápida</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === 'classes' ? (
              filteredClasses.length === 0 ? (
                <tr><td colSpan={4} className="empty-text">Nenhuma turma encontrada.</td></tr>
              ) : filteredClasses.map(c => {
                const isReleased = exam.releases.some(r => r.classId === c.id);
                return (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c._count?.students || 0} alunos</td>
                    <td>
                      {isReleased 
                        ? <span className="badge badge-success">Liberado</span> 
                        : <span className="badge badge-secondary">Bloqueado</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className={`btn btn-sm ${isReleased ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => toggleReleaseClass(c)}
                        disabled={actionLoading === c.id}
                        style={{ minWidth: '80px' }}
                      >
                        {actionLoading === c.id ? '...' : (isReleased ? 'Revogar' : 'Liberar')}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              filteredStudents.length === 0 ? (
                <tr><td colSpan={4} className="empty-text">Nenhum aluno encontrado.</td></tr>
              ) : filteredStudents.map(s => {
                const isExplicitlyReleased = exam.releases.some(r => r.studentId === s.id);
                const releasedClassIds = exam.releases.filter(r => r.classId).map(r => r.classId);
                const releasedViaClass = s.classes?.find(c => releasedClassIds.includes(c.classId));
                const isReleased = isExplicitlyReleased || !!releasedViaClass;

                const studentAttempts = exam.attempts.filter(a => a.studentId === s.id);
                const attemptsCount = studentAttempts.length;
                const latestAttempt = studentAttempts.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
                const activeCooldown = exam.cooldowns.find(c => c.studentId === s.id);

                return (
                  <tr key={s.id}>
                    <td><strong>{s.user?.name}</strong></td>
                    <td>{s.user?.email}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${attemptsCount >= (exam.maxAttempts || Infinity) ? 'badge-warning' : 'badge-secondary'}`}>
                        {attemptsCount} {exam.maxAttempts > 0 ? `/ ${exam.maxAttempts}` : ''}
                      </span>
                    </td>
                    <td>
                      {latestAttempt ? (
                        <div>
                          {latestAttempt.resultStatus === 'PASSED' && <span className="badge badge-success">Aprovado ({latestAttempt.score}%)</span>}
                          {latestAttempt.resultStatus === 'FAILED' && <span className="badge badge-danger">Reprovado ({latestAttempt.score}%)</span>}
                          {latestAttempt.resultStatus === 'PENDING' && <span className="badge badge-warning">Em andamento</span>}
                          {latestAttempt.resultStatus === 'FAILED_TIMEOUT' && <span className="badge badge-danger">Tempo Esgotado</span>}
                          {latestAttempt.resultStatus === 'FAILED_ABANDONMENT' && <span className="badge badge-danger">Abandonada</span>}
                        </div>
                      ) : <span style={{ color: '#6b7280' }}>Não iniciou</span>}
                    </td>
                    <td>
                      {activeCooldown ? (
                        <span className="badge badge-warning" title={`Até ${new Date(activeCooldown.endsAt).toLocaleString('pt-BR')}`}>
                          Bloqueado (CD)
                        </span>
                      ) : <span style={{ color: '#6b7280' }}>-</span>}
                    </td>
                    <td>
                      {isReleased 
                        ? <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <span className="badge badge-success" title={releasedViaClass ? `Acesso via: ${releasedViaClass.class.name}` : 'Acesso Individual'}>
                              Liberado
                            </span>
                            {releasedViaClass && (
                              <span style={{ fontSize: '0.7rem', color: '#9ca3af', lineHeight: 1 }} title={releasedViaClass.class.name}>
                                via Turma
                              </span>
                            )}
                          </div>
                        : <span className="badge badge-secondary">Bloqueado</span>}
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        className={`btn btn-sm ${isExplicitlyReleased ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => toggleReleaseStudent(s)}
                        disabled={actionLoading === s.id}
                        style={{ minWidth: '80px' }}
                      >
                        {actionLoading === s.id ? '...' : (isExplicitlyReleased ? 'Revogar' : 'Liberar')}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Custom Confirm Modal for Revoking Access */}
      {confirmRevoke && (
        <div className="modal-overlay" onClick={() => setConfirmRevoke(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Confirmar Revogação</h3>
              <button className="modal-close" onClick={() => setConfirmRevoke(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Tem certeza que deseja revogar o acesso {confirmRevoke.type === 'class' ? 'da turma' : 'do aluno'} <strong>{confirmRevoke.name}</strong>?</p>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '1rem', color: '#9ca3af' }}>
                Esta ação impedirá o início da prova a partir de agora, mas não apagará o histórico de resultados de tentativas já realizadas.
              </p>
              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmRevoke(null)} disabled={actionLoading !== null}>
                  Cancelar
                </button>
                <button className="btn btn-danger" onClick={executeRevoke} disabled={actionLoading !== null}>
                  {actionLoading ? 'Revogando...' : 'Sim, Revogar Acesso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
