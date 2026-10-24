export interface AuthUser {
  userId: string;
  email?: string;
  role?: string;
}

export async function verifySupabaseJwt(
  authHeader: string | null,
  jwtSecret: string | undefined
): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);

    // Verify expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    // If secret provided, verify HS256 signature via Web Crypto API
    if (jwtSecret) {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(jwtSecret);
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const dataToVerify = encoder.encode(`${parts[0]}.${parts[1]}`);
      const rawSig = Uint8Array.from(
        atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0)
      );

      const isValid = await crypto.subtle.verify('HMAC', key, rawSig, dataToVerify);
      if (!isValid) return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch (err) {
    console.error('JWT verification failed:', err);
    return null;
  }
}
