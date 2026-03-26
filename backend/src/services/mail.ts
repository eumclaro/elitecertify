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
      ? `"${parsed.fromName || 'ELT Training'}" <${parsed.fromEmail}>` 
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
    process.env.RUNTIME_SMTP_FROM = process.env.SMTP_FROM || '"ELT Training" <no-reply@elt.com.br>';
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
    const from = process.env.RUNTIME_SMTP_FROM || '"ELT Training" <no-reply@elt.com.br>';

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
  subject?: string
) {
  try {
    const provider = getEmailProvider();

    // 1. Tentar buscar vínculo dinâmico no banco de dados
    const binding = await prisma.emailEventBinding.findUnique({
      where: { eventKey },
      include: { template: true }
    });

    let finalSlug: string | undefined = undefined;

    if (binding && binding.isActive && binding.template) {
      finalSlug = binding.template.slug;
      console.log(`[Mail] Using dynamic binding for ${eventKey}: ${finalSlug}`);
    } else {
      // Fallback para o mapeamento estático legado
      finalSlug = EMAIL_MAPPINGS[eventKey];
      console.log(`[Mail] No active binding found for ${eventKey}. Falling back to static: ${finalSlug}`);
    }

    if (!finalSlug) {
      throw new Error(`Nenhum template (DB ou Estático) localizado para o evento: ${eventKey}`);
    }

    // 2. Buscar remetente autorizado do sistema
    const { fromEmail, fromName } = await getAuthorizedSender();

    // 3. Disparar via Provider
    const msgId = await provider.sendTemplate({
      toEmail,
      toName,
      eventKey,
      templateSlug: finalSlug,
      subject,
      dynamicData,
      fromEmail,
      fromName
    });

    // 3. Registrar Log Robusto
    await prisma.emailLog.create({
      data: {
        eventKey,
        templateUsed: finalSlug,
        recipient: toEmail,
        subject: subject || '(Sem assunto)',
        payloadJson: JSON.stringify(dynamicData),
        provider: 'MANDRILL',
        mandrillMsgId: msgId,
        status: 'SENT',
        sentAt: new Date()
      }
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
        errorMessage: error.message
      }
    }).catch(() => {});

    throw error;
  }
}

// ==========================================
// SEMANTIC WRAPPERS - FASE 1 (MIGRATED TO MANDRILL)
// ==========================================

export async function sendWelcomeEmail(name: string, email: string, rawPassword?: string) {
  return dispatchTemplateToMandrill('STUDENT_CREATED', email, name, {
    NAME: name,
    EMAIL: email,
    PASSWORD: rawPassword || '',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  });
}

export async function sendPasswordResetEmail(name: string, email: string, resetLink: string) {
  return dispatchTemplateToMandrill('AUTH_PASSWORD_RESET', email, name, {
    NAME: name,
    EMAIL: email,
    RESET_LINK: resetLink,
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  });
}

export async function sendExamReleasedEmail(name: string, email: string, examName: string) {
  return dispatchTemplateToMandrill('EXAM_RELEASED', email, name, {
    NAME: name,
    EMAIL: email,
    EXAM_NAME: examName,
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  });
}

export async function sendExamPassedEmail(name: string, email: string, examName: string, certificateUrl?: string) {
  return dispatchTemplateToMandrill('EXAM_PASSED', email, name, {
    NAME: name,
    EMAIL: email,
    EXAM_NAME: examName,
    CERTIFICATE_LINK: certificateUrl || '',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  });
}

export async function sendExamFailedEmail(name: string, email: string, examName: string, cooldownEndDate?: Date) {
  return dispatchTemplateToMandrill('EXAM_FAILED', email, name, {
    NAME: name,
    EMAIL: email,
    EXAM_NAME: examName,
    COOLDOWN_DATE: cooldownEndDate ? cooldownEndDate.toLocaleDateString('pt-BR') : '',
    COOLDOWN_TIME: cooldownEndDate ? cooldownEndDate.toLocaleTimeString('pt-BR') : '',
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  });
}

export async function sendCooldownReleasedEmail(name: string, email: string, examName: string) {
  return dispatchTemplateToMandrill('COOLDOWN_RELEASED', email, name, {
    NAME: name,
    EMAIL: email,
    EXAM_NAME: examName,
    SUPPORT_EMAIL: 'suporte@elitetraining.com.br'
  });
}
