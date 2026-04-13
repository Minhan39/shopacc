import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/middleware';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error } = requireAuth(req);
  if (error) return error;
  const { id } = await context.params;

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
      [id]
    );
    if (!res.rows[0]) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
    return NextResponse.json({ account: res.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = requireAuth(req);
  if (error) return error;
  if (user.role !== 'seller') {
    return NextResponse.json({ error: 'Chỉ người bán mới có quyền cập nhật' }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await req.json();
  const { sold_at, warranty_expires_at, buyer_contact, proof_images } = body;

  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT * FROM accounts WHERE id = $1', [id]);
    if (!existing.rows[0]) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });

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
        sold_at || new Date().toISOString(),
        warranty_expires_at || null,
        buyer_contact || null,
        proof_images || [],
        user.id,
        id,
      ]
    );
    return NextResponse.json({ account: res.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error } = requireAuth(req);
  if (error) return error;
  const { id } = await context.params;

  const client = await pool.connect();
  try {
    await client.query('DELETE FROM accounts WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } finally {
    client.release();
  }
}
