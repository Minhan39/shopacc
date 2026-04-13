import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, getUser } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

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
    const params: any[] = [];

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
    return NextResponse.json({ accounts: res.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const { error, user } = requireAuth(req);
  if (error) return error;
  if (user.role !== 'creator') {
    return NextResponse.json({ error: 'Chỉ người tạo mới có quyền thêm tài khoản' }, { status: 403 });
  }

  const { account, temp_password } = await req.json();
  if (!account || !temp_password) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO accounts (account, temp_password, received_at, status, created_by)
       VALUES ($1, $2, NOW(), 'unsold', $3)
       RETURNING *`,
      [account, temp_password, user.id]
    );
    return NextResponse.json({ account: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
