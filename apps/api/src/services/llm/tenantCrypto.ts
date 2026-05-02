import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const masterKey = process.env.LLM_MASTER_KEY;
  if (!masterKey) {
    // Fallback: derive from any available env var to avoid runtime crash
    return scryptSync(process.env.GROQ_API_KEY || 'default-master-key-change-me', 'salt', 32);
  }
  return scryptSync(masterKey, 'salt', 32);
}

/**
 * Encrypt a tenant LLM API key before storing in DB.
 * Returns base64 string with IV prepended.
 */
export function encryptApiKey(plainText: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}

/**
 * Decrypt a tenant LLM API key from DB storage.
 * Input must be the base64 string produced by encryptApiKey.
 */
export function decryptApiKey(encryptedText: string): string {
  const [ivBase64, data] = encryptedText.split(':');
  if (!ivBase64 || !data) throw new Error('Invalid encrypted API key format');
  const iv = Buffer.from(ivBase64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
