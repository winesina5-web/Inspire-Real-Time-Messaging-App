import React, { useState } from 'react';

interface ClipboardDrawerProps {
  onInsertText: (text: string) => void;
  onClose: () => void;
}

export const ClipboardDrawer: React.FC<ClipboardDrawerProps> = ({
  onInsertText,
  onClose,
}) => {
  const [items, setItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('inspire_clipboard_sync');
    return saved
      ? JSON.parse(saved)
      : [
          'Here is the updated design document link: https://inspire.app/preview',
          'Let us hop on a quick call at 3:00 PM today.',
          'Please review the attached pull request and security verification checklist.',
        ];
  });

  const handleClear = () => {
    setItems([]);
    localStorage.removeItem('inspire_clipboard_sync');
  };

  return (
    <div className="absolute bottom-16 left-4 right-4 z-40 bg-white dark:bg-[#161B2B] shadow-2xl border border-[#E5E7EB] dark:border-[#2A3348] rounded-2xl p-4 animate-slide-up select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center space-x-2">
          <span className="text-base">📋</span>
          <span className="font-extrabold text-xs text-black dark:text-white">
            Cross-Device Clipboard
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {items.length > 0 && (
            <button
              onClick={handleClear}
              className="text-[10px] text-gray-400 hover:text-rose-500 font-bold"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="w-5 h-5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">
          Clipboard is empty. Copy text anywhere in Inspire to sync across devices.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {items.map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                onInsertText(item);
                onClose();
              }}
              className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-[#0E2A6E]/10 dark:hover:bg-white/10 cursor-pointer text-xs font-medium text-black dark:text-white truncate transition-colors"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
