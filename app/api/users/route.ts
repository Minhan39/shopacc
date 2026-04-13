import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireAuth } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, name, username, role, created_at FROM users ORDER BY created_at DESC');
    return NextResponse.json({ users: res.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  const { name, username, password, role } = await req.json();
  if (!name || !username || !password || !role) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  }
  if (!['seller', 'creator'].includes(role)) {
    return NextResponse.json({ error: 'Role không hợp lệ' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const hashed = hashPassword(password);
    const res = await client.query(
      'INSERT INTO users (name, username, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, username, role, created_at',
      [name, username, hashed, role]
    );
    return NextResponse.json({ user: res.rows[0] }, { status: 201 });
  } catch (err: any) {
    if (err.code === '23505') return NextResponse.json({ error: 'Username đã tồn tại' }, { status: 409 });
    throw err;
  } finally {
    client.release();
  }
}
