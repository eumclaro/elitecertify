
export interface EmailTemplateConfig {
  slug: string;
  description: string;
  mergeVars: string[];
  eventSlug: string | string[];
}

export const MANDRILL_TEMPLATES: Record<string, EmailTemplateConfig> = {
  'welcome': {
    slug: 'student-welcome',
    description: 'E-mail de boas-vindas para novos alunos',
    mergeVars: ['NAME', 'EMAIL', 'PASSWORD'],
    eventSlug: 'STUDENT_CREATED'
  },
  'password-reset': {
    slug: 'auth-password-reset',
    description: 'Recuperação de senha',
    mergeVars: ['NAME', 'RESET_LINK'],
    eventSlug: 'AUTH_PASSWORD_RESET'
  },
  'exam-available': {
    slug: 'exam-released',
    description: 'Aviso de prova disponível',
    mergeVars: ['NAME', 'EXAM_NAME'],
    eventSlug: 'EXAM_RELEASED'
  },
  'exam-result': {
    slug: 'exam-result',
    description: 'Resultado da prova (Aprovado/Reprovado)',
    mergeVars: ['NAME', 'EXAM_NAME', 'SCORE', 'STATUS'],
    eventSlug: ['EXAM_PASSED', 'EXAM_FAILED']
  },
  'cooldown-released': {
    slug: 'exam-cooldown-released',
    description: 'Aviso de liberação de cooldown',
    mergeVars: ['NAME', 'EXAM_NAME'],
    eventSlug: 'COOLDOWN_RELEASED'
  },
  'new-class': {
    slug: 'new-class-notification',
    description: 'Notificação de nova turma vinculada',
    mergeVars: ['NAME', 'CLASS_NAME'],
    eventSlug: 'EXAM_RELEASED'
  },
  'retake-reminder': {
    slug: 'exam-retake-reminder',
    description: 'Lembrete de refação de prova',
    mergeVars: ['NAME', 'EXAM_NAME', 'EXAM_DATE'],
    eventSlug: 'EXAM_DEADLINE_REMINDER'
  },
  'congratulations': {
    slug: 'exam-congratulations',
    description: 'Parabéns pela aprovação e certificado',
    mergeVars: ['NAME', 'EXAM_NAME', 'CERTIFICATE_LINK'],
    eventSlug: 'CERTIFICATE_AVAILABLE'
  }
};

export type TemplateKey = keyof typeof MANDRILL_TEMPLATES;
