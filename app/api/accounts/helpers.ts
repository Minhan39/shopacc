import { NextResponse } from 'next/server';

export interface AccountSalePayload {
  sold_at?: string | null;
  warranty_expires_at?: string | null;
  buyer_contact?: string | null;
  proof_images?: string[] | null;
}

export function parseAccountId(id: string) {
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return null;
  }

  return parsedId;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export function normalizeSalePayload(payload: AccountSalePayload) {
  const soldAt = payload.sold_at ? new Date(payload.sold_at) : new Date();
  const warrantyExpiresAt = payload.warranty_expires_at ? new Date(payload.warranty_expires_at) : null;

  if (Number.isNaN(soldAt.getTime())) {
    return { error: badRequest('sold_at khong hop le') };
  }

  if (warrantyExpiresAt && Number.isNaN(warrantyExpiresAt.getTime())) {
    return { error: badRequest('warranty_expires_at khong hop le') };
  }

  if (payload.proof_images && !Array.isArray(payload.proof_images)) {
    return { error: badRequest('proof_images phai la mang chuoi') };
  }

  const proofImages = (payload.proof_images ?? [])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (payload.proof_images && proofImages.length !== payload.proof_images.length) {
    return { error: badRequest('proof_images chi duoc chua chuoi') };
  }

  return {
    value: {
      soldAt: soldAt.toISOString(),
      warrantyExpiresAt: warrantyExpiresAt?.toISOString() ?? null,
      buyerContact: payload.buyer_contact?.trim() || null,
      proofImages,
    },
  };
}
