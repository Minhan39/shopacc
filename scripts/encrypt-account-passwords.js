#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('./load-env');

const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const ENCRYPTION_PREFIX = 'enc:v1';
const IV_LENGTH = 12;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL');
}

const sql = neon(databaseUrl);

function getMirrorConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ''),
    serviceRoleKey,
  };
}

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

function encryptAccountSecret(value) {
  if (!value || value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return value;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAccountSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

async function mirrorUpdateAccount(id, tempPassword) {
  const config = getMirrorConfig();
  if (!config) return;

  const response = await fetch(`${config.url}/rest/v1/accounts?id=eq.${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      temp_password: tempPassword,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to mirror account ${id}`);
  }
}

async function encryptPrimary(label) {
  const rows = await sql`
    SELECT id, temp_password
    FROM accounts
    WHERE temp_password IS NOT NULL
      AND temp_password <> ''
      AND temp_password NOT LIKE ${`${ENCRYPTION_PREFIX}:%`}
  `;

  for (const row of rows) {
    const encrypted = encryptAccountSecret(row.temp_password);
    await sql`
      UPDATE accounts
      SET temp_password = ${encrypted}
      WHERE id = ${row.id}
    `;
    await mirrorUpdateAccount(row.id, encrypted);
  }

  console.log(`${label}: encrypted ${rows.length} account password(s).`);
}

async function main() {
  await encryptPrimary('primary');
}

main().catch((error) => {
  console.error('Encryption migration failed:', error.message);
  process.exit(1);
});
