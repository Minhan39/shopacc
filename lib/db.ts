import { Pool } from 'pg';

type SupportedTable = 'users' | 'accounts';
type UserRole = 'seller' | 'creator';
type AccountStatus = 'unsold' | 'sold';
type MirrorMode = 'strict' | 'best-effort';

export type UserRow = {
  id: number;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  created_at: string;
};

type UserAuthRow = UserRow & { password: string };
type PublicUserRow = Omit<UserAuthRow, 'password'>;

export type AccountRow = {
  id: number;
  account: string;
  temp_password: string;
  received_at: string;
  status: AccountStatus;
  sold_at: string | null;
  warranty_expires_at: string | null;
  buyer_contact: string | null;
  proof_images: string[] | null;
  created_by: number | null;
  sold_by: number | null;
  created_at: string;
  creator_name?: string | null;
  creator_username?: string | null;
  seller_name?: string | null;
  seller_username?: string | null;
};

type StatsResponse = {
  summary: {
    total: number;
    sold: number;
    unsold: number;
  };
  daily: Array<{ date: string; count: number }>;
  monthly: Array<{ month: string; count: number }>;
  byCreator: Array<{ name: string; username: string; created: number; sold: number }>;
};

type CountRow = { count: string };
type DailyRow = { date: string; count: string };
type MonthlyRow = { month: string; count: string };
type CreatorStatsRow = { name: string; username: string; created: string; sold: string };

const mirrorMode: MirrorMode = process.env.DB_MIRROR_STRICT === 'true' ? 'strict' : 'best-effort';

let primaryPoolInstance: Pool | null = null;
let mirrorConfigInstance: { url: string; serviceRoleKey: string } | null | undefined;

function getPrimaryPool() {
  if (primaryPoolInstance) {
    return primaryPoolInstance;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  primaryPoolInstance = new Pool({ connectionString });
  return primaryPoolInstance;
}

function getMirrorConfig() {
  if (mirrorConfigInstance !== undefined) {
    return mirrorConfigInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    mirrorConfigInstance = null;
    return mirrorConfigInstance;
  }

  mirrorConfigInstance = {
    url: url.replace(/\/$/, ''),
    serviceRoleKey,
  };

  return mirrorConfigInstance;
}

function toMirrorErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown mirror error';
}

async function parseMirrorResponse(response: Response) {
  if (response.ok) {
    return;
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  const message =
    typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : typeof payload === 'string'
        ? payload
        : 'Supabase mirror request failed';

  throw new Error(message);
}

async function mirrorUpsert(table: SupportedTable, row: Record<string, unknown>) {
  const config = getMirrorConfig();
  if (!config) return;

  const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });

  await parseMirrorResponse(response);
}

async function mirrorDeleteById(table: SupportedTable, id: number) {
  const config = getMirrorConfig();
  if (!config) return;

  const response = await fetch(`${config.url}/rest/v1/${table}?id=eq.${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: 'return=minimal',
    },
  });

  await parseMirrorResponse(response);
}

async function handleMirrorOperation(operation: () => Promise<void>) {
  if (!getMirrorConfig()) return;

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

export async function listUsers() {
  const result = await getPrimaryPool().query<PublicUserRow>(
    'SELECT id, name, username, role, created_at FROM users ORDER BY created_at DESC'
  );
  return result.rows;
}

export async function findUserByUsername(username: string) {
  const result = await getPrimaryPool().query<UserAuthRow>(
    'SELECT id, name, username, password, role, created_at FROM users WHERE username = $1 LIMIT 1',
    [username]
  );
  return result.rows[0] ?? null;
}

export async function createUser(input: {
  name: string;
  username: string;
  password: string;
  role: UserRole;
}) {
  const result = await getPrimaryPool().query<UserAuthRow>(
    `INSERT INTO users (name, username, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, username, password, role, created_at`,
    [input.name, input.username, input.password, input.role]
  );

  const created = result.rows[0];
  await syncMirrorRow('users', created);

  const { password: _password, ...user } = created;
  return user;
}

export async function listAccounts(filters: { status?: AccountStatus | null; search?: string | null } = {}) {
  let query = `
    SELECT a.*,
      uc.name as creator_name, uc.username as creator_username,
      us.name as seller_name, us.username as seller_username
    FROM accounts a
    LEFT JOIN users uc ON a.created_by = uc.id
    LEFT JOIN users us ON a.sold_by = us.id
    WHERE 1=1
  `;
  const params: Array<string> = [];

  if (filters.status) {
    params.push(filters.status);
    query += ` AND a.status = $${params.length}`;
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    query += ` AND (a.account ILIKE $${params.length} OR a.buyer_contact ILIKE $${params.length})`;
  }

  query += ' ORDER BY a.created_at DESC';

  const result = await getPrimaryPool().query<AccountRow>(query, params);
  return result.rows;
}

export async function getAccountById(id: number) {
  const result = await getPrimaryPool().query<AccountRow>(
    `SELECT a.*,
      uc.name as creator_name, uc.username as creator_username,
      us.name as seller_name, us.username as seller_username
     FROM accounts a
     LEFT JOIN users uc ON a.created_by = uc.id
     LEFT JOIN users us ON a.sold_by = us.id
     WHERE a.id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function createAccount(input: {
  account: string;
  temp_password: string;
  created_by: number;
}) {
  const result = await getPrimaryPool().query<AccountRow>(
    `INSERT INTO accounts (account, temp_password, received_at, status, created_by)
     VALUES ($1, $2, NOW(), 'unsold', $3)
     RETURNING *`,
    [input.account, input.temp_password, input.created_by]
  );

  const created = result.rows[0];
  await syncMirrorRow('accounts', created);
  return created;
}

export async function updateAccountSale(input: {
  id: number;
  sold_at: string;
  warranty_expires_at: string | null;
  buyer_contact: string | null;
  proof_images: string[];
  sold_by: number;
}) {
  const result = await getPrimaryPool().query<AccountRow>(
    `UPDATE accounts SET
      status = 'sold',
      sold_at = $1,
      warranty_expires_at = $2,
      buyer_contact = $3,
      proof_images = $4,
      sold_by = $5
     WHERE id = $6
     RETURNING *`,
    [
      input.sold_at,
      input.warranty_expires_at,
      input.buyer_contact,
      input.proof_images,
      input.sold_by,
      input.id,
    ]
  );

  const updated = result.rows[0] ?? null;
  if (updated) {
    await syncMirrorRow('accounts', updated);
  }

  return updated;
}

export async function deleteAccountById(id: number) {
  const result = await getPrimaryPool().query<{ id: number }>(
    'DELETE FROM accounts WHERE id = $1 RETURNING id',
    [id]
  );

  const deleted = result.rows[0] ?? null;
  if (deleted) {
    await syncMirrorDelete('accounts', id);
  }

  return deleted;
}

export async function importAccounts(
  rows: Array<{ account: string; temp_password: string; created_by: number }>
) {
  const inserted: AccountRow[] = [];

  for (const row of rows) {
    inserted.push(
      await createAccount({
        account: row.account,
        temp_password: row.temp_password,
        created_by: row.created_by,
      })
    );
  }

  return inserted;
}

export async function getStats(): Promise<StatsResponse> {
  const pool = getPrimaryPool();
  const [total, sold, unsold, daily, monthly, byCreator] = await Promise.all([
    pool.query<CountRow>('SELECT COUNT(*) as count FROM accounts'),
    pool.query<CountRow>("SELECT COUNT(*) as count FROM accounts WHERE status = 'sold'"),
    pool.query<CountRow>("SELECT COUNT(*) as count FROM accounts WHERE status = 'unsold'"),
    pool.query<DailyRow>(`
      SELECT DATE(sold_at) as date, COUNT(*) as count
      FROM accounts
      WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(sold_at)
      ORDER BY date ASC
    `),
    pool.query<MonthlyRow>(`
      SELECT TO_CHAR(sold_at, 'YYYY-MM') as month, COUNT(*) as count
      FROM accounts
      WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(sold_at, 'YYYY-MM')
      ORDER BY month ASC
    `),
    pool.query<CreatorStatsRow>(`
      SELECT u.name, u.username,
        COUNT(a.id) as created,
        SUM(CASE WHEN a.status = 'sold' THEN 1 ELSE 0 END) as sold
      FROM users u
      LEFT JOIN accounts a ON a.created_by = u.id
      WHERE u.role = 'creator'
      GROUP BY u.id, u.name, u.username
    `),
  ]);

  return {
    summary: {
      total: parseInt(total.rows[0]?.count ?? '0', 10),
      sold: parseInt(sold.rows[0]?.count ?? '0', 10),
      unsold: parseInt(unsold.rows[0]?.count ?? '0', 10),
    },
    daily: daily.rows.map((row) => ({
      date: row.date,
      count: parseInt(row.count, 10),
    })),
    monthly: monthly.rows.map((row) => ({
      month: row.month,
      count: parseInt(row.count, 10),
    })),
    byCreator: byCreator.rows.map((row) => ({
      name: row.name,
      username: row.username,
      created: parseInt(row.created, 10),
      sold: parseInt(row.sold ?? '0', 10),
    })),
  };
}

async function initSchema() {
  const pool = getPrimaryPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('seller', 'creator')),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
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
  await initSchema();
  console.log(`DB initialized${getMirrorConfig() ? ' with Supabase mirror enabled' : ''}`);
}
