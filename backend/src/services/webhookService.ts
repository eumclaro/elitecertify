import prisma from '../config/database';

export type WebhookEvent = 'exam.started' | 'exam.approved' | 'exam.failed';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  student: {
    id: string;
    name: string;
    email: string;
  };
  exam: {
    id: string;
    title: string;
  };
  attempt: {
    id: string;
    score: number;
    passed: boolean;
    totalQuestions: number;
    correctAnswers: number;
  };
  certificate?: {
    code: string;
    validationUrl: string;
  };
}

export async function triggerExamWebhook(examId: string, payload: WebhookPayload) {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { webhookUrl: true }
    });

    if (!exam || !exam.webhookUrl) {
      return;
    }

    console.log(`[Webhook] Triggering ${payload.event} for exam ${examId} to ${exam.webhookUrl}`);

    // Disparo assíncrono (Fire and Forget)
    fetch(exam.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Elite-Certify-Webhook/1.0'
      },
      body: JSON.stringify(payload)
    }).then(res => {
      if (!res.ok) {
        console.error(`[Webhook] Failed with status ${res.status}: ${exam.webhookUrl}`);
      }
    }).catch(err => {
      console.error(`[Webhook] Error calling ${exam.webhookUrl}:`, err.message);
    });

  } catch (error: any) {
    console.error(`[Webhook] System error:`, error.message);
  }
}
