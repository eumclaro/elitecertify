import mailchimpTx from '@mailchimp/mailchimp_transactional';
import { IEmailProvider, SendTemplateOptions } from './types';
import { EMAIL_MAPPINGS } from '../../constants/emailEvents';
import { env } from '../../config/env';

export class MandrillProvider implements IEmailProvider {
  private client: any = null;

  init(): void {
    const apiKey = env.MANDRILL_API_KEY || process.env.SMTP_PASS;
    if (!apiKey) {
      console.warn('[MandrillProvider] IGNORING INIT: MANDRILL_API_KEY / SMTP_PASS is not defined.');
      return;
    }
    // Handle both CommonJS and ESModule default export situations
    const initClient = (mailchimpTx as any).default || mailchimpTx;
    this.client = initClient(apiKey);
    console.log('[MandrillProvider] Initialized successfully.');
  }

  async send(options: SendTemplateOptions): Promise<string> {
    if (!this.client) {
      throw new Error('MandrillProvider is not initialized. Check MANDRILL_API_KEY.');
    }

    if (!options.htmlContent) {
      throw new Error('Internal templates migration requires HTML content to be provided.');
    }

    console.log(`[MandrillProvider] Sending HTML for event: ${options.eventKey}`);
    
    let renderedHtml = options.htmlContent;
    // Substituição simples de {{VAR}} pelos valores de dynamicData
    Object.entries(options.dynamicData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      renderedHtml = renderedHtml.replace(regex, String(value));
    });

    const message: any = {
      to: [{ email: options.toEmail, name: options.toName, type: 'to' }],
      html: renderedHtml,
      subject: options.subject || 'Notificação - ELT Training',
      merge_language: 'mailchimp',
    };

    if (options.fromEmail) message.from_email = options.fromEmail;
    if (options.fromName) message.from_name = options.fromName;

    try {
      const response = await this.client.messages.send({ message });
      const result = Array.isArray(response) ? response[0] : response;
      
      if (result.status === 'rejected' || result.status === 'invalid') {
        throw new Error(`Mandrill rejected: ${result.reject_reason || 'Unknown'}`);
      }
      return result._id;
    } catch (error: any) {
      const errMessage = error?.response?.data?.message || error.message || 'Unknown Mandrill SDK error';
      throw new Error(`Mandrill API Error: ${errMessage}`);
    }
  }

  // Métodos depreciados ou removidos conforme solicitado
  async listTemplates(): Promise<any[]> { return []; }
  async getTemplateInfo(_slug: string): Promise<any> { throw new Error('Action removed'); }
  async renderTemplate(_slug: string, _vars: any): Promise<string> { throw new Error('Action removed'); }
}
