import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>(Array(28).fill(8));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (waveformTimerRef.current) {
      clearInterval(waveformTimerRef.current);
      waveformTimerRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    setPermissionError(null);
    setAudioBlob(null);
    audioChunksRef.current = [];
    setRecordingDuration(0);

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Voice recording is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextType = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextType) {
        const context: AudioContext = new AudioContextType();
        audioContextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        waveformTimerRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(samples);
          let energy = 0;
          for (let i = 0; i < samples.length; i += 1) { const value = (samples[i] - 128) / 128; energy += value * value; }
          const level = Math.max(8, Math.min(100, Math.round(Math.sqrt(energy / samples.length) * 220)));
          setRecordingWaveform((previous) => [...previous.slice(1), level]);
        }, 80);
      }
      setRecordingWaveform(Array(28).fill(8));
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const supportedType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) { void audioContextRef.current.close().catch(() => undefined); audioContextRef.current = null; }
      };

      mediaRecorder.start(200);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      setPermissionError(err instanceof Error ? err.message : 'Microphone permission required for voice notes');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      clearTimer();
      setIsRecording(false);

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      const recorder = mediaRecorderRef.current;
      recorder.addEventListener('stop', () => {
        const mimeType = recorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        resolve(blob.size > 0 ? blob : null);
      }, { once: true });

      recorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    clearTimer();
    setIsRecording(false);
    setRecordingWaveform(Array(28).fill(8));
    setAudioBlob(null);
    audioChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  return {
    isRecording,
    recordingDuration,
    audioBlob,
    permissionError,
    recordingWaveform,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
