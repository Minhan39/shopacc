import { NextRequest, NextResponse } from 'next/server';
import pool, { syncMirrorRow } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';
import { encryptAccountSecret, hydrateAccountSecret } from '@/lib/account-secret';

export async function POST(req: NextRequest) {
  const { error, user } = requireAuth(req);
  if (error) return error;
  if (user.role !== 'creator') {
    return NextResponse.json({ error: 'Chỉ người tạo mới có quyền import' }, { status: 403 });
  }

  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });

  const lines = text.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
  if (lines.length % 2 !== 0) {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ: số dòng phải chẵn (account/password)' }, { status: 400 });
  }

  const pairs: { account: string; temp_password: string }[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    pairs.push({ account: lines[i], temp_password: lines[i + 1] });
  }

  const client = await pool.connect();
  try {
    const inserted = [];
    for (const pair of pairs) {
      const encryptedTempPassword = encryptAccountSecret(pair.temp_password);
      const res = await client.query(
        `INSERT INTO accounts (account, temp_password, received_at, status, created_by)
         VALUES ($1, $2, NOW(), 'unsold', $3) RETURNING *`,
        [pair.account, encryptedTempPassword, user.id]
      );
      await syncMirrorRow('accounts', res.rows[0]);
      inserted.push(hydrateAccountSecret(res.rows[0]));
    }
    return NextResponse.json({ inserted: inserted.length, accounts: inserted });
  } finally {
    client.release();
  }
}
