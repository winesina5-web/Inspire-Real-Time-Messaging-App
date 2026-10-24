import React from 'react';
import { SentimentTimelinePoint } from '../types';

interface SentimentTimelineModalProps {
  points: SentimentTimelinePoint[];
  onSelectDay: (point: SentimentTimelinePoint) => void;
  onClose: () => void;
}

export const SentimentTimelineModal: React.FC<SentimentTimelineModalProps> = ({
  points,
  onSelectDay,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📈</span>
            <h3 className="font-extrabold text-base text-black dark:text-white">
              7-Day Sentiment Timeline
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 font-bold flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mb-5">
          See how emotional tone evolved across your messages this week. Tap any day bar to jump to that conversation segment.
        </p>

        {/* 7-Column Sparkline Bar Chart */}
        <div className="h-44 flex items-end justify-between space-x-2 px-2 pb-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800 mb-5">
          {points.map((pt, idx) => {
            // Height proportional to score/activity
            const barHeightPct = Math.max(Math.min(Math.round(((pt.score + 1) / 2) * 100), 100), 20);
            const isPositive = pt.score >= 0.2;
            const isTense = pt.score <= -0.2;

            return (
              <div
                key={idx}
                onClick={() => onSelectDay(pt)}
                className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group"
                title={`${pt.day}: ${pt.positive}% Positive, ${pt.negative}% Tension`}
              >
                <div className="text-[10px] font-bold text-gray-400 group-hover:text-black dark:group-hover:text-white mb-1 transition-colors">
                  {pt.positive}%
                </div>
                <div
                  style={{ height: `${barHeightPct}%` }}
                  className={`w-full max-w-[28px] rounded-t-xl transition-all group-hover:scale-105 ${
                    isPositive
                      ? 'bg-linear-to-t from-[#FFD700] to-emerald-400'
                      : isTense
                      ? 'bg-linear-to-t from-rose-600 to-amber-500'
                      : 'bg-linear-to-t from-[#0E2A6E] to-blue-400'
                  }`}
                />
                <span className="text-[10px] font-extrabold mt-2 text-gray-700 dark:text-gray-300">
                  {pt.day}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[10px] font-bold px-2 text-gray-500 mb-5">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Positive Vibe</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0E2A6E]" />
            <span>Neutral / Focused</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>High Tension</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
        >
          Close Timeline
        </button>
      </div>
    </div>
  );
};
