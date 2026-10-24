import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Check if user dismissed recently
      const dismissed = localStorage.getItem('inspire_pwa_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('inspire_pwa_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Install App"
      className="fixed bottom-20 left-4 right-4 max-w-sm mx-auto z-50 bg-[#0E2A6E] text-white p-4 rounded-2xl shadow-2xl border border-[#FFD700]/30 flex items-center justify-between animate-slide-up"
    >
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-[#FFD700] text-[#1A1A2E] flex items-center justify-center font-black text-xl shadow-inner">
          ⚡
        </div>
        <div>
          <h4 className="font-bold text-sm tracking-tight">Install Inspire</h4>
          <p className="text-xs text-blue-100">Add to home screen for fast chat</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleDismiss}
          className="px-2.5 py-1 text-xs text-blue-200 hover:text-white font-medium"
        >
          Later
        </button>
        <button
          onClick={handleInstall}
          className="px-3.5 py-1.5 bg-[#FFD700] text-[#1A1A2E] rounded-xl text-xs font-bold hover:brightness-105 active:scale-95 transition-transform"
        >
          Install
        </button>
      </div>
    </aside>
  );
};
