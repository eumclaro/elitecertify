import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function SmtpSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [form, setForm] = useState({
    host: '',
    port: '',
    user: '',
    pass: '',
    fromEmail: '',
    fromName: ''
  });
  const [hasPassword, setHasPassword] = useState(false);
  const [showPass, setShowPass] = useState(false);
  
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data } = await api.get('/settings/smtp');
      if (data.hasPassword !== undefined) {
        setForm({
          host: data.host || '',
          port: data.port || '',
          user: data.user || '',
          pass: '', // field should remain empty unless they want to change it
          fromEmail: data.fromEmail || '',
          fromName: data.fromName || ''
        });
        setHasPassword(data.hasPassword);
      }
    } catch (err: any) {
      alert('Erro ao carregar configurações SMTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await api.put('/settings/smtp', form);
      setFeedback({ type: 'success', message: 'Configurações SMTP gravadas e criptografadas com sucesso no banco de dados!' });
      fetchConfig();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const { data } = await api.post('/settings/smtp/test', form);
      setFeedback({ type: 'success', message: data.message || 'Teste concluído com sucesso! Verifique o e-mail.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Erro ao realizar teste de SMTP. Verifique os dados digitados.' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="smtp-settings-page">
      <div className="page-header">
        <div>
          <h2>Configurações SMTP</h2>
          <p>Gerencie as credenciais do servidor de e-mail transacional (Mailchimp/Mandrill)</p>
        </div>
      </div>

      {feedback && (
        <div style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          borderRadius: '8px',
          backgroundColor: feedback.type === 'success' ? '#042f2e' : '#450a0a',
          color: feedback.type === 'success' ? '#34d399' : '#fca5a5',
          border: `1px solid ${feedback.type === 'success' ? '#059669' : '#ef4444'}`,
          maxWidth: '800px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          fontSize: '0.95rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <span style={{ fontSize: '1.25rem' }}>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <span style={{ flex: 1, fontWeight: '500' }}>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7, padding: '4px' }}>✕</button>
        </div>
      )}

      <div style={{ maxWidth: '800px', backgroundColor: '#1e293b', padding: '2rem', borderRadius: '8px', border: '1px solid #334155' }}>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label>Servidor (Host)</label>
              <input type="text" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} required 
                placeholder="Ex: smtp.mandrillapp.com" style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc' }} />
            </div>
            <div className="form-group">
              <label>Porta (Port)</label>
              <input type="number" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} required 
                placeholder="Ex: 587 ou 465" style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label>Nome do Remetente</label>
              <input type="text" value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })} required 
                placeholder="Ex: ELT Training" style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc' }} />
            </div>
            <div className="form-group">
              <label>E-mail do Remetente</label>
              <input type="email" value={form.fromEmail} onChange={e => setForm({ ...form, fromEmail: e.target.value })} required 
                placeholder="Ex: no-reply@elt.com.br" style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="form-group">
              <label>Usuário SMTP</label>
              <input type="text" value={form.user} onChange={e => setForm({ ...form, user: e.target.value })} required 
                placeholder="Usuário ou API Key Name" style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc' }} />
            </div>
            <div className="form-group">
              <label>
                Senha / API Key Secret
                {hasPassword && !form.pass && <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#10b981' }}>(Salva no sistema)</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? "text" : "password"} value={form.pass} 
                  onChange={e => setForm({ ...form, pass: e.target.value })} 
                  required={!hasPassword}
                  placeholder={hasPassword ? 'Preencha apenas para alterar...' : 'Senha do SMTP'} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc' }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  {showPass ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing || saving}>
              {testing ? 'Despachando Ensaio...' : '🧪 Testar Disparo'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || testing}>
              {saving ? 'Gravando...' : '💾 Gravar Definições'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
