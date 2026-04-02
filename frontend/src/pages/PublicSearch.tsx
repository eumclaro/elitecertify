import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ShieldCheck } from 'lucide-react';

export default function PublicSearch() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Por favor, insira o código do certificado.');
      return;
    }
    navigate(`/validar/${code.trim()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="mb-10 flex flex-col items-center gap-2 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <img 
          src="/logotipo-elite-black.png" 
          alt="Elite Training Logo" 
          className="h-20 w-auto object-contain mb-2"
        />
        <div className="h-px w-12 bg-slate-200 mx-auto mt-2 opacity-50" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden bg-white animate-in zoom-in-95 duration-500">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-slate-900">Verificar Autenticidade</CardTitle>
          <CardDescription className="text-slate-500">
            Insira o código do certificado para confirmar sua validade
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-4">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Ex: ELT-57B62B8C"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  className="pl-10 h-12 bg-slate-50 border-slate-200 focus-visible:ring-primary shadow-sm uppercase font-mono tracking-wider"
                />
              </div>
              {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
            </div>
            <Button type="submit" className="w-full h-12 font-bold text-base shadow-lg shadow-primary/20">
              Verificar Certificado
            </Button>
          </form>
          
          <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
            <ShieldCheck className="size-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Sistema de Verificação Oficial</p>
          </div>
        </CardContent>
      </Card>

      <p className="mt-8 text-slate-400 text-[10px] font-medium tracking-[0.2em] uppercase">
        &copy; {new Date().getFullYear()} Elite Training Global
      </p>
    </div>
  );
}
