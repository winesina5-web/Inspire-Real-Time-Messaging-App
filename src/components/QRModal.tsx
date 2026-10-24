import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';

export const QRModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'my_qr' | 'scan'>('my_qr');
  const [scanInput, setScanInput] = useState('');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    `inspire://add/${user?.username || 'user'}`
  )}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/chats?add=${user?.username}`);
    toast('Profile link copied to clipboard!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl text-center animate-slide-up">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-extrabold text-sm text-black dark:text-white">QR Code Contact</h3>
          <button onClick={onClose} className="p-1 text-gray-400 font-bold">✕</button>
        </div>

        <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 my-4">
          <button
            onClick={() => setTab('my_qr')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'my_qr' ? 'bg-white dark:bg-[#161B2B] text-[#0E2A6E] dark:text-[#3D6FE0] shadow-xs' : 'text-gray-500'
            }`}
          >
            My QR Code
          </button>
          <button
            onClick={() => setTab('scan')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'scan' ? 'bg-white dark:bg-[#161B2B] text-[#0E2A6E] dark:text-[#3D6FE0] shadow-xs' : 'text-gray-500'
            }`}
          >
            Scan Code
          </button>
        </div>

        {tab === 'my_qr' ? (
          <div className="flex flex-col items-center space-y-4 py-2">
            <div className="p-4 bg-white rounded-2xl border-4 border-[#0E2A6E] shadow-md inline-block">
              <img src={qrUrl} alt={`QR Code for @${user?.username}`} className="w-44 h-44 object-contain" />
            </div>
            <div>
              <h4 className="font-black text-sm text-black dark:text-white">{user?.display_name}</h4>
              <p className="text-xs font-bold text-[#0E2A6E] dark:text-[#3D6FE0]">@{user?.username}</p>
            </div>
            <button
              onClick={handleCopyLink}
              className="w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-extrabold hover:bg-[#081B47]"
            >
              Copy Direct Chat Link
            </button>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            <div className="w-48 h-48 mx-auto rounded-2xl bg-black/10 dark:bg-black/40 border-2 border-dashed border-[#0E2A6E] flex items-center justify-center">
              <span className="text-3xl">📷</span>
            </div>
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Paste invite link or scanned code…"
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs border border-gray-200 dark:border-gray-700"
            />
            <button
              onClick={() => {
                if (scanInput) {
                  toast(`Recognized contact code: ${scanInput}`, 'success');
                  onClose();
                }
              }}
              className="w-full py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold"
            >
              Add Scanned Contact
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
