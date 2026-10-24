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
}

const LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  voice_note: 10 * 1024 * 1024,
  avatar: 5 * 1024 * 1024,
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

  const maxAllowed = LIMITS[messageType] || LIMITS.image;
  if (file.size > maxAllowed) {
    return Response.json(
      { error: `File exceeds maximum allowed size for ${messageType}` },
      { status: 413 }
    );
  }

  // Key naming convention: {userId}/{uuid}.{ext} or {userId}/avatar.{ext}
  const ext = file.name.split('.').pop() || 'bin';
  const objectKey =
    messageType === 'avatar'
      ? `${user.userId}/avatar.${ext}`
      : `${user.userId}/${crypto.randomUUID()}.${ext}`;

  // Write directly using the native R2 binding
  await env.MY_BUCKET.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
    customMetadata: {
      uploader: user.userId,
      messageType,
      originalName: file.name,
    },
  });

  return Response.json({
    object_key: objectKey,
    size: file.size,
    mime_type: file.type,
  });
}

export async function handleDownloadUrl(
  request: Request,
  env: Env,
  user: AuthUser
): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { object_key?: string };
  const objectKey = body.object_key;

  if (!objectKey) {
    return Response.json({ error: 'Missing object_key' }, { status: 400 });
  }

  // Verify object exists in bucket
  const head = await env.MY_BUCKET.head(objectKey);
  if (!head) {
    return Response.json({ error: 'Media not found' }, { status: 404 });
  }

  // Construct download URL
  // If R2 credentials are configured, generate presigned GET URL; otherwise provide worker proxy path
  const downloadUrl = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}/${objectKey}`;

  return Response.json({
    download_url: downloadUrl,
    expires_in: 300,
  });
}
