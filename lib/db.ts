import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';

type SupportedTable = 'users' | 'accounts';
type MirrorMode = 'strict' | 'best-effort';
type QueryRow = Record<string, unknown>;
type QueryResult<T extends QueryRow = QueryRow> = { rows: T[] };

type QueryClient = {
  query<T extends QueryRow = QueryRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
};

type QueryPool = {
  connect(): Promise<QueryClient>;
  query<T extends QueryRow = QueryRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
};

const mirrorMode: MirrorMode = process.env.DB_MIRROR_STRICT === 'true' ? 'strict' : 'best-effort';

let primarySqlInstance: ReturnType<typeof neon> | null = null;
let mirrorClientInstance: ReturnType<typeof createClient> | null | undefined;

function getPrimarySql() {
  if (primarySqlInstance) {
    return primarySqlInstance;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  primarySqlInstance = neon(connectionString);
  return primarySqlInstance;
}

function getMirrorClient() {
  if (mirrorClientInstance !== undefined) {
    return mirrorClientInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    mirrorClientInstance = null;
    return mirrorClientInstance;
  }

  mirrorClientInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: fetch.bind(globalThis),
    },
  });

  return mirrorClientInstance;
}

async function queryPrimary<T extends QueryRow = QueryRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const rows = await getPrimarySql().query(text, params) as T[];
  return { rows };
}

function createClientAdapter(): QueryClient {
  return {
    query: queryPrimary,
    release() {},
  };
}

const pool: QueryPool = {
  async connect() {
    return createClientAdapter();
  },
  query: queryPrimary,
};

export default pool;

export function getPrimaryPool() {
  return pool;
}

export function hasMirrorDatabase() {
  return Boolean(getMirrorClient());
}

function toMirrorErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown mirror error';
}

async function mirrorUpsert(table: SupportedTable, row: Record<string, unknown>) {
  const client = getMirrorClient();
  if (!client) return;

  const { error } = await client.from(table).upsert(row, { onConflict: 'id' });
  if (error) {
    throw new Error(error.message);
  }
}

async function mirrorDeleteById(table: SupportedTable, id: number) {
  const client = getMirrorClient();
  if (!client) return;

  const { error } = await client.from(table).delete().eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

async function handleMirrorOperation(operation: () => Promise<void>) {
  if (!getMirrorClient()) return;

  try {
    await operation();
  } catch (error) {
    if (mirrorMode === 'strict') {
      throw error;
    }

    console.warn(`[db-mirror] ${toMirrorErrorMessage(error)}`);
  }
}

export async function syncMirrorRow(table: SupportedTable, row: Record<string, unknown>) {
  await handleMirrorOperation(() => mirrorUpsert(table, row));
}

export async function syncMirrorDelete(table: SupportedTable, id: number) {
  await handleMirrorOperation(() => mirrorDeleteById(table, id));
}

async function initSchemaWithQueries(query: QueryClient['query']) {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('seller', 'creator')),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      account VARCHAR(255) NOT NULL,
      temp_password VARCHAR(255) NOT NULL,
      received_at TIMESTAMP NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'unsold' CHECK (status IN ('unsold', 'sold')),
      sold_at TIMESTAMP,
      warranty_expires_at TIMESTAMP,
      buyer_contact VARCHAR(255),
      proof_images TEXT[],
      created_by INTEGER REFERENCES users(id),
      sold_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

export async function initDB() {
  await initSchemaWithQueries(queryPrimary);
  console.log(`DB initialized${getMirrorClient() ? ' with Supabase mirror enabled' : ''}`);
}
