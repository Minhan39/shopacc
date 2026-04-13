import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ user });
}
