import React from 'react';

interface ChatStatsModalProps {
  partnerName: string;
  stats: {
    sent_count: number;
    received_count: number;
    most_active_hour: string;
    top_words: string[];
    top_emojis: string[];
    streak_days: number;
    avg_response_minutes: number;
  };
  onClose: () => void;
}

export const ChatStatsModal: React.FC<ChatStatsModalProps> = ({
  partnerName,
  stats,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📊</span>
            <div>
              <h3 className="font-extrabold text-base text-black dark:text-white leading-tight">
                Conversation Statistics
              </h3>
              <p className="text-[11px] text-gray-500">Activity with {partnerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 font-bold flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3.5 rounded-2xl bg-[#0E2A6E]/10 dark:bg-[#3D6FE0]/15 border border-[#0E2A6E]/20 text-center">
            <div className="text-2xl font-black text-[#0E2A6E] dark:text-[#3D6FE0]">
              {stats.sent_count}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mt-1">
              Sent by You
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.received_count}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mt-1">
              Received
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
            <div className="text-2xl font-black text-amber-500">
              🔥 {stats.streak_days}d
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mt-1">
              Active Streak
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
              ⚡ {stats.avg_response_minutes}m
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mt-1">
              Avg Response
            </div>
          </div>
        </div>

        {/* Most Active Time & Emojis */}
        <div className="space-y-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs mb-5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-500">Peak Hours:</span>
            <span className="font-extrabold text-black dark:text-white">
              {stats.most_active_hour}
            </span>
          </div>

          <div>
            <span className="font-bold text-gray-500 block mb-1.5">Top Emojis:</span>
            <div className="flex space-x-2 text-xl">
              {stats.top_emojis.map((em, idx) => (
                <span key={idx} className="p-1 rounded-lg bg-white dark:bg-gray-700 shadow-2xs">
                  {em}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="font-bold text-gray-500 block mb-1.5">Frequent Keywords:</span>
            <div className="flex flex-wrap gap-1.5">
              {stats.top_words.map((w, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-full bg-[#0E2A6E]/10 dark:bg-white/10 text-[10px] font-bold">
                  #{w}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
        >
          Close Statistics
        </button>
      </div>
    </div>
  );
};
