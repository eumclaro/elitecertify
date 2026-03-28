export const EMAIL_MAPPINGS = {
  AUTH_PASSWORD_RESET: 'auth-password-reset',
  STUDENT_CREATED: 'student-welcome',
  EXAM_RELEASED: 'exam-released',
  EXAM_PASSED: 'exam-passed',
  EXAM_FAILED: 'exam-failed',
  EXAM_ABANDONED: 'exam-abandoned',
  EXAM_FAILED_COOLDOWN: 'exam-cooldown-alert',
  COOLDOWN_RELEASED: 'exam-cooldown-released',
  // Fase 2
  PASSWORD_RESET_COMPLETED: 'auth-password-reset-completed',
  CERTIFICATE_AVAILABLE: 'certificate-available',
  EXAM_DEADLINE_REMINDER: 'exam-deadline-reminder',
  MANUAL_TEST: 'manual-test',
} as const;

export type EmailEventKey = keyof typeof EMAIL_MAPPINGS;
export type EmailEventSlug = typeof EMAIL_MAPPINGS[EmailEventKey];
