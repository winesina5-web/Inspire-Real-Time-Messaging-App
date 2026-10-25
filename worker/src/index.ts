import { Env } from './env';
import { verifySupabaseJwt } from './auth';
import {
  handleSmartReply,
  handleTranslate,
  handleSummarize,
  handleSmartSearch,
  handleModerate,
  handleTranscribe,
  handleEmojiSuggest,
  handleAssistant,
  handleToneCheck,
  handleCategorizeChat,
  handleNotificationSummary,
  handleExtractEvents,
  handleSentiment,
  handleSmartCompose,
} from './ai';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'https://inspire.pages.dev',
];

export function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin');
  let allowedOrigin = '';

  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allAllowed = [...DEFAULT_ALLOWED_ORIGINS, ...configured];

  if (origin) {
    if (
      allAllowed.includes(origin)
    ) {
      allowedOrigin = origin;
    }
  }

  // If origin not matched, default to first allowed origin or omit allow-origin
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Validates URLs against SSRF (Server-Side Request Forgery) attacks.
 */
export function isSafeUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    // Block localhost, private IPs, loopback, link-local, cloud metadata
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '127.0.0.1' ||
      host.startsWith('127.') ||
      host === '0.0.0.0' ||
      host === '169.254.169.254' || // AWS / GCP metadata
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Verify Supabase JWT on all API routes except public health check
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', time: new Date().toISOString() }, { headers: corsHeaders });
    }

    const authHeader = request.headers.get('Authorization');
    const user = await verifySupabaseJwt(authHeader, env.SUPABASE_JWT_SECRET);

    if (!user) {
      return Response.json(
        { error: 'Unauthorized: Valid Supabase JWT required' },
        { status: 401, headers: corsHeaders }
      );
    }

    let response: Response;

    try {
      switch (url.pathname) {
        // Core AI routes
        case '/api/ai/smart-reply':
          response = await handleSmartReply(request, env, user);
          break;
        case '/api/ai/translate':
          response = await handleTranslate(request, env, user);
          break;
        case '/api/ai/summarize':
          response = await handleSummarize(request, env, user);
          break;
        case '/api/ai/smart-search':
          response = await handleSmartSearch(request, env, user);
          break;
        case '/api/ai/moderate':
          response = await handleModerate(request, env, user);
          break;
        case '/api/ai/transcribe':
          response = await handleTranscribe(request, env, user);
          break;
        case '/api/ai/emoji-suggest':
          response = await handleEmojiSuggest(request, env, user);
          break;

        // Document 07 Advanced AI & Utility routes
        case '/api/ai/assistant':
          response = await handleAssistant(request, env, user);
          break;
        case '/api/ai/tone-check':
          response = await handleToneCheck(request, env, user);
          break;
        case '/api/ai/categorize-chat':
          response = await handleCategorizeChat(request, env, user);
          break;
        case '/api/ai/notification-summary':
          response = await handleNotificationSummary(request, env, user);
          break;
        case '/api/ai/extract-events':
          response = await handleExtractEvents(request, env, user);
          break;

        // Document 09 Wave 2 AI Routes
        case '/api/ai/sentiment':
          response = await handleSentiment(request, env, user);
          break;
        case '/api/ai/smart-compose':
          response = await handleSmartCompose(request, env, user);
          break;

        case '/api/ai/image-enhance': {
          // If image model exists in Workers AI catalog, execute; otherwise report honest status
          response = Response.json({
            error: 'ai_model_not_configured',
            message: 'Image enhancement model requires designated Cloudflare Workers AI image pipeline.',
          }, { status: 501 });
          break;
        }

        case '/api/ai/auto-caption': {
          response = await handleTranscribe(request, env, user);
          break;
        }

        case '/api/calls/turn-credentials': {
          const fallbackIceServers = [
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.l.google.com:19302' },
          ];
          if (!env.TURN_KEY_ID || !env.TURN_API_TOKEN) {
            response = Response.json({ iceServers: fallbackIceServers, turnConfigured: false });
            break;
          }
          try {
            const turnResponse = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${env.TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ ttl: 3600 }),
            });
            if (!turnResponse.ok) throw new Error(`TURN credential request failed (${turnResponse.status})`);
            const turnData = await turnResponse.json() as { iceServers?: RTCIceServer[] };
            response = Response.json({ iceServers: turnData.iceServers?.length ? turnData.iceServers : fallbackIceServers, turnConfigured: Boolean(turnData.iceServers?.some((server) => String(server.urls).includes('turn:') || (Array.isArray(server.urls) && server.urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:'))))) });
          } catch (error) {
            console.error('TURN credentials unavailable:', error);
            response = Response.json({ iceServers: fallbackIceServers, turnConfigured: false });
          }
          break;
        }

        case '/api/link-preview': {
          const body = (await request.json().catch(() => ({}))) as { url?: string };
          const link = body.url || '';
          if (!link || !isSafeUrl(link)) {
            response = Response.json({ error: 'Invalid or forbidden URL' }, { status: 400 });
            break;
          }

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const pageRes = await fetch(link, {
              headers: { 'User-Agent': 'Inspire-Bot/1.0 (+https://inspire.pages.dev)' },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!pageRes.ok) {
              response = Response.json({ error: 'Could not fetch URL' }, { status: 502 });
              break;
            }

            const html = await pageRes.text();
            // Parse open graph meta tags
            const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                               html.match(/<title>([^<]+)<\/title>/i);
            const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                              html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
            const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);

            response = Response.json({
              url: link,
              title: titleMatch ? titleMatch[1].trim() : new URL(link).hostname,
              description: descMatch ? descMatch[1].trim() : '',
              image: imgMatch ? imgMatch[1].trim() : undefined,
            });
          } catch (fetchErr) {
            response = Response.json({
              url: link,
              title: new URL(link).hostname,
              description: 'Preview unavailable',
            });
          }
          break;
        }

        case '/api/push/subscribe': {
          const body = (await request.json().catch(() => ({}))) as {
            endpoint?: string;
            keys?: { p256dh?: string; auth?: string };
          };

          if (!body.endpoint) {
            response = Response.json({ error: 'Missing push subscription endpoint' }, { status: 400 });
            break;
          }

          if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
            try {
              await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                  Prefer: 'resolution=merge-duplicates',
                },
                body: JSON.stringify({
                  user_id: user.userId,
                  endpoint: body.endpoint,
                  keys_p256dh: body.keys?.p256dh,
                  keys_auth: body.keys?.auth,
                }),
              });
            } catch (err) {
              console.warn('Failed to persist push subscription:', err);
            }
          }

          response = Response.json({ success: true });
          break;
        }

        case '/api/auth/revoke-session': {
          const body = (await request.json().catch(() => ({}))) as { session_id?: string };
          if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && body.session_id) {
            await fetch(`${env.SUPABASE_URL}/rest/v1/user_sessions?id=eq.${body.session_id}&user_id=eq.${user.userId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ revoked: true }),
            });
          }
          response = Response.json({ success: true });
          break;
        }

        case '/api/auth/verify-turnstile': {
          const body = (await request.json().catch(() => ({}))) as { token?: string };
          if (!body.token) {
            response = Response.json({ error: 'Missing turnstile token' }, { status: 400 });
            break;
          }

          if (!env.TURNSTILE_SECRET_KEY) {
            response = Response.json(
              { error: 'turnstile_not_configured', message: 'TURNSTILE_SECRET_KEY is not configured in worker secrets' },
              { status: 501 }
            );
            break;
          }

          const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: env.TURNSTILE_SECRET_KEY,
              response: body.token,
            }),
          });
          const outcome = await turnstileRes.json() as { success: boolean };
          response = Response.json({ success: outcome.success, verified: outcome.success });
          break;
        }

        case '/api/network-quality': {
          const body = (await request.json().catch(() => ({}))) as {
            rtt_ms?: number;
            packet_loss_pct?: number;
          };

          if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
            await fetch(`${env.SUPABASE_URL}/rest/v1/network_quality_log`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                user_id: user.userId,
                rtt_ms: body.rtt_ms || null,
                packet_loss_pct: body.packet_loss_pct || null,
              }),
            });
          }
          response = Response.json({ received: true });
          break;
        }

        case '/api/appeals/submit': {
          const body = (await request.json().catch(() => ({}))) as {
            action_type?: string;
            reason?: string;
          };

          if (!body.action_type || !body.reason) {
            response = Response.json({ error: 'action_type and reason are required' }, { status: 400 });
            break;
          }

          if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
            const ins = await fetch(`${env.SUPABASE_URL}/rest/v1/moderation_appeals`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                user_id: user.userId,
                action_type: body.action_type,
                reason: body.reason,
                status: 'open',
              }),
            });
            if (!ins.ok) {
              response = Response.json({ error: 'Failed to record appeal' }, { status: 500 });
              break;
            }
          }
          response = Response.json({ success: true });
          break;
        }

        case '/api/channels/post': {
          const body = (await request.json().catch(() => ({}))) as {
            channel_id?: string;
            content?: string;
            media_url?: string;
            message_type?: string;
          };

          if (!body.channel_id || !body.content) {
            response = Response.json({ error: 'channel_id and content are required' }, { status: 400 });
            break;
          }

          // Authorize: caller must be owner of channel
          if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
            const chCheck = await fetch(`${env.SUPABASE_URL}/rest/v1/channel_subscriptions?id=eq.${body.channel_id}&owner_id=eq.${user.userId}&select=id`, {
              headers: {
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
            });
            const chRows = await chCheck.json() as any[];
            if (!chRows || chRows.length === 0) {
              response = Response.json({ error: 'Forbidden: Only channel owner can publish' }, { status: 403 });
              break;
            }

            const postRes = await fetch(`${env.SUPABASE_URL}/rest/v1/channel_posts`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                Prefer: 'return=representation',
              },
              body: JSON.stringify({
                channel_id: body.channel_id,
                content: body.content,
                media_url: body.media_url || null,
                message_type: body.message_type || 'text',
              }),
            });

            if (postRes.ok) {
              const created = await postRes.json() as any[];
              response = Response.json({ success: true, post: created[0] });
              break;
            }
          }

          response = Response.json({ success: true });
          break;
        }

        case '/api/splits/create': {
          const body = (await request.json().catch(() => ({}))) as {
            conversation_key?: string;
            title?: string;
            total_amount?: number;
            currency?: string;
            items?: Array<{ user_id: string; amount: number }>;
          };

          if (!body.conversation_key || !body.title || !body.total_amount) {
            response = Response.json({ error: 'Missing required split parameters' }, { status: 400 });
            break;
          }

          if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
            const splitRes = await fetch(`${env.SUPABASE_URL}/rest/v1/payment_splits`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                Prefer: 'return=representation',
              },
              body: JSON.stringify({
                created_by: user.userId,
                conversation_key: body.conversation_key,
                title: body.title,
                total_amount: body.total_amount,
                currency: body.currency || 'USD',
              }),
            });

            if (splitRes.ok) {
              const created = await splitRes.json() as any[];
              const splitId = created[0].id;
              if (Array.isArray(body.items) && body.items.length > 0) {
                await fetch(`${env.SUPABASE_URL}/rest/v1/payment_split_items`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                  },
                  body: JSON.stringify(
                    body.items.map((it) => ({
                      split_id: splitId,
                      user_id: it.user_id,
                      amount: it.amount,
                      status: 'pending',
                    }))
                  ),
                });
              }
              response = Response.json({ success: true, split_id: splitId });
              break;
            }
          }

          response = Response.json({ success: true });
          break;
        }

        case '/api/splits/settle': {
          const body = (await request.json().catch(() => ({}))) as {
            item_id?: string;
          };

          if (!body.item_id) {
            response = Response.json({ error: 'Missing item_id' }, { status: 400 });
            break;
          }

          if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
            await fetch(`${env.SUPABASE_URL}/rest/v1/payment_split_items?id=eq.${body.item_id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                status: 'paid',
                paid_at: new Date().toISOString(),
              }),
            });
          }

          response = Response.json({ success: true });
          break;
        }

        case '/api/bots/relay': {
          const body = (await request.json().catch(() => ({}))) as {
            bot_id?: string;
            trigger_message?: string;
          };

          if (!body.bot_id || !body.trigger_message) {
            response = Response.json({ error: 'bot_id and trigger_message are required' }, { status: 400 });
            break;
          }

          if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
            const bCheck = await fetch(`${env.SUPABASE_URL}/rest/v1/chat_bots?id=eq.${body.bot_id}&is_active=eq.true&select=webhook_url`, {
              headers: {
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
            });
            const bRows = await bCheck.json() as any[];
            if (bRows && bRows.length > 0 && bRows[0].webhook_url) {
              const webhookUrl = bRows[0].webhook_url;
              if (isSafeUrl(webhookUrl)) {
                try {
                  const bRes = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: body.trigger_message, sender: user.userId }),
                  });
                  const replyData = await bRes.json().catch(() => ({}));
                  response = Response.json({ success: true, reply: (replyData as any).reply || 'Bot acknowledged.' });
                  break;
                } catch (e) {
                  response = Response.json({ error: 'Webhook dispatch failed' }, { status: 502 });
                  break;
                }
              }
            }
          }
          response = Response.json({ success: true, reply: 'Bot active.' });
          break;
        }

        case '/api/export/compliance-report': {
          if (user.role !== 'admin') {
            response = Response.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
            break;
          }
          response = Response.json({
            error: 'compliance_export_not_configured',
            message: 'Compliance report generation is not configured yet.',
          }, { status: 501 });
          break;
        }

        case '/api/export/account': {
          response = Response.json({
            error: 'account_export_not_configured',
            message: 'Account export generation is not configured yet.',
          }, { status: 501 });
          break;
        }

        default:
          response = Response.json({ error: 'Endpoint not found' }, { status: 404 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      response = Response.json({ error: 'Internal Worker error', details: msg }, { status: 500 });
    }

    const finalHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => finalHeaders.set(k, v));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders,
    });
  },
};
