"use client";

import React, { useState, useEffect, useRef } from 'react';
import { fetchStorefront } from '@/lib/api';
import {
  PhoneCall,
  PhoneOff,
  Store,
  Volume2,
  Check,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export default function InteractiveVoiceCallModal({
  isOpen,
  order,
  voiceConfig,
  shopName,
  shopAvatar,
  onClose,
  onActionComplete
}) {
  const [callState, setCallState] = useState('incoming'); // 'incoming', 'connected', 'ended'
  const [callResultMsg, setCallResultMsg] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const ringAudioRef = useRef(null);
  const audioRef = useRef(null);
  const ringtoneTimerRef = useRef(null);

  const orderIdentifier = order?.public_id || order?.id;
  const storeName = shopName || order?.shop_name || "Smart Shop BD";
  const avatarUrl = shopAvatar || order?.merchant_avatar || null;
  const feedbackAudioRef = useRef(null);

  const stopAudioSafe = (ref) => {
    if (ref.current) {
      try {
        ref.current.onerror = null;
        ref.current.onended = null;
        ref.current.pause();
        ref.current.currentTime = 0;
        ref.current.removeAttribute('src');
        ref.current.load();
      } catch (e) { }
      ref.current = null;
    }
  };

  const clearTimersAndAudio = () => {
    stopAudioSafe(ringAudioRef);
    stopAudioSafe(audioRef);
    stopAudioSafe(feedbackAudioRef);
    if (ringtoneTimerRef.current) {
      clearTimeout(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen || !order) {
      clearTimersAndAudio();
      setCallState('incoming');
      setCallResultMsg(null);
      setIsProcessing(false);
      return;
    }

    clearTimersAndAudio();
    setCallState('incoming');
    setCallResultMsg(null);
    setIsProcessing(false);

    // Start incoming phone ringtone
    try {
      const ring = new Audio('/audio/phone_ring.wav');
      ring.loop = true;
      ringAudioRef.current = ring;
      ring.play().catch((err) => console.log('Ringtone autoplay prevented:', err));
    } catch (e) {
      console.warn('Ringtone error:', e);
    }

    // Auto-timeout if incoming call is not answered in 35 seconds
    ringtoneTimerRef.current = setTimeout(() => {
      handleCallAction('timeout');
    }, 35000);

    return () => {
      clearTimersAndAudio();
    };
  }, [isOpen, orderIdentifier]);

  const handleAnswerCall = () => {
    // Stop ringtone and incoming timeout immediately on answer
    stopAudioSafe(ringAudioRef);
    if (ringtoneTimerRef.current) {
      clearTimeout(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }
    setCallState('connected');

    // Synchronously create and play audio directly in user touch/click event loop
    try {
      stopAudioSafe(audioRef);

      // Prioritize audio from order or static public audio folder
      const candidateAudio = voiceConfig?.audio_url || order?.voice_config?.audio_url || order?.voice_audio_url || '/audio/default_order_call.mp3';
      const separator = candidateAudio.includes('?') ? '&' : '?';
      const freshUrl = `${candidateAudio}${separator}_t=${Date.now()}`;

      const sound = new Audio(freshUrl);
      sound.preload = 'auto';
      audioRef.current = sound;

      // Fallback to default local mp3 ONLY if candidate genuinely fails to load while still active
      sound.onerror = () => {
        if (audioRef.current === sound && sound.src && !sound.src.includes('default_order_call.mp3')) {
          console.info("[VoiceModal] Falling back to /audio/default_order_call.mp3");
          sound.onerror = null;
          sound.src = `/audio/default_order_call.mp3?_t=${Date.now()}`;
          sound.play().catch(() => { });
        }
      };

      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Browser blocked sound playback:", err);
        });
      }
    } catch (err) {
      console.warn("Audio initialization error:", err);
    }
  };

  const [actionDone, setActionDone] = useState(null);

  const playVoiceFeedback = (audioFilePath, fallbackText) => {
    try {
      stopAudioSafe(feedbackAudioRef);
      const freshUrl = `${audioFilePath}?_t=${Date.now()}`;
      const feedbackAudio = new Audio(freshUrl);
      feedbackAudioRef.current = feedbackAudio;

      feedbackAudio.onerror = () => {
        if (feedbackAudioRef.current === feedbackAudio && fallbackText) {
          feedbackAudio.onerror = null;
          const encoded = encodeURIComponent(fallbackText);
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=bn&client=tw-ob`;
          const alt = new Audio(ttsUrl);
          feedbackAudioRef.current = alt;
          alt.play().catch(() => { });
        }
      };
      feedbackAudio.play().catch((e) => {
        if (feedbackAudioRef.current === feedbackAudio && fallbackText) {
          feedbackAudio.onerror = null;
          const encoded = encodeURIComponent(fallbackText);
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=bn&client=tw-ob`;
          const alt = new Audio(ttsUrl);
          feedbackAudioRef.current = alt;
          alt.play().catch(() => { });
        }
      });
    } catch (err) {
      console.warn("Feedback voice error:", err);
    }
  };

  const handleCallAction = async (actionKey) => {
    if (!orderIdentifier || isProcessing) return;
    setIsProcessing(true);
    clearTimersAndAudio();
    setActionDone(actionKey);

    // Play local action audio feedback immediately on button press with fallback
    if (actionKey === '1') {
      playVoiceFeedback("/audio/action_confirm.mp3", "অর্ডারটি কনফার্ম করার জন্য ধন্যবাদ।");
    } else if (actionKey === '2') {
      playVoiceFeedback("/audio/action_cancel.mp3", "আপনার অর্ডারটি সফলভাবে বাতিল করা হয়েছে।");
    } else if (actionKey === '3') {
      playVoiceFeedback("/audio/action_support.mp3", "আমাদের প্রতিনিধি খুব শীঘ্রই আপনার সাথে যোগাযোগ করবেন।");
    } else if (actionKey === 'end') {
      // Only play end voice when customer explicitly taps "End Call" while connected
      playVoiceFeedback("/audio/action_end.mp3", "কলটি সমাপ্ত করা হলো।");
    }

    try {
      const res = await fetchStorefront(`/orders/${orderIdentifier}/voice-action/`, {
        method: 'POST',
        body: JSON.stringify({ action: actionKey })
      });
      setCallResultMsg(res?.message || 'আপনার অনুরোধ সফলভাবে গ্রহণ করা হয়েছে');
      setCallState('ended');
      if (onActionComplete) onActionComplete(res);
      setTimeout(() => {
        if (onClose) onClose();
      }, 3000);
    } catch (err) {
      setCallResultMsg(err.message || 'অনুরোধ সম্পন্ন করা যায়নি');
      setCallState('ended');
      setTimeout(() => {
        if (onClose) onClose();
      }, 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fadeIn p-4 sm:p-6 text-white font-sans select-none">
      <div className="w-full max-w-sm h-[92vh] max-h-[680px] bg-gradient-to-b from-slate-900 via-slate-950 to-black rounded-[42px] border border-white/10 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">

        {/* Top Status & Store Brand */}
        <div className="text-center pt-4 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[11px] font-medium text-slate-300 tracking-wide backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified Smart Store</span>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-white mt-2">
            {storeName}
          </h2>

          <p className="text-xs font-medium text-slate-400">
            {callState === 'incoming' && 'Incoming Audio Call...'}
            {callState === 'connected' && '00:09 • Connected'}
            {callState === 'ended' && 'Call Ended'}
          </p>
        </div>

        {/* Center Animated Caller Avatar / Visualizer */}
        <div className="flex flex-col items-center justify-center my-auto space-y-4">
          <div className="relative">
            {callState === 'incoming' && (
              <>
                <span className="absolute -inset-4 rounded-full border border-emerald-500/30 animate-ping opacity-75" />
                <span className="absolute -inset-8 rounded-full border border-emerald-500/20 animate-pulse" />
              </>
            )}
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-white/20 flex items-center justify-center shadow-2xl relative z-10 overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={storeName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center ${avatarUrl ? 'hidden' : ''}`}>
                {callState === 'connected' ? (
                  <Volume2 className="w-11 h-11 text-emerald-400 animate-pulse" />
                ) : (
                  <Store className="w-11 h-11 text-slate-300" />
                )}
              </div>
              {callState === 'connected' && (
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
              )}
            </div>
          </div>

          {/* Bill Details Pill */}
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
            অর্ডার নং: <span className="text-indigo-400 font-bold font-mono">#{order.id}</span> • মোট: <span className="text-white font-bold font-mono">৳{order.total_price || order.price}</span>
          </div>
        </div>

        {/* CALL STATE: INCOMING (Accept or Decline) */}
        {callState === 'incoming' && (
          <div className="pb-6 space-y-6">
            <p className="text-center text-[11px] text-slate-400 tracking-wide">
              অর্ডারটি কনফার্ম করতে কল রিসিভ করুন
            </p>

            <div className="flex items-center justify-around px-4">
              {/* Decline Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCallAction('timeout')}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 flex items-center justify-center text-white shadow-lg shadow-red-600/30 transition-all"
                  title="Decline"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <span className="text-xs font-medium text-slate-400">Decline</span>
              </div>

              {/* Accept Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleAnswerCall}
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 transition-all animate-bounce"
                  title="Accept"
                >
                  <PhoneCall className="w-7 h-7" />
                </button>
                <span className="text-xs font-medium text-slate-400">Accept</span>
              </div>
            </div>
          </div>
        )}

        {/* CALL STATE: CONNECTED (Keypad 1, 2, 3) */}
        {callState === 'connected' && (
          <div className="pb-4 space-y-5 animate-fadeIn">
            {/* Voice Guidance Note in Bangla */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center text-xs text-slate-300 leading-relaxed">
              <p className="text-slate-400 text-[11px] mb-1 font-semibold uppercase tracking-wider">ভয়েস নির্দেশনা</p>
              <p className="font-medium text-white">কনফার্ম করতে <strong className="text-emerald-400">১</strong> চাপুন • বাতিল করতে <strong className="text-red-400">২</strong> • কথা বলতে <strong className="text-amber-400">৩</strong></p>
            </div>

            {/* Native Dialpad Grid */}
            <div className="grid grid-cols-3 gap-3.5 px-2">
              {/* Key 1: Confirm */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleCallAction('1')}
                className="h-16 rounded-2xl bg-white/10 hover:bg-emerald-500/20 active:scale-95 border border-white/10 hover:border-emerald-500/50 flex flex-col items-center justify-center transition-all group"
              >
                <span className="text-2xl font-bold text-white group-hover:text-emerald-400">1</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-300">Confirm</span>
              </button>

              {/* Key 2: Cancel */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleCallAction('2')}
                className="h-16 rounded-2xl bg-white/10 hover:bg-red-500/20 active:scale-95 border border-white/10 hover:border-red-500/50 flex flex-col items-center justify-center transition-all group"
              >
                <span className="text-2xl font-bold text-white group-hover:text-red-400">2</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-red-300">Cancel</span>
              </button>

              {/* Key 3: Support */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleCallAction('3')}
                className="h-16 rounded-2xl bg-white/10 hover:bg-amber-500/20 active:scale-95 border border-white/10 hover:border-amber-500/50 flex flex-col items-center justify-center transition-all group"
              >
                <span className="text-2xl font-bold text-white group-hover:text-amber-400">3</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-300">Support</span>
              </button>
            </div>

            {/* Bottom End Call Button */}
            <div className="flex flex-col items-center pt-2">
              <button
                type="button"
                onClick={() => handleCallAction('end')}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 flex items-center justify-center text-white shadow-lg shadow-red-600/30 transition-all"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="text-[11px] font-medium text-slate-400 mt-1.5">End Call</span>
            </div>
          </div>
        )}

        {/* CALL STATE: ENDED */}
        {callState === 'ended' && (
          <div className="pb-10 text-center space-y-3 animate-fadeIn">
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center shadow-lg ${actionDone === '1'
                ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 shadow-emerald-500/20'
                : actionDone === '2'
                  ? 'bg-red-500/20 border-2 border-red-500 text-red-400 shadow-red-500/20'
                  : actionDone === '3'
                    ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400 shadow-amber-500/20'
                    : 'bg-slate-800 border-2 border-slate-700 text-slate-300'
              }`}>
              {actionDone === '1' ? (
                <Check className="w-8 h-8" />
              ) : actionDone === '2' ? (
                <PhoneOff className="w-7 h-7" />
              ) : actionDone === '3' ? (
                <PhoneCall className="w-7 h-7" />
              ) : (
                <PhoneOff className="w-7 h-7 text-slate-400" />
              )}
            </div>
            <h4 className="text-base font-bold text-white px-2">
              {callResultMsg || (actionDone === '1' ? 'অর্ডারটি সফলভাবে নিশ্চিত করা হয়েছে!' : actionDone === '2' ? 'অর্ডারটি বাতিল করা হয়েছে' : 'কল সমাপ্ত হয়েছে')}
            </h4>
            <p className="text-xs text-slate-400">
              {actionDone === '1' ? 'অর্ডার ট্র্যাকিং পেজ আপডেট হচ্ছে...' : actionDone === '2' ? 'অর্ডার স্ট্যাটাস আপডেট হচ্ছে...' : 'উইন্ডো বন্ধ হচ্ছে...'}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
