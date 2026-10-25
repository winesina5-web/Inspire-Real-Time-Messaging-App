const MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const DEFAULT_ORIGINS = [
  'https://inspire-real-time-messaging-app.pages.dev',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = [...DEFAULT_ORIGINS, ...(env.ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean)];
  const headers = new Headers({
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  });
  if (origin && allowed.includes(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(data, status = 200, headers) {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers: h });
}

async function requireUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth },
  });
  if (!response.ok) return null;
  return await response.json();
}

async function ask(env, system, prompt, maxTokens = 180) {
  if (!env.AI) throw new Error('Workers AI binding is missing on inspire-worker.');
  const result = await env.AI.run(MODEL, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt.slice(0, 12000) }],
    max_tokens: maxTokens,
  });
  const text = typeof result?.response === 'string' ? result.response : '';
  if (!text.trim()) throw new Error('Workers AI returned an empty response.');
  return text.trim();
}

function parseJson(text, fallback) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* use fallback */ }
    }
    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      try { return JSON.parse(cleaned.slice(objectStart, objectEnd + 1)); } catch { /* use fallback */ }
    }
    return fallback;
  }
}

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ status: 'ok', worker: 'inspire-worker', ai_bound: Boolean(env.AI), time: new Date().toISOString() }, 200, headers);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers);

    const user = await requireUser(request, env).catch(() => null);
    if (!user?.id) return json({ error: 'Unauthorized: valid Supabase session required' }, 401, headers);

    const contentType = request.headers.get('Content-Type') || '';
    let formData = null;
    let body = {};
    if (contentType.toLowerCase().includes('multipart/form-data')) {
      formData = await request.formData().catch(() => null);
    } else {
      body = await request.json().catch(() => ({}));
    }
    try {
      switch (url.pathname) {
        case '/api/ai/smart-reply': {
          const text = String(body.message_text || '').trim();
          if (!text) return json({ suggestions: [] }, 200, headers);
          const output = await ask(env, 'Suggest exactly 3 concise, natural replies, each under 8 words. Return only a JSON array of strings.', text, 100);
          return json({ suggestions: parseJson(output, output.split('\n').filter(Boolean).slice(0, 3)) }, 200, headers);
        }
        case '/api/ai/assistant': {
          const messages = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
          const reply = await ask(env, 'You are Inspire Assistant, a concise and helpful assistant inside a messaging app.', messages.map((m) => `${m.role || 'user'}: ${String(m.content || '')}`).join('\n'), 220);
          return json({ reply }, 200, headers);
        }
        case '/api/ai/summarize': {
          const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
          const summary = await ask(env, 'Summarize the conversation in concise bullet points. Do not invent details.', messages.map((m) => `${m.sender || 'User'}: ${m.content || ''}`).join('\n'), 180);
          return json({ summary }, 200, headers);
        }
        case '/api/ai/translate': {
          const text = String(body.message_text || '');
          const target = String(body.target_lang || 'en').slice(0, 30);
          const translated_text = await ask(env, `Translate the user's text into language code/name ${target}. Return only the translation.`, text, 220);
          return json({ translated_text }, 200, headers);
        }
        case '/api/ai/smart-search': {
          const query = String(body.query || '').toLowerCase();
          const messages = Array.isArray(body.messages) ? body.messages.slice(0, 100) : [];
          const matching_ids = messages.filter((m) => String(m.content || '').toLowerCase().includes(query)).map((m) => m.id).filter(Boolean).slice(0, 20);
          return json({ matching_ids }, 200, headers);
        }
        case '/api/ai/moderate': {
          const content = String(body.content || '');
          const output = await ask(env, 'Classify content safety. Return JSON only: {"verdict":"safe"|"flagged_for_review","confidence":0..1}. Flag clear harassment, threats, hate, exploitation, or spam.', content, 60);
          return json(parseJson(output, { verdict: 'flagged_for_review', confidence: 0.5 }), 200, headers);
        }
        case '/api/ai/emoji-suggest': {
          const output = await ask(env, 'Suggest up to 5 relevant emoji for this message. Return only a JSON array of emoji strings.', String(body.message_text || ''), 60);
          return json({ emojis: parseJson(output, ['🙂']) }, 200, headers);
        }
        case '/api/ai/tone-check': {
          const output = await ask(env, 'Analyze message tone. Return JSON only with keys tone, suggestion, isPositive (boolean).', String(body.text || ''), 80);
          return json(parseJson(output, { tone: 'neutral', suggestion: '', isPositive: true }), 200, headers);
        }
        case '/api/ai/categorize-chat': {
          const output = await ask(env, 'Choose exactly one category from Work, Personal, Family, Projects, Urgent, General. Return only the category.', (Array.isArray(body.messages) ? body.messages : []).join('\n'), 30);
          return json({ folder: output.replace(/[^a-zA-Z ]/g, '').trim().slice(0, 30) || 'General' }, 200, headers);
        }
        case '/api/ai/notification-summary': {
          const count = Math.max(0, Number(body.unread_count) || 0);
          const summary = await ask(env, 'Write one friendly short notification summary without exposing sensitive data.', `Unread messages: ${count}. Samples: ${(body.samples || []).slice(0, 5).join('; ')}`, 60);
          return json({ summary }, 200, headers);
        }
        case '/api/ai/extract-events': {
          const output = await ask(env, 'Extract calendar events from this text. Return only JSON array of objects with title, time, description. If none, return [].', String(body.text || ''), 160);
          return json({ events: parseJson(output, []) }, 200, headers);
        }
        case '/api/ai/sentiment': {
          const output = await ask(env, 'Analyze conversation mood. Return JSON only: {"mood_label":"short label","mood_emoji":"emoji","breakdown":{"positive":0,"neutral":0,"negative":0},"gradient_start":"#0E2A6E","gradient_end":"#FFD700"}. Percentages total 100.', (Array.isArray(body.messages) ? body.messages : []).join('\n'), 100);
          return json(parseJson(output, { mood_label: 'Neutral', mood_emoji: '💬', breakdown: { positive: 33, neutral: 34, negative: 33 }, gradient_start: '#0E2A6E', gradient_end: '#FFD700' }), 200, headers);
        }
        case '/api/ai/smart-compose': {
          const partial = String(body.partial_text || '');
          const system = body.mode === 'grammar_fix' ? 'Correct grammar and punctuation only. Return corrected text only.' : 'Continue the user draft naturally. Return only the suggested continuation.';
          return json({ completion: await ask(env, system, partial, 100) }, 200, headers);
        }
        case '/api/ai/voice-summary': {
          const summary = await ask(env, 'Summarize this voice-note transcript in one or two sentences.', String(body.transcript || ''), 100);
          return json({ summary }, 200, headers);
        }
        case '/api/ai/transcribe':
        case '/api/ai/auto-caption': {
          const file = formData?.get('file');
          if (!(file instanceof File)) return json({ error: 'Expected multipart/form-data with a media file.' }, 400, headers);
          if (file.size > 20 * 1024 * 1024) return json({ error: 'Media exceeds the 20 MB transcription limit.' }, 413, headers);
          if (!env.AI) return json({ error: 'Workers AI binding is missing.' }, 503, headers);
          const bytes = new Uint8Array(await file.arrayBuffer());
          const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: Array.from(bytes) });
          const transcript = String(result?.text || result?.transcription || '').trim();
          if (url.pathname === '/api/ai/auto-caption') {
            const safeTranscript = transcript.replace(/-->/g, '—>').replace(/\r?\n/g, ' ').trim();
            const vtt = safeTranscript ? `WEBVTT\\n\\n00:00:00.000 --> 00:00:30.000\\n${safeTranscript}\\n` : 'WEBVTT\\n';
            return json({ vtt, transcript }, 200, headers);
          }
          return json({ transcript }, 200, headers);
        }
        case '/api/ai/image-enhance':
        case '/api/image/enhance': {
          return json({ error: 'Image enhancement model is not enabled for this account yet.' }, 501, headers);
        }
        case '/api/export/chat': {
          const partnerId = String(body.partner_id || '');
          if (!partnerId) return json({ error: 'partner_id is required' }, 400, headers);
          const query = new URLSearchParams({
            select: 'created_at,sender_id,content,message_type,media_name',
            or: `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`,
            order: 'created_at.asc',
          });
          const response = await fetch(`${env.SUPABASE_URL}/rest/v1/messages?${query.toString()}`, {
            headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: request.headers.get('Authorization') || '', Accept: 'application/json' },
          });
          if (!response.ok) return json({ error: 'Could not export this conversation.' }, 502, headers);
          const messages = await response.json();
          const output = body.format === 'json' ? JSON.stringify(messages, null, 2) : messages.map((message) => `[${message.created_at}] ${message.sender_id === user.id ? 'You' : 'Contact'}: ${message.content || `[${message.message_type || 'media'}: ${message.media_name || ''}]`}`).join('\\n');
          const bytes = new TextEncoder().encode(output);
          let binary = '';
          for (const byte of bytes) binary += String.fromCharCode(byte);
          const mime = body.format === 'json' ? 'application/json' : 'text/plain';
          return json({ download_url: `data:${mime};base64,${btoa(binary)}` }, 200, headers);
        }
        case '/api/appeals/submit': {
          const actionType = String(body.action_type || '').slice(0, 100);
          const reason = String(body.reason || '').trim().slice(0, 2000);
          if (!actionType || !reason) return json({ error: 'Action type and reason are required.' }, 400, headers);
          const response = await fetch(`${env.SUPABASE_URL}/rest/v1/moderation_appeals`, {
            method: 'POST',
            headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: request.headers.get('Authorization') || '', 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ user_id: user.id, action_type: actionType, reason, status: 'open' }),
          });
          return response.ok ? json({ success: true }, 200, headers) : json({ error: 'Could not submit appeal.' }, 502, headers);
        }
        case '/api/export/compliance-report':
          return json({ error: 'Compliance report export is not implemented yet.' }, 501, headers);
        case '/api/calls/turn-credentials':
          return json({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }] }, 200, headers);
        case '/api/link-preview':
          return json({ error: 'Link preview endpoint is not included in this first deployment.' }, 501, headers);
        case '/api/gif-search':
          return json({ gifs: [] }, 200, headers);
        default:
          return json({ error: 'Endpoint not found', path: url.pathname }, 404, headers);
      }
    } catch (error) {
      return json({ error: 'AI request failed', details: error instanceof Error ? error.message : String(error) }, 502, headers);
    }
  },
};
