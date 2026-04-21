import { NextRequest, NextResponse } from 'next/server';
import { createAccount, listAccounts } from '@/lib/db';
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

  const normalizedStatus = status === 'sold' || status === 'unsold' ? status : undefined;

  try {
    const accounts = await listAccounts({ status: normalizedStatus, search });

    return NextResponse.json({
      filters: {
        status: status || null,
        search: search || null,
      },
      total: accounts.length,
      accounts: accounts.map(hydrateAccountSecret),
    });
  } catch {
    return NextResponse.json({ error: 'Khong the tai danh sach tai khoan' }, { status: 500 });
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

  try {
    const encryptedTempPassword = encryptAccountSecret(tempPassword);
    const created = await createAccount({
      account,
      temp_password: encryptedTempPassword,
      created_by: user.id,
    });

    return NextResponse.json(
      {
        message: 'Tao tai khoan thanh cong',
        account: hydrateAccountSecret(created),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Khong the tao tai khoan' }, { status: 500 });
  }
}
