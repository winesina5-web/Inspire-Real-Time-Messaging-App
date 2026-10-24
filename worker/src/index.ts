import { Env, handleMediaUpload, handleDownloadUrl } from './media';
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
} from './ai';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    const user = await verifySupabaseJwt(authHeader, env.SUPABASE_JWT_SECRET);

    if (!user) {
      return Response.json(
        { error: 'Unauthorized: Missing or invalid Supabase JWT' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    let response: Response;

    try {
      switch (url.pathname) {
        // Media routes
        case '/api/media/upload':
          response = await handleMediaUpload(request, env, user);
          break;
        case '/api/media/download-url':
          response = await handleDownloadUrl(request, env, user);
          break;

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

        case '/api/calls/turn-credentials':
          response = Response.json({
            iceServers: [
              { urls: 'stun:stun.cloudflare.com:3478' },
              { urls: 'stun:stun.l.google.com:19302' },
            ],
          });
          break;

        case '/api/link-preview': {
          const body = (await request.json().catch(() => ({}))) as { url?: string };
          const link = body.url || '';
          response = Response.json({
            url: link,
            title: 'Inspire Link Preview',
            description: `Live preview for ${link}`,
            image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
          });
          break;
        }

        case '/api/gif-search': {
          response = Response.json({
            gifs: [
              'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
              'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
              'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif',
            ],
          });
          break;
        }

        case '/api/export/chat': {
          response = Response.json({
            download_url: 'data:text/plain;charset=utf-8,--- Inspire Chat Export ---',
          });
          break;
        }

        case '/api/push/subscribe': {
          response = Response.json({ success: true });
          break;
        }

        case '/api/auth/revoke-session': {
          response = Response.json({ success: true });
          break;
        }

        case '/api/auth/verify-turnstile': {
          const body = (await request.json().catch(() => ({}))) as { token?: string };
          response = Response.json({ success: true, verified: Boolean(body.token) });
          break;
        }

        case '/api/export/account': {
          response = Response.json({
            status: 'completed',
            user_id: user.userId,
            generated_at: new Date().toISOString(),
            download_url: `https://pub-r2.inspire.app/exports/${user.userId}_archive.json`,
          });
          break;
        }

        // Wave 2 Routes (Document 09)
        case '/api/ai/sentiment': {
          response = Response.json({
            mood_label: 'Lighthearted & Productive',
            mood_emoji: '✨',
            breakdown: { positive: 68, neutral: 22, negative: 10 },
            gradient_start: '#0E2A6E',
            gradient_end: '#FFD700',
          });
          break;
        }

        case '/api/ai/smart-compose': {
          const body = (await request.json().catch(() => ({}))) as { partial_text?: string; mode?: string };
          if (body.mode === 'grammar_fix') {
            const txt = (body.partial_text || '').trim();
            response = Response.json({ completion: txt.charAt(0).toUpperCase() + txt.slice(1) });
          } else if (body.mode === 'group_name') {
            response = Response.json({ suggestions: ['Inspire Innovators 🚀', 'NextGen Collaboration 💡', 'Core Project Sync 🎯'] });
          } else {
            response = Response.json({ completion: 'great plan to me, let us proceed!' });
          }
          break;
        }

        case '/api/ai/image-enhance': {
          response = Response.json({
            success: true,
            enhanced_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
          });
          break;
        }

        case '/api/ai/auto-caption': {
          response = Response.json({
            vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:03.500\n[Inspire Video Caption]\n\n00:00:03.500 --> 00:00:07.000\nDemonstrating real-time communication on Inspire.',
          });
          break;
        }

        case '/api/bots/relay': {
          response = Response.json({ success: true, reply: 'Bot received trigger and dispatched webhook.' });
          break;
        }

        case '/api/channels/post': {
          response = Response.json({ success: true, post_id: `post_${Date.now()}` });
          break;
        }

        case '/api/splits/create': {
          response = Response.json({ success: true, split_id: `split_${Date.now()}` });
          break;
        }

        case '/api/splits/settle': {
          response = Response.json({ success: true });
          break;
        }

        case '/api/music-preview': {
          response = Response.json({
            track_name: 'Inspire Waves',
            artist: 'Sound Collective',
            album_art_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
            preview_url: 'https://actions.google.com/sounds/v1/science_fiction/ambient_hum_medium.ogg',
            platform: 'spotify',
          });
          break;
        }

        case '/api/appeals/submit': {
          response = Response.json({ success: true });
          break;
        }

        case '/api/analytics/conversation': {
          response = Response.json({
            sent_count: 42,
            received_count: 38,
            most_active_hour: '2:00 PM – 4:00 PM',
            top_words: ['inspire', 'great', 'project', 'ready', 'update'],
            top_emojis: ['🔥', '✨', '👍', '❤️', '🚀'],
            streak_days: 7,
            avg_response_minutes: 3,
          });
          break;
        }

        case '/api/export/compliance-report': {
          response = Response.json({
            download_url: 'data:text/plain;charset=utf-8,--- Inspire Administrative Compliance Report ---',
          });
          break;
        }

        case '/api/network-quality': {
          response = Response.json({ received: true });
          break;
        }

        default:
          response = Response.json({ error: 'Endpoint not found' }, { status: 404 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      response = Response.json({ error: 'Internal Worker error', details: msg }, { status: 500 });
    }

    const newHeaders = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
