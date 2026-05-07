import crypto from 'crypto';
import type { AccountRow } from '@/lib/db';
import { addTradingIncomeToSupabase } from '@/lib/supabase-trading-service';

type FirebaseConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  collection: string;
  userId: string;
};

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } };

export type FirebaseSaleExtra = {
  saleAmount: number | null;
  saleNote: string | null;
};

let configInstance: FirebaseConfig | null | undefined;
let accessTokenCache: { token: string; expiresAt: number } | null = null;

function normalizePrivateKey(value: string) {
  let privateKey = value.trim();

  if (privateKey.endsWith(',')) {
    privateKey = privateKey.slice(0, -1).trim();
  }

  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }

  return privateKey.replace(/\\n/g, '\n').trim();
}

function getFirebaseConfig() {
  if (configInstance !== undefined) {
    return configInstance;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
    : null;

  if (!projectId || !clientEmail || !privateKey) {
    configInstance = null;
    return configInstance;
  }

  configInstance = {
    projectId,
    clientEmail,
    privateKey,
    collection: process.env.FIREBASE_INCOMES_COLLECTION || process.env.FIREBASE_SALES_COLLECTION || 'incomes',
    userId: process.env.FIREBASE_INCOME_USER_ID || 'EMPTY',
  };

  return configInstance;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createServiceAccountJwt(config: FirebaseConfig) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const unsignedToken = `${header}.${claims}`;
  let signature: Buffer;

  try {
    signature = crypto.createSign('RSA-SHA256').update(unsignedToken).sign(config.privateKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown private key parse error';
    throw new Error(`Invalid FIREBASE_PRIVATE_KEY format: ${message}`);
  }

  return `${unsignedToken}.${base64Url(signature)}`;
}

async function getAccessToken(config: FirebaseConfig) {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.token;
  }

  const assertion = createServiceAccountJwt(config);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || 'Firebase access token request failed');
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error('Firebase access token response is missing access_token');
  }

  accessTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };

  return payload.access_token;
}

function stringOrNull(value: string | null | undefined): FirestoreValue {
  return value ? { stringValue: value } : { nullValue: null };
}

function numberValue(value: number): FirestoreValue {
  return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
}

function createFirestoreDocumentId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(20);

  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}

export class FirebaseSaleService {
  async addSale(account: AccountRow, extra: FirebaseSaleExtra) {
    const config = getFirebaseConfig();
    if (!config) return;

    const token = await getAccessToken(config);
    const documentId = createFirestoreDocumentId();
    const date = account.sold_at ? new Date(account.sold_at) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const incomeTimestamp = safeDate.toISOString();

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        config.projectId
      )}/databases/(default)/documents/${encodeURIComponent(config.collection)}/${documentId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            id: { stringValue: documentId },
            user_id: { stringValue: config.userId },
            type: { stringValue: 'trading' },
            amount: numberValue(extra.saleAmount ?? 0),
            note: stringOrNull(extra.saleNote),
            date: { timestampValue: incomeTimestamp },
            month: { integerValue: String(safeDate.getMonth() + 1) },
            year: { integerValue: String(safeDate.getFullYear()) },
            createdAt: { timestampValue: incomeTimestamp },
            updatedAt: { timestampValue: incomeTimestamp },
          },
        }),
      }
    );

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(payload || 'Firebase sale add failed');
    }

    return documentId;
  }
}

const firebaseSaleService = new FirebaseSaleService();

export async function addSaleToFirebase(account: AccountRow, extra: FirebaseSaleExtra) {
  try {
    const firebaseId = await firebaseSaleService.addSale(account, extra);

    if (!firebaseId || extra.saleAmount === null) {
      return;
    }

    await addTradingIncomeToSupabase({
      firebaseId,
      amount: extra.saleAmount,
      note: extra.saleNote,
      date: account.sold_at || new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Firebase sale add error';
    console.warn(`[firebase-sale] ${message}`);
  }
}
