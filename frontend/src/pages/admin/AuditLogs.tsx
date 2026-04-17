import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Dispatches from './Dispatches';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '../../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Activity,
  Calendar,
  Smartphone,
  Globe
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  user: { 
    name: string; 
    email: string;
    role: string;
    student?: { id: string };
  };
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
      if (filter.action && filter.action !== 'all') params.action = filter.action;
      const { data } = await api.get('/audit', { params });
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    api.get('/audit/actions').then(r => setActions(r.data)).catch(console.error);
  }, []);

  useEffect(() => { fetchLogs(); }, [filter]);

  const actionLabels: Record<string, { label: string; color: string }> = {
    'LOGIN': { label: 'Login', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    'LOGOUT': { label: 'Logout', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
    'REGISTER': { label: 'Registro', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    'EXAM_START': { label: 'Prova Iniciada', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    'EXAM_PASSED': { label: 'Aprovado', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    'EXAM_FAILED': { label: 'Reprovado', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
    'EXAM_ABANDONED': { label: 'Abandonou', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
    'CREATE': { label: 'Criação', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
    'UPDATE': { label: 'Edição', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    'DELETE': { label: 'Exclusão', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  };

  const getActionDisplay = (action: string) => {
    return actionLabels[action] || { label: action, color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' };
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-muted-foreground">Histórico completo de ações e comunicações do sistema</p>
      </div>

      <Tabs defaultValue="activity">
        <TabsList className="mb-4">
          <TabsTrigger value="activity">Atividade do Sistema</TabsTrigger>
          <TabsTrigger value="dispatches">Disparos de E-mail</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-[240px]">
          <Select
            value={filter.action || 'all'}
            onValueChange={v => setFilter({ action: v === 'all' ? '' : v, page: 1 })}
          >
            <SelectTrigger className="bg-muted/50 font-medium">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                <SelectValue placeholder="Todas as ações" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {actions.map(a => (
                <SelectItem key={a} value={a}>{getActionDisplay(a).label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6 w-[180px]">Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Conexão / Dispositivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center text-muted-foreground italic">
                    Nenhum registro encontrado para este filtro.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => {
                  const display = getActionDisplay(log.action);
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/10 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold flex items-center gap-1.5 whitespace-nowrap">
                            <Calendar className="size-3 text-muted-foreground" />
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${log.user?.role === 'STUDENT' ? 'bg-blue-500/10 text-blue-600' : 'bg-primary/10 text-primary'}`}>
                            {log.user?.role === 'STUDENT' ? <User className="size-4" /> : <Shield className="size-4" />}
                          </div>
                          <div className="flex flex-col">
                            {log.user?.role === 'STUDENT' && log.user?.student?.id ? (
                              <Link to={`/admin/students/${log.user.student.id}`} className="font-bold hover:text-primary transition-colors hover:underline">
                                {log.user.name}
                              </Link>
                            ) : (
                              <span className="font-bold">{log.user?.name || 'Sistema'}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{log.user?.email || ''}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`font-black uppercase text-[10px] tracking-widest px-2 py-0.5 border shadow-none ${display.color}`}>
                          {display.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 max-w-[150px]">
                          <span className="text-sm font-bold truncate">{log.entity || '—'}</span>
                          {log.entityId && <span className="text-[10px] font-mono text-muted-foreground uppercase opacity-60">{log.entityId.substring(0, 8)}...</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                             <Globe className="size-3 text-muted-foreground shrink-0" />
                             <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{log.ip || '—'}</code>
                          </div>
                          <div className="flex items-center gap-2 max-w-[200px]" title={log.device || ''}>
                             <Smartphone className="size-3 text-muted-foreground shrink-0" />
                             <span className="text-[10px] text-muted-foreground truncate">{log.device || '—'}</span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground font-medium">
            Página <span className="text-foreground font-bold">{filter.page}</span> de <span className="text-foreground font-bold">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filter.page <= 1}
              onClick={() => setFilter(f => ({ ...f, page: f.page - 1 }))}
              className="gap-2 font-bold"
            >
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filter.page >= totalPages}
              onClick={() => setFilter(f => ({ ...f, page: f.page + 1 }))}
              className="gap-2 font-bold"
            >
              Próxima <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
        </TabsContent>

        <TabsContent value="dispatches" className="-mx-6">
          <Dispatches />
        </TabsContent>
      </Tabs>
    </div>
  );
}
