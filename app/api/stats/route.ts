import { NextRequest, NextResponse } from 'next/server';
import { getStats } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  const stats = await getStats();
  return NextResponse.json(stats);
}
