import nodemailer from 'nodemailer';
import prisma from '../config/database';
import { decrypt } from '../utils/crypto';
import { 
  EmailContent, EMAIL_EVENTS as LEGACY_EVENTS, EmailEvent,
  getWelcomeTemplate, getPasswordResetTemplate, getExamReleasedTemplate,
  getExamPassedTemplate, getExamFailedTemplate, getCooldownReleasedTemplate
} from './emailTemplates';
import { IEmailProvider } from './email/types';
import { MandrillProvider } from './email/mandrillProvider';
import { EMAIL_MAPPINGS, EmailEventKey } from '../constants/emailEvents';

let defaultProvider: IEmailProvider | null = null;
export function getEmailProvider(): IEmailProvider {
  if (!defaultProvider) {
    defaultProvider = new MandrillProvider();
    defaultProvider.init();
  }
  return defaultProvider;
}

export async function getAuthorizedSender() {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_config' } });
    if (setting) {
      const parsed = JSON.parse(setting.value);
      return {
        fromEmail: parsed.fromEmail as string | undefined,
        fromName: parsed.fromName as string | undefined
      };
    }
  } catch (e) {}
  return { fromEmail: undefined, fromName: undefined };
}

// Cache em memória para evitar hits no banco a cada e-mail disparado
let cachedSmtpConfig: any = null;
let configCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function getActiveTransport() {
  const now = Date.now();
  if (cachedSmtpConfig && (now - configCacheTime < CACHE_TTL)) {
    return nodemailer.createTransport(cachedSmtpConfig);
  }

  // Tenta buscar do Banco de Dados
  let configStr = null;
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_config' } });
    if (setting) configStr = setting.value;
  } catch (e) {
    // Falha silenciosa se DB não existir/schema falhar, usa env.
  }

  let transportParams: any = null;

  if (configStr) {
    const parsed = JSON.parse(configStr);
    const pass = parsed.pass ? decrypt(parsed.pass) : '';
    transportParams = {
      host: parsed.host,
      port: parseInt(parsed.port, 10),
      secure: parseInt(parsed.port, 10) === 465, // true para 465 SSL puro
      auth: {
        user: parsed.user,
        pass: pass,
      }
    };
    process.env.RUNTIME_SMTP_FROM = parsed.fromEmail 
      ? `"${parsed.fromName || 'Elite Certify'}" <${parsed.fromEmail}>` 
      : '';
  } else {
    // Fallback absoluto pro .env (caso nenhuma definicao de painel exista)
    transportParams = {
      host: process.env.SMTP_HOST || 'smtp.mandrillapp.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    };
    process.env.RUNTIME_SMTP_FROM = process.env.SMTP_FROM || '"Elite Certify" <no-reply@elt.com.br>';
  }

  cachedSmtpConfig = transportParams;
  configCacheTime = now;

  return nodemailer.createTransport(transportParams);
}

interface InternalMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  type?: string; 
}

/**
 * Método Base para disparar e-mails.
 * Encapsula a lógica de try/catch para não quebrar fluxos em caso de erro SMTP, 
 * e faz o log transparente da operação via console/DB se desejado.
 */
export async function sendMail(options: InternalMailOptions) {
  try {
    const transporter = await getActiveTransport();
    const from = process.env.RUNTIME_SMTP_FROM || '"Elite Certify" <no-reply@elt.com.br>';

    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    
    console.log(`[MAIL - SUCCESS] Event: ${options.type || 'generic'} | Dest: ${options.to} | MessageID: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`[MAIL - ERROR] Event: ${options.type || 'generic'} | Dest: ${options.to} | Erro: ${error.message}`);
    return false;
  }
}

// Wrapper Helper Legado
export async function dispatchTemplate(event: EmailEvent, toEmail: string, content: EmailContent) {
  return sendMail({
    to: toEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    type: event
  });
}

// ==========================================
// MANDRILL DISPATCHER BASE
// ==========================================

export async function dispatchTemplateToMandrill(
  eventKey: EmailEventKey, 
  toEmail: string, 
  toName: string, 
  dynamicData: Record<string, any>,
  subject?: string,
  dispatchId?: string
) {
  try {
    const provider = getEmailProvider();

    // 1. Tentar buscar vínculo dinâmico no banco de dados
    const binding = await prisma.emailEventBinding.findUnique({
      where: { eventKey },
      include: { internalTemplate: true, template: true }
    });

    let internalHtml: string | undefined = undefined;
    let templateNameUsed: string = 'Internal';

    if (binding && binding.isActive && binding.internalTemplate && binding.internalTemplate.status === 'ACTIVE') {
      internalHtml = binding.internalTemplate.htmlContent || undefined;
      templateNameUsed = binding.internalTemplate.name;
      console.log(`[Mail] Using internal template for ${eventKey}: ${templateNameUsed}`);
    } else {
      // Se não houver template interno ativo, retornamos erro conforme solicitado
      throw new Error(`Nenhum template interno ativo vinculado ao evento ${eventKey}`);
    }

    // 2. Buscar remetente autorizado do sistema
    const { fromEmail, fromName } = await getAuthorizedSender();

    // 3. Disparar via Provider (Mandrill as Transporter only)
    const msgId = await provider.send({
      toEmail,
      toName,
      eventKey,
      subject: subject || '(Sem assunto)',
      dynamicData,
      fromEmail,
      fromName,
      htmlContent: internalHtml
    });

    // 3. Registrar Log Robusto
    await prisma.emailLog.create({
      data: {
        eventKey,
        templateUsed: templateNameUsed,
        recipient: toEmail,
        subject: subject || '(Sem assunto)',
        payloadJson: JSON.stringify(dynamicData),
        provider: 'MANDRILL',
        mandrillMsgId: msgId,
        status: 'SENT',
        sentAt: new Date(),
        dispatchId
      } as any
    });

    console.log(`[MANDRILL - SUCCESS] Event: ${eventKey} | Dest: ${toEmail} | MsgID: ${msgId}`);
    return true;
  } catch (error: any) {
    console.error(`[MANDRILL - ERROR] Event: ${eventKey} | Dest: ${toEmail} | Erro: ${error.message}`);
    
    // Registrar falha no Log (se possível)
    await prisma.emailLog.create({
      data: {
        eventKey,
        templateUsed: eventKey,
        recipient: toEmail,
        provider: 'MANDRILL',
        status: 'FAILED',
        errorMessage: error.message,
        dispatchId
      } as any
    }).catch(() => {});

    throw error;
  }
}

// ==========================================
// SEMANTIC WRAPPERS - FASE 1 (MIGRATED TO MANDRILL)
// ==========================================

export async function sendWelcomeEmail(name: string, email: string, rawPassword?: string, lastName: string = '') {
  return dispatchTemplateToMandrill('STUDENT_CREATED', email, name, {
    NAME: name,
    LAST_NAME: lastName,
    EMAIL: email,
    PASSWORD: rawPassword || '',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  }, 'Suas credenciais de acesso - Elite Training');
}

export async function sendPasswordResetEmail(name: string, email: string, resetLink: string, lastName: string = '') {
  return dispatchTemplateToMandrill('AUTH_PASSWORD_RESET', email, name, {
    NAME: name,
    LAST_NAME: lastName,
    EMAIL: email,
    RESET_LINK: resetLink,
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  }, 'Redefinição de senha - Elite Training');
}

export async function sendInviteEmail(name: string, email: string, role: string, inviteLink: string) {
  const roleLabel = role === 'SUPER_ADMIN' ? 'Super Administrador' : (role === 'ADMIN' ? 'Administrador' : 'Visualizador');
  
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="color:#111827;font-size:24px;margin:0;">Elite Certify</h1>
      </div>
      
      <h2 style="color:#111827;font-size:20px;margin-bottom:16px;">Olá, ${name}!</h2>
      
      <p style="color:#4b5563;font-size:16px;line-height:24px;margin-bottom:24px;">
        Você foi convidado para acessar a plataforma <strong>Elite Certify</strong> como <strong>${roleLabel}</strong>.
      </p>
      
      <p style="color:#4b5563;font-size:16px;line-height:24px;margin-bottom:32px;">
        Clique no link abaixo para criar sua senha e ativar sua conta:
      </p>
      
      <div style="text-align:center;margin-bottom:32px;">
        <a href="${inviteLink}" 
           style="background-color:#111827;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">
          Ativar Minha Conta
        </a>
      </div>
      
      <p style="color:#6b7280;font-size:14px;line-height:20px;margin-bottom:16px;">
        Este link expira em <strong>48 horas</strong>.
      </p>
      
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:32px 0;" />
      
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
        Se você não esperava por este convite, pode ignorar este e-mail com segurança.
      </p>
    </div>
  `;

  return sendMail({
    to: email,
    subject: 'Você foi convidado para acessar o Elite Certify',
    html,
    type: 'ADMIN_INVITE'
  });
}

export async function sendExamReleasedEmail(name: string, email: string, examName: string, lastName: string = '') {
  return dispatchTemplateToMandrill('EXAM_RELEASED', email, name, {
    NAME: name,
    LAST_NAME: lastName,
    EMAIL: email,
    EXAM_NAME: examName,
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  }, `Você tem uma nova prova disponível: ${examName}`);
}

export async function sendExamPassedEmail(
  name: string, 
  email: string, 
  examName: string, 
  score: number,
  correctAnswers: number,
  totalQuestions: number,
  certificateUrl?: string, 
  lastName: string = ''
) {
  return dispatchTemplateToMandrill('EXAM_PASSED', email, name, {
    NAME: name,
    LAST_NAME: lastName,
    EMAIL: email,
    EXAM_NAME: examName,
    SCORE: `${score}%`,
    CORRETAS: correctAnswers,
    ERRADAS: totalQuestions - correctAnswers,
    TOTAL_QUESTOES: totalQuestions,
    STATUS: 'APROVADO',
    CERTIFICATE_LINK: certificateUrl || '',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  }, `Parabéns! Você foi aprovado em: ${examName}`);
}

export async function sendExamFailedEmail(
  name: string, 
  email: string, 
  examName: string, 
  score: number,
  correctAnswers: number,
  totalQuestions: number,
  cooldownEndDate?: Date, 
  lastName: string = '',
  attemptId: string = ''
) {
  const dynamicData = {
    NAME: name,
    LAST_NAME: lastName,
    EMAIL: email,
    EXAM_NAME: examName,
    SCORE: `${score}%`,
    CORRETAS: correctAnswers,
    ERRADAS: totalQuestions - correctAnswers,
    TOTAL_QUESTOES: totalQuestions,
    STATUS: 'REPROVADO',
    COOLDOWN_DATE: cooldownEndDate ? cooldownEndDate.toLocaleDateString('pt-BR') : '',
    COOLDOWN_TIME: cooldownEndDate ? cooldownEndDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    RESULT_LINK: attemptId ? `${process.env.FRONTEND_URL}/student/result/${attemptId}` : '',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  };
  console.log('[MAIL DEBUG] dynamicData sendo enviado:', JSON.stringify(dynamicData, null, 2));
  return dispatchTemplateToMandrill('EXAM_FAILED', email, name, dynamicData, `Resultado da prova: ${examName}`);
}

export async function sendExamAbandonedEmail(name: string, email: string, examName: string, lastName: string = '') {
  return dispatchTemplateToMandrill('EXAM_ABANDONED', email, name, {
    NAME: name,
    LAST_NAME: lastName,
    EMAIL: email,
    EXAM_NAME: examName,
    STATUS: 'DESCLASSIFICADO',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  }, `Prova não finalizada: ${examName}`);
}

export async function sendCooldownReleasedEmail(name: string, email: string, examName: string, lastName: string = '') {
  return dispatchTemplateToMandrill('COOLDOWN_RELEASED', email, name, {
    NAME: name,
    LAST_NAME: lastName,
    EMAIL: email,
    EXAM_NAME: examName,
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  }, `Você já pode tentar novamente: ${examName}`);
}

export async function sendEventReferralEmail(
  referrerName: string,
  referredName: string,
  referredEmail: string,
  eventTitle: string,
  eventDate: Date,
  eventLocation: string,
  isOnline: boolean
) {
  const formattedDate = eventDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const locationLabel = isOnline ? 'Online' : eventLocation;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
      <h2 style="color:#111827;margin-bottom:8px;">Olá, ${referredName}!</h2>
      <p style="color:#6b7280;margin-bottom:24px;">
        <strong>${referrerName}</strong> achou que você adoraria participar deste evento da Elite Training.
      </p>
      <div style="background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <h3 style="color:#111827;margin:0 0 8px;">${eventTitle}</h3>
        <p style="color:#6b7280;margin:4px 0;">📅 ${formattedDate}</p>
        <p style="color:#6b7280;margin:4px 0;">📍 ${locationLabel}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;">
        Entre em contato com a Elite Training para saber mais sobre este evento.
      </p>
    </div>
  `;

  return sendMail({
    to: referredEmail,
    subject: `${referrerName} te indicou para: ${eventTitle}`,
    html,
  });
}
