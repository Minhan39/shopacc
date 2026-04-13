import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyPassword, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = res.rows[0];
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Sai tài khoản hoặc mật khẩu' }, { status: 401 });
    }

    const token = signToken({ id: user.id, username: user.username, name: user.name, role: user.role });
    const response = NextResponse.json({ user: { id: user.id, username: user.username, name: user.name, role: user.role } });
    response.cookies.set('token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/' });
    return response;
  } finally {
    client.release();
  }
}
