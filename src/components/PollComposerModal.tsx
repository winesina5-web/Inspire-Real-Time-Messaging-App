import React, { useState } from 'react';
import { PollData } from '../types';

interface PollComposerModalProps {
  onSendPoll: (poll: PollData) => void;
  onClose: () => void;
}

export const PollComposerModal: React.FC<PollComposerModalProps> = ({ onSendPoll, onClose }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [allowMultiple, setAllowMultiple] = useState(false);

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions((prev) => [...prev, `Option ${prev.length + 1}`]);
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length > 2) {
      setOptions((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const poll: PollData = {
      id: `poll_${Date.now()}`,
      question: question.trim(),
      allow_multiple: allowMultiple,
      options: options.map((opt, i) => ({
        id: `opt_${i}_${Date.now()}`,
        option_text: opt.trim() || `Choice ${i + 1}`,
        votes: [],
      })),
    };

    onSendPoll(poll);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-extrabold text-sm text-black dark:text-white flex items-center space-x-2">
            <span>📊</span>
            <span>Create Poll</span>
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 my-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1">
              Poll Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question…"
              required
              className="w-full px-3 py-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white focus:outline-none focus:border-[#0E2A6E]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1">
              Options
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400 font-bold">{i + 1}.</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                    required
                    className="flex-1 px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(i)}
                      className="p-1 text-rose-500 hover:text-rose-700 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 text-xs font-bold text-[#0E2A6E] dark:text-[#3D6FE0] hover:underline"
              >
                + Add another option
              </button>
            )}
          </div>

          <label className="flex items-center space-x-2.5 text-xs font-bold text-black dark:text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              className="rounded text-[#0E2A6E]"
            />
            <span>Allow multiple answers</span>
          </label>

          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-black shadow-md hover:bg-[#081B47]"
            >
              Send Poll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
