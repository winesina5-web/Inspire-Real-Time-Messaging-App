import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySupabaseJwt } from './auth';
import { isSafeUrl, getCorsHeaders } from './index';

// Helper to construct test JWTs
async function createTestJwt(
  payload: Record<string, unknown>,
  secret: string,
  alg: string = 'HS256'
): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg, typ: 'JWT' };
  
  const b64Url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const encodedHeader = b64Url(header);
  const encodedPayload = b64Url(payload);
  const data = `${encodedHeader}.${encodedPayload}`;

  if (alg === 'none') {
    return `${data}.`;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigB64 = Buffer.from(sigBuffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${data}.${sigB64}`;
}

test('verifySupabaseJwt: fails closed when JWT secret is undefined or blank', async () => {
  const token = await createTestJwt(
    { sub: 'usr_123', exp: Math.floor(Date.now() / 1000) + 3600 },
    'any_secret'
  );

  const res1 = await verifySupabaseJwt(`Bearer ${token}`, undefined);
  assert.equal(res1, null, 'must fail closed on undefined secret');

  const res2 = await verifySupabaseJwt(`Bearer ${token}`, '   ');
  assert.equal(res2, null, 'must fail closed on empty secret');
});

test('verifySupabaseJwt: fails closed on invalid auth header format', async () => {
  assert.equal(await verifySupabaseJwt(null, 'secret'), null);
  assert.equal(await verifySupabaseJwt('Basic 12345', 'secret'), null);
  assert.equal(await verifySupabaseJwt('Bearer', 'secret'), null);
});

test('verifySupabaseJwt: fails closed on expired token', async () => {
  const secret = 'super-secret-jwt-key-for-test-32b';
  const pastTime = Math.floor(Date.now() / 1000) - 100;
  const token = await createTestJwt({ sub: 'usr_abc', exp: pastTime }, secret);

  const user = await verifySupabaseJwt(`Bearer ${token}`, secret);
  assert.equal(user, null, 'expired token must be rejected');
});

test('verifySupabaseJwt: rejects unsupported alg (none attack)', async () => {
  const secret = 'super-secret-jwt-key-for-test-32b';
  const token = await createTestJwt(
    { sub: 'usr_hacker', exp: Math.floor(Date.now() / 1000) + 3600 },
    secret,
    'none'
  );

  const user = await verifySupabaseJwt(`Bearer ${token}`, secret);
  assert.equal(user, null, 'alg: none must be rejected');
});

test('verifySupabaseJwt: fails on tampered payload or signature mismatch', async () => {
  const secret = 'super-secret-jwt-key-for-test-32b';
  const validToken = await createTestJwt(
    { sub: 'usr_real', role: 'user', exp: Math.floor(Date.now() / 1000) + 3600 },
    secret
  );

  // Tamper with secret
  const resultWithWrongSecret = await verifySupabaseJwt(
    `Bearer ${validToken}`,
    'wrong-verification-secret-xyz'
  );
  assert.equal(resultWithWrongSecret, null, 'signature mismatch must return null');

  // Tamper with payload
  const parts = validToken.split('.');
  const forgedPayload = Buffer.from(
    JSON.stringify({ sub: 'usr_real', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  const tamperedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

  const resultTampered = await verifySupabaseJwt(`Bearer ${tamperedToken}`, secret);
  assert.equal(resultTampered, null, 'tampered payload must fail signature check');
});

test('verifySupabaseJwt: accepts valid signed token with authenticated aud', async () => {
  const secret = 'correct-supabase-secret-test-key-32';
  const futureExp = Math.floor(Date.now() / 1000) + 7200;
  const token = await createTestJwt(
    {
      sub: 'usr_valid_001',
      email: 'test@example.com',
      role: 'admin',
      aud: 'authenticated',
      exp: futureExp,
    },
    secret
  );

  const user = await verifySupabaseJwt(`Bearer ${token}`, secret);
  assert.notEqual(user, null);
  assert.equal(user?.userId, 'usr_valid_001');
  assert.equal(user?.email, 'test@example.com');
  assert.equal(user?.role, 'admin');
});

test('isSafeUrl: blocks SSRF targets and permits public web URLs', () => {
  // Blocked SSRF targets
  assert.equal(isSafeUrl('http://localhost:3000/api'), false, 'blocks localhost');
  assert.equal(isSafeUrl('http://127.0.0.1:8080/admin'), false, 'blocks 127.0.0.1');
  assert.equal(isSafeUrl('http://0.0.0.0'), false, 'blocks 0.0.0.0');
  assert.equal(isSafeUrl('http://169.254.169.254/latest/meta-data'), false, 'blocks AWS/GCP metadata IP');
  assert.equal(isSafeUrl('http://10.0.0.1/internal'), false, 'blocks 10.x.x.x private class A');
  assert.equal(isSafeUrl('http://192.168.1.1/router'), false, 'blocks 192.168.x.x private class C');
  assert.equal(isSafeUrl('http://service.internal/config'), false, 'blocks .internal');
  assert.equal(isSafeUrl('ftp://example.com/file'), false, 'blocks non-http protocols');

  // Permitted public URLs
  assert.equal(isSafeUrl('https://example.com/article'), true, 'permits public https');
  assert.equal(isSafeUrl('https://github.com/winesina5-web'), true, 'permits github');
  assert.equal(isSafeUrl('http://public-site.org/index.html'), true, 'permits public http');
});

test('getCorsHeaders: never returns wildcard * and respects origin allowlist', () => {
  const mockEnv = {
    ALLOWED_ORIGINS: 'https://custom-domain.com,https://inspire.pages.dev',
  } as any;

  // Request from authorized origin
  const reqAuthorized = new Request('http://localhost:8787/api/test', {
    headers: { Origin: 'https://custom-domain.com' },
  });
  const headersAuth = getCorsHeaders(reqAuthorized, mockEnv) as Record<string, string>;
  assert.equal(headersAuth['Access-Control-Allow-Origin'], 'https://custom-domain.com');
  assert.notEqual(headersAuth['Access-Control-Allow-Origin'], '*');

  // Request from unauthorized origin
  const reqUnauth = new Request('http://localhost:8787/api/test', {
    headers: { Origin: 'https://evil-site.com' },
  });
  const headersUnauth = getCorsHeaders(reqUnauth, mockEnv) as Record<string, string>;
  assert.equal(headersUnauth['Access-Control-Allow-Origin'], undefined, 'must not allow unauthorized origin');

  const reqWildcardPages = new Request('http://localhost:8787/api/test', {
    headers: { Origin: 'https://attacker.pages.dev' },
  });
  const headersWildcardPages = getCorsHeaders(reqWildcardPages, mockEnv) as Record<string, string>;
  assert.equal(headersWildcardPages['Access-Control-Allow-Origin'], undefined, 'must not trust arbitrary pages.dev subdomains');
});
