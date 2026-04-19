import { NextRequest, NextResponse } from 'next/server';
import pool, { syncMirrorRow } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';
import { encryptAccountSecret, hydrateAccountSecret } from '@/lib/account-secret';

export async function GET(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search')?.trim();

  if (status && status !== 'unsold' && status !== 'sold') {
    return NextResponse.json({ error: 'status chi chap nhan unsold hoac sold' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
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

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (a.account ILIKE $${params.length} OR a.buyer_contact ILIKE $${params.length})`;
    }

    query += ' ORDER BY a.created_at DESC';

    const res = await client.query(query, params);

    return NextResponse.json({
      filters: {
        status: status || null,
        search: search || null,
      },
      total: res.rows.length,
      accounts: res.rows.map(hydrateAccountSecret),
    });
  } catch {
    return NextResponse.json({ error: 'Khong the tai danh sach tai khoan' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const { error, user } = requireAuth(req);
  if (error) return error;

  if (user.role !== 'creator') {
    return NextResponse.json({ error: 'Chi nguoi tao moi co quyen them tai khoan' }, { status: 403 });
  }

  let body: { account?: string; temp_password?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Du lieu gui len khong hop le' }, { status: 400 });
  }

  const account = body.account?.trim();
  const tempPassword = body.temp_password?.trim();

  if (!account || !tempPassword) {
    return NextResponse.json({ error: 'Thieu account hoac temp_password' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const encryptedTempPassword = encryptAccountSecret(tempPassword);
    const res = await client.query(
      `INSERT INTO accounts (account, temp_password, received_at, status, created_by)
       VALUES ($1, $2, NOW(), 'unsold', $3)
       RETURNING *`,
      [account, encryptedTempPassword, user.id]
    );
    await syncMirrorRow('accounts', res.rows[0]);

    return NextResponse.json(
      {
        message: 'Tao tai khoan thanh cong',
        account: hydrateAccountSecret(res.rows[0]),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Khong the tao tai khoan' }, { status: 500 });
  } finally {
    client.release();
  }
}
