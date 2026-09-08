// Supabase JWT verification via the project's JWKS endpoint (asymmetric keys, ES256 — verified on this project);
// SUPABASE_JWT_SECRET (HS256) only as a legacy fallback. AUDIT.md Judge 2.
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwksCache = new Map();

export function bearer(request) {
  const h = request.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

export async function verifySupabaseJWT(token, env) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('SUPABASE_URL not configured');
  const issuer = `${base}/auth/v1`;
  let jwks = jwksCache.get(base);
  if (!jwks) { jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)); jwksCache.set(base, jwks); }
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: 'authenticated' });
    return payload;                                   // { sub, email, role, exp, ... }
  } catch (e) {
    if (env.SUPABASE_JWT_SECRET) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET), { issuer, audience: 'authenticated' });
      return payload;
    }
    throw e;
  }
}
