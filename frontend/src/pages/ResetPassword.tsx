import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <h3>Link Inválido</h3>
          <p>O token de redefinição não foi fornecido.</p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: '20px', display: 'inline-block' }}>
            Voltar ao Login
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(res.data.message || 'Senha redefinida com sucesso!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao redefinir senha. O link pode ter expirado.');
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
            <img src="/logotipo-elite-training.png" alt="Elite Certify" className="login-logo-img" />
          </div>
          <p>Criar Nova Senha</p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="alert alert-success" style={{ marginBottom: '20px' }}>{success}</div>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Redirecionando para o login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="password">Nova Senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Nova Senha</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Salvando...' : 'Redefinir Senha'}
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
