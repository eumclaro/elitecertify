import { useState, useEffect } from 'react';
import api from '../../services/api';

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  provider: string;
  status: string;
  lastSyncedAt: string;
}

interface EmailBinding {
  id: string;
  eventKey: string;
  templateId: string;
  isActive: boolean;
  template?: EmailTemplate;
}

const EVENT_KEYS = [
  'AUTH_PASSWORD_RESET',
  'STUDENT_CREATED',
  'EXAM_RELEASED',
  'EXAM_PASSED',
  'EXAM_FAILED',
  'EXAM_FAILED_COOLDOWN',
  'COOLDOWN_RELEASED',
  'PASSWORD_RESET_COMPLETED',
  'CERTIFICATE_AVAILABLE',
  'EXAM_DEADLINE_REMINDER'
];

export default function EmailManagement() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [bindings, setBindings] = useState<EmailBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modais
  const [showBindingModal, setShowBindingModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // States de Formulário
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Test Email States
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [testSlug, setTestSlug] = useState('');
  const [testData, setTestData] = useState('{\n  "NAME": "Usuário Teste",\n  "SUPPORT_EMAIL": "suporte@elt.com.br"\n}');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, bRes] = await Promise.all([
        api.get('/email-templates'),
        api.get('/email-templates/bindings')
      ]);
      setTemplates(tRes.data);
      setBindings(bRes.data);
    } catch (err: any) {
      setError('Erro ao carregar dados do servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const res = await api.get('/email-templates/mandrill/sync');
      setSuccess(`Sincronização concluída! Criados: ${res.data.created}, Atualizados: ${res.data.updated}`);
      fetchData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError('Erro ao sincronizar com Mandrill');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveBinding = async () => {
    if (!selectedEvent || !selectedTemplateId) return;
    try {
      await api.post('/email-templates/bindings', {
        eventKey: selectedEvent,
        templateId: selectedTemplateId,
        isActive: true
      });
      setSuccess('Vínculo salvo com sucesso!');
      fetchData();
      setShowBindingModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao salvar vínculo');
    }
  };

  const handlePreview = async (slug: string) => {
    setPreviewHtml('');
    setShowPreviewModal(true);
    setPreviewLoading(true);
    try {
      // Usar vars padrão para preview
      const defaultVars = { NAME: 'Exemplo de Nome', SUPPORT_EMAIL: 'suporte@elt.com.br' };
      const res = await api.post('/email-templates/render', { slug, mergeVars: defaultVars });
      setPreviewHtml(res.data.html);
    } catch (err) {
      setError('Erro ao renderizar preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !testSlug) return;
    try {
      const parsedData = JSON.parse(testData);
      await api.post('/email-templates/test', {
        toEmail: testEmail,
        toName: testName || 'Destinatário Teste',
        templateSlug: testSlug,
        dynamicData: parsedData
      });
      setSuccess('E-mail de teste enviado com sucesso!');
      setShowTestModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Erro ao enviar teste: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="email-management">
      <div className="page-header">
        <div>
          <h2>Gestão de E-mails Transacionais</h2>
          <p>Governança de templates Mandrill e vínculos com eventos do sistema.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : '🔄 Sincronizar Mandrill'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowBindingModal(true)}>
            ➕ Novo Vínculo
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 350px' }}>
        <div className="dashboard-card">
          <h3>Templates Integrados ({templates.length})</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nome / Slug</th>
                  <th>Provedor</th>
                  <th>Última Sinc</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.slug}</div>
                    </td>
                    <td><span className="badge badge-secondary">{t.provider}</span></td>
                    <td>{t.lastSyncedAt ? new Date(t.lastSyncedAt).toLocaleDateString() : 'Nunca'}</td>
                    <td className="actions">
                      <button className="btn btn-sm btn-outline" onClick={() => handlePreview(t.slug)}>👁️ Preview</button>
                      <button className="btn btn-sm btn-outline" onClick={() => { setTestSlug(t.slug); setShowTestModal(true); }}>📧 Teste</button>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr><td colSpan={4} className="empty-text">Nenhum template sincronizado. Clique em Sincronizar Mandrill.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Vínculos Ativos ({bindings.length})</h3>
          <div className="bindings-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bindings.map(b => (
              <div key={b.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>{b.eventKey}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  ➡️ {b.template?.name || b.template?.slug || 'Template não localizado'}
                </div>
                {!b.isActive && <span className="badge badge-warning" style={{ marginTop: '4px' }}>Inativo</span>}
              </div>
            ))}
            {bindings.length === 0 && (
              <p className="empty-text" style={{ padding: '16px' }}>Nenhum vínculo configurado.</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Novo Vínculo */}
      {showBindingModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Vincular Evento a Template</h3>
              <button className="modal-close" onClick={() => setShowBindingModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Evento do Sistema</label>
                <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}>
                  <option value="">Selecione um evento...</option>
                  {EVENT_KEYS.map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Template Mandrill</label>
                <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                  <option value="">Selecione um template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowBindingModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveBinding}>Salvar Vínculo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Preview */}
      {showPreviewModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3>Visualização do Template</h3>
              <button className="modal-close" onClick={() => setShowPreviewModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
              {previewLoading ? (
                <div className="page-loading"><div className="spinner"></div></div>
              ) : (
                <iframe
                  srcDoc={previewHtml}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                  title="Mandrill Preview"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Teste de Disparo */}
      {showTestModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Disparar E-mail de Teste</h3>
              <button className="modal-close" onClick={() => setShowTestModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>E-mail do Destinatário</label>
                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="ex: seu@email.com" />
              </div>
              <div className="form-group">
                <label>Nome do Destinatário</label>
                <input type="text" value={testName} onChange={e => setTestName(e.target.value)} placeholder="ex: João Silva" />
              </div>
              <div className="form-group">
                <label>Variáveis de Teste (JSON)</label>
                <textarea 
                  rows={5} 
                  value={testData} 
                  onChange={e => setTestData(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowTestModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSendTest}>Enviar Teste Agora</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
