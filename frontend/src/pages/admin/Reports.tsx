import { useState } from 'react';
import api from '../../services/api';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Users, 
  FileText, 
  CheckCircle2, 
  Trophy, 
  BarChart3, 
  School,
  Download,
  Loader2,
  Calendar,
  MessageSquare,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  LineChart,
  Line
} from 'recharts';
import { format } from 'date-fns';

// --- Components ---

const MetricCard = ({ title, value, icon: Icon, description, colorClass }: any) => (
  <Card className="border-none shadow-sm">
    <CardContent className="p-6">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="flex flex-col gap-1 mt-1">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </CardContent>
  </Card>
);

export default function Reports() {
  const [period, setPeriod] = useState('30d');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedExam, setSelectedExam] = useState<string>('');

  // 1. Data Fetching
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['reports-stats', period],
    queryFn: async () => (await api.get(`/reports/stats?period=${period}`)).data
  });

  const { data: perfChart } = useQuery({
    queryKey: ['reports-perf-chart', period],
    queryFn: async () => (await api.get(`/reports/charts/performance?period=${period}`)).data
  });

  const { data: classList } = useQuery({
    queryKey: ['classes-list'],
    queryFn: async () => (await api.get('/classes')).data
  });

  const { data: examList } = useQuery({
    queryKey: ['exams-list'],
    queryFn: async () => (await api.get('/exams')).data
  });

  const { data: classReport, isLoading: loadingClass } = useQuery({
    queryKey: ['class-report', selectedClass, period],
    queryFn: async () => (await api.get(`/reports/class/${selectedClass}?period=${period}`)).data,
    enabled: !!selectedClass
  });

  const { data: examReport, isLoading: loadingExam } = useQuery({
    queryKey: ['exam-report', selectedExam, period],
    queryFn: async () => (await api.get(`/reports/exam/${selectedExam}?period=${period}`)).data,
    enabled: !!selectedExam
  });

  const { data: npsReport, isLoading: loadingNps } = useQuery({
    queryKey: ['nps-report', period],
    queryFn: async () => (await api.get(`/reports/nps?period=${period}`)).data
  });

  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: 'excel' | 'pdf', reportType: 'class' | 'exam', id: string) => {
    try {
      setExporting(`${reportType}-${type}`);
      const response = await api.get(`/reports/export/${type}?type=${reportType}&id=${id}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: type === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio-${reportType}.${type === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Motor de Relatórios</h1>
          <p className="text-muted-foreground mt-1">Inteligência de dados e performance da Elite Certify</p>
        </div>
        
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
          <Calendar className="size-4 text-muted-foreground ml-2" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] border-none bg-transparent shadow-none focus:ring-0 font-medium">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted h-12 p-1 gap-1">
          <TabsTrigger value="overview" className="px-6 data-[state=active]:bg-background">Visão Geral</TabsTrigger>
          <TabsTrigger value="class" className="px-6 data-[state=active]:bg-background">Por Turma</TabsTrigger>
          <TabsTrigger value="exam" className="px-6 data-[state=active]:bg-background">Por Prova</TabsTrigger>
          <TabsTrigger value="nps" className="px-6 data-[state=active]:bg-background">Satisfação (NPS)</TabsTrigger>
        </TabsList>

        {/* --- ABA 1: VISÃO GERAL --- */}
        <TabsContent value="overview" className="space-y-6 outline-none">
          {loadingStats ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Total Alunos" value={stats.totalStudents} icon={Users} description="Novos no período" colorClass="bg-blue-500/10 text-blue-600" />
              <MetricCard title="Provas Feitas" value={stats.totalAttempts} icon={FileText} description="Tentativas finalizadas" colorClass="bg-amber-500/10 text-amber-600" />
              <MetricCard title="Taxa Aprovação" value={`${stats.globalPassRate}%`} icon={CheckCircle2} description="Média de sucesso" colorClass="bg-emerald-500/10 text-emerald-600" />
              <MetricCard title="Score NPS" value={stats.npsScore} icon={Trophy} description="Lealdade global" colorClass="bg-violet-500/10 text-violet-600" />
            </div>
          )}

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Desempenho no Período</CardTitle>
                <CardDescription>Aprovados vs Reprovados por dia</CardDescription>
              </div>
              <TrendingUp className="text-muted-foreground size-5" />
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perfChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={(str) => format(new Date(str), 'dd/MM')} tick={{fontSize: 12}} />
                    <YAxis tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                    <Legend iconType="circle" />
                    <Bar name="Aprovados" dataKey="passed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                    <Bar name="Reprovados" dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- ABA 2: POR TURMA --- */}
        <TabsContent value="class" className="space-y-6 outline-none">
          <Card className="border-none shadow-sm bg-muted/30">
            <CardContent className="p-6 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[240px]">
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione uma turma para analisar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(classList) ? (
                      classList.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    ) : (classList as any)?.data ? (
                      (classList as any).data.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              {selectedClass && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 font-bold" 
                    disabled={!!exporting}
                    onClick={() => handleExport('excel', 'class', selectedClass)}
                  >
                    {exporting === 'class-excel' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Excel
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 font-bold" 
                    disabled={!!exporting}
                    onClick={() => handleExport('pdf', 'class', selectedClass)}
                  >
                    {exporting === 'class-pdf' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    PDF
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {!selectedClass ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
              <School className="size-12 mb-4 opacity-20" />
              <p>Selecione uma turma para visualizar métricas específicas.</p>
            </div>
          ) : loadingClass ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : classReport && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <MetricCard title="Alunos" value={classReport.stats.totalStudents} icon={Users} colorClass="bg-slate-100 text-slate-600" />
                <MetricCard title="Ativos" value={classReport.stats.activeStudents} icon={TrendingUp} colorClass="bg-blue-100 text-blue-600" />
                <MetricCard title="Sucesso" value={`${classReport.stats.passRate}%`} icon={CheckCircle2} colorClass="bg-emerald-100 text-emerald-600" />
                <MetricCard title="Média" value={`${classReport.stats.avgGrade}%`} icon={BarChart3} colorClass="bg-amber-100 text-amber-600" />
                <MetricCard title="NPS" value={classReport.stats.npsScore} icon={MessageSquare} colorClass="bg-violet-100 text-violet-600" />
              </div>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Alunos da Turma</CardTitle>
                  <CardDescription>Desempenho individual no período selecionado</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="px-6">Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-center">Tentativas</TableHead>
                        <TableHead className="text-center">Última Nota</TableHead>
                        <TableHead className="text-right px-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classReport.students.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="px-6 font-medium">{s.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{s.email}</TableCell>
                          <TableCell className="text-center">{s.attempts}</TableCell>
                          <TableCell className="text-center font-bold">{s.lastScore !== null ? `${s.lastScore}%` : '-'}</TableCell>
                          <TableCell className="text-right px-6">
                             <Badge variant={s.status === 'PASSED' ? 'default' : s.status === 'FAILED' ? 'destructive' : 'outline'}>
                              {s.status === 'PASSED' ? 'Aprovado' : s.status === 'FAILED' ? 'Reprovado' : 'Pendente'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* --- ABA 3: POR PROVA --- */}
        <TabsContent value="exam" className="space-y-6 outline-none">
           <Card className="border-none shadow-sm bg-muted/30">
            <CardContent className="p-6 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[240px]">
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione uma prova para analisar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(examList as any)?.data ? (
                      (examList as any).data.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))
                    ) : Array.isArray(examList) ? (
                      examList.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
               {selectedExam && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 font-bold" 
                    disabled={!!exporting}
                    onClick={() => handleExport('excel', 'exam', selectedExam)}
                  >
                    {exporting === 'exam-excel' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Excel
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 font-bold" 
                    disabled={!!exporting}
                    onClick={() => handleExport('pdf', 'exam', selectedExam)}
                  >
                    {exporting === 'exam-pdf' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    PDF
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {!selectedExam ? (
             <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
              <FileText className="size-12 mb-4 opacity-20" />
              <p>Selecione uma prova para visualizar métricas de desempenho.</p>
            </div>
          ) : loadingExam ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : examReport && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Total Tentativas" value={examReport.stats.totalAttempts} icon={FileText} colorClass="bg-slate-100 text-slate-600" />
                <MetricCard title="Aprovados" value={examReport.stats.passed} icon={CheckCircle2} colorClass="bg-emerald-100 text-emerald-600" />
                <MetricCard title="Reprovados" value={examReport.stats.failed} icon={AlertCircle} colorClass="bg-rose-100 text-rose-600" />
                <MetricCard title="Média" value={`${examReport.stats.avgGrade}%`} icon={BarChart3} colorClass="bg-amber-100 text-amber-600" />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Distribuição de Notas</CardTitle>
                    <CardDescription>Quantidade de alunos por faixa de pontuação</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={examReport.histogram}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="range" tick={{fontSize: 10}} />
                          <YAxis tick={{fontSize: 10}} />
                          <Tooltip cursor={{fill: '#f9fafb'}} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm flex flex-col justify-center text-center p-8 space-y-4">
                  <div className="p-4 bg-orange-500/10 text-orange-600 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                    <AlertCircle className="size-10" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Questão mais errada</h3>
                    {examReport.stats.mostMissed ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-muted-foreground italic">"{examReport.stats.mostMissed.text}"</p>
                        <p className="text-2xl font-black text-rose-600">{examReport.stats.mostMissed.count} erros</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-4">Nenhum erro registrado no período.</p>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* --- ABA 4: NPS --- */}
        <TabsContent value="nps" className="space-y-6 outline-none">
          {loadingNps ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : npsReport && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="border-none shadow-sm md:col-span-1 py-8 flex flex-col items-center justify-center">
                   <div className={`text-6xl font-black mb-2 ${npsReport.score >= 50 ? 'text-emerald-500' : npsReport.score >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                    {npsReport.score}
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Global NPS Score</p>
                  <div className="mt-6 w-full px-6 space-y-2">
                    <div className="flex justify-between text-xs font-bold"><span className="text-emerald-500">Promotores</span><span>{Math.round((npsReport.distribution.promoters / (npsReport.distribution.promoters + npsReport.distribution.neutrals + npsReport.distribution.detractors)) * 100) || 0}%</span></div>
                    <div className="flex justify-between text-xs font-bold"><span className="text-amber-500">Neutros</span><span>{Math.round((npsReport.distribution.neutrals / (npsReport.distribution.promoters + npsReport.distribution.neutrals + npsReport.distribution.detractors)) * 100) || 0}%</span></div>
                    <div className="flex justify-between text-xs font-bold"><span className="text-rose-500">Detratores</span><span>{Math.round((npsReport.distribution.detractors / (npsReport.distribution.promoters + npsReport.distribution.neutrals + npsReport.distribution.detractors)) * 100) || 0}%</span></div>
                  </div>
                </Card>

                <Card className="border-none shadow-sm md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Evolução do NPS</CardTitle>
                    <CardDescription>Satisfação ao longo do tempo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {npsReport.evolution.length < 2 ? (
                      <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground space-y-2">
                        <BarChart3 className="size-10 opacity-10" />
                        <p className="text-sm italic">Ainda não há dados suficientes para exibir a evolução.</p>
                        <p className="text-[10px]">Os dados aparecerão conforme as pesquisas forem respondidas.</p>
                      </div>
                    ) : (
                      <div className="h-[250px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={npsReport.evolution}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="label" tick={{fontSize: 10}} />
                            <YAxis tick={{fontSize: 10}} domain={[-100, 100]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={3} dot={{r: 5, fill: '#8b5cf6'}} activeDot={{r: 8}} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

               <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Feedbacks de Alunos</CardTitle>
                  <CardDescription>Comentários recentes das pesquisas NPS</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   {npsReport.feedbacks.length === 0 ? (
                    <p className="text-center text-muted-foreground italic py-8">Nenhum feedback em texto registrado.</p>
                  ) : npsReport.feedbacks.map((f: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-lg bg-muted/30 border border-slate-100 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs">{f.student}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(f.date), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      <p className="text-sm italic text-slate-800">"{f.text}"</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
