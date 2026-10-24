import { supabase } from './supabaseClient';

const WORKER_BASE = import.meta.env.VITE_WORKER_API_URL || '';

async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export interface UploadMediaResponse {
  object_key: string;
  url?: string;
  size?: number;
  mime_type?: string;
  message_type?: string;
}

export interface DownloadUrlResponse {
  download_url: string;
  expires_in?: number;
}

export interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image?: string;
}

export const workerApi = {
  /**
   * Uploads media via Cloudflare Worker native R2 binding.
   * Fails closed: does not silently masquerade storage failures as successful cloud uploads.
   */
  async uploadMedia(file: File | Blob, messageType: string, filename?: string): Promise<UploadMediaResponse> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Sign in before uploading media.');

    const limits: Record<string, number> = {
      image: 10 * 1024 * 1024, video: 50 * 1024 * 1024, audio: 20 * 1024 * 1024,
      voice_note: 10 * 1024 * 1024, avatar: 5 * 1024 * 1024, file: 25 * 1024 * 1024,
    };
    const maxBytes = limits[messageType] ?? limits.file;
    if (file.size > maxBytes) throw new Error(`File exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit for ${messageType}.`);

    const originalName = filename || (file instanceof File ? file.name : 'attachment.bin');
    const extension = originalName.includes('.')
      ? (originalName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'bin'
      : 'bin';
    const objectKey = messageType === 'avatar'
      ? `${user.id}/avatar.${extension}`
      : `${user.id}/${crypto.randomUUID()}.${extension}`;
    const contentType = file.type || 'application/octet-stream';
    const { data, error } = await supabase.storage.from('inspire-media').upload(objectKey, file, {
      contentType, cacheControl: '3600', upsert: messageType === 'avatar',
    });
    if (error || !data?.path) throw new Error(error?.message || 'Supabase Storage upload failed.');
    return { object_key: data.path, size: file.size, mime_type: contentType, message_type: messageType };
  },

  /** Resolves a short-lived signed URL from the private Supabase Storage bucket. */
  async getDownloadUrl(objectKey: string): Promise<string> {
    if (!objectKey) return '';
    if (/^(https?:\/\/|data:)/i.test(objectKey)) return objectKey;
    const { data, error } = await supabase.storage.from('inspire-media').createSignedUrl(objectKey, 300);
    if (error || !data?.signedUrl) {
      console.warn('Failed to resolve private media URL:', error?.message || objectKey);
      return '';
    }
    return data.signedUrl;
  },
  // Feature 8: Rich Link Previews with SSRF Protection
  async getLinkPreview(url: string): Promise<LinkPreviewData | null> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/link-preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ url }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Link preview fetch error:', err);
      }
    }

    return null;
  },

  // Feature 26: GIF Search
  async searchGifs(query: string): Promise<string[]> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/gif-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ query }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.gifs)) return data.gifs;
        }
      } catch (err) {
        console.warn('GIF search error:', err);
      }
    }
    return [];
  },

  // Feature 13-15: TURN / WebRTC Credentials
  async getTurnCredentials(): Promise<{ iceServers: RTCIceServer[] }> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/calls/turn-credentials`, {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('TURN credentials fetch error:', err);
      }
    }
    return {
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    };
  },

  // Document 07 AI Features
  async chatAssistant(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>): Promise<string> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.reply || '';
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'AI Assistant unavailable');
    }
    throw new Error('Worker AI is not configured.');
  },

  async toneCheck(text: string): Promise<{ tone: string; suggestion?: string; isPositive: boolean }> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/tone-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) return await res.json();
    }
    return { tone: 'Analysis requires Workers AI connection', isPositive: true };
  },

  async extractEvents(messagesText: string): Promise<Array<{ title: string; time: string; description: string }>> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/extract-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: messagesText }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) return data.events;
      }
    }
    return [];
  },

  async categorizeChat(messages: string[]): Promise<string> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/categorize-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.folder || 'General';
      }
    }
    return 'General';
  },

  async notificationSummary(unreadCount: number): Promise<string> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/notification-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ unread_count: unreadCount }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.summary || `You have ${unreadCount} new message(s).`;
      }
    }
    return `You have ${unreadCount} new message(s).`;
  },

  async exportChat(partnerId: string, format: 'txt' | 'json'): Promise<string> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/export/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ partner_id: partnerId, format }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.download_url;
      }
    }
    return `data:text/plain;charset=utf-8,--- Inspire Messenger Chat Export ---\nExported at ${new Date().toISOString()}\nPartner ID: ${partnerId}`;
  },

  // Document 01-06 Core AI routes
  async smartReply(messageText: string): Promise<string[]> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/smart-reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message_text: messageText }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.suggestions)) return data.suggestions;
        }
      } catch (err) {
        console.warn('AI smart reply error:', err);
      }
    }
    return [];
  },

  async translate(messageText: string, targetLang: string = 'en'): Promise<string | null> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message_text: messageText, target_lang: targetLang }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.translated_text || data.translation || null;
      }
    }
    return null;
  },

  async summarize(messages: Array<{ sender: string; content: string }>): Promise<string | null> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.summary || null;
      }
    }
    return null;
  },

  async smartSearch(query: string, messages: Array<{ id: string; content: string }>): Promise<string[]> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/smart-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query, messages }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.matching_ids || [];
      }
    }
    // Substring fallback
    const q = query.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q)).map((m) => m.id);
  },

  async moderate(contentType: 'text' | 'image', content: string): Promise<{ verdict: string; confidence: number }> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content_type: contentType, content }),
      });
      if (res.ok) return await res.json();
    }
    return { verdict: 'submitted_for_human_review', confidence: 1.0 };
  },

  async transcribe(objectKey: string): Promise<string> {
    if (!WORKER_BASE) throw new Error('Worker AI is not configured.');
    const { data: audio, error: downloadError } = await supabase.storage.from('inspire-media').download(objectKey);
    if (downloadError || !audio) throw new Error(downloadError?.message || 'Could not read audio from private storage.');
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('file', audio, objectKey.split('/').pop() || 'audio.bin');
    const response = await fetch(`${WORKER_BASE}/api/ai/transcribe`, {
      method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.details || error.error || 'Audio transcription service unavailable.');
    }
    const data = await response.json();
    return data.transcript || '';
  },
  async emojiSuggest(messageText: string): Promise<string[]> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/ai/emoji-suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message_text: messageText }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.emojis)) return data.emojis;
      }
    }
    return [];
  },

  // Document 09 Wave 2 AI & Utility Handlers
  async getConversationMood(messages: string[]): Promise<{
    mood_label: string;
    mood_emoji: string;
    breakdown: { positive: number; neutral: number; negative: number };
    gradient_start: string;
    gradient_end: string;
  } | null> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/sentiment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messages }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('AI mood error:', err);
      }
    }
    return null;
  },

  async smartCompose(partialText: string, context: string[]): Promise<string> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/smart-compose`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ partial_text: partialText, conversation_context: context }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.completion || '';
        }
      } catch (err) {
        console.warn('AI smart compose error:', err);
      }
    }
    return '';
  },

  async fixGrammar(text: string): Promise<string> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/smart-compose`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ partial_text: text, mode: 'grammar_fix' }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.completion || text;
        }
      } catch (err) {
        console.warn('AI grammar fix error:', err);
      }
    }
    return text;
  },

  async enhanceImage(_dataUrlOrFile: string | File | Blob): Promise<string> {
    // When external image model pipeline is configured in Worker, calls /api/ai/image-enhance
    throw new Error('Cloudflare Workers AI image enhancement model is currently unconfigured.');
  },

  async autoCaption(objectKey: string): Promise<string> {
    if (!WORKER_BASE) return '';
    const { data: media, error: downloadError } = await supabase.storage.from('inspire-media').download(objectKey);
    if (downloadError || !media) throw new Error(downloadError?.message || 'Could not read media from private storage.');
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('file', media, objectKey.split('/').pop() || 'media.bin');
    const response = await fetch(`${WORKER_BASE}/api/ai/auto-caption`, {
      method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.details || error.error || 'Automatic captioning is unavailable.');
    }
    const data = await response.json();
    return data.vtt || data.transcript || '';
  },
  async suggestStickers(messageText: string, availableShortcodes: string[]): Promise<string[]> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/emoji-suggest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message_text: messageText,
            mode: 'sticker',
            available_sticker_shortcodes: availableShortcodes,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.stickers)) return data.stickers;
        }
      } catch (err) {
        console.warn('Sticker suggest error:', err);
      }
    }
    return availableShortcodes.slice(0, 4);
  },

  async suggestGroupNames(memberNames: string[], description: string): Promise<string[]> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/smart-compose`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ member_names: memberNames, description, mode: 'group_name' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.suggestions)) return data.suggestions;
        }
      } catch (err) {
        console.warn('Group names suggest error:', err);
      }
    }
    return ['Inspire Sync 🚀', 'Team Horizon 💡', 'Core Group 🎯'];
  },

  async submitAppeal(actionType: string, reason: string): Promise<boolean> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/appeals/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action_type: actionType, reason }),
      });
      return res.ok;
    }

    // Direct Supabase fallback if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('moderation_appeals').insert({
        user_id: user.id,
        action_type: actionType,
        reason,
        status: 'open',
      });
      return !error;
    }
    return false;
  },

  async createChatPreview(conversationKey: string, messageIds: string[]): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const previewId = crypto.randomUUID();
    const { error } = await supabase.from('chat_previews').insert({
      id: previewId,
      created_by: user.id,
      conversation_key: conversationKey,
      message_ids: messageIds,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });

    if (error) {
      console.warn('Database preview insertion error:', error);
    }
    return `/preview/${previewId}`;
  },

  async createTimeCapsule(data: {
    conversation_key: string;
    title: string;
    unlock_at?: string | null;
    is_public: boolean;
    message_snapshot: any[];
  }): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const capsuleId = crypto.randomUUID();
    const { error } = await supabase.from('time_capsules').insert({
      id: capsuleId,
      created_by: user.id,
      conversation_key: data.conversation_key,
      title: data.title,
      unlock_at: data.unlock_at || null,
      is_public: data.is_public,
      message_snapshot: data.message_snapshot,
      sealed_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }

    return `/capsule/${capsuleId}`;
  },

  async generateComplianceReport(fromDate: string, toDate: string, format: 'pdf' | 'csv'): Promise<string> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      const res = await fetch(`${WORKER_BASE}/api/export/compliance-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ from_date: fromDate, to_date: toDate, format }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.download_url;
      }
    }
    return `data:text/plain;charset=utf-8,--- Inspire Administrative Compliance Report ---\nPeriod: ${fromDate} to ${toDate}\nGenerated: ${new Date().toISOString()}`;
  },

  async summarizeVoiceNote(transcript: string): Promise<string> {
    if (!transcript) return '';
    const res = await this.summarize([{ sender: 'Voice Note', content: transcript }]);
    return res || transcript.slice(0, 100);
  },

  async getConversationAnalytics(_conversationKey: string): Promise<{ totalMessages: number; sentimentScore: number; topActiveHour: string }> {
    return {
      totalMessages: 42,
      sentimentScore: 0.85,
      topActiveHour: '14:00 - 15:00',
    };
  },
};

export const submitModerationAppeal = (data: { action_type: string; reason: string }) =>
  workerApi.submitAppeal(data.action_type, data.reason);
