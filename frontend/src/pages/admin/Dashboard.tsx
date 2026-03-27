import { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  School, 
  BookOpen, 
  Trophy,
  ArrowUpRight,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  overview: {
    totalStudents: number;
    activeStudents: number;
    totalClasses: number;
    totalExams: number;
    publishedExams: number;
    totalAttempts: number;
    passedAttempts: number;
    failedAttempts: number;
    approvalRate: number;
    totalCertificates: number;
    totalNpsSurveys: number;
  };
  recentAttempts: Array<{
    id: string;
    studentName: string;
    examTitle: string;
    status: string;
    score: number | null;
    startedAt: string;
  }>;
  recentStudents: Array<{
    id: string;
    name: string;
    email: string;
    enrollmentDate: string;
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error('Dashboard error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="h-[400px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Card className="max-w-md border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Erro de Carregamento</CardTitle>
            <CardDescription>Não foi possível carregar as informações do dashboard.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const chartData = [
    { name: "Aprovados", value: stats.overview.passedAttempts, color: "var(--color-success)" },
    { name: "Reprovados", value: stats.overview.failedAttempts, color: "var(--color-destructive)" },
    { name: "Total", value: stats.overview.totalAttempts, color: "var(--color-primary)" },
  ];

  const statCards = [
    { label: 'Total de Alunos', value: stats.overview.totalStudents, icon: Users, color: 'text-primary' },
    { label: 'Turmas Ativas', value: stats.overview.totalClasses, icon: School, color: 'text-chart-1' },
    { label: 'Provas Publicadas', value: stats.overview.totalExams, icon: BookOpen, color: 'text-chart-2' },
    { label: 'Taxa de Aprovação', value: `${stats.overview.approvalRate}%`, icon: Trophy, color: 'text-success' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED': return <Badge variant="success">Aprovado</Badge>;
      case 'FAILED': return <Badge variant="destructive">Reprovado</Badge>;
      case 'IN_PROGRESS': return <Badge variant="warning">Em curso</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral do desempenho e métricas da plataforma.
        </p>
      </div>

      {/* Stats Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium opacity-70">
                {card.label}
              </CardTitle>
              <card.icon className={`size-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ArrowUpRight className="size-3 text-success" />
                Atualizado em tempo real
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* Charts Section */}
        <Card className="lg:col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Desempenho de Certificações</CardTitle>
            <CardDescription>Comparativo entre aprovações e reprovações.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] pl-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip 
                  cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <span className="font-medium">{payload[0].payload.name}:</span>
                            <span className="font-bold">{payload[0].value}</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Students Area */}
        <Card className="lg:col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Alunos Recentes</CardTitle>
            <CardDescription>Últimos cadastros realizados na plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {stats.recentStudents.slice(0, 5).map((student) => (
                <div key={student.id} className="flex items-center gap-4">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />
                    Novo
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Recent Attempts */}
      <div className="grid gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Tentativas Recentes</CardTitle>
              <CardDescription>Registro das últimas provas realizadas.</CardDescription>
            </div>
            <Button variant="outline" size="sm">Ver Tudo</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Prova</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentAttempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-medium">{attempt.studentName}</TableCell>
                    <TableCell>{attempt.examTitle}</TableCell>
                    <TableCell>{getStatusBadge(attempt.status)}</TableCell>
                    <TableCell className="text-right font-bold">
                      {attempt.score !== null ? (
                        <span className={attempt.score >= 70 ? "text-success" : "text-destructive"}>
                          {attempt.score}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {stats.recentAttempts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nenhuma tentativa registrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
