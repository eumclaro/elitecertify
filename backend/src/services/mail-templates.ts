
export interface EmailTemplateConfig {
  slug: string;
  name: string;
  description: string;
  mergeVars: string[];
  eventSlug: string | string[];
}

export const MANDRILL_TEMPLATES: Record<string, EmailTemplateConfig> = {
  'welcome': {
    slug: 'student-welcome',
    name: 'Boas-vindas',
    description: 'E-mail de boas-vindas para novos alunos',
    mergeVars: ['NAME', 'EMAIL', 'PASSWORD'],
    eventSlug: 'STUDENT_CREATED'
  },
  'password-reset': {
    slug: 'auth-password-reset',
    name: 'Recuperação de Senha',
    description: 'Recuperação de senha',
    mergeVars: ['NAME', 'RESET_LINK'],
    eventSlug: 'AUTH_PASSWORD_RESET'
  },
  'exam-available': {
    slug: 'exam-released',
    name: 'Prova Disponível',
    description: 'Aviso de prova disponível',
    mergeVars: ['NAME', 'EXAM_NAME'],
    eventSlug: 'EXAM_RELEASED'
  },
  'exam-result': {
    slug: 'exam-result',
    name: 'Resultado de Prova',
    description: 'Resultado da prova (Aprovado/Reprovado)',
    mergeVars: ['NAME', 'EXAM_NAME', 'SCORE', 'CORRETAS', 'ERRADAS', 'TOTAL_QUESTOES', 'STATUS', 'RESULT_LINK'],
    eventSlug: ['EXAM_PASSED', 'EXAM_FAILED']
  },
  'exam-failed': {
    slug: 'exam-failed',
    name: 'Reprovado por Nota',
    description: 'Enviado para alunos reprovados por pontuação',
    mergeVars: ['NAME', 'EXAM_NAME', 'SCORE', 'CORRETAS', 'ERRADAS', 'TOTAL_QUESTOES', 'COOLDOWN_DATE', 'COOLDOWN_TIME', 'RESULT_LINK'],
    eventSlug: 'EXAM_FAILED'
  },
  'exam-abandoned': {
    slug: 'exam-abandoned',
    name: 'Desclassificado',
    description: 'Enviado para alunos que abandonaram a prova',
    mergeVars: ['NAME', 'EXAM_NAME'],
    eventSlug: 'EXAM_ABANDONED'
  },
  'cooldown-released': {
    slug: 'exam-cooldown-released',
    name: 'Cooldown Liberado',
    description: 'Aviso de liberação de cooldown',
    mergeVars: ['NAME', 'EXAM_NAME'],
    eventSlug: 'COOLDOWN_RELEASED'
  },
  'new-class': {
    slug: 'new-class-notification',
    name: 'Nova Turma',
    description: 'Notificação de nova turma vinculada',
    mergeVars: ['NAME', 'CLASS_NAME'],
    eventSlug: 'EXAM_RELEASED'
  },
  'retake-reminder': {
    slug: 'exam-retake-reminder',
    name: 'Lembrete de Refação',
    description: 'Lembrete para provas pendentes',
    mergeVars: ['NAME', 'EXAM_NAME', 'EXAM_DATE'],
    eventSlug: 'EXAM_DEADLINE_REMINDER'
  },
  'congratulations': {
    slug: 'exam-congratulations',
    name: 'Parabéns!',
    description: 'Parabéns pela aprovação e certificado',
    mergeVars: ['NAME', 'EXAM_NAME', 'CERTIFICATE_LINK'],
    eventSlug: 'CERTIFICATE_AVAILABLE'
  },
  'certificate-sent': {
    slug: 'certificate-sent',
    name: 'Envio de Certificado',
    description: 'Certificado PDF anexo enviado ao aluno',
    mergeVars: ['NAME', 'EXAM_NAME', 'CERTIFICATE_CODE'],
    eventSlug: 'CERTIFICATE_SENT'
  }
};

export type TemplateKey = keyof typeof MANDRILL_TEMPLATES;
