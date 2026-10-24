import React, { useState, useRef, useEffect } from 'react';

interface CameraModalProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        activeStream = s;
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => {
        console.warn('Camera error:', err);
        setCameraError('Unable to access device camera.');
      });

    return () => {
      if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleTakeSnap = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedDataUrl(dataUrl);
    }
  };

  const handleConfirm = () => {
    if (!capturedDataUrl) return;
    fetch(capturedDataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], `snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        onClose();
      });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-4 animate-fade-in select-none">
      <div className="flex items-center justify-between text-white pb-2">
        <h3 className="font-extrabold text-sm">Inspire Camera</h3>
        <button onClick={onClose} className="p-2 text-xl font-bold">✕</button>
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-3xl bg-neutral-900 border border-neutral-800">
        {cameraError ? (
          <div className="text-center p-6 text-rose-400 text-xs font-semibold">
            ⚠️ {cameraError}
          </div>
        ) : capturedDataUrl ? (
          <img src={capturedDataUrl} alt="Captured preview" className="max-h-full max-w-full object-contain rounded-3xl" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="max-h-full max-w-full object-contain rounded-3xl" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex items-center justify-center space-x-6 py-4">
        {capturedDataUrl ? (
          <>
            <button
              onClick={() => setCapturedDataUrl(null)}
              className="px-5 py-2.5 rounded-2xl bg-gray-700 text-white text-xs font-bold"
            >
              Retake
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-black shadow-lg"
            >
              Send Photo
            </button>
          </>
        ) : (
          <button
            onClick={handleTakeSnap}
            disabled={Boolean(cameraError)}
            className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 transition-transform"
            aria-label="Capture photo"
          >
            <div className="w-12 h-12 rounded-full bg-white" />
          </button>
        )}
      </div>
    </div>
  );
};
