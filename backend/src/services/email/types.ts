import { EmailEventKey } from '../../constants/emailEvents';

export interface SendTemplateOptions {
  toEmail: string;
  toName: string;
  eventKey?: EmailEventKey;
  templateSlug?: string;
  subject?: string;
  dynamicData: Record<string, any>;
  fromEmail?: string;
  fromName?: string;
  htmlContent?: string;
}

export interface IEmailProvider {
  /**
   * Initializes the provider context (e.g. setting API keys)
   */
  init(): void;

  /**
   * Sends an email with HTML content.
   */
  send(options: SendTemplateOptions): Promise<string>;

  /**
   * Fetches the template list from the provider.
   */
  listTemplates(): Promise<any[]>;

  /**
   * Fetches specific template info.
   */
  getTemplateInfo(slug: string): Promise<any>;

  /**
   * Renders the template HTML.
   */
  renderTemplate(slug: string, mergeVars: Record<string, any>): Promise<string>;
}
