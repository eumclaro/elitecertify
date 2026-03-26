import { env } from '../config/env';

export const EMAIL_EVENTS = {
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  STUDENT_CREATED: 'student.created',
  EXAM_RELEASED: 'exam.released',
  EXAM_PASSED: 'exam.passed',
  EXAM_FAILED: 'exam.failed',
  COOLDOWN_RELEASED: 'exam.cooldown_released',
  // Fase 2
  PASSWORD_RESET_COMPLETED: 'auth.password_reset_completed',
  CERTIFICATE_AVAILABLE: 'certificate.available',
  EXAM_DEADLINE_REMINDER: 'exam.deadline_reminder',
} as const;

export type EmailEvent = typeof EMAIL_EVENTS[keyof typeof EMAIL_EVENTS];

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const BRANDING = {
  platformName: 'ELT Training',
  platformUrl: env.FRONTEND_URL || 'https://app.elt.com.br',
  supportEmail: 'suporte@elitetraining.com.br',
  whatsapp: '+55 11 99999-9999',
  logoUrl: 'https://certify.elitetraining.com.br/logotipo-elite-training.png', // Fallback publico
  primaryColor: '#3b82f6',
};

function getBaseEmailLayout(title: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${BRANDING.platformName}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #334155;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background-color: #0f172a; padding: 20px; text-align: center;">
      <h1 style="color: #f8fafc; margin: 0; font-size: 24px;">${BRANDING.platformName}</h1>
    </div>

    <!-- Body -->
    <div style="padding: 30px 20px;">
      <h2 style="color: #0f172a; margin-top: 0;">${title}</h2>
      ${bodyContent}
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
      <p style="margin: 0 0 10px 0;">Precisa de ajuda? Entre em contato pelo e-mail <a href="mailto:${BRANDING.supportEmail}" style="color: ${BRANDING.primaryColor};">${BRANDING.supportEmail}</a> ou pelo WhatsApp ${BRANDING.whatsapp}.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${BRANDING.platformName}. Todos os direitos reservados.</p>
    </div>
    
  </div>
</body>
</html>
  `.trim();
}

function buttonHtml(label: string, url: string): string {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="background-color: ${BRANDING.primaryColor}; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">${label}</a>
    </div>
  `;
}

// ==========================================
// FASE 1 - TEMPLATES
// ==========================================

export function getWelcomeTemplate(name: string, email: string, rawPassword?: string): EmailContent {
  const loginInfo = rawPassword 
    ? `<p><strong>Login:</strong> ${email}<br/><strong>Senha temporária:</strong> ${rawPassword}</p><p><em>Recomendamos fortemente que você altere sua senha no primeiro acesso por questões de segurança.</em></p>`
    : `<p><strong>Login:</strong> ${email}</p><p>Sua conta foi criada sob uma senha já pré-configurada ou mantida do sistema antigo.</p>`;

  const body = `
    <p>Olá, <strong>${name}</strong>!</p>
    <p>Sua conta acaba de ser criada e você já tem acesso à plataforma de certificações.</p>
    <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <h3 style="margin-top: 0; font-size: 16px;">Suas Credenciais:</h3>
      ${loginInfo}
    </div>
    ${buttonHtml('Acessar Plataforma', BRANDING.platformUrl)}
  `;

  return {
    subject: `Bem-vindo(a) à ${BRANDING.platformName} - Credenciais de Acesso`,
    html: getBaseEmailLayout('Sua conta foi criada!', body),
    text: `Olá ${name}! Sua conta foi criada. Login: ${email}. Acesse: ${BRANDING.platformUrl}`
  };
}

export function getPasswordResetTemplate(name: string, resetLink: string): EmailContent {
  const body = `
    <p>Olá, <strong>${name}</strong>,</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
    <p>Se você não solicitou esta alteração, pode ignorar este e-mail em segurança. Sua senha não será alterada até que você clique no link abaixo e crie uma nova.</p>
    ${buttonHtml('Redefinir Minha Senha', resetLink)}
    <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
      Ou copie e cole este link no seu navegador:<br/>
      <a href="${resetLink}" style="color: ${BRANDING.primaryColor}; word-break: break-all;">${resetLink}</a>
    </p>
  `;

  return {
    subject: `Recuperação de Senha - ${BRANDING.platformName}`,
    html: getBaseEmailLayout('Redefinição de Senha', body),
    text: `Olá ${name}, acesse o link para redefinir sua senha: ${resetLink}`
  };
}

export function getExamReleasedTemplate(name: string, examName: string): EmailContent {
  const body = `
    <p>Olá, <strong>${name}</strong>,</p>
    <p>A prova <strong>"${examName}"</strong> acabou de ser liberada para você em nossa plataforma!</p>
    <p>Acesse seu painel agora mesmo para conferir os detalhes e iniciar sua tentativa quando estiver pronto.</p>
    ${buttonHtml('Acessar Minhas Provas', `${BRANDING.platformUrl}/student/exams`)}
  `;

  return {
    subject: `Nova Prova Liberada: ${examName}`,
    html: getBaseEmailLayout('Sua prova está disponível', body),
    text: `A prova "${examName}" foi liberada para você. Acesse ${BRANDING.platformUrl}/student/exams`
  };
}

export function getExamPassedTemplate(name: string, examName: string, certificateUrl?: string): EmailContent {
  const certBlock = certificateUrl 
    ? `<p>Seu certificado digital já está disponível!</p>${buttonHtml('Acessar Certificado', certificateUrl)}` 
    : buttonHtml('Ir para a Plataforma', BRANDING.platformUrl);

  const body = `
    <p>Parabéns, <strong>${name}</strong>!</p>
    <p>Temos o prazer de informar que você foi aprovado(a) na prova <strong>"${examName}"</strong>.</p>
    <div style="padding: 20px; background-color: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px; margin: 20px 0;">
      <h3 style="margin: 0; color: #065f46;">Aprovação Registrada! ✅</h3>
      <p style="margin: 10px 0 0 0; color: #064e3b;">Excelente trabalho. A nota mínima exigida foi alcançada com sucesso.</p>
    </div>
    ${certBlock}
  `;

  return {
    subject: `Aprovação: ${examName} 🎉`,
    html: getBaseEmailLayout('Você foi Aprovado(a)!', body),
    text: `Parabéns ${name}, você foi aprovado na prova "${examName}".`
  };
}

export function getExamFailedTemplate(name: string, examName: string, cooldownEndDate?: Date): EmailContent {
  const cooldownMsg = cooldownEndDate 
    ? `<p>De acordo com as regras desta prova, você entrou em um período de bloqueio temporário (cooldown) e poderá realizar uma nova tentativa somente a partir de <strong>${cooldownEndDate.toLocaleDateString('pt-BR')} às ${cooldownEndDate.toLocaleTimeString('pt-BR')}</strong>.</p>`
    : `<p>Você não atingiu a pontuação mínima desta vez. Acesse a plataforma para visualizar os detalhes e planejar sua próxima tentativa.</p>`;

  const body = `
    <p>Olá, <strong>${name}</strong>.</p>
    <p>Concluímos a correção da prova <strong>"${examName}"</strong>.</p>
    <p>Infelizmente, você não atingiu a pontuação necessária para aprovação nesta tentativa.</p>
    ${cooldownMsg}
    ${buttonHtml('Ver Resultado Completo', `${BRANDING.platformUrl}/student/exams`)}
    <p>Continue estudando e não desanime. Boa sorte na próxima!</p>
  `;

  return {
    subject: `Resultado da Prova: ${examName}`,
    html: getBaseEmailLayout('Resultado Disponível', body),
    text: `Olá ${name}, você não foi aprovado na prova "${examName}".`
  };
}

export function getCooldownReleasedTemplate(name: string, examName: string): EmailContent {
  const body = `
    <p>Olá, <strong>${name}</strong>,</p>
    <p>Boa notícia! O seu período de espera (cooldown) para a prova <strong>"${examName}"</strong> foi encerrado.</p>
    <p>Você já pode acessar a plataforma e realizar uma nova tentativa agora mesmo.</p>
    ${buttonHtml('Tentar Novamente', `${BRANDING.platformUrl}/student/exams`)}
  `;

  return {
    subject: `Nova Tentativa Liberada: ${examName}`,
    html: getBaseEmailLayout('Cooldown Encerrado', body),
    text: `O cooldown para a prova "${examName}" terminou. Você já pode tentar novamente.`
  };
}
