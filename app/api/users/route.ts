import { NextRequest, NextResponse } from 'next/server';
import { createUser, listUsers } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireAuth } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  const { name, username, password, role } = await req.json();
  if (!name || !username || !password || !role) {
    return NextResponse.json({ error: 'Thieu thong tin' }, { status: 400 });
  }

  if (!['seller', 'creator'].includes(role)) {
    return NextResponse.json({ error: 'Role khong hop le' }, { status: 400 });
  }

  try {
    const hashed = hashPassword(password);
    const user = await createUser({
      name,
      username,
      password: hashed,
      role,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      (('code' in err && (err.code === '23505' || err.code === '409')) ||
        ('status' in err && err.status === 409))
    ) {
      return NextResponse.json({ error: 'Username da ton tai' }, { status: 409 });
    }

    throw err;
  }
}
