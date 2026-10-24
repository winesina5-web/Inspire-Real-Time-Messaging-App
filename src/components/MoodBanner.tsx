import React, { useState } from 'react';
import { MoodData } from '../types';

interface MoodBannerProps {
  mood: MoodData;
  onDismiss: () => void;
}

export const MoodBanner: React.FC<MoodBannerProps> = ({ mood, onDismiss }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className="relative z-20 px-4 py-2 text-white shadow-md transition-all select-none border-b border-black/10"
      style={{
        background: `linear-gradient(90deg, ${mood.gradient_start} 0%, ${mood.gradient_end} 100%)`,
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div
          onClick={() => setShowDetails((prev) => !prev)}
          className="flex items-center space-x-2 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="text-lg">{mood.mood_emoji}</span>
          <span className="font-extrabold text-xs tracking-tight text-white drop-shadow-xs">
            Mood: {mood.mood_label}
          </span>
          <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded-full font-bold">
            {showDetails ? 'Hide breakdown' : 'Tap for details'}
          </span>
        </div>

        <button
          onClick={onDismiss}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/20 text-white font-bold text-xs"
          title="Dismiss mood banner"
          aria-label="Dismiss mood banner"
        >
          ✕
        </button>
      </div>

      {showDetails && (
        <div className="max-w-md mx-auto mt-2 pt-2 border-t border-white/20 text-xs flex justify-between items-center text-white/95">
          <span className="font-semibold text-[11px]">Sentiment breakdown:</span>
          <div className="flex space-x-2 text-[10px] font-bold">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/80">
              Positive: {mood.breakdown.positive}%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/80">
              Neutral: {mood.breakdown.neutral}%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/80">
              Tension: {mood.breakdown.negative}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
