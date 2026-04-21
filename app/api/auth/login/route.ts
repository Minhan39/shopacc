import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername } from '@/lib/db';
import { verifyPassword, signToken } from '@/lib/auth';

function getLoginErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Khong the dang nhap luc nay';
  }

  const message = error.message.toLowerCase();

  if (process.env.NODE_ENV !== 'production') {
    if (message.includes('password authentication failed')) {
      return 'Ket noi database that bai: DATABASE_URL dang sai user hoac password.';
    }

    if (message.includes('getaddrinfo') || message.includes('enotfound') || message.includes('econnrefused')) {
      return 'Ket noi database that bai: khong the truy cap host trong DATABASE_URL.';
    }
  }

  return 'Khong the dang nhap luc nay';
}

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

  try {
    const user = await findUserByUsername(username);

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
  } catch (error) {
    console.error('[auth/login]', error);
    return NextResponse.json({ error: getLoginErrorMessage(error) }, { status: 500 });
  }
}
