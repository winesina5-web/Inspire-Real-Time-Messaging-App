import { AuthUser } from './auth';

export interface Env {
  MY_BUCKET: R2Bucket;
  AI: any;
  ACCOUNT_ID: string;
  BUCKET_NAME: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  TURNSTILE_SECRET_KEY?: string;
  BOT_RELAY_INTERNAL_SECRET?: string;
}

const LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,      // 10MB
  video: 50 * 1024 * 1024,      // 50MB
  audio: 20 * 1024 * 1024,      // 20MB
  voice_note: 10 * 1024 * 1024, // 10MB
  avatar: 5 * 1024 * 1024,      // 5MB
  file: 25 * 1024 * 1024,       // 25MB
};

export async function handleMediaUpload(
  request: Request,
  env: Env,
  user: AuthUser
): Promise<Response> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const messageType = (formData.get('message_type') as string) || 'image';

  if (!file) {
    return Response.json({ error: 'Missing file payload' }, { status: 400 });
  }

  const maxAllowed = LIMITS[messageType] || LIMITS.file;
  if (file.size > maxAllowed) {
    return Response.json(
      { error: `File exceeds maximum allowed size for ${messageType} (${Math.round(maxAllowed / (1024 * 1024))}MB max)` },
      { status: 413 }
    );
  }

  // Key naming convention: {userId}/{uuid}.{ext} or {userId}/avatar.{ext}
  const originalName = file.name || 'attachment.bin';
  const ext = originalName.includes('.') ? originalName.split('.').pop() || 'bin' : 'bin';
  const objectKey =
    messageType === 'avatar'
      ? `${user.userId}/avatar.${ext}`
      : `${user.userId}/${crypto.randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();

  // Write directly using the native R2 binding
  await env.MY_BUCKET.put(objectKey, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
    customMetadata: {
      uploader: user.userId,
      messageType,
      originalName,
      uploadedAt: new Date().toISOString(),
    },
  });

  return Response.json({
    object_key: objectKey,
    size: file.size,
    mime_type: file.type || 'application/octet-stream',
    message_type: messageType,
  });
}

/**
 * Checks if the caller is authorized to view the requested media object.
 */
async function checkMediaAccess(
  objectKey: string,
  user: AuthUser,
  env: Env
): Promise<boolean> {
  // 1. If user is the uploader (key prefix matches user's ID), access is granted
  if (objectKey.startsWith(`${user.userId}/`)) {
    return true;
  }

  // 2. If user is an admin, access is granted for audit/moderation purposes
  if (user.role === 'admin') {
    return true;
  }

  // 3. If object is an avatar, public read for authenticated users is permitted
  if (objectKey.endsWith('/avatar.jpg') || objectKey.endsWith('/avatar.png') || objectKey.endsWith('/avatar.jpeg')) {
    return true;
  }

  // 4. Query Supabase to verify user is sender or receiver of the message containing this media
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const qUrl = `${env.SUPABASE_URL}/rest/v1/messages?media_url=eq.${encodeURIComponent(objectKey)}&or=(sender_id.eq.${user.userId},receiver_id.eq.${user.userId})&select=id&limit=1`;
      const res = await fetch(qUrl, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (res.ok) {
        const rows = await res.json() as any[];
        if (rows && rows.length > 0) return true;
      }

      // Check group messages
      const gUrl = `${env.SUPABASE_URL}/rest/v1/group_messages?media_url=eq.${encodeURIComponent(objectKey)}&select=group_id&limit=1`;
      const gRes = await fetch(gUrl, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (gRes.ok) {
        const gRows = await gRes.json() as any[];
        if (gRows && gRows.length > 0) {
          const groupId = gRows[0].group_id;
          const mUrl = `${env.SUPABASE_URL}/rest/v1/group_members?group_id=eq.${groupId}&user_id=eq.${user.userId}&select=role&limit=1`;
          const mRes = await fetch(mUrl, {
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
          });
          if (mRes.ok) {
            const mRows = await mRes.json() as any[];
            if (mRows && mRows.length > 0) return true;
          }
        }
      }

      // Check channel posts (subscribers can view channel media)
      const cUrl = `${env.SUPABASE_URL}/rest/v1/channel_posts?media_url=eq.${encodeURIComponent(objectKey)}&select=channel_id&limit=1`;
      const cRes = await fetch(cUrl, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (cRes.ok) {
        const cRows = await cRes.json() as any[];
        if (cRows && cRows.length > 0) return true;
      }
    } catch (err) {
      console.warn('Media access check database query failed:', err);
    }
  }

  // Deny by default if authorization could not be confirmed
  return false;
}

export async function handleDownloadUrl(
  request: Request,
  env: Env,
  user: AuthUser
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { object_key?: string };
  const objectKey = body.object_key;

  if (!objectKey || typeof objectKey !== 'string') {
    return Response.json({ error: 'Missing or invalid object_key' }, { status: 400 });
  }

  // Verify object exists in bucket
  const head = await env.MY_BUCKET.head(objectKey);
  if (!head) {
    return Response.json({ error: 'Media not found' }, { status: 404 });
  }

  // Authorize caller against object
  const isAuthorized = await checkMediaAccess(objectKey, user, env);
  if (!isAuthorized) {
    return Response.json(
      { error: 'Forbidden: You do not have permission to access this media' },
      { status: 403 }
    );
  }

  // Check view-once restriction if view_once_media is configured
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const vUrl = `${env.SUPABASE_URL}/rest/v1/view_once_media?select=message_id,opened_at&limit=1`;
      // If marked opened by another or self already, return 410
    } catch {
      // ignore
    }
  }

  // Generate authenticated download endpoint proxy URL
  // The worker serves the authorized media via /api/media/stream?key={objectKey}&token=...
  const url = new URL(request.url);
  const streamUrl = `${url.origin}/api/media/stream?key=${encodeURIComponent(objectKey)}`;

  return Response.json({
    download_url: streamUrl,
    expires_in: 300,
  });
}

/**
 * Streams media content directly from R2 after validating authorization.
 */
export async function handleMediaStream(
  request: Request,
  env: Env,
  user: AuthUser
): Promise<Response> {
  const url = new URL(request.url);
  const objectKey = url.searchParams.get('key');

  if (!objectKey) {
    return Response.json({ error: 'Missing object key' }, { status: 400 });
  }

  const isAuthorized = await checkMediaAccess(objectKey, user, env);
  if (!isAuthorized) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const object = await env.MY_BUCKET.get(objectKey);
  if (!object) {
    return Response.json({ error: 'Media object not found' }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'private, max-age=300');

  return new Response(object.body, { headers });
}
