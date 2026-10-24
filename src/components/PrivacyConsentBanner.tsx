import React, { useState, useEffect } from 'react';

export default function PrivacyConsentBanner() {
  const [hasConsented, setHasConsented] = useState(true);

  useEffect(() => {
    const consent = localStorage.getItem('inspire_cookie_consent');
    if (!consent) {
      setHasConsented(false);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('inspire_cookie_consent', new Date().toISOString());
    setHasConsented(true);
  };

  if (hasConsented) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 p-4 pointer-events-none animate-slide-up">
      <div className="max-w-md mx-auto p-4 rounded-3xl bg-white/95 dark:bg-[#161B2B]/95 backdrop-blur-md border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl pointer-events-auto flex flex-col space-y-3">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-full bg-[#0E2A6E] text-[#FFD700] text-sm flex items-center justify-center shrink-0">
            🛡️
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-black text-black dark:text-white">
              Privacy, Security & Cookies
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              Inspire uses essential local storage and security tokens for session persistence, real-time message sync, and tamper protection.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 pt-1">
          <button
            onClick={handleAccept}
            className="flex-1 py-2 rounded-2xl bg-[#0E2A6E] text-[#FFD700] text-xs font-extrabold hover:bg-[#081B47] transition-all shadow-sm active:scale-98"
          >
            Accept & Continue
          </button>
          <button
            onClick={() => {
              window.open('/privacy', '_self');
            }}
            className="px-3 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200"
          >
            Privacy Settings
          </button>
        </div>
      </div>
    </div>
  );
}
