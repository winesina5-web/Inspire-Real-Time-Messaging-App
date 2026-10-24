import React, { useState, useRef, useEffect } from 'react';
import { formatDuration } from '../utils/helpers';

interface VoiceNotePlayerProps {
  audioUrl: string;
  isSentByMe?: boolean;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ audioUrl, isSentByMe = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setLoadError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Playback error:', e);
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTo = parseFloat(e.target.value);
    setCurrentTime(seekTo);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTo;
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 18 pseudo waveform bars with deterministic heights
  const bars = [35, 60, 85, 45, 95, 70, 40, 80, 100, 65, 50, 90, 75, 40, 60, 85, 50, 70];

  return (
    <div className="flex items-center space-x-3 w-56 sm:w-64 select-none py-1">
      <button
        type="button"
        onClick={togglePlay}
        disabled={loadError}
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
        className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-sm ${
          isSentByMe
            ? 'bg-white text-[#0E2A6E] hover:bg-gray-100'
            : 'bg-[#0E2A6E] text-white hover:bg-[#081B47] dark:bg-[#3D6FE0]'
        }`}
      >
        {isPlaying ? (
          <span className="text-xs font-black">❚❚</span>
        ) : (
          <span className="text-xs font-black ml-0.5">▶</span>
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center space-y-1">
        <div className="relative flex items-center h-5 w-full">
          {/* Waveform visual bars */}
          <div className="absolute inset-0 flex items-center justify-between pointer-events-none opacity-85">
            {bars.map((height, i) => {
              const barPercent = (i / bars.length) * 100;
              const isPast = barPercent <= progressPercent;
              return (
                <div
                  key={i}
                  style={{ height: `${height}%` }}
                  className={`w-1 rounded-full transition-colors ${
                    isSentByMe
                      ? isPast ? 'bg-[#FFD700]' : 'bg-white/40'
                      : isPast ? 'bg-[#0E2A6E] dark:bg-[#FFD700]' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              );
            })}
          </div>

          <input
            type="range"
            min={0}
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            disabled={loadError}
            aria-label="Seek voice note"
            className="w-full opacity-0 cursor-pointer h-5 z-10"
          />
        </div>

        <div className="flex justify-between text-[11px] font-bold">
          <span className={isSentByMe ? 'text-white/90' : 'text-gray-700 dark:text-gray-300'}>
            {formatDuration(isPlaying ? currentTime : (duration || 0))}
          </span>
          <span className={`text-[10px] ${isSentByMe ? 'text-white/70' : 'text-gray-400'}`}>
            🎤 Voice Note
          </span>
        </div>
      </div>
    </div>
  );
};
