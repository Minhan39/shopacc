import { Pool } from 'pg';

type SupportedTable = 'users' | 'accounts';

type MirrorMode = 'strict' | 'best-effort';

const primaryConnectionString = process.env.DATABASE_URL;
const mirrorConnectionString = process.env.MIRROR_DATABASE_URL;

const primaryPool = new Pool({
  connectionString: primaryConnectionString,
});

const mirrorPool = mirrorConnectionString
  ? new Pool({
      connectionString: mirrorConnectionString,
    })
  : null;

const mirrorMode: MirrorMode = process.env.DB_MIRROR_STRICT === 'true' ? 'strict' : 'best-effort';

export default primaryPool;

export function getPrimaryPool() {
  return primaryPool;
}

export function hasMirrorDatabase() {
  return Boolean(mirrorPool);
}

function toMirrorErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown mirror error';
}

function getColumnsAndValues(row: Record<string, unknown>) {
  const entries = Object.entries(row).filter(([, value]) => value !== undefined);
  const columns = entries.map(([column]) => column);
  const values = entries.map(([, value]) => value);

  return { columns, values };
}

async function mirrorUpsert(table: SupportedTable, row: Record<string, unknown>) {
  if (!mirrorPool) return;

  const { columns, values } = getColumnsAndValues(row);
  if (columns.length === 0) return;

  const quotedColumns = columns.map((column) => `"${column}"`);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updateColumns = columns
    .filter((column) => column !== 'id')
    .map((column) => `"${column}" = EXCLUDED."${column}"`);

  const query = `
    INSERT INTO "${table}" (${quotedColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT ("id") DO UPDATE SET ${updateColumns.join(', ')}
  `;

  await mirrorPool.query(query, values);
}

async function mirrorDeleteById(table: SupportedTable, id: number) {
  if (!mirrorPool) return;
  await mirrorPool.query(`DELETE FROM "${table}" WHERE id = $1`, [id]);
}

async function handleMirrorOperation(operation: () => Promise<void>) {
  if (!mirrorPool) return;

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

async function initSchema(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('seller', 'creator')),
        created_at TIMESTAMP DEFAULT NOW()
      );

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
  } finally {
    client.release();
  }
}

export async function initDB() {
  await initSchema(primaryPool);

  if (mirrorPool) {
    await initSchema(mirrorPool);
  }

  console.log(`DB initialized${mirrorPool ? ' with mirror enabled' : ''}`);
}
