import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User, Shield, Lock, Camera } from "lucide-react";

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const [details, setDetails] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setDetails({ name: user.name, email: user.email });
    }
  }, [user]);

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/auth/profile/details', details);
      toast.success('Perfil atualizado com sucesso!');
      refreshUser();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error('As senhas não coincidem.');
    }
    setPasswordLoading(true);
    try {
      await api.put('/auth/profile/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      toast.success('Senha alterada com sucesso! Por favor, faça login novamente.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setAvatarLoading(true);
    try {
      await api.post('/auth/profile/avatar', formData);
      toast.success('Foto de perfil atualizada!');
      refreshUser();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao subir imagem.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <Badge className="bg-purple-600">SUPER ADMIN</Badge>;
      case 'ADMIN':
        return <Badge className="bg-blue-600">ADMIN</Badge>;
      case 'VIEWER':
        return <Badge variant="secondary">VIEWER</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Meu Perfil</h2>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais e segurança da conta.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="relative group">
                <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
                  {avatarLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-full">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : null}
                  <AvatarImage src={user?.avatarUrl ? `${api.defaults.baseURL?.replace('/api', '')}${user.avatarUrl}` : undefined} />
                  <AvatarFallback className="text-3xl bg-primary/10 font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform"
                >
                  <Camera className="w-4 h-4" />
                  <input 
                    id="avatar-upload" 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleAvatarUpload}
                    disabled={avatarLoading}
                  />
                </label>
              </div>
              
              <div className="mt-4 text-center">
                <h3 className="text-xl font-semibold">{user?.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{user?.email}</p>
                {getRoleBadge(user?.role || '')}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none shadow-none">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium">
                <Shield className="w-4 h-4 text-primary" />
                <span>Perfil Administrativo Ativo</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <Lock className="w-4 h-4 text-primary" />
                <span>Conta Protegida por Sessão</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-4 h-4" /> Dados de Perfil
              </CardTitle>
              <CardDescription>
                Atualize seu nome e e-mail de acesso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateDetails} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input 
                    id="name" 
                    value={details.name} 
                    onChange={e => setDetails({...details, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={details.email} 
                    onChange={e => setDetails({...details, email: e.target.value})} 
                    required 
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-fit gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Atualizar Dados
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="w-4 h-4" /> Alterar Senha
              </CardTitle>
              <CardDescription>
                Por segurança, você será deslogado após a alteração.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="current">Senha Atual</Label>
                  <Input 
                    id="current" 
                    type="password"
                    value={passwords.currentPassword}
                    onChange={e => setPasswords({...passwords, currentPassword: e.target.value})}
                    required 
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new">Nova Senha</Label>
                    <Input 
                      id="new" 
                      type="password"
                      value={passwords.newPassword}
                      onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm">Confirmar Nova Senha</Label>
                    <Input 
                      id="confirm" 
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                <Button type="submit" variant="secondary" disabled={passwordLoading} className="w-fit gap-2">
                  {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Alterar Senha
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
