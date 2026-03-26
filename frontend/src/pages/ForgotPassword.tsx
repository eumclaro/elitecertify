import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccess(response.data.message || 'E-mail enviado com sucesso.');
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao solicitar recuperação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img src="/logotipo-elite-training.png" alt="Elite Training" className="login-logo-img" />
          </div>
          <p>Recuperação de Senha</p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="alert alert-success" style={{ marginBottom: '20px' }}>{success}</div>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Voltar ao Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '20px', textAlign: 'center' }}>
              Digite seu e-mail abaixo e enviaremos um link para você redefinir sua senha.
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading || !email}>
              {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/login" style={{ fontSize: '0.875rem', color: '#64748b', textDecoration: 'none' }}>
                Voltar ao Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
