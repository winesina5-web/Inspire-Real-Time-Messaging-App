import { Env } from './env';
import { AuthUser } from './auth';

/**
 * Checks if the daily AI neuron budget (10,000 neurons/day) has been exceeded.
 */
async function checkAiBudget(env: Env): Promise<boolean> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return true; // allow if tracking not configured

  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const qUrl = `${env.SUPABASE_URL}/rest/v1/ai_usage_log?created_at=gte.${encodeURIComponent(todayIso)}&select=estimated_neurons`;
    const res = await fetch(qUrl, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (res.ok) {
      const rows = (await res.json()) as Array<{ estimated_neurons: number }>;
      const total = rows.reduce((acc, r) => acc + (Number(r.estimated_neurons) || 0), 0);
      if (total >= 9500) {
        // Approaching or exceeding 10,000 neurons limit
        return false;
      }
    }
  } catch (err) {
    console.warn('Failed to verify daily AI budget:', err);
  }

  return true;
}

/**
 * Logs AI usage to Supabase ai_usage_log table.
 */
async function logAiUsage(
  env: Env,
  user: AuthUser,
  feature: string,
  modelId: string,
  estimatedNeurons: number
) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/ai_usage_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        user_id: user.userId,
        feature,
        model_id: modelId,
        estimated_neurons: estimatedNeurons,
      }),
    });
  } catch (err) {
    console.warn('Failed to log AI usage to Supabase:', err);
  }
}

function handleAiError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('3036')) {
    return Response.json({ error: 'ai_budget_exceeded', details: 'Daily neuron allocation reached.' }, { status: 429 });
  }
  if (msg.includes('3040')) {
    return Response.json({ error: 'ai_temporarily_unavailable', details: 'GPU capacity busy, please retry.' }, { status: 503 });
  }
  if (msg.includes('5035')) {
    return Response.json({ error: 'ai_requires_paid_plan', details: 'Selected model requires paid tier.' }, { status: 403 });
  }
  return Response.json({ error: 'ai_request_failed', details: msg }, { status: 500 });
}

export async function handleSmartReply(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { message_text?: string };
  const text = (body.message_text || '').trim();
  if (!text) return Response.json({ suggestions: [] });

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const budgetOk = await checkAiBudget(env);
  if (!budgetOk) {
    return Response.json({ error: 'ai_budget_exceeded' }, { status: 429 });
  }

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'You are an inline assistant in Inspire Messenger. Suggest 3 concise, natural replies (under 6 words each). Format output STRICTLY as a valid JSON array of 3 strings.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 60,
    });

    await logAiUsage(env, user, 'smart_reply', modelId, 0.8);
    let suggestions: string[] = [];
    try {
      suggestions = JSON.parse(res.response);
    } catch {
      suggestions = res.response ? res.response.split('\n').filter(Boolean).map((s: string) => s.replace(/^\d+[\.\-\)]\s*/, '').trim()).slice(0, 3) : [];
    }
    return Response.json({ suggestions });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleTranslate(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { message_text?: string; target_lang?: string };
  const text = (body.message_text || '').trim();
  const target = body.target_lang || 'en';
  if (!text) return Response.json({ translated_text: '' });

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const budgetOk = await checkAiBudget(env);
  if (!budgetOk) return Response.json({ error: 'ai_budget_exceeded' }, { status: 429 });

  const modelId = '@cf/meta/m2m100-1.2b';
  try {
    const res = await env.AI.run(modelId, {
      text,
      target_lang: target,
    });
    await logAiUsage(env, user, 'translate', modelId, 0.25);
    return Response.json({ translated_text: res.translated_text || text });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleSummarize(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { messages?: Array<{ sender: string; content: string }> };
  const messages = body.messages || [];
  if (!messages.length) return Response.json({ summary: 'No messages to summarize.' });

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const budgetOk = await checkAiBudget(env);
  if (!budgetOk) return Response.json({ error: 'ai_budget_exceeded' }, { status: 429 });

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const formatted = messages.slice(-30).map((m) => `${m.sender}: ${m.content}`).join('\n');
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'You are an executive summarizer in Inspire Messenger. Summarize the following conversation in 2-3 clear bullet points focusing on key agreements, questions, and decisions. Plain text with bullets.',
        },
        { role: 'user', content: formatted },
      ],
      max_tokens: 150,
    });
    await logAiUsage(env, user, 'summarize', modelId, 1.2);
    return Response.json({ summary: res.response });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleSmartSearch(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { query?: string; messages?: Array<{ id: string; content: string }> };
  const query = (body.query || '').trim();
  const messages = body.messages || [];
  if (!query || !messages.length) return Response.json({ matching_ids: [] });

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const budgetOk = await checkAiBudget(env);
  if (!budgetOk) return Response.json({ error: 'ai_budget_exceeded' }, { status: 429 });

  const modelId = '@cf/baai/bge-m3';
  try {
    // Generate embeddings for semantic similarity ranking
    const texts = [query, ...messages.slice(0, 20).map((m) => m.content)];
    const res = await env.AI.run(modelId, { text: texts });
    await logAiUsage(env, user, 'smart_search', modelId, 0.6);

    // Compute cosine similarity between query and candidate messages
    const queryVec = res.data[0];
    const scored = messages.slice(0, 20).map((m, idx) => {
      const vec = res.data[idx + 1];
      if (!vec) return { id: m.id, score: 0 };
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < queryVec.length; i++) {
        dot += queryVec[i] * vec[i];
        normA += queryVec[i] * queryVec[i];
        normB += vec[i] * vec[i];
      }
      const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
      return { id: m.id, score: similarity };
    });

    const matchingIds = scored
      .filter((s) => s.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.id);

    return Response.json({ matching_ids: matchingIds });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleModerate(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { content_type?: string; content?: string };
  const contentType = body.content_type || 'text';
  const content = body.content || '';

  if (!content) return Response.json({ verdict: 'safe', confidence: 1.0 });

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const modelId = contentType === 'image' ? '@cf/meta/llama-3.2-11b-vision-instruct' : '@cf/meta/llama-guard-3-8b';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'user',
          content: `Assess whether this content violates safety guidelines (hate speech, violence, harassment, sexual exploitation, or spam): "${content}"`,
        },
      ],
      max_tokens: 50,
    });
    await logAiUsage(env, user, 'moderate', modelId, 0.4);
    const resp = (res.response || '').toLowerCase();
    const isUnsafe = resp.includes('unsafe') || resp.includes('violat') || resp.includes('flag');
    return Response.json({
      verdict: isUnsafe ? 'flagged_harmful' : 'safe',
      confidence: isUnsafe ? 0.92 : 0.98,
      details: res.response,
    });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleTranscribe(request: Request, env: Env, user: AuthUser): Promise<Response> {
  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const candidate = formData.get('file');
    if (candidate instanceof File) file = candidate;
  } catch {
    return Response.json({ error: 'Expected multipart/form-data with an audio file' }, { status: 400 });
  }
  if (!file) return Response.json({ error: 'Missing audio file' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) {
    return Response.json({ error: 'Audio file exceeds the 20 MB limit' }, { status: 413 });
  }
  if (file.type && !file.type.startsWith('audio/') && !['video/mp4', 'video/webm', 'application/octet-stream'].includes(file.type)) {
    return Response.json({ error: 'Unsupported audio media type' }, { status: 415 });
  }

  const budgetOk = await checkAiBudget(env);
  if (!budgetOk) return Response.json({ error: 'ai_budget_exceeded' }, { status: 429 });
  const modelId = '@cf/openai/whisper-large-v3-turbo';
  try {
    const audioBytes = await file.arrayBuffer();
    const res = await env.AI.run(modelId, { audio: [...new Uint8Array(audioBytes)] });
    await logAiUsage(env, user, 'transcribe', modelId, 23.3);
    return Response.json({ transcript: res.text || 'Transcription complete.' });
  } catch (err) {
    return handleAiError(err);
  }
}
export async function handleEmojiSuggest(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { message_text?: string; mode?: string; available_sticker_shortcodes?: string[] };
  const text = (body.message_text || '').trim();
  if (!text) return Response.json({ emojis: [] });

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    if (body.mode === 'sticker' && Array.isArray(body.available_sticker_shortcodes)) {
      const candidates = body.available_sticker_shortcodes.slice(0, 15).join(', ');
      const res = await env.AI.run(modelId, {
        messages: [
          {
            role: 'system',
            content: `Select up to 4 most relevant stickers from: [${candidates}] that best fit the message. Return strictly a JSON array of shortcodes.`,
          },
          { role: 'user', content: text },
        ],
        max_tokens: 60,
      });
      await logAiUsage(env, user, 'emoji_suggest', modelId, 0.25);
      try {
        const stickers = JSON.parse(res.response);
        return Response.json({ stickers });
      } catch {
        return Response.json({ stickers: body.available_sticker_shortcodes.slice(0, 4) });
      }
    }

    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'Suggest 4 emoji relevant to the user message. Output strictly a JSON array of 4 emoji characters, e.g. ["👍", "🔥", "✨", "❤️"].',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 30,
    });
    await logAiUsage(env, user, 'emoji_suggest', modelId, 0.3);
    let emojis = ['👍', '😊', '✨', '🔥'];
    try {
      emojis = JSON.parse(res.response);
    } catch {
      // fallback
    }
    return Response.json({ emojis });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleAssistant(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { messages?: Array<{ role: string; content: string }> };
  const messages = body.messages || [];

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const budgetOk = await checkAiBudget(env);
  if (!budgetOk) return Response.json({ error: 'ai_budget_exceeded' }, { status: 429 });

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'You are Inspire Assistant, a knowledgeable AI companion inside Inspire Messenger. Help users coordinate events, formulate clear thoughts, and optimize discussions concisely.',
        },
        ...messages.slice(-10),
      ],
      max_tokens: 220,
    });
    await logAiUsage(env, user, 'chat_assistant', modelId, 1.5);
    return Response.json({ reply: res.response });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleToneCheck(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = (body.text || '').trim();
  if (!text) return Response.json({ tone: 'Empty message', isPositive: true });

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'Analyze message tone. Return a JSON object with: { "tone": "...", "suggestion": "...", "isPositive": boolean }',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 60,
    });
    await logAiUsage(env, user, 'tone_check', modelId, 0.4);
    try {
      const parsed = JSON.parse(res.response);
      return Response.json(parsed);
    } catch {
      return Response.json({ tone: res.response, isPositive: true });
    }
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleCategorizeChat(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { messages?: string[] };
  const messages = body.messages || [];

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'Given recent chat snippets, suggest one folder label from: [Work, Personal, Family, Projects, Urgent, General]. Reply with ONLY the folder name word.',
        },
        { role: 'user', content: messages.slice(-10).join('\n') },
      ],
      max_tokens: 15,
    });
    await logAiUsage(env, user, 'auto_categorize', modelId, 0.4);
    const folder = (res.response || 'General').trim().replace(/[^a-zA-Z]/g, '') || 'General';
    return Response.json({ folder });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleNotificationSummary(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { unread_count?: number; samples?: string[] };
  const unreadCount = body.unread_count || 1;
  const samples = body.samples || [];

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'Provide a 1-sentence friendly notification summary for unread messages without revealing sensitive passwords or tokens.',
        },
        { role: 'user', content: `Unread count: ${unreadCount}. Message snippets: ${samples.slice(0, 5).join('; ')}` },
      ],
      max_tokens: 50,
    });
    await logAiUsage(env, user, 'notification_summary', modelId, 0.6);
    return Response.json({ summary: res.response });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleExtractEvents(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = (body.text || '').trim();

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'Extract calendar events/meetings mentioned in text. Output strictly a JSON array of objects with keys: "title", "time", "description". If none found, output [].',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 150,
    });
    await logAiUsage(env, user, 'event_extraction', modelId, 0.9);
    try {
      const events = JSON.parse(res.response);
      return Response.json({ events });
    } catch {
      return Response.json({ events: [] });
    }
  } catch (err) {
    return handleAiError(err);
  }
}

// Wave 2 AI Handlers (Document 09)
export async function handleSentiment(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { messages?: string[] };
  const messages = body.messages || [];

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: `Analyze the mood of these conversation messages. Output JSON strictly with:
{
  "mood_label": "e.g. Lighthearted & Productive",
  "mood_emoji": "emoji",
  "breakdown": { "positive": 70, "neutral": 20, "negative": 10 },
  "gradient_start": "#0E2A6E",
  "gradient_end": "#FFD700"
}`,
        },
        { role: 'user', content: messages.slice(-30).join('\n') },
      ],
      max_tokens: 100,
    });
    await logAiUsage(env, user, 'sentiment', modelId, 1.2);
    try {
      const parsed = JSON.parse(res.response);
      return Response.json(parsed);
    } catch {
      return Response.json({
        mood_label: 'Balanced & Engaged',
        mood_emoji: '✨',
        breakdown: { positive: 65, neutral: 25, negative: 10 },
        gradient_start: '#0E2A6E',
        gradient_end: '#FFD700',
      });
    }
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleSmartCompose(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    partial_text?: string;
    conversation_context?: string[];
    mode?: string;
    member_names?: string[];
  };

  if (!env.AI || typeof env.AI.run !== 'function') {
    return Response.json({ error: 'Workers AI binding unavailable' }, { status: 503 });
  }

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    if (body.mode === 'grammar_fix') {
      const res = await env.AI.run(modelId, {
        messages: [
          {
            role: 'system',
            content: 'Fix grammar, punctuation, and capitalization only. Return strictly the corrected text with no extra commentary.',
          },
          { role: 'user', content: body.partial_text || '' },
        ],
        max_tokens: 80,
      });
      await logAiUsage(env, user, 'smart_compose', modelId, 0.3);
      return Response.json({ completion: res.response?.trim() || body.partial_text });
    }

    if (body.mode === 'group_name') {
      const res = await env.AI.run(modelId, {
        messages: [
          {
            role: 'system',
            content: 'Suggest 3 creative group chat names based on members/topic. Return strictly a JSON array of 3 string names (under 20 characters each with an emoji).',
          },
          { role: 'user', content: `Members: ${(body.member_names || []).join(', ')}` },
        ],
        max_tokens: 60,
      });
      await logAiUsage(env, user, 'smart_compose', modelId, 0.3);
      try {
        const suggestions = JSON.parse(res.response);
        return Response.json({ suggestions });
      } catch {
        return Response.json({ suggestions: ['Inspire Sync 🚀', 'Team Horizon 💡', 'Core Chat 🎯'] });
      }
    }

    // Default smart-compose sentence completion
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'You are an autocomplete assistant. Continue the user\'s partial message in 4 to 10 words. Return only the continuation text, no quotation marks.',
        },
        { role: 'user', content: body.partial_text || '' },
      ],
      max_tokens: 25,
    });
    await logAiUsage(env, user, 'smart_compose', modelId, 0.4);
    return Response.json({ completion: res.response?.trim() || '' });
  } catch (err) {
    return handleAiError(err);
  }
}
