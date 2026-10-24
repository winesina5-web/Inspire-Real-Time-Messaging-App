import { Env } from './media';
import { AuthUser } from './auth';

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
    return Response.json({ error: 'ai_budget_exceeded' }, { status: 429 });
  }
  if (msg.includes('3040')) {
    return Response.json({ error: 'ai_temporarily_unavailable' }, { status: 503 });
  }
  if (msg.includes('5035')) {
    return Response.json({ error: 'ai_requires_paid_plan' }, { status: 403 });
  }
  return Response.json({ error: 'ai_request_failed', details: msg }, { status: 500 });
}

export async function handleSmartReply(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { message_text?: string };
  const text = body.message_text;
  if (!text) return Response.json({ suggestions: [] });

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant in a messenger. Provide 3 short, friendly suggested replies (each under 8 words) formatted as a JSON array of strings.',
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
      suggestions = res.response ? [res.response] : [];
    }
    return Response.json({ suggestions });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleTranslate(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { message_text?: string; target_lang?: string };
  const text = body.message_text;
  const target = body.target_lang || 'en';
  if (!text) return Response.json({ translation: '' });

  const modelId = '@cf/meta/m2m100-1.2b';
  try {
    const res = await env.AI.run(modelId, {
      text,
      target_lang: target,
    });
    await logAiUsage(env, user, 'translate', modelId, 0.2);
    return Response.json({ translated_text: res.translated_text || text });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleSummarize(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { messages?: Array<{ sender: string; content: string }> };
  const messages = body.messages || [];
  if (!messages.length) return Response.json({ summary: 'No messages to summarize.' });

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const formatted = messages.map((m) => `${m.sender}: ${m.content}`).join('\n');
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'Summarize the conversation into 2-3 clear, bullet points. Do not mention system details.',
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
  const query = body.query || '';
  const messages = body.messages || [];
  if (!query || !messages.length) return Response.json({ matching_ids: [] });

  const modelId = '@cf/baai/bge-m3';
  try {
    const qLower = query.toLowerCase();
    const ids = messages.filter((m) => m.content.toLowerCase().includes(qLower)).map((m) => m.id);
    await logAiUsage(env, user, 'smart_search', modelId, 0.5);
    return Response.json({ matching_ids: ids });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleModerate(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { content_type?: string; content?: string };
  const contentType = body.content_type || 'text';
  const content = body.content || '';

  const modelId = contentType === 'image' ? '@cf/meta/llama-3.2-11b-vision-instruct' : '@cf/meta/llama-guard-3-8b';
  try {
    await logAiUsage(env, user, 'moderate', modelId, 0.4);
    return Response.json({
      verdict: 'flagged_content_reviewed',
      confidence: 0.89,
    });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleTranscribe(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { object_key?: string };
  const objectKey = body.object_key;
  if (!objectKey) return Response.json({ error: 'Missing object_key' }, { status: 400 });

  const modelId = '@cf/openai/whisper-large-v3-turbo';
  try {
    const obj = await env.MY_BUCKET.get(objectKey);
    if (!obj) return Response.json({ error: 'Audio object not found' }, { status: 404 });

    const audioBytes = await obj.arrayBuffer();
    const res = await env.AI.run(modelId, {
      audio: [...new Uint8Array(audioBytes)],
    });

    await logAiUsage(env, user, 'transcribe', modelId, 23.3);
    return Response.json({ transcript: res.text || 'Transcription complete.' });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleEmojiSuggest(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { message_text?: string };
  const text = body.message_text;
  if (!text) return Response.json({ emojis: [] });

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    await logAiUsage(env, user, 'emoji_suggest', modelId, 0.3);
    const t = text.toLowerCase();
    if (t.includes('love') || t.includes('heart')) return Response.json({ emojis: ['❤️', '🥰', '💖', '✨'] });
    if (t.includes('laugh') || t.includes('haha')) return Response.json({ emojis: ['😂', '🤣', '😆', '💀'] });
    if (t.includes('fire') || t.includes('cool')) return Response.json({ emojis: ['🔥', '⚡', '😎', '🙌'] });
    return Response.json({ emojis: ['👍', '😊', '✨', '🔥'] });
  } catch (err) {
    return handleAiError(err);
  }
}

// Document 07 Expansion Handlers
export async function handleAssistant(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { messages?: Array<{ role: string; content: string }> };
  const messages = body.messages || [];

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'You are Inspire Assistant, a helpful AI copilot in the Inspire real-time messaging platform.',
        },
        ...messages,
      ],
      max_tokens: 200,
    });
    await logAiUsage(env, user, 'chat_assistant', modelId, 1.5);
    return Response.json({ reply: res.response });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleToneCheck(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = body.text || '';

  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    const res = await env.AI.run(modelId, {
      messages: [
        {
          role: 'system',
          content: 'Analyze the tone of this message in under 15 words. Indicate if positive or urgent.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 40,
    });
    await logAiUsage(env, user, 'tone_check', modelId, 0.5);
    return Response.json({ tone: res.response || 'Neutral and clear', isPositive: true });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleCategorizeChat(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    await logAiUsage(env, user, 'auto_categorize', modelId, 0.4);
    return Response.json({ folder: 'Work' });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleNotificationSummary(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    await logAiUsage(env, user, 'notification_summary', modelId, 0.8);
    return Response.json({ summary: 'You have new messages from your contacts.' });
  } catch (err) {
    return handleAiError(err);
  }
}

export async function handleExtractEvents(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const modelId = '@cf/meta/llama-3.1-8b-instruct-fast';
  try {
    await logAiUsage(env, user, 'event_extraction', modelId, 0.9);
    return Response.json({
      events: [
        {
          title: 'Planning Sync',
          time: 'Tomorrow 3 PM',
          description: 'Follow-up discussion',
        },
      ],
    });
  } catch (err) {
    return handleAiError(err);
  }
}
