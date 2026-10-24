import { useState, useCallback } from 'react';
import { workerApi } from '../lib/workerApi';
import { AiFeatureKey } from '../types';

export function useAI() {
  const [loadingFeature, setLoadingFeature] = useState<AiFeatureKey | null>(null);

  const getSmartReplies = useCallback(async (messageText: string): Promise<string[]> => {
    try {
      return await workerApi.smartReply(messageText);
    } catch {
      return [];
    }
  }, []);

  const translateMessage = useCallback(async (text: string, targetLang: string = 'en'): Promise<string | null> => {
    setLoadingFeature('translate');
    try {
      return await workerApi.translate(text, targetLang);
    } catch {
      return null;
    } finally {
      setLoadingFeature(null);
    }
  }, []);

  const summarizeChat = useCallback(async (messages: Array<{ sender: string; content: string }>): Promise<string | null> => {
    setLoadingFeature('summarize');
    try {
      return await workerApi.summarize(messages);
    } catch {
      return null;
    } finally {
      setLoadingFeature(null);
    }
  }, []);

  const smartSearchChat = useCallback(async (query: string, messages: Array<{ id: string; content: string }>): Promise<string[]> => {
    setLoadingFeature('smart_search');
    try {
      return await workerApi.smartSearch(query, messages);
    } catch {
      return [];
    } finally {
      setLoadingFeature(null);
    }
  }, []);

  const transcribeAudio = useCallback(async (objectKey: string): Promise<string | null> => {
    setLoadingFeature('transcribe');
    try {
      return await workerApi.transcribe(objectKey);
    } catch {
      return null;
    } finally {
      setLoadingFeature(null);
    }
  }, []);

  const suggestEmojis = useCallback(async (text: string): Promise<string[]> => {
    try {
      return await workerApi.emojiSuggest(text);
    } catch {
      return [];
    }
  }, []);

  const moderateContent = useCallback(async (contentType: 'text' | 'image', content: string) => {
    setLoadingFeature('moderate');
    try {
      return await workerApi.moderate(contentType, content);
    } catch {
      return { verdict: 'flagged_for_review', confidence: 0.85 };
    } finally {
      setLoadingFeature(null);
    }
  }, []);

  return {
    loadingFeature,
    getSmartReplies,
    translateMessage,
    summarizeChat,
    smartSearchChat,
    transcribeAudio,
    suggestEmojis,
    moderateContent,
  };
}
