import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Image as ImageIcon, Upload } from "lucide-react";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [form, setForm] = useState({
    host: '',
    port: '',
    user: '',
    pass: '',
    fromEmail: '',
    fromName: ''
  });
  const [hasPassword, setHasPassword] = useState(false);
  const [showPass, setShowPass] = useState(false);
  
  const [loginCoverUrl, setLoginCoverUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const [smtpRes, coverRes] = await Promise.all([
        api.get('/settings/smtp'),
        api.get('/settings/login-cover')
      ]);

      if (smtpRes.data.hasPassword !== undefined) {
        setForm({
          host: smtpRes.data.host || '',
          port: smtpRes.data.port || '',
          user: smtpRes.data.user || '',
          pass: '', 
          fromEmail: smtpRes.data.fromEmail || '',
          fromName: smtpRes.data.fromName || ''
        });
        setHasPassword(smtpRes.data.hasPassword);
      }

      setLoginCoverUrl(coverRes.data.url);
    } catch (err: any) {
      toast.error('Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/smtp', form);
      toast.success('Configurações SMTP gravadas e criptografadas com sucesso!');
      fetchConfigs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar configurações SMTP.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setTesting(true);
    try {
      const { data } = await api.post('/settings/smtp/test', form);
      toast.success(data.message || 'Teste concluído com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao realizar teste de SMTP.');
    } finally {
      setTesting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas arquivos de imagem (JPG, PNG).');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/settings/login-cover', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Imagem de login atualizada com sucesso!');
      setLoginCoverUrl(data.url);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar imagem de login.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações Base</h2>
        <p className="text-muted-foreground text-sm">
          Gerencie as integrações de e-mail e a interface de acesso do aluno.
        </p>
      </div>

      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="appearance" className="gap-2"><ImageIcon className="w-4 h-4"/> Interfaces / App</TabsTrigger>
          <TabsTrigger value="smtp" className="gap-2"><Mail className="w-4 h-4"/> E-mail SMTP</TabsTrigger>
        </TabsList>

        {/* Tab Aparencia */}
        <TabsContent value="appearance" className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <Card>
            <CardHeader>
              <CardTitle>Imagem da Tela de Login</CardTitle>
              <CardDescription>
                Esta imagem será exibida no painel esquerdo da tela de entrada dos alunos e administradores. Recomenda-se imagens na vertical para melhor conversão.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex flex-col gap-4 w-full md:w-1/2">
                  <div className="flex items-center justify-center w-full min-h-[300px] border-2 border-dashed rounded-lg bg-muted/20 relative overflow-hidden group">
                    {loginCoverUrl ? (
                      <img 
                        src={`${import.meta.env.VITE_API_URL}${loginCoverUrl}`} 
                        alt="Login Cover Preview" 
                        className="w-full h-full object-cover absolute inset-0"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-[#1a1a1a] w-full h-[300px] absolute inset-0">
                         <img src="/logotipo-elite-training.png" className="h-12 opacity-50 grayscale mix-blend-overlay" alt="placeholder" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                         {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Upload className="w-4 h-4 mr-2"/>}
                         Substituir Imagem
                       </Button>
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/jpg, image/webp" 
                  />
                  <div className="text-xs text-muted-foreground">
                    Formatos aceitos: JPG, PNG. O arquivo substituirá o anterior automaticamente.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Tab SMTP */}
        <TabsContent value="smtp" className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <Card>
            <form onSubmit={handleSaveSmtp}>
              <CardHeader>
                <CardTitle>Credenciais do Servidor SMTP</CardTitle>
                <CardDescription>
                  Serviço de disparo que enviará e-mails transacionais pela plataforma (Mandrill/Mailchimp).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Servidor (Host)</Label>
                    <Input placeholder="Ex: smtp.mandrillapp.com" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Porta (Port)</Label>
                    <Input type="number" placeholder="Ex: 587" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Nome do Remetente</Label>
                    <Input placeholder="Ex: Elite Certify" value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>E-mail do Remetente</Label>
                    <Input type="email" placeholder="Ex: noreply@empresa.com.br" value={form.fromEmail} onChange={e => setForm({ ...form, fromEmail: e.target.value })} required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Usuário SMTP</Label>
                    <Input placeholder="API Key Name" value={form.user} onChange={e => setForm({ ...form, user: e.target.value })} required />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">
                      Senha / Secret Key
                      {hasPassword && !form.pass && <span className="text-xs text-primary">(Salva do db)</span>}
                    </Label>
                    <div className="flex relative">
                      <Input 
                        type={showPass ? "text" : "password"} 
                        value={form.pass} 
                        onChange={e => setForm({ ...form, pass: e.target.value })} 
                        required={!hasPassword}
                        placeholder={hasPassword ? 'Preencha apenas se for alterar...' : 'Senha do SMTP'} 
                        className="pr-16"
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="absolute right-0 top-0 h-9 px-3 text-xs" 
                        onClick={() => setShowPass(!showPass)}>
                        {showPass ? 'GHOST' : 'Ver'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2 border-t pt-6 bg-muted/20">
                <Button type="button" variant="outline" onClick={handleTestSmtp} disabled={testing || saving}>
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null}
                  Testar Disparo
                </Button>
                <Button type="submit" disabled={saving || testing}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null}
                  Gravar Definições
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
