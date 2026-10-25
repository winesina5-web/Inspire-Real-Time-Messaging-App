import React, { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { formatDuration } from '../utils/helpers';
import { Profile } from '../types';
import { useAuth } from '../hooks/useAuth';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { workerApi } from '../lib/workerApi';

interface CallModalProps {
  callId: string;
  partner: Profile;
  type: 'voice' | 'video';
  isCaller: boolean;
  onEndCall: (duration: number) => void;
}

export const CallModal: React.FC<CallModalProps> = ({ callId, partner, type, isCaller, onEndCall }) => {
  const { user } = useAuth();
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'voice');
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const hasTurnRelayRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const processingSignalsRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const offerSentRef = useRef(false);
  const endedRef = useRef(false);
  const iceRestartAttemptedRef = useRef(false);

  useEffect(() => {
    if (!user || !isConfigured) {
      setCallStatus('error');
      setErrorMessage('Calls require a signed-in Supabase session.');
      return;
    }
    let mounted = true;
    let durationTimer: ReturnType<typeof setInterval> | null = null;
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const sendSignal = async (eventType: 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'reject', payload: unknown = {}) => {
      const { error } = await supabase.from('call_signals').insert({
        call_id: callId,
        sender_id: user.id,
        receiver_id: partner.id,
        event_type: eventType,
        payload,
      });
      if (error) throw error;
    };

    const restartIce = async (pc: RTCPeerConnection) => {
      if (!isCaller || iceRestartAttemptedRef.current || !mounted || pc.signalingState === 'closed') return;
      iceRestartAttemptedRef.current = true;
      try {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        await sendSignal('offer', { sdp: pc.localDescription, iceRestart: true });
      } catch (error) {
        console.warn('ICE restart failed:', error);
      }
    };

    const applyPendingCandidates = async (pc: RTCPeerConnection) => {
      const candidates = pendingCandidatesRef.current.splice(0);
      for (const candidate of candidates) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (error) { console.warn('ICE candidate apply failed:', error); }
      }
    };

    const processSignal = async (signal: any) => {
      if (!mounted || !signal?.id || signal.call_id !== callId || signal.receiver_id !== user.id ||
          processedSignalsRef.current.has(signal.id) || processingSignalsRef.current.has(signal.id) || signal.sender_id === user.id) return;
      const pc = peerConnectionRef.current;
      if (!pc || pc.signalingState === 'closed') return;
      processingSignalsRef.current.add(signal.id);
      try {
        if (signal.event_type === 'offer' && !isCaller) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
          await applyPendingCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', { sdp: pc.localDescription });
          await supabase.from('calls').update({ status: 'answered' }).eq('id', callId);
        } else if (signal.event_type === 'answer' && isCaller) {
          if (pc.signalingState === 'have-local-offer' || !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
            await applyPendingCandidates(pc);
          }
        } else if (signal.event_type === 'ice-candidate' && signal.payload?.candidate) {
          const candidate = signal.payload.candidate as RTCIceCandidateInit;
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        } else if (signal.event_type === 'reject' || signal.event_type === 'hangup') {
          endedRef.current = true;
          setCallStatus('ended');
          onEndCall(duration);
        }
        processedSignalsRef.current.add(signal.id);
      } catch (error) {
        console.warn('Call signaling error:', error);
        if (mounted) {
          setCallStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Call signaling failed.');
        }
      } finally {
        processingSignalsRef.current.delete(signal.id);
      }
    };

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        if (!mounted) { stream.getTracks().forEach((track) => track.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const credentials = await workerApi.getTurnCredentials();
        hasTurnRelayRef.current = Boolean(credentials.turnConfigured);
        const pc = new RTCPeerConnection({ iceServers: credentials.iceServers, iceCandidatePoolSize: 2 });
        peerConnectionRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          const remote = remoteStreamRef.current || new MediaStream();
          remoteStreamRef.current = remote;
          if (!remote.getTracks().some((track) => track.id === event.track.id)) remote.addTrack(event.track);
          const video = remoteVideoRef.current;
          const audio = remoteAudioRef.current;
          if (video && type === 'video') {
            video.srcObject = remote;
            void video.play().catch((error) => console.debug('Remote video autoplay awaits user gesture:', error));
          }
          if (audio) {
            audio.srcObject = remote;
            void audio.play().catch((error) => {
              console.debug('Remote audio autoplay blocked:', error);
              if (mounted) setErrorMessage('Tap the screen once to allow audio playback.');
            });
          }
        };
        pc.onicecandidate = (event) => {
          if (event.candidate && mounted) {
            void sendSignal('ice-candidate', { candidate: event.candidate.toJSON() }).catch((error) => console.warn('ICE send failed:', error));
          }
        };
        pc.onconnectionstatechange = () => {
          if (!mounted) return;
          if (pc.connectionState === 'connected') {
            if (disconnectTimer) clearTimeout(disconnectTimer);
            disconnectTimer = null;
            setCallStatus('connected');
            setErrorMessage('');
            if (!durationTimer) durationTimer = setInterval(() => setDuration((prev) => prev + 1), 1000);
          } else if (pc.connectionState === 'disconnected') {
            // Mobile networks briefly drop ICE while switching Wi-Fi/cellular. Do not end the call immediately.
            if (!disconnectTimer) disconnectTimer = setTimeout(() => {
              if (mounted && pc.connectionState === 'disconnected') {
                setCallStatus('connecting');
                setErrorMessage('Network interrupted. Trying to reconnect…');
              }
              disconnectTimer = null;
            }, 10000);
          } else if (pc.connectionState === 'failed') {
            if (isCaller && !iceRestartAttemptedRef.current) {
              setErrorMessage('Network path failed. Trying to reconnect…');
              void restartIce(pc);
              if (!disconnectTimer) disconnectTimer = setTimeout(() => {
                if (mounted && pc.connectionState !== 'connected') {
                  setCallStatus('error');
                  setErrorMessage(hasTurnRelayRef.current ? 'Could not connect media. Check network permissions and try again.' : 'This network needs a TURN relay. Configure TURN_KEY_ID and TURN_API_TOKEN on the inspire-worker Worker, then retry.');
                }
                disconnectTimer = null;
              }, 12000);
            } else {
              setCallStatus('error');
              setErrorMessage('Could not connect media. Check microphone permissions and network connectivity.');
            }
          }
        };

        const channel = supabase
          .channel(`call_signals_${callId}_${user.id}`)
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'call_signals', filter: `call_id=eq.${callId}`,
          }, (payload) => { void processSignal(payload.new); })
          .subscribe(async (status) => {
            if (status !== 'SUBSCRIBED' || !mounted) return;
            const { data, error } = await supabase.from('call_signals').select('*').eq('call_id', callId).order('created_at', { ascending: true });
            if (!error && data) {
              if (isCaller && data.some((signal) => signal.event_type === 'offer' && signal.sender_id === user.id)) {
                offerSentRef.current = true;
              }
              for (const signal of data) await processSignal(signal);
            }
            if (isCaller && !offerSentRef.current && !endedRef.current && pc.signalingState === 'stable') {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await sendSignal('offer', { sdp: pc.localDescription });
              offerSentRef.current = true;
            }
          });
        channelRef.current = channel;
      } catch (error) {
        console.warn('Call setup failed:', error);
        if (mounted) {
          setCallStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Could not access microphone or camera. Check browser permissions.');
        }
      }
    };

    void setup();
    return () => {
      mounted = false;
      if (durationTimer) clearInterval(durationTimer);
      if (disconnectTimer) clearTimeout(disconnectTimer);
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
      peerConnectionRef.current?.close();
    };
  }, [callId, partner.id, type, isCaller, user?.id]);

  const handleEnd = async () => {
    if (!endedRef.current && user && isConfigured) {
      endedRef.current = true;
      await supabase.from('call_signals').insert({
        call_id: callId, sender_id: user.id, receiver_id: partner.id,
        event_type: 'hangup', payload: {},
      });
      await supabase.from('calls').update({
        status: duration > 0 ? 'answered' : 'missed',
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      }).eq('id', callId);
    }
    onEndCall(duration);
  };

  const handleToggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = isMuted; });
    setIsMuted((prev) => !prev);
  };
  const handleToggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = isVideoOff; });
    setIsVideoOff((prev) => !prev);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#081B47]/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-6 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-200">
            {callStatus === 'connecting' ? 'Calling…' : callStatus === 'connected' ? `${type.toUpperCase()} CALL · ${formatDuration(duration)}` : callStatus === 'error' ? 'Call error' : 'Call ended'}
          </p>
          <p className="font-black text-lg truncate">{partner.display_name || partner.username}</p>
        </div>
        <span className="text-[10px] rounded-full bg-white/10 px-2.5 py-1">WebRTC</span>
      </div>

      {type === 'video' ? (
        <div className="flex-1 min-h-0 flex flex-col gap-3 justify-center py-4">
          <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden bg-black/50 border border-white/15">
            <video ref={remoteVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            {callStatus !== 'connected' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4"><Avatar name={partner.display_name} avatarUrl={partner.avatar_url} size="xl" /><p className="text-sm">{callStatus === 'error' ? errorMessage : 'Waiting for the other person…'}</p></div>}
          </div>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-28 h-36 sm:w-36 sm:h-44 object-cover rounded-2xl bg-black/70 self-end border border-white/20" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <Avatar name={partner.display_name} avatarUrl={partner.avatar_url} size="xl" />
          <p className="text-sm text-blue-100">{callStatus === 'connected' ? `Connected · ${formatDuration(duration)}` : errorMessage || 'Waiting for the other person to answer…'}</p>

        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {callStatus === 'error' && errorMessage && <p role="alert" className="text-sm text-rose-200 text-center">{errorMessage}</p>}
      <div className="max-w-md mx-auto w-full flex items-center justify-around py-3">
        <button onClick={handleToggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center text-xl ${isMuted ? 'bg-red-500' : 'bg-white/15'}`} title={isMuted ? 'Unmute' : 'Mute'}>{isMuted ? '🔇' : '🎙️'}</button>
        {type === 'video' && <button onClick={handleToggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center text-xl ${isVideoOff ? 'bg-red-500' : 'bg-white/15'}`} title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}>{isVideoOff ? '🚫' : '📹'}</button>}
        <button onClick={() => void handleEnd()} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-2xl shadow-2xl" title="End call">📵</button>
      </div>
    </div>
  );
};
