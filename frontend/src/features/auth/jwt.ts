import type { Role } from '../../lib/types';

interface JwtClaims {
  sub: string;
  hospitalId: string | null;
  role: Role;
  sessionId: string;
  exp?: number;
  iat?: number;
}

/** Decode a JWT payload without verifying the signature (display/routing only). */
export function decodeJwt(token: string): JwtClaims | null {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

export function isExpired(token: string, skewSeconds = 15): boolean {
  const claims = decodeJwt(token);
  if (!claims?.exp) return false;
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
