import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// O ideal é definir SMTP_ENCRYPTION_KEY no .env (uma string aleatória). Se não houver, usa fallback fixo local.
const RAW_KEY = process.env.SMTP_ENCRYPTION_KEY || 'elt_cert_secure_secret_fallback_key';
// Hash para garantir exatos 32 bytes para o AES-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(RAW_KEY).digest(); 
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  if (!text) return text;
  const textParts = text.split(':');
  if (textParts.length !== 2) return text; // Caso não seja encriptado ou tenha formato quebrado
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedText = Buffer.from(textParts[1], 'hex');
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Falha ao decriptar senha SMTP', e);
    return ''; // Evita crash
  }
}
