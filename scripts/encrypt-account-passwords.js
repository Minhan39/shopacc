#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('./load-env');

const crypto = require('crypto');
const { Pool } = require('pg');

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

async function encryptPool(pool, label) {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT id, temp_password
      FROM accounts
      WHERE temp_password IS NOT NULL
        AND temp_password <> ''
        AND temp_password NOT LIKE '${ENCRYPTION_PREFIX}:%'
    `);

    for (const row of res.rows) {
      await client.query('UPDATE accounts SET temp_password = $1 WHERE id = $2', [
        encryptAccountSecret(row.temp_password),
        row.id,
      ]);
    }

    console.log(`${label}: encrypted ${res.rows.length} account password(s).`);
  } finally {
    client.release();
  }
}

async function main() {
  const primaryPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const mirrorPool = process.env.MIRROR_DATABASE_URL
    ? new Pool({ connectionString: process.env.MIRROR_DATABASE_URL })
    : null;

  try {
    await encryptPool(primaryPool, 'primary');

    if (mirrorPool) {
      await encryptPool(mirrorPool, 'mirror');
    }
  } finally {
    await primaryPool.end();

    if (mirrorPool) {
      await mirrorPool.end();
    }
  }
}

main().catch((error) => {
  console.error('Encryption migration failed:', error.message);
  process.exit(1);
});
