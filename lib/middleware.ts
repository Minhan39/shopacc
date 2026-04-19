import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';

function getTokenFromRequest(req: NextRequest) {
  const cookieToken = req.cookies.get('token')?.value;
  if (cookieToken) return cookieToken;

  const authorization = req.headers.get('authorization');
  if (!authorization) return null;

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  return token.trim();
}

export function getUser(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

export function requireAuth(req: NextRequest) {
  const user = getUser(req);
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  return { error: null, user };
}

export function requireRole(req: NextRequest, role: string) {
  const { error, user } = requireAuth(req);
  if (error) return { error, user: null };
  if (user.role !== role) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}
