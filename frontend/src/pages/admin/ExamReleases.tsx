import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors" onClick={() => navigate('/admin/exams')}>
            <ArrowLeft className="size-4" /> Voltar para Provas
          </button>
          <h1 className="text-3xl font-bold tracking-tight">Liberações: {exam.title}</h1>
          <p className="text-muted-foreground mt-2">Gerencie quais turmas e alunos individuais podem acessar esta prova.</p>
        </div>
        <div className="flex items-center gap-2 mt-10">
           <Checkbox 
              id="showOnly" 
              checked={showOnlyReleased} 
              onCheckedChange={(c) => setShowOnlyReleased(c === true)} 
           />
           <label htmlFor="showOnly" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
             Mostrar apenas liberados
           </label>
        </div>
      </div>

      <div className="flex border-b mb-6">
        <button 
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'classes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
          onClick={() => { setActiveTab('classes'); setSearch(''); }}
        >
          Turmas
        </button>
        <button 
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'students' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
          onClick={() => { setActiveTab('students'); setSearch(''); }}
        >
          Alunos Individuais
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === 'classes' ? 'Buscar turma por nome...' : 'Buscar aluno por nome...'}
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-11 bg-muted/50"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden mt-6">
        <Table>
          <TableHeader className="bg-muted/30">
            {activeTab === 'classes' ? (
              <TableRow>
                <TableHead className="px-6">Nome da Turma</TableHead>
                <TableHead className="px-6">Qtd. Alunos</TableHead>
                <TableHead className="w-32 px-6">Acesso</TableHead>
                <TableHead className="w-40 px-6 text-right">Ação Rápida</TableHead>
              </TableRow>
            ) : (
              <TableRow>
                <TableHead className="px-6">Nome do Aluno</TableHead>
                <TableHead className="px-6">Email</TableHead>
                <TableHead className="px-6">Tentativas</TableHead>
                <TableHead className="px-6">Último Resultado</TableHead>
                <TableHead className="px-6">Cooldown</TableHead>
                <TableHead className="w-32 px-6">Acesso</TableHead>
                <TableHead className="w-40 px-6 text-right">Ação Rápida</TableHead>
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {activeTab === 'classes' ? (
              filteredClasses.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="empty-text text-center py-6 text-muted-foreground">Nenhuma turma encontrada.</TableCell></TableRow>
              ) : filteredClasses.map(c => {
                const isReleased = exam.releases.some(r => r.classId === c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="px-6 font-semibold">{c.name}</TableCell>
                    <TableCell className="px-6 text-muted-foreground">{c._count?.students || 0} alunos</TableCell>
                    <TableCell className="px-6">
                      {isReleased 
                        ? <span className="badge badge-success px-2 py-1 bg-green-500/10 text-green-500 rounded-md text-xs font-bold border border-green-500/20">Liberado</span> 
                        : <span className="badge badge-secondary px-2 py-1 bg-slate-500/10 text-slate-500 rounded-md text-xs font-bold border border-slate-500/20">Bloqueado</span>}
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <button 
                        className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${isReleased ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                        onClick={() => toggleReleaseClass(c)}
                        disabled={actionLoading === c.id}
                        style={{ minWidth: '80px' }}
                      >
                        {actionLoading === c.id ? '...' : (isReleased ? 'Revogar' : 'Liberar')}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              filteredStudents.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="empty-text text-center py-6 text-muted-foreground">Nenhum aluno encontrado.</TableCell></TableRow>
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
                  <TableRow key={s.id}>
                    <TableCell className="px-6 font-semibold">{s.user?.name}</TableCell>
                    <TableCell className="px-6 text-muted-foreground">{s.user?.email}</TableCell>
                    <TableCell className="px-6 text-center text-muted-foreground text-sm">
                      <span className={`badge ${attemptsCount >= (exam.maxAttempts || Infinity) ? 'badge-warning' : 'badge-secondary'}`}>
                        {attemptsCount} {exam.maxAttempts > 0 ? `/ ${exam.maxAttempts}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 text-sm">
                      {latestAttempt ? (
                        <div className="flex gap-2">
                          {latestAttempt.resultStatus === 'PASSED' && <span className="text-green-500 font-medium">Aprovado ({latestAttempt.score}%)</span>}
                          {latestAttempt.resultStatus === 'FAILED' && <span className="text-red-500 font-medium">Reprovado ({latestAttempt.score}%)</span>}
                          {latestAttempt.resultStatus === 'PENDING' && <span className="text-yellow-500 font-medium">Em andamento</span>}
                          {latestAttempt.resultStatus === 'FAILED_TIMEOUT' && <span className="text-red-500 font-medium">Tempo Esgotado</span>}
                          {latestAttempt.resultStatus === 'FAILED_ABANDONMENT' && <span className="text-red-500 font-medium">Abandonada</span>}
                        </div>
                      ) : <span className="text-muted-foreground">Não iniciou</span>}
                    </TableCell>
                    <TableCell className="px-6 text-sm">
                      {activeCooldown ? (
                        <span className="text-orange-500 font-medium" title={`Até ${new Date(activeCooldown.endsAt).toLocaleString('pt-BR')}`}>
                          Bloqueado (CD)
                        </span>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="px-6">
                      {isReleased 
                        ? <div className="flex flex-col gap-1 items-start">
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-xs font-bold border border-green-500/20" title={releasedViaClass ? `Acesso via: ${releasedViaClass.class.name}` : 'Acesso Individual'}>
                              Liberado
                            </span>
                            {releasedViaClass && (
                              <span className="text-[10px] text-muted-foreground" title={releasedViaClass.class.name}>
                                via Turma
                              </span>
                            )}
                          </div>
                        : <span className="px-2 py-0.5 bg-slate-500/10 text-slate-500 rounded text-xs font-bold border border-slate-500/20">Bloqueado</span>}
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <button 
                        className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${isExplicitlyReleased ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                        onClick={() => toggleReleaseStudent(s)}
                        disabled={actionLoading === s.id}
                        style={{ minWidth: '80px' }}
                      >
                        {actionLoading === s.id ? '...' : (isExplicitlyReleased ? 'Revogar' : 'Liberar')}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
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
