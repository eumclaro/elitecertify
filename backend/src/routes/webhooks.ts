import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { env } from '../config/env';

const router = Router();

// Endpoint for Mandrill Webhooks
router.post('/mandrill', async (req, res) => {
  try {
    const signature = req.headers['x-mandrill-signature'] as string;
    const webhookKey = process.env.MANDRILL_WEBHOOK_KEY;

    // 1. HMAC Validation (Only if key is present in ENV)
    if (webhookKey && signature) {
      // Mandrill signs the full incoming URL + all POST fields ordered by key
      const webhookUrl = `${env.PRODUCTION_URL}/api/webhooks/mandrill`;
      
      const keys = Object.keys(req.body).sort();
      let signedData = webhookUrl;
      for (const key of keys) {
        signedData += key + req.body[key];
      }

      const expectedSignature = crypto
        .createHmac('sha1', webhookKey)
        .update(signedData)
        .digest('base64');

      if (signature !== expectedSignature) {
        return res.status(401).send('Invalid signature');
      }
    }

    // 2. Parse Events
    const eventsRaw = req.body.mandrill_events;
    if (!eventsRaw) {
      // Might be a Mandrill Ping
      return res.status(200).send('OK');
    }

    const events = typeof eventsRaw === 'string' ? JSON.parse(eventsRaw) : eventsRaw;

    // 3. Process Events Idempotently
    for (const evt of events) {
      const msgId = evt.msg?._id;
      const eventType = evt.event; 
      
      if (!msgId) continue;

      const emailLog = await prisma.emailLog.findUnique({ where: { mandrillMsgId: msgId } });
      if (!emailLog) continue; // Unrecognized message, ignore

      const updateData: any = {};
      const now = new Date(evt.ts * 1000);

      switch (eventType) {
        case 'open':
          if (!emailLog.openedAt) updateData.openedAt = now;
          updateData.status = 'OPENED';
          break;
        case 'click':
          if (!emailLog.clickedAt) updateData.clickedAt = now;
          updateData.status = 'CLICKED';
          break;
        case 'hard_bounce':
        case 'soft_bounce':
        case 'reject':
        case 'spam':
          if (!emailLog.bouncedAt) updateData.bouncedAt = now;
          updateData.status = 'BOUNCED';
          updateData.errorMessage = `Mandrill Reject/Bounce: ${evt.msg?.bounce_description || evt.event}`;
          break;
        case 'send':
          // Confirms it left the Mandrill servers to the recipient
          if (emailLog.status === 'PENDING' || emailLog.status === 'SENT') {
            updateData.status = 'DELIVERED';
          }
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.emailLog.update({
          where: { mandrillMsgId: msgId },
          data: updateData
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhooks] Mandrill Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Mandrill requires replying to HEAD requests with 200 OK during setup
router.head('/mandrill', (_req, res) => {
  res.status(200).send('OK');
});

export default router;
