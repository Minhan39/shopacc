import crypto from 'crypto';

const ENCRYPTION_PREFIX = 'enc:v1';
const IV_LENGTH = 12;

function getAccountSecretKey() {
  const secret = process.env.ACCOUNT_SECRET_KEY;

  if (!secret) {
    throw new Error('Missing ACCOUNT_SECRET_KEY');
  }

  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32) {
    throw new Error('ACCOUNT_SECRET_KEY must be a base64-encoded 32-byte key');
  }

  return key;
}

export function encryptAccountSecret(value: string) {
  if (!value) return value;
  if (value.startsWith(`${ENCRYPTION_PREFIX}:`)) return value;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAccountSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptAccountSecret(value: string | null | undefined) {
  if (!value) return value ?? '';
  if (!value.startsWith(`${ENCRYPTION_PREFIX}:`)) return value;

  const [, , ivBase64, authTagBase64, encryptedBase64] = value.split(':');
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted account secret format');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getAccountSecretKey(),
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

type AccountRow = {
  temp_password?: string | null;
  [key: string]: unknown;
};

export function hydrateAccountSecret<T extends AccountRow>(row: T): T {
  if (typeof row.temp_password !== 'string') {
    return row;
  }

  return {
    ...row,
    temp_password: decryptAccountSecret(row.temp_password),
  };
}
