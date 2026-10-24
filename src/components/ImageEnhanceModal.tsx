import React, { useState } from 'react';
import { workerApi } from '../lib/workerApi';

interface ImageEnhanceModalProps {
  imageFile: File;
  onConfirmSend: (finalFile: File | Blob) => void;
  onCancel: () => void;
}

export const ImageEnhanceModal: React.FC<ImageEnhanceModalProps> = ({
  imageFile,
  onConfirmSend,
  onCancel,
}) => {
  const [originalUrl, setOriginalUrl] = useState<string>(() => URL.createObjectURL(imageFile));
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<'original' | 'enhanced'>('original');

  const handleEnhance = async () => {
    setIsEnhancing(true);
    try {
      const enhanced = await workerApi.enhanceImage(imageFile);
      setEnhancedUrl(enhanced);
      setSelectedVersion('enhanced');
    } catch {
      // fallback
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSend = () => {
    onConfirmSend(imageFile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up flex flex-col">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <span className="text-xl">✨</span>
            <h3 className="font-extrabold text-sm text-black dark:text-white">
              AI Image Preview & Enhancement
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 font-bold flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Image Preview Stage */}
        <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-black flex items-center justify-center mb-4">
          <img
            src={selectedVersion === 'enhanced' && enhancedUrl ? enhancedUrl : originalUrl}
            alt="Upload Preview"
            className={`w-full h-full object-contain transition-all duration-300 ${
              isEnhancing ? 'blur-xs brightness-75' : ''
            }`}
          />
          {isEnhancing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/40">
              <span className="w-8 h-8 rounded-full border-3 border-[#FFD700] border-t-transparent animate-spin mb-2" />
              <span className="text-xs font-black tracking-wide">Enhancing clarity with Workers AI…</span>
            </div>
          )}
        </div>

        {/* Toggle Controls */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex space-x-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedVersion('original')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedVersion === 'original'
                  ? 'bg-[#0E2A6E] text-white dark:bg-[#3D6FE0]'
                  : 'text-gray-500'
              }`}
            >
              Original
            </button>
            <button
              type="button"
              disabled={!enhancedUrl}
              onClick={() => setSelectedVersion('enhanced')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedVersion === 'enhanced'
                  ? 'bg-[#0E2A6E] text-white dark:bg-[#3D6FE0]'
                  : 'text-gray-400 disabled:opacity-40'
              }`}
            >
              Enhanced ✨
            </button>
          </div>

          {!enhancedUrl && (
            <button
              type="button"
              disabled={isEnhancing}
              onClick={handleEnhance}
              className="px-3.5 py-1.5 rounded-xl bg-[#FFD700] text-[#1A1A2E] text-xs font-black shadow-xs hover:bg-[#FFD700]/90 active:scale-95"
            >
              ✨ Enhance Image
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="flex-1 py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
          >
            Send Photo
          </button>
        </div>
      </div>
    </div>
  );
};
