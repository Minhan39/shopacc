import { NextRequest, NextResponse } from 'next/server';
import pool, { syncMirrorDelete, syncMirrorRow } from '@/lib/db';
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

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT a.*,
        uc.name as creator_name, uc.username as creator_username,
        us.name as seller_name, us.username as seller_username
       FROM accounts a
       LEFT JOIN users uc ON a.created_by = uc.id
       LEFT JOIN users us ON a.sold_by = us.id
       WHERE a.id = $1`,
      [accountId]
    );

    if (!res.rows[0]) {
      return NextResponse.json({ error: 'Khong tim thay tai khoan' }, { status: 404 });
    }

    return NextResponse.json({ account: hydrateAccountSecret(res.rows[0]) });
  } catch {
    return NextResponse.json({ error: 'Khong the tai chi tiet tai khoan' }, { status: 500 });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT * FROM accounts WHERE id = $1', [accountId]);

    if (!existing.rows[0]) {
      return NextResponse.json({ error: 'Khong tim thay tai khoan' }, { status: 404 });
    }

    const res = await client.query(
      `UPDATE accounts SET
        status = 'sold',
        sold_at = $1,
        warranty_expires_at = $2,
        buyer_contact = $3,
        proof_images = $4,
        sold_by = $5
       WHERE id = $6 RETURNING *`,
      [
        normalized.value.soldAt,
        normalized.value.warrantyExpiresAt,
        normalized.value.buyerContact,
        normalized.value.proofImages,
        user.id,
        accountId,
      ]
    );
    await syncMirrorRow('accounts', res.rows[0]);

    return NextResponse.json({
      message: existing.rows[0].status === 'sold' ? 'Cap nhat thong tin ban thanh cong' : 'Danh dau da ban thanh cong',
      account: hydrateAccountSecret(res.rows[0]),
    });
  } catch {
    return NextResponse.json({ error: 'Khong the cap nhat tai khoan' }, { status: 500 });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    const deleted = await client.query('DELETE FROM accounts WHERE id = $1 RETURNING id', [accountId]);

    if (!deleted.rows[0]) {
      return NextResponse.json({ error: 'Khong tim thay tai khoan' }, { status: 404 });
    }

    await syncMirrorDelete('accounts', accountId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Khong the xoa tai khoan' }, { status: 500 });
  } finally {
    client.release();
  }
}
