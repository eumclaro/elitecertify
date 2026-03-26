import { useState, useEffect } from 'react';
import api from '../../services/api';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: string | null;
  ip: string | null;
  device: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<string[]>([]);
  const [filter, setFilter] = useState({ action: '', page: 1 });
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page: filter.page, limit: 30 };
      if (filter.action) params.action = filter.action;
      const { data } = await api.get('/audit', { params });
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/audit/actions').then(r => setActions(r.data)).catch(console.error);
  }, []);

  useEffect(() => { fetchLogs(); }, [filter]);

  const actionLabels: Record<string, { label: string; color: string }> = {
    'LOGIN': { label: '🔑 Login', color: '#6366f1' },
    'LOGOUT': { label: '🚪 Logout', color: '#94a3b8' },
    'REGISTER': { label: '📝 Registro', color: '#10b981' },
    'EXAM_START': { label: '▶️ Prova Iniciada', color: '#f59e0b' },
    'EXAM_PASSED': { label: '✅ Aprovado', color: '#10b981' },
    'EXAM_FAILED': { label: '❌ Reprovado', color: '#ef4444' },
    'EXAM_ABANDONED': { label: '⏸️ Abandonou', color: '#94a3b8' },
    'CREATE': { label: '➕ Criação', color: '#6366f1' },
    'UPDATE': { label: '✏️ Edição', color: '#f59e0b' },
    'DELETE': { label: '🗑️ Exclusão', color: '#ef4444' },
  };

  const getActionDisplay = (action: string) => {
    return actionLabels[action] || { label: action, color: '#94a3b8' };
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📋 Auditoria</h2>
          <p>Histórico de ações do sistema</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select
          value={filter.action}
          onChange={e => setFilter({ action: e.target.value, page: 1 })}
          className="filter-select"
        >
          <option value="">Todas as ações</option>
          {actions.map(a => (
            <option key={a} value={a}>{getActionDisplay(a).label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner"></div></div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>IP</th>
                  <th>Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={6} className="empty-text">Nenhum registro encontrado</td></tr>
                ) : logs.map(log => {
                  const display = getActionDisplay(log.action);
                  return (
                    <tr key={log.id}>
                      <td><span className="audit-date">{formatDate(log.createdAt)}</span></td>
                      <td>
                        <div className="audit-user">
                          <strong>{log.user?.name || '—'}</strong>
                          <small>{log.user?.email || ''}</small>
                        </div>
                      </td>
                      <td>
                        <span className="audit-action" style={{borderColor: display.color, color: display.color}}>
                          {display.label}
                        </span>
                      </td>
                      <td>
                        <span className="audit-entity">{log.entity || '—'}</span>
                        {log.entityId && <small style={{display:'block', color:'var(--text-muted)', fontSize: 10}}>{log.entityId.substring(0, 8)}...</small>}
                      </td>
                      <td><code className="audit-ip">{log.ip || '—'}</code></td>
                      <td><span className="audit-device" title={log.device || ''}>{log.device ? log.device.substring(0, 30) + '...' : '—'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-sm btn-outline"
                disabled={filter.page <= 1}
                onClick={() => setFilter(f => ({ ...f, page: f.page - 1 }))}
              >← Anterior</button>
              <span className="page-info">Página {filter.page} de {totalPages}</span>
              <button
                className="btn btn-sm btn-outline"
                disabled={filter.page >= totalPages}
                onClick={() => setFilter(f => ({ ...f, page: f.page + 1 }))}
              >Próxima →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
