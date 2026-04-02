import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, Mail } from "lucide-react";
import api from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    // Buscar a imagem do backend. Rota pública.
    api.get('/settings/login-cover')
      .then(res => {
        if (res.data.url) {
          setCoverUrl(`${import.meta.env.VITE_API_URL}${res.data.url}`);
        }
      })
      .catch(() => {
         // Ignorar se a request falhar em network.
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // O App.tsx já redireciona se o user estiver logado, mas forçamos localmente aqui:
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Credenciais inválidas. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      {/* Lado Esquerdo - Painel Imagem (Desktop 50%) */}
      <div className="hidden md:flex md:w-1/2 min-h-screen relative overflow-hidden bg-[#1a1a1a] items-center justify-center border-r">
        {coverUrl ? (
          <img 
            src={coverUrl} 
            alt="Login Cover Background" 
            className="absolute inset-0 w-full h-full object-cover object-center animate-in fade-in duration-1000"
          />
        ) : (
          <img 
             src="/logotipo-elite-training.png" 
             className="h-16 opacity-30 grayscale mix-blend-overlay max-w-[80%]" 
             alt="Elite Training Logo Fallback" 
          />
        )}
      </div>

      {/* Lado Direito - Formulário (Desktop 50% / Mobile 100%) */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 lg:p-16 min-h-screen">
        <div className="w-full max-w-[380px] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="mb-10 text-center">
             <img 
              src="/logotipo-elite-training.png" 
              alt="Elite Training Logo" 
              className="h-14 w-auto object-contain mx-auto mb-6" 
            />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Bem-vindo de volta</h1>
            <p className="text-sm text-slate-500 text-balance">
              Insira suas credenciais para acessar sua conta
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 mb-2">
                <AlertDescription className="text-xs font-semibold">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="email" className="font-semibold text-xs tracking-wider uppercase text-slate-500">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary focus-visible:border-primary shadow-sm"
                  required
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" title="" className="font-semibold text-xs tracking-wider uppercase text-slate-500">
                  Senha
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-primary hover:underline underline-offset-4"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary focus-visible:border-primary shadow-sm"
                  required
                />
              </div>
            </div>
            
            <Button type="submit" className="w-full h-11 font-bold shadow-lg shadow-primary/20 mt-2 active:scale-95 transition-transform" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Fazer Login"
              )}
            </Button>
          </form>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            Ao entrar, você concorda com nossos{" "}
            <a href="#" className="underline underline-offset-4 hover:text-slate-900 transition-colors font-medium">Termos de Serviço</a>
            {" "}e{" "}
            <a href="#" className="underline underline-offset-4 hover:text-slate-900 transition-colors font-medium">Política de Privacidade</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
