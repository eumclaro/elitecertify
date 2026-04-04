export interface EmailTemplate {
  slug: string;
  name: string;
  description: string;
  eventSlug: string | string[];
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  { slug: 'welcome', name: 'Boas-vindas', description: 'Enviado ao criar um novo aluno', eventSlug: 'STUDENT_CREATED' },
  { slug: 'password-reset', name: 'Recuperação de Senha', description: 'Instruções para reset de senha', eventSlug: 'AUTH_PASSWORD_RESET' },
  { slug: 'exam-available', name: 'Prova Disponível', description: 'Notifica que uma nova prova foi liberada', eventSlug: 'EXAM_RELEASED' },
  { slug: 'exam-result', name: 'Resultado de Prova', description: 'Envia a nota e status após conclusão', eventSlug: ['EXAM_PASSED', 'EXAM_FAILED'] },
  { slug: 'exam-failed', name: 'Reprovado por Nota', description: 'Enviado para alunos reprovados por pontuação', eventSlug: 'EXAM_FAILED' },
  { slug: 'exam-abandoned', name: 'Desclassificado', description: 'Enviado para alunos que abandonaram a prova', eventSlug: 'EXAM_ABANDONED' },
  { slug: 'cooldown-released', name: 'Cooldown Liberado', description: 'Avisa que o aluno pode refazer a prova', eventSlug: 'COOLDOWN_RELEASED' },
  { slug: 'new-class', name: 'Nova Turma', description: 'Notifica entrada em uma nova turma', eventSlug: 'EXAM_RELEASED' },
  { slug: 'retake-reminder', name: 'Lembrete de Refação', description: 'Lembrete para provas pendentes', eventSlug: 'EXAM_DEADLINE_REMINDER' },
  { slug: 'congratulations', name: 'Parabéns!', description: 'Enviado após aprovação com certificado', eventSlug: 'CERTIFICATE_AVAILABLE' },
  { slug: 'certificate-sent', name: 'Envio de Certificado', description: 'Certificado PDF anexo enviado ao aluno', eventSlug: 'CERTIFICATE_SENT' },
];
