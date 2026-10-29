"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { fetchStorefront, getStorefrontUrl } from '@/lib/api';
import ChatWidgetRenderer, { InChatOrderModal } from './ChatWidgetRenderer';
import MarkdownMessage from './MarkdownMessage';
import {
  Store,
  Sparkles,
  Send,
  Headphones,
  CheckCheck,
  ArrowLeft,
  Zap,
  UserCheck,
  Loader2,
  AlertCircle,
  Truck,
  MapPin,
  ShoppingBag,
  Package,
  Paperclip,
  X,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export function SellerAvatar({ src, name, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || 'S').trim().charAt(0).toUpperCase();

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-8 h-8 text-xs rounded-xl',
    header: 'w-9 h-9 sm:w-10 sm:h-10 text-sm rounded-xl',
    lg: 'w-12 h-12 text-base rounded-2xl',
  }[size] || 'w-8 h-8 text-xs rounded-xl';

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || 'Seller'}
        className={`${sizeClasses} object-cover border border-slate-700/80 bg-slate-800 shrink-0 shadow-sm ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} bg-gradient-to-br from-indigo-600 to-purple-600 border border-indigo-400/30 text-white font-bold flex items-center justify-center shrink-0 shadow-sm ${className}`}
      title={name || 'Seller'}
    >
      {initial}
    </div>
  );
}

export function AiAssistantAvatar({ src, name, size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    header: 'w-9 h-9 sm:w-10 sm:h-10',
    lg: 'w-12 h-12',
  }[size] || 'w-8 h-8';

  const badgeSizes = {
    sm: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
    md: 'w-4 h-4 -bottom-1 -right-1',
    header: 'w-4 h-4 -bottom-1 -right-1',
    lg: 'w-5 h-5 -bottom-1 -right-1',
  }[size] || 'w-4 h-4 -bottom-1 -right-1';

  return (
    <div className={`relative shrink-0 mt-0.5 ${sizeClasses}`}>
      <SellerAvatar
        src={src}
        name={name}
        size={size}
        className={`border-indigo-500/50 shadow-md ${className}`}
      />
      <span
        className={`absolute ${badgeSizes} rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg border-2 border-slate-900 ring-1 ring-indigo-400/40`}
        title="AI Assistant"
      >
        <Sparkles className="w-2.5 h-2.5 fill-current text-white" />
      </span>
    </div>
  );
}

function stripControlTags(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\[\[\s*(WIDGET|ACTION)\s*:\s*[a-zA-Z0-9_:+\-#]+\s*\]\]/gi, '')
    .replace(/\[\[\s*(WIDGET|ACTION)[^\]]*$/gi, '')
    .trim();
}

function parseMessageWithAttachment(rawContent, attachedProp = null) {
  if (attachedProp) return { text: rawContent, attachedProduct: attachedProp };
  if (!rawContent || typeof rawContent !== 'string') return { text: rawContent || '', attachedProduct: null };

  const match = rawContent.match(/^\[PRODUCT_ATTACHED\s+id=([^\s]+)\s+name="([^"]*)"\s+price="([^"]*)"\s+image="([^"]*)"\]\s*([\s\S]*)$/i);
  if (match) {
    return {
      text: match[5] || '',
      attachedProduct: {
        id: match[1],
        name: match[2],
        price: match[3],
        image: match[4],
      },
    };
  }
  return { text: rawContent, attachedProduct: null };
}

const DEFAULT_QUICK_PROMPTS = [
  'ডেলিভারি চার্জ কত?',
  'নতুন ঠিকানা যোগ করতে চাই',
  'কী কী প্রোডাক্ট স্টকে আছে?',
  'আমার অর্ডারের আপডেট কী?',
  'সেলারের সাথে কথা বলতে চাই',
];

function getWidgetCacheKey(merchantId) {
  return `smart_shop_chat_widgets_v1_${merchantId}`;
}

function readCachedWidgets(merchantId) {
  if (typeof window === 'undefined' || !merchantId) return {};
  try {
    const raw = window.localStorage.getItem(getWidgetCacheKey(merchantId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCachedWidgets(merchantId, msgId, widgets) {
  if (typeof window === 'undefined' || !merchantId || !msgId || !widgets?.length) return;
  try {
    const current = readCachedWidgets(merchantId);
    current[String(msgId)] = widgets;
    window.localStorage.setItem(getWidgetCacheKey(merchantId), JSON.stringify(current));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * REUSABLE CONVERSATIONAL UI ENGINE WINDOW
 * Can be embedded in full-screen `/messages`, inside a floating drawer on `/shop/[session]`,
 * or on any product/checkout page.
 */
export default function ChatEngineWindow({
  thread,
  visitorId,
  onBackMobile,
  onThreadUpdated,
  quickPrompts = DEFAULT_QUICK_PROMPTS,
  compact = false,
}) {
  const merchantId = thread?.merchant_id;

  const [messages, setMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(thread?.is_ai_enabled ?? true);
  const [isHumanNeeded, setIsHumanNeeded] = useState(thread?.is_human_needed ?? false);
  const [greetingMessage, setGreetingMessage] = useState(thread?.greeting_message || '');

  // Live Token Streaming & Smooth Typewriter State
  const [inputText, setInputText] = useState('');
  const [attachedProduct, setAttachedProduct] = useState(null); // { id, name, price, image }
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingWidgets, setStreamingWidgets] = useState([]);
  const [controlLoading, setControlLoading] = useState(false);
  const [widgetActionLoading, setWidgetActionLoading] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [activeOrderProduct, setActiveOrderProduct] = useState(null);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const activeMerchantIdRef = useRef(merchantId);
  const isStreamingRef = useRef(false);

  // Smooth token-by-token typewriter queue refs
  const targetStreamTextRef = useRef('');
  const displayedStreamTextRef = useRef('');
  const streamDoneEventRef = useRef(null);
  const animTimerRef = useRef(null);

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    });
    const doScroll = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: smooth ? 'smooth' : 'auto',
          block: 'end',
        });
      }
    };
    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 40);
    setTimeout(doScroll, 160);
  }, []);

  const stopTypewriterLoop = useCallback(() => {
    if (animTimerRef.current) {
      clearInterval(animTimerRef.current);
      animTimerRef.current = null;
    }
    targetStreamTextRef.current = '';
    displayedStreamTextRef.current = '';
    streamDoneEventRef.current = null;
  }, []);

  useEffect(() => {
    return () => stopTypewriterLoop();
  }, [stopTypewriterLoop]);

  const startTypewriterLoop = useCallback(
    (currentMerchantId) => {
      if (animTimerRef.current) return;
      animTimerRef.current = setInterval(() => {
        const target = targetStreamTextRef.current;
        const current = displayedStreamTextRef.current;

        if (current.length < target.length) {
          const remaining = target.length - current.length;
          const step = remaining > 80 ? 5 : remaining > 35 ? 3 : remaining > 12 ? 2 : 1;
          const nextText = target.slice(0, current.length + step);
          displayedStreamTextRef.current = nextText;
          setStreamingContent(nextText);
        } else if (streamDoneEventRef.current) {
          const doneEvent = streamDoneEventRef.current;
          stopTypewriterLoop();
          setIsThinking(false);
          setStreamingContent('');
          setStreamingWidgets([]);
          setIsStreaming(false);
          isStreamingRef.current = false;

          if (typeof doneEvent.is_ai_enabled === 'boolean') {
            setIsAiEnabled(doneEvent.is_ai_enabled);
          }
          if (typeof doneEvent.is_human_needed === 'boolean') {
            setIsHumanNeeded(doneEvent.is_human_needed);
          }

          if (doneEvent.assistant_message) {
            const finalMsg = doneEvent.assistant_message;
            if (finalMsg.widgets?.length) {
              writeCachedWidgets(currentMerchantId, finalMsg.id, finalMsg.widgets);
            }
            setMessages((prev) => {
              if (prev.some((m) => m.id === finalMsg.id)) return prev;
              return [...prev, finalMsg];
            });

            if (onThreadUpdated) {
              onThreadUpdated(currentMerchantId, {
                last_message: finalMsg.content,
                last_message_role: 'assistant',
                last_message_time: finalMsg.sent_at,
                is_ai_enabled: doneEvent.is_ai_enabled,
                is_human_needed: doneEvent.is_human_needed,
              });
            }
          }

          setTimeout(() => {
            scrollToBottom(true);
            inputRef.current?.focus();
          }, 40);
        }
      }, 18);
    },
    [onThreadUpdated, scrollToBottom, stopTypewriterLoop]
  );

  const fetchChatHistory = useCallback(
    async (mId, vid, silent = false) => {
      if (!mId || !vid) return;
      if (!silent) setHistoryLoading(true);
      try {
        const params = new URLSearchParams({
          merchant_id: String(mId),
          visitor_id: vid,
        });
        const data = await fetchStorefront(`/messages/history/?${params.toString()}`, {
          cache: 'no-store',
        });

        if (activeMerchantIdRef.current !== mId) return;

        const cachedMap = readCachedWidgets(mId);
        const incomingMsgs = (Array.isArray(data?.messages) ? data.messages : []).map((m) => {
          const cachedW = cachedMap[String(m.id)];
          return cachedW && (!m.widgets || m.widgets.length === 0)
            ? { ...m, widgets: cachedW }
            : m;
        });

        setMessages((prev) => {
          // Preserve any local interactive widget messages created during this session
          const localInteractive = prev.filter((pm) => String(pm.id).startsWith('local_widget_'));
          if (silent && prev.length >= incomingMsgs.length) {
            const lastServerPrev = [...prev]
              .reverse()
              .find((pm) => !String(pm.id).startsWith('local_widget_'));
            const lastInc = incomingMsgs[incomingMsgs.length - 1];
            if (
              lastServerPrev?.id === lastInc?.id &&
              lastServerPrev?.content === lastInc?.content
            ) {
              return prev;
            }
          }
          // Merge server messages + any local interactive widget cards
          return [...incomingMsgs, ...localInteractive];
        });

        if (data?.contact) {
          setIsAiEnabled(Boolean(data.contact.is_ai_enabled));
          setIsHumanNeeded(Boolean(data.contact.is_human_needed));
        }
        if (data?.greeting_message) {
          setGreetingMessage(data.greeting_message);
        }
        if (!silent) {
          setTimeout(() => scrollToBottom(false), 60);
        }
      } catch (err) {
        if (!silent) console.error('Failed to load chat history:', err);
      } finally {
        if (!silent) setHistoryLoading(false);
      }
    },
    [scrollToBottom]
  );

  // Reset and load history when thread changes
  useEffect(() => {
    if (!merchantId || !visitorId) return;
    stopTypewriterLoop();
    activeMerchantIdRef.current = merchantId;
    setIsAiEnabled(thread?.is_ai_enabled ?? true);
    setIsHumanNeeded(thread?.is_human_needed ?? false);
    setGreetingMessage(thread?.greeting_message || '');
    setStreamingContent('');
    setStreamingWidgets([]);
    setIsThinking(false);
    setIsStreaming(false);
    isStreamingRef.current = false;
    setErrorBanner('');
    fetchChatHistory(merchantId, visitorId, false);
  }, [merchantId, visitorId, fetchChatHistory, stopTypewriterLoop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 4 seconds for Seller manual replies
  useEffect(() => {
    if (!merchantId || !visitorId) return;
    const interval = setInterval(() => {
      if (!isStreamingRef.current) {
        fetchChatHistory(merchantId, visitorId, true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [merchantId, visitorId, fetchChatHistory]);

  // Auto-scroll when streaming tokens or widgets arrive
  useEffect(() => {
    if (streamingContent || isThinking || streamingWidgets.length > 0) {
      scrollToBottom(false);
    }
  }, [streamingContent, isThinking, streamingWidgets, scrollToBottom]);

  // Always scroll to latest/last message on entrance and when history finishes loading
  useEffect(() => {
    if (!historyLoading && messages.length > 0) {
      scrollToBottom(false);
    }
  }, [historyLoading, messages.length, merchantId, scrollToBottom]);

  // Send Message with Real-Time SSE Token Streaming + Interactive Widget Resolution
  const handleSendMessage = async (overrideText = null) => {
    const textToSend = (overrideText !== null ? overrideText : inputText).trim();
    if (!textToSend || !merchantId || isStreaming) return;

    const currentAttached = attachedProduct;
    if (overrideText === null) {
      setInputText('');
      setAttachedProduct(null);
    }
    setErrorBanner('');
    stopTypewriterLoop();

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      role: 'user',
      content: textToSend,
      attached_product: currentAttached,
      sent_at: new Date().toISOString(),
      sender_type: 'customer',
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setIsStreaming(true);
    isStreamingRef.current = true;
    setIsThinking(isAiEnabled);
    setStreamingContent('');
    setStreamingWidgets([]);
    scrollToBottom(true);

    if (onThreadUpdated) {
      onThreadUpdated(merchantId, {
        last_message: textToSend,
        last_message_role: 'user',
        last_message_time: new Date().toISOString(),
      });
    }

    try {
      const streamUrl = getStorefrontUrl('/messages/stream/');
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          merchant_id: merchantId,
          visitor_id: visitorId,
          message: textToSend,
          product_id: currentAttached?.id || null,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('মেসেজ পাঠাতে সমস্যা হয়েছে।');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const lines = rawEvent.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'user_saved' && event.user_message) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempId ? event.user_message : m))
                );
                if (typeof event.is_ai_enabled === 'boolean') {
                  setIsAiEnabled(event.is_ai_enabled);
                }
                if (typeof event.is_human_needed === 'boolean') {
                  setIsHumanNeeded(event.is_human_needed);
                }
              } else if (event.type === 'thinking') {
                setIsThinking(true);
              } else if (event.type === 'token') {
                setIsThinking(false);
                targetStreamTextRef.current += event.token || '';
                startTypewriterLoop(merchantId);
              } else if (event.type === 'widgets' && Array.isArray(event.widgets)) {
                setStreamingWidgets(event.widgets);
              } else if (event.type === 'human_mode') {
                stopTypewriterLoop();
                setIsThinking(false);
                setIsStreaming(false);
                isStreamingRef.current = false;
                setIsAiEnabled(false);
                if (typeof event.is_human_needed === 'boolean') {
                  setIsHumanNeeded(event.is_human_needed);
                }
              } else if (event.type === 'done') {
                if (targetStreamTextRef.current.length > 0) {
                  streamDoneEventRef.current = event;
                  startTypewriterLoop(merchantId);
                } else {
                  setIsThinking(false);
                  setStreamingContent('');
                  setStreamingWidgets([]);
                  setIsStreaming(false);
                  isStreamingRef.current = false;
                  if (event.assistant_message) {
                    if (event.assistant_message.widgets?.length) {
                      writeCachedWidgets(
                        merchantId,
                        event.assistant_message.id,
                        event.assistant_message.widgets
                      );
                    }
                    setMessages((prev) => [...prev, event.assistant_message]);
                  }
                }
              } else if (event.type === 'error') {
                stopTypewriterLoop();
                setIsThinking(false);
                setStreamingContent('');
                setStreamingWidgets([]);
                setIsStreaming(false);
                isStreamingRef.current = false;
                if (event.assistant_message) {
                  setMessages((prev) => [...prev, event.assistant_message]);
                } else if (event.message) {
                  setErrorBanner(event.message);
                }
              }
            } catch (parseErr) {
              console.warn('SSE JSON parse warning:', parseErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Streaming error:', err);
      stopTypewriterLoop();
      setErrorBanner('সংযোগে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setIsThinking(false);
      setStreamingContent('');
      setStreamingWidgets([]);
      setIsStreaming(false);
      isStreamingRef.current = false;
    }
  };

  // Trigger an interactive UI template directly (from toolbar or inside another widget)
  const handleOpenInteractiveTemplate = async (actionName) => {
    if (!merchantId || widgetActionLoading) return;
    setWidgetActionLoading(actionName);
    setErrorBanner('');
    try {
      const res = await fetchStorefront('/messages/widget-action/', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: merchantId,
          visitor_id: visitorId,
          action: actionName,
        }),
      });
      if (res?.success && res?.widget) {
        const localMsg = {
          id: `local_widget_${Date.now()}`,
          role: 'assistant',
          content:
            res.assistant_text ||
            'নিচের ইন্টারঅ্যাক্টিভ টেমপ্লেট থেকে আপনার অপশন নির্বাচন করুন:',
          sent_at: new Date().toISOString(),
          sender_type: 'ai',
          widgets: [res.widget],
        };
        setMessages((prev) => [...prev, localMsg]);
        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch (err) {
      setErrorBanner('টেমপ্লেট লোড করতে সমস্যা হয়েছে।');
    } finally {
      setWidgetActionLoading('');
    }
  };

  // Callback when a widget calculates a live quote and logs an assistant message on the server
  const handleWidgetQuoteCalculated = useCallback(
    (res) => {
      if (res?.assistant_message) {
        const msg = res.assistant_message;
        if (msg.widgets?.length) {
          writeCachedWidgets(merchantId, msg.id, msg.widgets);
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (onThreadUpdated) {
          onThreadUpdated(merchantId, {
            last_message: msg.content,
            last_message_role: 'assistant',
            last_message_time: msg.sent_at,
          });
        }
        setTimeout(() => scrollToBottom(true), 60);
      }
    },
    [merchantId, onThreadUpdated, scrollToBottom]
  );

  // Toggle AI / Request Seller Human Support
  const handleModeAction = async (action) => {
    if (!merchantId || controlLoading) return;
    setControlLoading(true);
    setErrorBanner('');
    try {
      const res = await fetchStorefront('/messages/control/', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: merchantId,
          visitor_id: visitorId,
          action,
        }),
      });
      if (res?.success) {
        setIsAiEnabled(Boolean(res.is_ai_enabled));
        setIsHumanNeeded(Boolean(res.is_human_needed));
        if (onThreadUpdated) {
          onThreadUpdated(merchantId, {
            is_ai_enabled: Boolean(res.is_ai_enabled),
            is_human_needed: Boolean(res.is_human_needed),
          });
        }
        if (res.notice_message) {
          await fetchChatHistory(merchantId, visitorId, true);
          scrollToBottom(true);
        }
      }
    } catch {
      setErrorBanner('মোড পরিবর্তন করতে সমস্যা হয়েছে।');
    } finally {
      setControlLoading(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      const date = new Date(iso);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col h-full min-h-0 min-w-0 max-w-full overflow-hidden bg-[#f8fafc] relative">
      {/* ─── CHAT HEADER ─── */}
      <div className="w-full px-2.5 sm:px-5 py-2.5 sm:py-3 border-b border-slate-200/90 bg-white/95 backdrop-blur-md flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 min-w-0 shadow-xs z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onBackMobile && (
            <button
              type="button"
              onClick={onBackMobile}
              className="md:hidden p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
              aria-label="Back to inbox"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative shrink-0">
            <SellerAvatar src={thread.logo} name={thread.shop_name} size="header" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-white ${isAiEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 truncate max-w-[120px] sm:max-w-[200px]">
                {thread.shop_name}
              </h2>
              {thread.session_code && !compact && (
                <Link
                  href={`/shop/${thread.session_code}`}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[10px] font-bold text-indigo-700 border border-indigo-200 transition-colors"
                >
                  <Store className="w-2.5 h-2.5" />
                  <span>শপ দেখুন</span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-1 mt-0.5">
              {isAiEnabled ? (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600 font-bold truncate">
                  <Zap className="w-3 h-3 fill-current shrink-0 text-emerald-500" />
                  <span className="truncate">AI লাইভ ইঞ্জিন চালু</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-amber-700 font-bold truncate">
                  <Headphones className="w-3 h-3 shrink-0 text-amber-600" />
                  <span className="truncate">
                    {isHumanNeeded ? 'সেলার সাপোর্ট মোড' : 'সেলার সরাসরি উত্তর দিচ্ছেন'}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {thread.session_code && !compact && (
            <Link
              href={`/shop/${thread.session_code}`}
              className="sm:hidden p-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200"
              title="শপ দেখুন"
            >
              <Store className="w-4 h-4" />
            </Link>
          )}

          {isAiEnabled ? (
            <button
              type="button"
              disabled={controlLoading}
              onClick={() => handleModeAction('request_human')}
              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] sm:text-xs font-bold transition-all disabled:opacity-50 shadow-xs"
              title="সরাসরি সেলারকে ডাকুন"
            >
              {controlLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Headphones className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">সেলারের সাথে কথা বলুন</span>
              <span className="sm:hidden">সেলার</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={controlLoading}
              onClick={() => handleModeAction('enable_ai')}
              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] sm:text-xs font-bold transition-all disabled:opacity-50 shadow-xs"
              title="পুনরায় AI রিপ্লাই চালু করুন"
            >
              {controlLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">AI চালু করুন</span>
              <span className="sm:hidden">AI</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── MESSAGES TIMELINE + INTERACTIVE WIDGET ENGINE ─── */}
      <div
        ref={messagesContainerRef}
        className="w-full flex-1 overflow-y-auto overflow-x-hidden px-2.5 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 min-h-0 min-w-0 bg-[#f8fafc]"
      >
        {/* Greeting Card */}
        {greetingMessage && (
          <div className="flex items-start gap-2.5 max-w-[94%] sm:max-w-[80%]">
            <AiAssistantAvatar
              src={thread.logo}
              name={thread.shop_name}
              size="md"
            />
            <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200/90 px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 shadow-md">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 mb-1">
                <Sparkles className="w-3 h-3 text-indigo-600 fill-indigo-100" />
                <span>{thread.shop_name} AI</span>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap font-medium">{greetingMessage}</p>
            </div>
          </div>
        )}

        {historyLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>পূর্ববর্তী মেসেজ লোড হচ্ছে...</span>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isCustomer = msg.role === 'user';
            const isSellerManual = !isCustomer && msg.sender_type === 'seller';

            if (isCustomer) {
              const parsed = parseMessageWithAttachment(msg.content, msg.attached_product);
              return (
                <div key={msg.id || index} className="flex justify-end">
                  <div className="max-w-[88%] sm:max-w-[70%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-600 to-indigo-700 text-white px-3.5 py-2.5 shadow-md shadow-indigo-600/20 space-y-1.5">
                    {parsed.attachedProduct && (
                      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/20 border border-white/15 text-left">
                        {parsed.attachedProduct.image ? (
                          <img
                            src={parsed.attachedProduct.image}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover bg-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-white/80" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-white truncate">
                            {parsed.attachedProduct.name}
                          </p>
                          <p className="text-[10px] text-indigo-200 font-semibold">
                            ৳{parsed.attachedProduct.price}
                          </p>
                        </div>
                      </div>
                    )}
                    <MarkdownMessage content={parsed.text} className="text-white" />
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-indigo-100">
                      <span>{formatTime(msg.sent_at)}</span>
                      <CheckCheck className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id || index}
                className="flex items-start gap-2.5 max-w-[94%] sm:max-w-[82%]"
              >
                <div className="shrink-0 mt-0.5">
                  {isSellerManual ? (
                    <SellerAvatar
                      src={thread.logo}
                      name={thread.shop_name}
                      size="md"
                      className="rounded-xl shadow-md border-emerald-500/30"
                    />
                  ) : (
                    <AiAssistantAvatar
                      src={thread.logo}
                      name={thread.shop_name}
                      size="md"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-white border border-slate-200/90 px-3.5 py-2.5 text-slate-800 shadow-md">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider mb-1">
                      {isSellerManual ? (
                        <span className="text-emerald-700 flex items-center gap-1 font-bold">
                          <UserCheck className="w-3 h-3 text-emerald-600" /> {thread.shop_name} (সেলার)
                        </span>
                      ) : (
                        <span className="text-indigo-600 flex items-center gap-1.5 font-bold">
                          <Sparkles className="w-3 h-3 text-indigo-600 fill-indigo-100" /> {thread.shop_name} AI
                        </span>
                      )}
                    </div>
                    <MarkdownMessage content={msg.content} />
                    <div className="flex items-center justify-end gap-2 mt-1 text-[10px] text-slate-400">
                      <span>{formatTime(msg.sent_at)}</span>
                    </div>
                  </div>

                  {/* Interactive UI Widgets Attached to Message */}
                  {Array.isArray(msg.widgets) && msg.widgets.length > 0 && (
                    <ChatWidgetRenderer
                      widgets={msg.widgets}
                      merchantId={merchantId}
                      visitorId={visitorId}
                      sessionCode={thread.session_code}
                      onQuoteCalculated={handleWidgetQuoteCalculated}
                      onOpenAddressForm={() => handleOpenInteractiveTemplate('open_address_form')}
                      onOpenOrderModal={(p) => setActiveOrderProduct(p)}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* ─── LIVE STREAMING / THINKING BUBBLE ─── */}
        {(isThinking || streamingContent) && (
          <div className="flex items-start gap-2.5 max-w-[94%] sm:max-w-[82%] animate-in fade-in duration-150">
            <AiAssistantAvatar
              src={thread.logo}
              name={thread.shop_name}
              size="md"
              className="animate-pulse"
            />

            <div className="flex-1 min-w-0">
              <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-white border border-indigo-200 px-3.5 py-2.5 text-slate-800 shadow-md">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 mb-1">
                  <Sparkles className="w-3 h-3 animate-spin fill-indigo-100" />
                  <span>AI লাইভ লিখছে...</span>
                </div>

                {isThinking && !streamingContent ? (
                  <div className="flex items-center gap-2 py-1 text-xs text-slate-600 font-medium">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                    </span>
                    <span className="text-slate-500">তথ্য যাচাই করা হচ্ছে...</span>
                  </div>
                ) : (
                  <MarkdownMessage
                    content={streamingContent}
                    isStreaming={true}
                  />
                )}
              </div>

              {streamingWidgets.length > 0 && (
                <ChatWidgetRenderer
                  widgets={streamingWidgets}
                  merchantId={merchantId}
                  visitorId={visitorId}
                  sessionCode={thread.session_code}
                  onQuoteCalculated={handleWidgetQuoteCalculated}
                  onOpenAddressForm={() => handleOpenInteractiveTemplate('open_address_form')}
                  onOpenOrderModal={(p) => setActiveOrderProduct(p)}
                />
              )}
            </div>
          </div>
        )}

        {errorBanner && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs max-w-md mx-auto shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── INTERACTIVE WIDGET TOOLBAR ─── */}
      <div className="w-full max-w-full min-w-0 px-2.5 sm:px-5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-slate-200/90 bg-white shrink-0">
        {/* Direct Interactive Template Triggers */}
        <button
          type="button"
          disabled={Boolean(widgetActionLoading) || isStreaming}
          onClick={() => handleOpenInteractiveTemplate('open_delivery_template')}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-700 transition-all disabled:opacity-40 shadow-xs"
        >
          {widgetActionLoading === 'open_delivery_template' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Truck className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="hidden sm:inline">ডেলিভারি চার্জ ও ঠিকানা</span>
          <span className="sm:hidden">ডেলিভারি চার্জ</span>
        </button>

        <button
          type="button"
          disabled={Boolean(widgetActionLoading) || isStreaming}
          onClick={() => handleOpenInteractiveTemplate('open_address_form')}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[11px] font-bold text-indigo-700 transition-all disabled:opacity-40 shadow-xs"
        >
          {widgetActionLoading === 'open_address_form' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <MapPin className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="hidden sm:inline">নতুন ঠিকানা ফর্ম</span>
          <span className="sm:hidden">ঠিকানা ফর্ম</span>
        </button>

        <button
          type="button"
          disabled={Boolean(widgetActionLoading) || isStreaming}
          onClick={() => handleOpenInteractiveTemplate('open_product_showcase')}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[11px] font-bold text-purple-700 transition-all disabled:opacity-40 shadow-xs"
        >
          {widgetActionLoading === 'open_product_showcase' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="hidden sm:inline">প্রোডাক্ট ক্যাটালগ</span>
          <span className="sm:hidden">ক্যাটালগ</span>
        </button>
      </div>

      {/* ─── LIVE RTL SLIDING PROMPT TICKER (মসৃণ লাইভ আরটিএল স্ক্রল) ─── */}
      {quickPrompts && quickPrompts.length > 0 && (
        <div className="relative w-full max-w-full min-w-0 overflow-hidden border-t border-slate-200/80 bg-slate-50 py-2 select-none">
          {/* Subtle edge fade gradients */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-r from-slate-50 to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-l from-slate-50 to-transparent z-10" />

          {/* Continuous looping RTL marquee track */}
          <div className="animate-marquee-rtl flex items-center gap-2">
            {[...quickPrompts, ...quickPrompts, ...quickPrompts].map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isStreaming}
                onClick={() => handleSendMessage(promptText)}
                className="shrink-0 px-3 py-1 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[11px] font-semibold text-slate-700 hover:text-indigo-700 shadow-xs transition-all active:scale-95 disabled:opacity-40"
              >
                {promptText}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── ATTACHED PRODUCT CHIP BAR (IF USER SELECTED OR DRAGGED A PRODUCT) ─── */}
      {attachedProduct && (
        <div className="px-2.5 sm:px-5 py-2 bg-indigo-50/80 border-t border-indigo-200 flex items-center justify-between gap-2.5 shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-indigo-200 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
              {attachedProduct.image ? (
                <img src={attachedProduct.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package className="w-4 h-4 text-indigo-600" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> সংযুক্ত পণ্য
              </span>
              <p className="text-xs font-bold text-slate-900 truncate">{attachedProduct.name}</p>
              <p className="text-[11px] text-emerald-600 font-bold">৳{attachedProduct.price}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedProduct(null)}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-800 border border-slate-200 transition-colors"
            title="পণ্য বাতিল করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── MESSAGE INPUT BAR WITH DRAG & DROP ZONE ─── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
          try {
            const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
            if (raw) {
              const data = JSON.parse(raw);
              if (data?.id && data?.name) {
                setAttachedProduct({
                  id: data.id,
                  name: data.name,
                  price: data.price || 0,
                  image: data.image || data.image_url || '',
                });
                if (!inputText.trim()) {
                  setInputText(`এই পণ্যটি (${data.name}) সম্পর্কে জানতে চাই।`);
                }
                inputRef.current?.focus();
              }
            }
          } catch (err) {
            console.warn('Drag drop parse error:', err);
          }
        }}
        className={`w-full max-w-full min-w-0 px-2.5 sm:px-5 py-2.5 sm:py-3 bg-white border-t transition-all flex items-end gap-1.5 sm:gap-2 shrink-0 relative shadow-sm ${isDraggingOver
          ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-400/40'
          : 'border-slate-200/90'
          }`}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 bg-indigo-50/90 backdrop-blur-sm z-30 flex items-center justify-center gap-2 text-indigo-700 font-bold text-xs pointer-events-none rounded-t-2xl animate-pulse">
            <Package className="w-5 h-5 text-indigo-600" />
            <span>পণ্যটি এখানে ছেড়ে দিন (Drop to Attach Product)</span>
          </div>
        )}

        {/* Quick Product Picker Button */}
        <button
          type="button"
          onClick={async () => {
            setShowProductPicker(true);
            if (!catalogProducts.length && merchantId) {
              setCatalogLoading(true);
              try {
                const res = await fetchStorefront(
                  `/shop/products/?session=${encodeURIComponent(thread.session_code || '')}`
                );
                setCatalogProducts(Array.isArray(res) ? res : []);
              } catch {
                setCatalogProducts([]);
              } finally {
                setCatalogLoading(false);
              }
            }
          }}
          className="h-10 sm:h-11 w-10 sm:w-11 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center shrink-0 transition-colors border border-slate-200 shadow-xs"
          title="পণ্য নির্বাচন করুন (Select Product)"
        >
          <Paperclip className="w-4 h-4 text-indigo-600" />
        </button>

        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              attachedProduct
                ? `সংযুক্ত পণ্যটি সম্পর্কে লিখুন...`
                : isAiEnabled
                  ? `${thread.shop_name}-কে মেসেজ লিখুন...`
                  : `${thread.shop_name}-এর সেলারকে লিখুন...`
            }
            className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none max-h-28 leading-relaxed transition-all shadow-inner"
          />
        </div>

        <button
          type="submit"
          disabled={(!inputText.trim() && !attachedProduct) || isStreaming}
          className="h-10 sm:h-11 w-10 sm:w-auto px-0 sm:px-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">পাঠান</span>
            </>
          )}
        </button>
      </form>

      {/* ─── MODAL: PRODUCT PICKER DRAWER ─── */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 flex flex-col shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">পণ্য নির্বাচন করুন</h3>
                  <p className="text-[11px] text-slate-500">যে পণ্যটি সম্পর্কে জানতে চান তা বেছে নিন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductPicker(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 space-y-2">
              {catalogLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span>পণ্য লোড হচ্ছে...</span>
                </div>
              ) : catalogProducts.length > 0 ? (
                catalogProducts.map((prod) => {
                  const img = prod.gallery?.[0]?.image || prod.gallery_images?.[0] || '';
                  const pr = prod.sale_price ?? prod.base_price ?? 0;
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        setAttachedProduct({
                          id: prod.id,
                          name: prod.name,
                          price: pr,
                          image: img,
                        });
                        setShowProductPicker(false);
                        if (!inputText.trim()) {
                          setInputText(`এই পণ্যটি (${prod.name}) সম্পর্কে জানতে চাই।`);
                        }
                        inputRef.current?.focus();
                      }}
                      className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 p-2 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {img ? (
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600">
                            {prod.name}
                          </p>
                          <p className="text-[11px] text-emerald-600 font-bold mt-0.5">৳{pr}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold shrink-0">
                        সিলেক্ট
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  কোনো পণ্য পাওয়া যায়নি।
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-Chat Direct Order Modal */}
      {activeOrderProduct && (
        <InChatOrderModal
          product={activeOrderProduct}
          merchantId={merchantId}
          visitorId={visitorId}
          onOrderPlaced={(res) => {
            handleWidgetQuoteCalculated(res);
            setActiveOrderProduct(null);
          }}
          onClose={() => setActiveOrderProduct(null)}
        />
      )}
    </div>
  );
}