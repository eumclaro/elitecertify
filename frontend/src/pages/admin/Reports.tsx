import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  FileText, 
  CheckCircle2, 
  Trophy, 
  LineChart, 
  School,
  Download,
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Reports() {
  const [stats, setStats] = useState<any>(null);
  const [examReport, setExamReport] = useState<any[]>([]);
  const [studentReport, setStudentReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/stats'),
      api.get('/reports/exams'),
      api.get('/reports/students'),
    ]).then(([s, e, st]) => {
      setStats(s.data);
      setExamReport(e.data);
      setStudentReport(st.data);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Visão consolidada de desempenho e métricas gerais</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" asChild className="gap-2 font-bold h-9">
            <a href="/api/reports/exams/export" target="_blank" rel="noopener noreferrer">
              <Download className="size-4" /> CSV Provas
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-2 font-bold h-9">
            <a href="/api/reports/students/export" target="_blank" rel="noopener noreferrer">
              <Download className="size-4" /> CSV Alunos
            </a>
          </Button>
        </div>
      </div>

      {/* Global Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="bg-muted/30 border-none">
            <CardContent className="p-4 pt-4 flex flex-col items-center text-center space-y-1">
              <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg mb-1"><Users className="size-5" /></div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Alunos</p>
              <p className="text-2xl font-bold">{stats.totalStudents}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-none">
            <CardContent className="p-4 pt-4 flex flex-col items-center text-center space-y-1">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg mb-1"><FileText className="size-5" /></div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Tentativas</p>
              <p className="text-2xl font-bold">{stats.totalAttempts}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-none">
            <CardContent className="p-4 pt-4 flex flex-col items-center text-center space-y-1">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg mb-1"><CheckCircle2 className="size-5" /></div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Aprovação</p>
              <p className="text-2xl font-bold">{stats.globalPassRate}%</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-none">
            <CardContent className="p-4 pt-4 flex flex-col items-center text-center space-y-1">
              <div className="p-2 bg-cyan-500/10 text-cyan-600 rounded-lg mb-1"><Trophy className="size-5" /></div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Certificados</p>
              <p className="text-2xl font-bold">{stats.totalCertificates}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-none">
            <CardContent className="p-4 pt-4 flex flex-col items-center text-center space-y-1">
              <div className="p-2 bg-violet-500/10 text-violet-600 rounded-lg mb-1"><LineChart className="size-5" /></div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Média Geral</p>
              <p className="text-2xl font-bold">{stats.avgScore}%</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-none">
            <CardContent className="p-4 pt-4 flex flex-col items-center text-center space-y-1">
              <div className="p-2 bg-pink-500/10 text-pink-600 rounded-lg mb-1"><School className="size-5" /></div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Turmas</p>
              <p className="text-2xl font-bold">{stats.totalClasses}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="exams" className="w-full">
        <TabsList className="bg-muted/50 p-1 h-12 mb-4">
          <TabsTrigger value="exams" className="px-6 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="size-4" /> Relatório de Provas
          </TabsTrigger>
          <TabsTrigger value="students" className="px-6 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="size-4" /> Relatório de Alunos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exams" className="mt-0">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">Prova</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Tentativas</TableHead>
                    <TableHead className="text-center">Aprovados</TableHead>
                    <TableHead className="text-center">Reprovados</TableHead>
                    <TableHead className="text-center">Média</TableHead>
                    <TableHead className="w-48">Taxa Aprovação</TableHead>
                    <TableHead className="text-right px-6">Certificados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examReport.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-64 text-center text-muted-foreground italic">
                        Nenhuma prova registrada.
                      </TableCell>
                    </TableRow>
                  ) : examReport.map(e => (
                    <TableRow key={e.id} className="hover:bg-muted/10 transition-colors group">
                      <TableCell className="px-6 font-bold group-hover:text-primary transition-colors">{e.title}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{e.className}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === 'PUBLISHED' ? 'default' : 'outline'} className={e.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}>
                          {e.status === 'PUBLISHED' ? 'Ativa' : 'Rascunho'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{e.totalAttempts}</TableCell>
                      <TableCell className="text-center text-emerald-600 font-bold">{e.passed}</TableCell>
                      <TableCell className="text-center text-rose-600 font-bold">{e.failed}</TableCell>
                      <TableCell className="text-center font-black">{e.avgScore}%</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Progress 
                            value={e.passRate} 
                            className={`h-1.5 ${e.passRate >= 70 ? "[&>div]:bg-emerald-500" : e.passRate >= 40 ? "[&>div]:bg-amber-500" : "[&>div]:bg-rose-500"}`}
                          />
                          <span className="text-[10px] font-bold text-muted-foreground">{e.passRate}% sucesso</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Badge variant="secondary" className="h-7 w-7 rounded-sm flex items-center justify-center p-0 font-black bg-blue-500/10 text-blue-600 ml-auto">
                          {e.certificates}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="mt-0">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6">Aluno</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Turmas</TableHead>
                    <TableHead className="text-center">Tentativas</TableHead>
                    <TableHead className="text-center">Aprovados</TableHead>
                    <TableHead className="text-center">Reprovados</TableHead>
                    <TableHead className="text-center font-black">Média</TableHead>
                    <TableHead className="text-right px-6">Certificados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentReport.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center text-muted-foreground italic">
                        Nenhum aluno registrado.
                      </TableCell>
                    </TableRow>
                  ) : studentReport.map(s => (
                    <TableRow key={s.id} className="hover:bg-muted/10 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <Link to={`/admin/students/${s.id}`} className="font-bold hover:text-primary transition-colors">
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{s.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] border-dashed">
                          {s.classes || 'Nenhuma'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{s.totalAttempts}</TableCell>
                      <TableCell className="text-center text-emerald-600 font-bold">{s.passed}</TableCell>
                      <TableCell className="text-center text-rose-600 font-bold">{s.failed}</TableCell>
                      <TableCell className="text-center font-black bg-muted/20">{s.avgScore}%</TableCell>
                      <TableCell className="text-right px-6">
                        <Badge variant="secondary" className="h-7 w-7 rounded-sm flex items-center justify-center p-0 font-black bg-blue-500/10 text-blue-600 ml-auto">
                          {s.certificates}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
