export interface AuthUser {
  userId: string;
  email?: string;
  role?: string;
}

/**
 * Verifies Supabase JWT token.
 * Security requirement: MUST FAIL CLOSED.
 * If jwtSecret is missing, empty, or token signature is invalid, returns null.
 * Validates expiration, algorithm, subject, and audience.
 */
export async function verifySupabaseJwt(
  authHeader: string | null,
  jwtSecret: string | undefined
): Promise<AuthUser | null> {
  // Fail closed if authorization header is absent or improperly formatted
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  // Fail closed if the verification key is missing or blank
  if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
    console.error('JWT verification failed: SUPABASE_JWT_SECRET is not configured. Failing closed.');
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode header and verify algorithm
    const headerJson = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
    const header = JSON.parse(headerJson);
    if (header.alg !== 'HS256') {
      console.warn(`JWT verification failed: unsupported algorithm ${header.alg}`);
      return null;
    }

    // Decode payload
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);

    // Verify subject (userId)
    if (!payload.sub || typeof payload.sub !== 'string') {
      return null;
    }

    // Verify expiration
    if (payload.exp && typeof payload.exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec >= payload.exp) {
        return null;
      }
    } else {
      // Tokens without exp are rejected
      return null;
    }

    // Supabase user access tokens must carry the authenticated audience.
    if (payload.aud !== 'authenticated') {
      return null;
    }

    // Verify HS256 signature via Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(jwtSecret.trim());
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataToVerify = encoder.encode(`${parts[0]}.${parts[1]}`);
    
    // Convert base64url signature to binary Uint8Array
    let b64Sig = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    while (b64Sig.length % 4 !== 0) {
      b64Sig += '=';
    }
    const rawSig = Uint8Array.from(atob(b64Sig), (c) => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify('HMAC', key, rawSig, dataToVerify);
    if (!isValid) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role || payload.app_metadata?.role || 'user',
    };
  } catch (err) {
    console.error('JWT verification error:', err);
    return null;
  }
}
