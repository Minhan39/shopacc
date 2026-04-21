import { NextRequest, NextResponse } from 'next/server';
import { deleteAccountById, getAccountById, updateAccountSale } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';
import { hydrateAccountSecret } from '@/lib/account-secret';
import { normalizeSalePayload, parseAccountId } from '../helpers';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error } = requireAuth(req);
  if (error) return error;

  const { id } = await context.params;
  const accountId = parseAccountId(id);

  if (!accountId) {
    return NextResponse.json({ error: 'id khong hop le' }, { status: 400 });
  }

  try {
    const account = await getAccountById(accountId);

    if (!account) {
      return NextResponse.json({ error: 'Khong tim thay tai khoan' }, { status: 404 });
    }

    return NextResponse.json({ account: hydrateAccountSecret(account) });
  } catch {
    return NextResponse.json({ error: 'Khong the tai chi tiet tai khoan' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = requireAuth(req);
  if (error) return error;

  if (user.role !== 'seller') {
    return NextResponse.json({ error: 'Chi nguoi ban moi co quyen cap nhat' }, { status: 403 });
  }

  const { id } = await context.params;
  const accountId = parseAccountId(id);

  if (!accountId) {
    return NextResponse.json({ error: 'id khong hop le' }, { status: 400 });
  }

  let body: {
    sold_at?: string | null;
    warranty_expires_at?: string | null;
    buyer_contact?: string | null;
    proof_images?: string[] | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Du lieu gui len khong hop le' }, { status: 400 });
  }

  const normalized = normalizeSalePayload(body);
  if (normalized.error) return normalized.error;

  try {
    const existing = await getAccountById(accountId);

    if (!existing) {
      return NextResponse.json({ error: 'Khong tim thay tai khoan' }, { status: 404 });
    }

    const updated = await updateAccountSale({
      id: accountId,
      sold_at: normalized.value.soldAt,
      warranty_expires_at: normalized.value.warrantyExpiresAt,
      buyer_contact: normalized.value.buyerContact,
      proof_images: normalized.value.proofImages,
      sold_by: user.id,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Khong the cap nhat tai khoan' }, { status: 500 });
    }

    return NextResponse.json({
      message: existing.status === 'sold' ? 'Cap nhat thong tin ban thanh cong' : 'Danh dau da ban thanh cong',
      account: hydrateAccountSecret(updated),
    });
  } catch {
    return NextResponse.json({ error: 'Khong the cap nhat tai khoan' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = requireAuth(req);
  if (error) return error;

  if (user.role !== 'creator') {
    return NextResponse.json({ error: 'Chi nguoi tao moi co quyen xoa tai khoan' }, { status: 403 });
  }

  const { id } = await context.params;
  const accountId = parseAccountId(id);

  if (!accountId) {
    return NextResponse.json({ error: 'id khong hop le' }, { status: 400 });
  }

  try {
    const deleted = await deleteAccountById(accountId);

    if (!deleted) {
      return NextResponse.json({ error: 'Khong tim thay tai khoan' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Khong the xoa tai khoan' }, { status: 500 });
  }
}
