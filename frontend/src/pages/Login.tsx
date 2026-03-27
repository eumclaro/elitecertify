import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, Mail } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // O App.tsx já redireciona se o user estiver logado, 
      // mas vamos forçar para garantir a melhor UX
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Credenciais inválidas. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh w-full flex items-center justify-center p-6 md:p-10 bg-muted/40 relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl animate-pulse" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-chart-1/5 blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-sm md:max-w-3xl relative z-10 animate-in fade-in zoom-in duration-500">
        <Card className="overflow-hidden border-none shadow-2xl shadow-primary/5">
          <CardContent className="grid p-0 md:grid-cols-2 items-stretch min-h-[600px]">
            <div className="relative hidden bg-primary md:flex flex-col overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.1),transparent)]" />
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-12 text-primary-foreground text-center">
                <div className="mb-8 flex items-center justify-center">
                  <img 
                    src="/logotipo-elite-training.png" 
                    alt="Elite Training Logo" 
                    className="h-16 w-auto object-contain brightness-0 invert" 
                  />
                </div>
                <p className="text-primary-foreground/90 leading-relaxed font-medium text-lg">
                  Plataforma de certificação internacional, parceiros oficiais Athletic Lab 
                </p>
                
                <div className="mt-12 space-y-4 w-full text-left">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="size-2 rounded-full bg-success" />
                    <span className="text-xs font-semibold opacity-90">Sistemas Ativos</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="size-2 rounded-full bg-chart-1" />
                    <span className="text-xs font-semibold opacity-90">Segurança de Dados ponta a ponta</span>
                  </div>
                </div>
              </div>
              <img
                src="/logotipo-elite-training.png"
                alt="Image"
                className="absolute inset-0 h-full w-full object-cover opacity-10 grayscale mix-blend-overlay pointer-events-none"
              />
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 md:p-12 flex flex-col justify-center h-full">
              <div className="flex flex-col gap-2 text-left mb-8">
                <div className="md:hidden flex flex-col items-center gap-4 mb-8">
                   <img 
                    src="/logotipo-elite-training.png" 
                    alt="Elite Training Logo" 
                    className="h-12 w-auto object-contain" 
                  />
                   <p className="text-center text-xs text-muted-foreground font-medium">
                    Plataforma de certificação internacional
                  </p>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Insira suas credenciais para acessar sua conta
                </p>
              </div>

              <div className="grid gap-6">
                {error && (
                  <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 animate-in slide-in-from-top-2">
                    <AlertDescription className="text-xs font-medium">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="grid gap-2">
                  <Label htmlFor="email" className="font-semibold text-xs uppercase tracking-wider opacity-70">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 bg-muted/30 border-none focus-visible:ring-2"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password" title="" className="font-semibold text-xs uppercase tracking-wider opacity-70">Senha</Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11 bg-muted/30 border-none focus-visible:ring-2"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-primary hover:underline underline-offset-4"
                  >
                    Esqueceu sua senha?
                  </Link>
                </div>

                <Button type="submit" className="w-full h-11 font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Fazer Login"
                  )}
                </Button>
              </div>

              <div className="mt-8 text-center text-xs text-muted-foreground">
                Ao entrar, você concorda com nossos <br className="hidden sm:inline" />{" "}
                <a href="#" className="underline underline-offset-4 hover:text-primary transition-colors">
                  Termos de Serviço
                </a>{" "}
                e{" "}
                <a href="#" className="underline underline-offset-4 hover:text-primary transition-colors">
                  Política de Privacidade
                </a>
                .
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
