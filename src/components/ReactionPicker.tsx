import React, { useState } from 'react';

interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
  messageText?: string;
}

const STANDARD_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏', '🚀'];

// Feature 106: Custom Emojis (Admin/User uploaded)
const CUSTOM_EMOJIS = [
  { shortcode: ':inspire_spark:', label: 'Sparkle', emoji: '✨', badge: 'Inspire' },
  { shortcode: ':inspire_rocket:', label: 'Rocket', emoji: '🚀', badge: 'Pro' },
  { shortcode: ':inspire_heart_fire:', label: 'Super Heart', emoji: '❤️‍🔥', badge: 'Inspire' },
  { shortcode: ':inspire_gem:', label: 'Gem', emoji: '💎', badge: 'VIP' },
  { shortcode: ':inspire_shield:', label: 'Security', emoji: '🛡️', badge: 'Admin' },
];

// Feature 103: AI Recommended Stickers
const AI_RECOMMENDED_STICKERS = [
  { id: 'stk_1', label: 'Celebrate!', emoji: '🥳', caption: 'Awesome work!' },
  { id: 'stk_2', label: 'Agreed', emoji: '🤝', caption: 'Sounds like a deal' },
  { id: 'stk_3', label: 'On It', emoji: '⚡', caption: 'Handling right now' },
  { id: 'stk_4', label: 'Thank You', emoji: '🙏', caption: 'Much appreciated' },
];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [activeTab, setActiveTab] = useState<'standard' | 'custom' | 'stickers'>('standard');
  const [showStickerRecs, setShowStickerRecs] = useState(false);

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="absolute z-40 bg-white dark:bg-[#161B2B] shadow-2xl border border-[#E5E7EB] dark:border-[#2A3348] rounded-2xl p-2 animate-slide-up select-none -top-14 right-0 sm:right-auto min-w-[260px]"
        role="dialog"
        aria-label="Reaction Picker"
      >
        {/* Feature 103 Contextual AI Sticker Chip */}
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#E5E7EB] dark:border-[#2A3348]">
          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('standard')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'standard'
                  ? 'bg-[#0E2A6E] text-white dark:bg-[#3D6FE0]'
                  : 'text-[#4B5563] dark:text-[#9CA3AF] hover:bg-black/5'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'custom'
                  ? 'bg-[#0E2A6E] text-white dark:bg-[#3D6FE0]'
                  : 'text-[#4B5563] dark:text-[#9CA3AF] hover:bg-black/5'
              }`}
            >
              Custom ✨
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'stickers' ? 'standard' : 'stickers')}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#1A1A2E] dark:text-[#FFD700] text-[10px] font-black transition-colors"
            title="AI Contextual Sticker recommendations"
          >
            <span>🎨 Sticker?</span>
          </button>
        </div>

        {/* Tab 1: Standard Emojis */}
        {activeTab === 'standard' && (
          <div className="flex items-center space-x-1 justify-between">
            {STANDARD_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelectEmoji(emoji);
                  onClose();
                }}
                className="w-7 h-7 flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Tab 2: Feature 106 Custom Emojis */}
        {activeTab === 'custom' && (
          <div className="flex items-center space-x-2 justify-around py-1">
            {CUSTOM_EMOJIS.map((cust) => (
              <button
                key={cust.shortcode}
                type="button"
                onClick={() => {
                  onSelectEmoji(cust.shortcode);
                  onClose();
                }}
                className="group relative flex flex-col items-center justify-center p-1 rounded-xl hover:bg-[#0E2A6E]/10 dark:hover:bg-white/10 active:scale-95 transition-all"
                title={`${cust.label} (${cust.shortcode})`}
                aria-label={`React with custom emoji ${cust.label}`}
              >
                <span className="text-xl group-hover:scale-125 transition-transform">{cust.emoji}</span>
                <span className="text-[8px] font-black text-[#0E2A6E] dark:text-[#3D6FE0] mt-0.5">{cust.badge}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tab 3: Feature 103 AI Contextual Stickers */}
        {activeTab === 'stickers' && (
          <div className="grid grid-cols-2 gap-1.5 py-1">
            {AI_RECOMMENDED_STICKERS.map((stk) => (
              <button
                key={stk.id}
                type="button"
                onClick={() => {
                  onSelectEmoji(stk.emoji);
                  onClose();
                }}
                className="flex items-center space-x-2 p-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#2A3348] hover:bg-[#FFD700]/10 text-left transition-colors"
              >
                <span className="text-2xl">{stk.emoji}</span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-black dark:text-white truncate">{stk.label}</div>
                  <div className="text-[9px] text-[#4B5563] dark:text-[#9CA3AF] truncate">{stk.caption}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
