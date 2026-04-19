import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyPassword, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Du lieu gui len khong hop le' }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password;

  if (!username || !password) {
    return NextResponse.json({ error: 'Thieu username hoac password' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = res.rows[0];

    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Sai tai khoan hoac mat khau' }, { status: 401 });
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      message: 'Dang nhap thanh cong',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Khong the dang nhap luc nay' }, { status: 500 });
  } finally {
    client.release();
  }
}
