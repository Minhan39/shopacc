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

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function getDefaultWarrantyExpiresAtValue(soldAt: Date) {
  const expiresAt = new Date(soldAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  expiresAt.setHours(12, 0, 0, 0);
  return toDateTimeLocalValue(expiresAt);
}

export function normalizeSalePayload(payload: AccountSalePayload) {
  const soldAt = payload.sold_at ? new Date(payload.sold_at) : new Date();
  const warrantyExpiresAtValue = payload.warranty_expires_at || getDefaultWarrantyExpiresAtValue(soldAt);
  const warrantyExpiresAt = new Date(warrantyExpiresAtValue);

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
      warrantyExpiresAt: warrantyExpiresAtValue,
      buyerContact: payload.buyer_contact?.trim() || null,
      proofImages,
    },
  };
}
