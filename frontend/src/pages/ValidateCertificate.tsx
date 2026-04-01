import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, Award, Calendar, Hash, User, ShieldCheck, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ValidateCertificate() {
  const { code } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validate = async () => {
      try {
        const response = await api.get(`/certificates/validate/${code}`);
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Certificado não encontrado ou inválido.');
      } finally {
        setLoading(false);
      }
    };

    if (code) validate();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-none">
          <CardHeader className="space-y-4">
            <Skeleton className="h-12 w-12 rounded-full mx-auto" />
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      {/* Brand Header */}
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className="size-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
          <ShieldCheck className="size-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">ELT CERT</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Portal de Autenticidade</p>
        </div>
      </div>

      <Card className="w-full max-w-2xl shadow-2xl border-none overflow-hidden bg-white">
        {error ? (
          <div className="p-12 text-center space-y-6">
            <div className="size-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="size-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Certificado Inválido</h2>
              <p className="text-slate-500 max-w-sm mx-auto">{error}</p>
            </div>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/">Voltar ao Início</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="bg-emerald-600 p-8 text-white text-center space-y-4 relative overflow-hidden">
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                < Award size={200} />
              </div>
              
              <div className="size-16 bg-white/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm">
                <CheckCircle2 className="size-8 text-white" />
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl font-black tracking-tight">VALIDADO</h2>
                <p className="text-emerald-100/80 font-medium font-mono text-sm tracking-widest">{data.code}</p>
              </div>
            </div>

            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="size-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Aluno</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 break-words">{data.studentName}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Award className="size-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Certificação / Prova</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 break-words">{data.examTitle}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="size-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Data de Emissão</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">
                    {format(new Date(data.issuedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Hash className="size-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Código de Verificação</span>
                  </div>
                  <p className="text-lg font-mono font-bold text-slate-900">{data.code}</p>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="w-fit bg-slate-50 text-slate-600 border-slate-200">
                    Status: Original
                  </Badge>
                  <p className="text-[10px] text-slate-400 italic">Este certificado foi emitido eletronicamente pela ELT CERT.</p>
                </div>
                
                <Button variant="ghost" size="sm" asChild className="gap-2 text-slate-600 hover:text-primary group">
                   <a href="https://elitetraining.com.br" target="_blank" rel="noopener noreferrer">
                      Elite Training <ExternalLink className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                   </a>
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Footer Info */}
      <p className="mt-8 text-slate-400 text-[10px] font-medium tracking-[0.2em] uppercase">
        &copy; {new Date().getFullYear()} ELT CERT &bull; Elite Training Global
      </p>
    </div>
  );
}
