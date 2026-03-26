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

  async sendTemplate(options: SendTemplateOptions): Promise<string> {
    if (!this.client) {
      throw new Error('MandrillProvider is not initialized. Check MANDRILL_API_KEY.');
    }

    const templateName = options.templateSlug || EMAIL_MAPPINGS[options.eventKey];
    if (!templateName) {
      throw new Error(`No Mandrill template mapped for event: ${options.eventKey}`);
    }

    const globalMergeVars = Object.entries(options.dynamicData).map(([name, content]) => ({
      name: name.toUpperCase(),
      content: String(content),
    }));

    const message: any = {
      to: [{ email: options.toEmail, name: options.toName, type: 'to' }],
      global_merge_vars: globalMergeVars,
    };

    if (options.fromEmail) {
      message.from_email = options.fromEmail;
    }
    if (options.fromName) {
      message.from_name = options.fromName;
    }

    if (options.subject) {
      message.subject = options.subject;
    }

    try {
      const response = await this.client.messages.sendTemplate({
        template_name: templateName,
        template_content: [],
        message,
      });

      const result = Array.isArray(response) ? response[0] : response;
      
      if (result.status === 'rejected' || result.status === 'invalid') {
        throw new Error(`Mandrill rejected the message: ${result.reject_reason || 'Unknown reason'}`);
      }

      return result._id;
    } catch (error: any) {
      const errMessage = error?.response?.data?.message || error.message || 'Unknown Mandrill SDK error';
      throw new Error(`Mandrill API Error: ${errMessage}`);
    }
  }

  async listTemplates(): Promise<any[]> {
    if (!this.client) return [];
    try {
      const response = await this.client.templates.list();
      return response || [];
    } catch (error: any) {
      console.error('[MandrillProvider] listTemplates Error:', error.message);
      throw error;
    }
  }

  async getTemplateInfo(slug: string): Promise<any> {
    if (!this.client) throw new Error('Not initialized');
    try {
      return await this.client.templates.info({ name: slug });
    } catch (error: any) {
      console.error(`[MandrillProvider] getTemplateInfo Error for ${slug}:`, error.message);
      throw error;
    }
  }

  async renderTemplate(slug: string, mergeVars: Record<string, any>): Promise<string> {
    if (!this.client) throw new Error('Not initialized');
    try {
      const vars = Object.entries(mergeVars).map(([name, content]) => ({
        name: name.toUpperCase(),
        content: String(content),
      }));

      const response = await this.client.templates.render({
        template_name: slug,
        template_content: [],
        merge_vars: vars
      });

      return response.html;
    } catch (error: any) {
      console.error(`[MandrillProvider] renderTemplate Error for ${slug}:`, error.message);
      throw error;
    }
  }
}
