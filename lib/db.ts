import { neon } from '@neondatabase/serverless';

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
type CreatorStatsRow = { name: string; username: string; created: string; sold: string | null };

const mirrorMode: MirrorMode = process.env.DB_MIRROR_STRICT === 'true' ? 'strict' : 'best-effort';

let sqlInstance: ReturnType<typeof neon> | null = null;
let mirrorConfigInstance: { url: string; serviceRoleKey: string } | null | undefined;

export type { SupportedTable, UserRole };

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL');
  }

  return databaseUrl;
}

function getSql() {
  if (!sqlInstance) {
    sqlInstance = neon(getDatabaseUrl());
  }

  return sqlInstance;
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
  const sql = getSql();

  return (await sql`
    SELECT id, name, username, role, created_at
    FROM users
    ORDER BY created_at DESC
  `) as PublicUserRow[];
}

export async function findUserByUsername(username: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, username, password, role, created_at
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `) as UserAuthRow[];

  return rows[0] ?? null;
}

export async function createUser(input: {
  name: string;
  username: string;
  password: string;
  role: UserRole;
}) {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO users (name, username, password, role)
    VALUES (${input.name}, ${input.username}, ${input.password}, ${input.role})
    RETURNING id, name, username, password, role, created_at
  `) as UserAuthRow[];

  const created = rows[0];
  await syncMirrorRow('users', created);

  const { password: _password, ...user } = created;
  return user;
}

export async function listAccounts(filters: { status?: AccountStatus | null; search?: string | null } = {}) {
  const sql = getSql();
  let query = `
    SELECT a.*,
      uc.name as creator_name, uc.username as creator_username,
      us.name as seller_name, us.username as seller_username
    FROM accounts a
    LEFT JOIN users uc ON a.created_by = uc.id
    LEFT JOIN users us ON a.sold_by = us.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    query += ` AND a.status = $${params.length}`;
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    query += ` AND (a.account ILIKE $${params.length} OR a.buyer_contact ILIKE $${params.length})`;
  }

  query += ' ORDER BY a.created_at DESC';

  return (await sql.query(query, params)) as AccountRow[];
}

export async function getAccountById(id: number) {
  const sql = getSql();
  const rows = (await sql`
    SELECT a.*,
      uc.name as creator_name, uc.username as creator_username,
      us.name as seller_name, us.username as seller_username
    FROM accounts a
    LEFT JOIN users uc ON a.created_by = uc.id
    LEFT JOIN users us ON a.sold_by = us.id
    WHERE a.id = ${id}
  `) as AccountRow[];

  return rows[0] ?? null;
}

export async function createAccount(input: {
  account: string;
  temp_password: string;
  created_by: number;
}) {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO accounts (account, temp_password, received_at, status, created_by)
    VALUES (${input.account}, ${input.temp_password}, NOW(), 'unsold', ${input.created_by})
    RETURNING *
  `) as AccountRow[];

  const created = rows[0];
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
  const sql = getSql();
  const rows = (await sql`
    UPDATE accounts
    SET status = 'sold',
        sold_at = ${input.sold_at},
        warranty_expires_at = ${input.warranty_expires_at},
        buyer_contact = ${input.buyer_contact},
        proof_images = ${input.proof_images},
        sold_by = ${input.sold_by}
    WHERE id = ${input.id}
    RETURNING *
  `) as AccountRow[];

  const updated = rows[0] ?? null;
  if (updated) {
    await syncMirrorRow('accounts', updated);
  }

  return updated;
}

export async function deleteAccountById(id: number) {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM accounts
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: number }>;

  const deleted = rows[0] ?? null;
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
    const created = await createAccount({
      account: row.account,
      temp_password: row.temp_password,
      created_by: row.created_by,
    });
    inserted.push(created);
  }

  return inserted;
}

export async function getStats(): Promise<StatsResponse> {
  const sql = getSql();
  const [totalRows, soldRows, unsoldRows, dailyRows, monthlyRows, byCreatorRows] = (await sql.transaction([
    sql`SELECT COUNT(*) as count FROM accounts`,
    sql`SELECT COUNT(*) as count FROM accounts WHERE status = 'sold'`,
    sql`SELECT COUNT(*) as count FROM accounts WHERE status = 'unsold'`,
    sql`
      SELECT DATE(sold_at) as date, COUNT(*) as count
      FROM accounts
      WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(sold_at)
      ORDER BY date ASC
    `,
    sql`
      SELECT TO_CHAR(sold_at, 'YYYY-MM') as month, COUNT(*) as count
      FROM accounts
      WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(sold_at, 'YYYY-MM')
      ORDER BY month ASC
    `,
    sql`
      SELECT u.name, u.username,
        COUNT(a.id) as created,
        SUM(CASE WHEN a.status = 'sold' THEN 1 ELSE 0 END) as sold
      FROM users u
      LEFT JOIN accounts a ON a.created_by = u.id
      WHERE u.role = 'creator'
      GROUP BY u.id, u.name, u.username
    `,
  ])) as [CountRow[], CountRow[], CountRow[], DailyRow[], MonthlyRow[], CreatorStatsRow[]];

  return {
    summary: {
      total: parseInt(totalRows[0]?.count ?? '0', 10),
      sold: parseInt(soldRows[0]?.count ?? '0', 10),
      unsold: parseInt(unsoldRows[0]?.count ?? '0', 10),
    },
    daily: dailyRows.map((row) => ({
      date: row.date,
      count: parseInt(row.count, 10),
    })),
    monthly: monthlyRows.map((row) => ({
      month: row.month,
      count: parseInt(row.count, 10),
    })),
    byCreator: byCreatorRows.map((row) => ({
      name: row.name,
      username: row.username,
      created: parseInt(row.created, 10),
      sold: parseInt(row.sold ?? '0', 10),
    })),
  };
}

export async function initDB() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('seller', 'creator')),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
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
    )
  `;

  console.log(`DB initialized${getMirrorConfig() ? ' with Supabase mirror enabled' : ''}`);
}
