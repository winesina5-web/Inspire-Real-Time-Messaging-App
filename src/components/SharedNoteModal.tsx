import React, { useState, useEffect } from 'react';

interface SharedNoteModalProps {
  conversationKey: string;
  partnerName: string;
  onClose: () => void;
}

export const SharedNoteModal: React.FC<SharedNoteModalProps> = ({
  conversationKey,
  partnerName,
  onClose,
}) => {
  const [content, setContent] = useState<string>(() => {
    return (
      localStorage.getItem(`inspire_shared_note_${conversationKey}`) ||
      `# Shared Workspace Notes\n- Ideas discussed between you and ${partnerName}\n- Real-time updates synced automatically\n`
    );
  });
  const [savedTime, setSavedTime] = useState<string>('Just now');

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(`inspire_shared_note_${conversationKey}`, content);
      setSavedTime('Saved just now');
    }, 600);
    return () => clearTimeout(timer);
  }, [content, conversationKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-lg bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up flex flex-col h-[75vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📝</span>
            <div>
              <h3 className="font-extrabold text-base text-black dark:text-white leading-tight">
                Collaborative Shared Note
              </h3>
              <p className="text-[11px] text-gray-500">
                Shared document with {partnerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 font-bold flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Note Editor Area */}
        <div className="flex-1 flex flex-col min-h-0 mb-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type notes, action items, or plans here…"
            className="flex-1 w-full p-4 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-mono text-xs leading-relaxed focus:outline-none resize-none"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
          <span className="text-[11px] text-gray-400 font-semibold">{savedTime}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#0E2A6E] text-white font-bold hover:bg-[#081B47]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
