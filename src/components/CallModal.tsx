import React, { useState, useEffect, useRef } from 'react';
import { Avatar } from './Avatar';
import { formatDuration } from '../utils/helpers';
import { Profile } from '../types';

interface CallModalProps {
  partner: Profile;
  type: 'voice' | 'video';
  onEndCall: (duration: number) => void;
}

export const CallModal: React.FC<CallModalProps> = ({ partner, type, onEndCall }) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'voice');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected'>('connecting');
  // Feature 100: AI Background Blur / Virtual Backgrounds
  const [bgMode, setBgMode] = useState<'none' | 'blur' | 'office' | 'scifi'>('none');
  const [showBgPanel, setShowBgPanel] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Simulated connection latency
    const connectTimer = setTimeout(() => {
      setCallStatus('connected');
    }, 1200);

    const callTimer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      clearTimeout(connectTimer);
      clearInterval(callTimer);
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsScreenSharing(true);
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.warn('Screen share cancelled:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#081B47]/95 backdrop-blur-xl flex flex-col justify-between p-6 text-white animate-fade-in select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
            {callStatus === 'connecting' ? 'Connecting Secure Call…' : `${type.toUpperCase()} CALL (${formatDuration(duration)})`}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {bgMode !== 'none' && (
            <span className="px-2 py-0.5 rounded-full bg-[#FFD700] text-[#1A1A2E] text-[10px] font-black uppercase">
              AI {bgMode} Active
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-semibold">
            WebRTC Encrypted
          </span>
        </div>
      </div>

      {/* Main Center Stage */}
      <div className="flex-1 flex flex-col items-center justify-center my-6 relative">
        {type === 'video' || isScreenSharing ? (
          <div className="w-full max-w-lg aspect-video rounded-3xl bg-black/60 border border-white/20 relative overflow-hidden flex items-center justify-center shadow-2xl">
            {isScreenSharing ? (
              <video ref={localVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
            ) : isVideoOff ? (
              <div className="flex flex-col items-center">
                <Avatar name={partner.display_name} size="xl" />
                <span className="text-xs text-blue-200 font-bold mt-2">Camera Off</span>
              </div>
            ) : (
              <div
                className={`relative w-full h-full flex items-center justify-center transition-all duration-300 ${
                  bgMode === 'blur'
                    ? 'backdrop-blur-2xl bg-blue-950/80'
                    : bgMode === 'office'
                    ? 'bg-cover bg-center'
                    : bgMode === 'scifi'
                    ? 'bg-cover bg-center'
                    : 'bg-linear-to-b from-blue-900/40 to-black'
                }`}
                style={{
                  backgroundImage:
                    bgMode === 'office'
                      ? 'url(https://images.unsplash.com/photo-1497366216548-37526070297c?w=1000&auto=format&fit=crop&q=80)'
                      : bgMode === 'scifi'
                      ? 'url(https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&auto=format&fit=crop&q=80)'
                      : undefined,
                }}
              >
                {/* Foreground segmented subject simulation */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative">
                    <Avatar name={partner.display_name} avatarUrl={partner.avatar_url} size="xl" />
                    {bgMode === 'blur' && (
                      <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-[#FFD700] text-[#1A1A2E] text-[9px] font-black">
                        AI Blur
                      </span>
                    )}
                  </div>
                  <div className="mt-3 bg-black/70 px-3.5 py-1 rounded-full text-xs font-bold text-white shadow-md">
                    {partner.display_name}
                  </div>
                </div>

                {/* Subtle depth lighting vignette */}
                <div className="absolute inset-0 bg-radial from-transparent to-black/60 pointer-events-none" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <Avatar name={partner.display_name} avatarUrl={partner.avatar_url} size="xl" />
              <div className="absolute -inset-2 rounded-full border-2 border-[#FFD700] animate-ping opacity-75" />
            </div>
            <div>
              <h2 className="text-2xl font-black">{partner.display_name}</h2>
              <p className="text-xs text-blue-200 mt-1">@{partner.username}</p>
            </div>
          </div>
        )}

        {/* Feature 100 Background Selection Modal */}
        {showBgPanel && type === 'video' && (
          <div className="absolute bottom-4 bg-[#161B2B]/95 border border-white/20 p-3 rounded-2xl shadow-2xl backdrop-blur-xl z-20 flex space-x-2 animate-slide-up">
            <button
              onClick={() => { setBgMode('none'); setShowBgPanel(false); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                bgMode === 'none' ? 'bg-[#FFD700] text-[#1A1A2E]' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              Default
            </button>
            <button
              onClick={() => { setBgMode('blur'); setShowBgPanel(false); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                bgMode === 'blur' ? 'bg-[#FFD700] text-[#1A1A2E]' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              ✨ Blur Background
            </button>
            <button
              onClick={() => { setBgMode('office'); setShowBgPanel(false); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                bgMode === 'office' ? 'bg-[#FFD700] text-[#1A1A2E]' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              🏢 Modern Studio
            </button>
            <button
              onClick={() => { setBgMode('scifi'); setShowBgPanel(false); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                bgMode === 'scifi' ? 'bg-[#FFD700] text-[#1A1A2E]' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              🌌 Deep Space
            </button>
          </div>
        )}
      </div>

      {/* Controls Dock */}
      <div className="flex items-center justify-center space-x-3 max-w-md mx-auto w-full bg-white/10 backdrop-blur-md p-3.5 rounded-3xl border border-white/20 shadow-2xl">
        {/* Mute Toggle */}
        <button
          onClick={() => setIsMuted((prev) => !prev)}
          className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-transform active:scale-95 ${
            isMuted ? 'bg-rose-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? '🔇' : '🎙️'}
        </button>

        {/* Video Toggle */}
        <button
          onClick={() => setIsVideoOff((prev) => !prev)}
          className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-transform active:scale-95 ${
            isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
          title={isVideoOff ? 'Turn video on' : 'Turn video off'}
          aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
        >
          {isVideoOff ? '🚫' : '📹'}
        </button>

        {/* Feature 100: AI Background Blur/Virtual Toggle */}
        {type === 'video' && (
          <button
            onClick={() => setShowBgPanel((prev) => !prev)}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-base transition-transform active:scale-95 ${
              bgMode !== 'none' || showBgPanel ? 'bg-[#FFD700] text-[#1A1A2E]' : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
            title="AI Virtual Background"
            aria-label="Toggle virtual background"
          >
            ✨
          </button>
        )}

        {/* Screen Share (Feature 17) */}
        <button
          onClick={handleToggleScreenShare}
          className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-transform active:scale-95 ${
            isScreenSharing ? 'bg-[#FFD700] text-[#1A1A2E]' : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
          title="Share screen"
          aria-label="Share screen"
        >
          🖥️
        </button>

        {/* Hang Up Button */}
        <button
          onClick={() => onEndCall(duration)}
          className="w-13 h-13 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          aria-label="End Call"
        >
          📞
        </button>
      </div>
    </div>
  );
};
