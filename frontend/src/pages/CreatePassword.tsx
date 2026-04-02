import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import api from '../services/api';

export default function CreatePassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setError('Token de convite não fornecido.');
      return;
    }

    // Validar token no backend
    api.get(`/auth/invite/validate?token=${token}`)
      .then(res => {
        setUserName(res.data.name);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Link de convite inválido ou expirado.');
      })
      .finally(() => {
        setValidating(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
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
      const res = await api.post('/auth/invite/activate', { token, password });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao ativar conta.');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 animate-pulse font-medium">Validando seu convite...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header Decorativo */}
        <div className="h-2 bg-primary w-full" />
        
        <div className="p-8 lg:p-10">
          <div className="mb-8 text-center">
            <img 
              src="/logotipo-elite-training.png" 
              alt="Elite Certify Logo" 
              className="h-12 w-auto object-contain mx-auto mb-6" 
            />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ativação de Conta</h1>
            {userName && (
              <p className="text-sm text-slate-500 mt-2">
                Olá, <span className="font-semibold text-slate-900">{userName}</span>! Crie sua senha de acesso abaixo.
              </p>
            )}
          </div>

          {success ? (
            <div className="space-y-6 py-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-700">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-xl text-slate-900">Conta Ativada!</h4>
                <p className="text-sm text-slate-500 mt-2">
                  {success}
                </p>
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Redirecionando para o login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {error && (
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 animate-in shake-in duration-300">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-semibold ml-2">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {!error ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Nova Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary shadow-sm"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 font-bold shadow-lg shadow-primary/20 mt-2 active:scale-[0.98] transition-all" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Ativando...
                      </>
                    ) : (
                      "Ativar Minha Conta"
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center py-4">
                  <Button variant="outline" asChild className="w-full">
                    <Link to="/login">Voltar ao Login</Link>
                  </Button>
                </div>
              )}
            </form>
          )}

          {!success && !error && (
            <p className="mt-10 text-center text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              Elite Training &copy; {new Date().getFullYear()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
