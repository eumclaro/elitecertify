import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { toast } from 'sonner';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, UserCog, ShieldCheck, UserMinus, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
  active: boolean;
  createdAt: string;
}

export default function TeamManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'VIEWER' as any,
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err: any) {
      toast.error('Erro ao carregar lista de equipe.');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/users/invite', {
        name: form.name,
        email: form.email,
        role: form.role
      });
      setInviteSent(true);
      toast.success('Convite enviado com sucesso!');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao convidar usuário.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      // 1. Atualizar dados básicos
      await api.put(`/users/${selectedUser.id}`, {
        name: form.name,
        email: form.email,
        role: form.role
      });

      // 2. Redefinir senha se preenchido (Apenas SUPER_ADMIN)
      if (currentUser?.role === 'SUPER_ADMIN' && form.newPassword) {
        if (form.newPassword !== form.confirmPassword) {
          toast.error('As senhas não coincidem.');
          setSubmitting(false);
          return;
        }
        await api.put(`/auth/team/${selectedUser.id}/password`, {
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword
        });
        toast.success('Senha redefinida com sucesso!');
      }

      toast.success('Usuário atualizado com sucesso!');
      setEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar usuário.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: SystemUser) => {
    try {
      const newStatus = !user.active;
      await api.put(`/users/${user.id}/deactivate`, { active: newStatus });
      toast.success(`Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso.`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao alterar status do usuário.');
    }
  };

  const openEditModal = (user: SystemUser) => {
    setSelectedUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      newPassword: '',
      confirmPassword: ''
    });
    setEditModalOpen(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <Badge className="bg-purple-600 hover:bg-purple-700">SUPER ADMIN</Badge>;
      case 'ADMIN':
        return <Badge className="bg-blue-600 hover:bg-blue-700">ADMIN</Badge>;
      case 'VIEWER':
        return <Badge variant="secondary">VIEWER</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestão de Equipe</h2>
          <p className="text-muted-foreground text-sm">
            Gerencie administradores e níveis de acesso da plataforma.
          </p>
        </div>

        <Dialog open={inviteModalOpen} onOpenChange={(open) => {
          setInviteModalOpen(open);
          if (!open) {
            setInviteSent(false);
            setForm({ name: '', email: '', role: 'VIEWER', newPassword: '', confirmPassword: '' });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Convidar Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Convidar Novo Administrador</DialogTitle>
              <DialogDescription>
                O convite enviará um e-mail com link de ativação segura.
              </DialogDescription>
            </DialogHeader>

            {inviteSent ? (
              <div className="space-y-4 py-4 text-center">
                <div className="flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-lg">Convite Enviado!</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Um link de ativação foi enviado para <strong>{form.email}</strong>.
                    O usuário tem 48 horas para criar sua senha.
                  </p>
                </div>
                <DialogFooter>
                  <Button className="w-full" onClick={() => setInviteModalOpen(false)}>Entendido</Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleInvite}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input 
                      id="name" 
                      value={form.name} 
                      onChange={e => setForm({...form, name: e.target.value})} 
                      placeholder="Ex: João Silva" 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">E-mail Corporativo</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={form.email} 
                      onChange={e => setForm({...form, email: e.target.value})} 
                      placeholder="exemplo@empresa.com" 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Nível de Acesso</Label>
                    <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN (Cria/Edita)</SelectItem>
                        <SelectItem value="VIEWER">VIEWER (Apenas Leitura/Correção)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enviar Convite por E-mail
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={!user.active ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                        <UserCheck className="w-3 h-3" /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <ShieldCheck className="w-3 h-3 text-amber-500" /> Pendente
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        title="Editar"
                        onClick={() => openEditModal(user)}
                      >
                        <UserCog className="w-4 h-4" />
                      </Button>
                      {user.role !== 'SUPER_ADMIN' && currentUser?.role === 'SUPER_ADMIN' && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          title={user.active ? "Desativar" : "Ativar"}
                          className={user.active ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.active ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações de perfil ou nível de acesso.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input 
                  id="edit-name" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input 
                  id="edit-email" 
                  type="email"
                  value={form.email} 
                  onChange={e => setForm({...form, email: e.target.value})} 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Nível de Acesso</Label>
                <Select 
                  value={form.role} 
                  onValueChange={v => setForm({...form, role: v})}
                  disabled={selectedUser?.role === 'SUPER_ADMIN'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedUser?.role === 'SUPER_ADMIN' ? (
                      <SelectItem value="SUPER_ADMIN">SUPER ADMIN</SelectItem>
                    ) : (
                      <>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="VIEWER">VIEWER</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {selectedUser?.role === 'SUPER_ADMIN' && (
                  <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                    Perfis SUPER_ADMIN não podem ter a role alterada via interface.
                  </p>
                )}
              </div>

              {/* Redefinição de Senha (SUPER_ADMIN apenas) */}
              {currentUser?.role === 'SUPER_ADMIN' && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-sm font-semibold uppercase tracking-wider">Redefinir Senha</span>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <Input 
                      id="new-password" 
                      type="password"
                      value={form.newPassword} 
                      onChange={e => setForm({...form, newPassword: e.target.value})} 
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                    <Input 
                      id="confirm-password" 
                      type="password"
                      value={form.confirmPassword} 
                      onChange={e => setForm({...form, confirmPassword: e.target.value})} 
                      placeholder="Repita a nova senha"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Deixe em branco para manter a senha atual. Se preenchido, o usuário será desconectado de outras sessões.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
