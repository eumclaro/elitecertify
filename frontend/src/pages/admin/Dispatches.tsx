import { useState, useEffect, useCallback } from 'react';
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
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  History,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  Download,
  FileJson,
  CheckCircle2,
  Send,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistorySummary {
  totalSent: number;
  totalSuccess: number;
  totalFailed: number;
  totalBatches: number;
}

interface LogItem {
  id: string;
  recipientEmail: string;
  recipientName: string;
  status: 'SENT' | 'FAILED';
  mandrillMsgId: string | null;
  sentAt: string | null;
  errorMessage: string | null;
}

interface HistoryItem {
  id: string;
  type: 'batch' | 'transactional';
  eventKey: string;
  templateName: string;
  totalRecipients: number;
  totalSuccess: number;
  totalFailed: number;
  createdAt: string;
  logs: LogItem[];
}

interface HistoryResponse {
  summary: HistorySummary;
  items: HistoryItem[];
  pagination: { page: number; limit: number; total: number };
}

type HistoryTypeFilter = 'all' | 'batch' | 'transactional' | 'failed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ success, total }: { success: number; total: number }) {
  if (total === 0) return <span className="text-muted-foreground text-xs">—</span>;
  if (success === total)
    return <span className="text-green-600 font-semibold text-sm">✅ {success}/{total}</span>;
  if (success === 0)
    return <span className="text-red-500 font-semibold text-sm">❌ {success}/{total}</span>;
  return <span className="text-amber-500 font-semibold text-sm">⚠️ {success}/{total}</span>;
}

const LIMIT = 20;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dispatches() {
  // History state
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyType, setHistoryType] = useState<HistoryTypeFilter>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Period state
  const [period, setPeriod] = useState<'30' | '60' | '90' | 'custom'>('30');
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined } | null>(null);

  // ── Fetch history ────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async (
    p: typeof period = period,
    type: HistoryTypeFilter = historyType,
    search: string = historySearch,
    page: number = historyPage,
  ) => {
    setHistoryLoading(true);
    try {
      const params: Record<string, string> = {
        type,
        page: String(page),
        limit: String(LIMIT),
      };
      if (p !== 'custom') {
        params.period = p;
      } else if (customRange?.from && customRange?.to) {
        params.period = '90';
      }
      if (search) params.search = search;

      const res = await api.get('/dispatches/history', { params });
      setHistory(res.data);
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [period, historyType, historySearch, historyPage, customRange]);

  useEffect(() => {
    fetchHistory(period, historyType, historySearch, historyPage);
  }, [period, historyType, historyPage]);

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setHistoryPage(1);
      fetchHistory(period, historyType, historySearch, 1);
    }, 400);
    return () => clearTimeout(t);
  }, [historySearch]);

  // ── Export ────────────────────────────────────────────────────────────────────

  const handleExport = async (dispatchId: string, formatType: 'csv' | 'pdf', templateName: string) => {
    try {
      const dateLabel = format(new Date(), 'dd-MM-yy');
      const res = await api.get(`/dispatches/${dispatchId}/export?format=${formatType}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `disparo-${templateName}-${dateLabel}.${formatType}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Documento gerado com sucesso');
    } catch {
      toast.error(`Erro ao gerar ${formatType.toUpperCase()}`);
    }
  };

  const summary = history?.summary ?? { totalSent: 0, totalSuccess: 0, totalFailed: 0, totalBatches: 0 };
  const items = history?.items ?? [];
  const pagination = history?.pagination ?? { page: 1, limit: LIMIT, total: 0 };
  const totalPages = Math.ceil(pagination.total / LIMIT);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disparos de E-mail</h1>
          <p className="text-muted-foreground">Gerencie envios em massa e acompanhe o histórico de comunicações.</p>
        </div>
        {/* Period toggle */}
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border shadow-sm">
          <span className="text-[10px] uppercase font-bold opacity-50 px-2">Período</span>
          <ToggleGroup
            type="single"
            value={period === 'custom' ? undefined : period}
            onValueChange={(val) => {
              if (val) { setPeriod(val as any); setCustomRange(null); setHistoryPage(1); }
            }}
            variant="outline"
            size="sm"
            className="bg-background rounded-md"
          >
            <ToggleGroupItem value="30" className="text-xs h-7 px-3">30 dias</ToggleGroupItem>
            <ToggleGroupItem value="60" className="text-xs h-7 px-3">60 dias</ToggleGroupItem>
            <ToggleGroupItem value="90" className="text-xs h-7 px-3">90 dias</ToggleGroupItem>
          </ToggleGroup>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline" size="sm"
                className={`h-7 px-3 text-xs gap-2 ${period === 'custom' ? 'border-primary bg-primary/5 text-primary' : ''}`}
              >
                <CalendarIcon className="size-3" />
                {customRange?.from && customRange?.to
                  ? `${format(customRange.from, 'dd/MM')} → ${format(customRange.to, 'dd/MM')}`
                  : 'Personalizado'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 flex gap-4 shadow-xl border-primary/20" align="end">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold opacity-60">De</Label>
                <Calendar mode="single" selected={customRange?.from}
                  onSelect={(date) => { setCustomRange(p => ({ from: date, to: p?.to })); setPeriod('custom'); setHistoryPage(1); }}
                  locale={ptBR} className="border rounded-md bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold opacity-60">Até</Label>
                <Calendar mode="single" selected={customRange?.to}
                  onSelect={(date) => { setCustomRange(p => ({ from: p?.from, to: date })); setPeriod('custom'); setHistoryPage(1); }}
                  locale={ptBR} className="border rounded-md bg-background" />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg"><Send className="size-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Total Enviados</p>
            <p className="text-2xl font-bold">{summary.totalSent}</p>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-green-500/10 text-green-500 rounded-lg"><CheckCircle2 className="size-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Sucesso</p>
            <p className="text-2xl font-bold">{summary.totalSuccess}</p>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-lg"><AlertCircle className="size-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Falhas</p>
            <p className="text-2xl font-bold">{summary.totalFailed}</p>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 text-orange-500 rounded-lg"><History className="size-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Lotes Processados</p>
            <p className="text-2xl font-bold">{summary.totalBatches}</p>
          </div>
        </div>
      </div>

      {/* Unified table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {/* Filters bar */}
        <div className="p-4 border-b bg-muted/30 flex flex-wrap items-center gap-3">
          <div className="flex bg-muted p-0.5 rounded-lg border">
            {(['all', 'transactional', 'batch', 'failed'] as HistoryTypeFilter[]).map((f) => {
              const labels: Record<HistoryTypeFilter, string> = {
                all: 'Todos', transactional: 'Transacional', batch: 'Em Massa', failed: 'Falhas',
              };
              return (
                <button
                  key={f}
                  onClick={() => { setHistoryType(f); setHistoryPage(1); }}
                  className={`px-3 py-1 text-[11px] uppercase font-bold rounded-md transition-all ${
                    historyType === f
                      ? 'bg-background shadow-sm' + (f === 'failed' ? ' text-red-600' : '')
                      : 'opacity-40 hover:opacity-100'
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por aluno ou e-mail..."
              className="pl-9 h-8 text-sm"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Evento / Template</TableHead>
              <TableHead>Destinatários</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Exportar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historyLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Clock className="size-5 animate-pulse mx-auto mb-2" /> Carregando...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhum disparo encontrado para este filtro.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isExpanded = expandedRowId === item.id;
                return (
                  <>
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                    >
                      <TableCell className="pr-0">
                        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm">{item.templateName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground">{item.eventKey}</span>
                            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${item.type === 'batch' ? 'border-blue-500/30 text-blue-500' : 'border-purple-500/30 text-purple-500'}`}>
                              {item.type === 'batch' ? 'Lote' : 'Transacional'}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.totalRecipients === 1
                          ? item.logs[0]?.recipientName || '1 aluno'
                          : `${item.totalRecipients} alunos`}
                      </TableCell>
                      <TableCell>
                        <StatusBadge success={item.totalSuccess} total={item.totalRecipients} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(item.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.type === 'batch' && (
                          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="size-7" title="CSV"
                              onClick={() => handleExport(item.id, 'csv', item.templateName)}>
                              <FileJson className="size-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" title="PDF"
                              onClick={() => handleExport(item.id, 'pdf', item.templateName)}>
                              <Download className="size-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded logs */}
                    {isExpanded && (
                      <TableRow key={`${item.id}-logs`} className="bg-muted/10 hover:bg-muted/10">
                        <TableCell colSpan={6} className="p-0">
                          <div className="px-8 py-3 space-y-1">
                            <div className="grid grid-cols-[1fr_1fr_100px_80px_1fr] gap-2 text-[10px] uppercase font-bold text-muted-foreground/60 pb-1 border-b mb-2">
                              <span>Nome</span><span>E-mail</span><span>Status</span><span>Horário</span><span>MsgID</span>
                            </div>
                            {item.logs.map((log) => (
                              <div key={log.id} className="grid grid-cols-[1fr_1fr_100px_80px_1fr] gap-2 text-xs items-center py-1">
                                <span className="font-medium truncate">{log.recipientName}</span>
                                <span className="text-muted-foreground truncate">{log.recipientEmail}</span>
                                <span>
                                  {log.status === 'SENT'
                                    ? <span className="text-green-600 font-medium">Entregue</span>
                                    : <span className="text-red-500 font-medium">Falhou</span>}
                                </span>
                                <span className="text-muted-foreground">
                                  {log.sentAt ? format(new Date(log.sentAt), 'HH:mm:ss') : '—'}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground truncate">
                                  {log.mandrillMsgId
                                    ? `MsgID: ${log.mandrillMsgId}`
                                    : log.errorMessage
                                      ? <span className="text-red-400" title={log.errorMessage}>Erro: {log.errorMessage}</span>
                                      : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between text-sm text-muted-foreground">
            <span>{pagination.total} registros • página {historyPage} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={historyPage <= 1}
                onClick={() => setHistoryPage(p => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={historyPage >= totalPages}
                onClick={() => setHistoryPage(p => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
