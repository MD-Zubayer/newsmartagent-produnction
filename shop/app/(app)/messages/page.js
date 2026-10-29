"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useCustomer } from '@/lib/auth-context';
import { fetchStorefront } from '@/lib/api';
import { readSellerHistory } from '@/lib/shop-brand';
import ChatEngineWindow, { SellerAvatar } from '@/components/chat-engine/ChatEngineWindow';
import {
  MessageSquare,
  Store,
  Sparkles,
  Search,
  RefreshCw,
  ShoppingBag,
  ShieldCheck,
  UserCheck,
  ArrowLeft,
} from 'lucide-react';

function formatThreadLastMessage(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const match = raw.match(/^\[PRODUCT_ATTACHED\s+id=([^\s]+)\s+name="([^"]*)"\s+price="([^"]*)"\s+image="([^"]*)"\]\s*([\s\S]*)$/i);
  if (match) {
    const textPart = match[5] ? ` - ${match[5]}` : '';
    return `🛍️ ${match[2]}${textPart}`;
  }
  return raw;
}

const VISITOR_STORAGE_KEY = 'smart_shop_visitor_id_v1';

export function getOrCreateVisitorId() {
  if (typeof window === 'undefined') return '';
  try {
    let vid = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      window.localStorage.setItem(VISITOR_STORAGE_KEY, vid);
    }
    return vid;
  } catch {
    return 'v_fallback';
  }
}

export default function CustomerMessagesPage() {
  const { customer, isAuthenticated } = useCustomer();
  const [visitorId, setVisitorId] = useState('');
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedMerchantIdRef = useRef(null);

  useEffect(() => {
    setVisitorId(getOrCreateVisitorId());
  }, []);

  const selectThread = useCallback((thread, openMobile = true) => {
    selectedMerchantIdRef.current = thread.merchant_id;
    setSelectedThread(thread);
    if (openMobile) setMobileShowChat(true);
  }, []);

  const loadThreads = useCallback(
    async (vid, autoSelectFirst = false) => {
      if (!vid) return;
      try {
        const localSellers = readSellerHistory();
        const localMerchantIds = localSellers
          .map((s) => s.id)
          .filter((id) => /^\d+$/.test(String(id)))
          .join(',');

        const params = new URLSearchParams({ visitor_id: vid });
        if (localMerchantIds) params.set('merchant_ids', localMerchantIds);

        const data = await fetchStorefront(`/messages/threads/?${params.toString()}`, {
          cache: 'no-store',
        });
        const fetchedThreads = Array.isArray(data?.threads) ? data.threads : [];
        setThreads(fetchedThreads);

        if (autoSelectFirst && fetchedThreads.length > 0 && !selectedMerchantIdRef.current) {
          const openDirectlyOnMobile = fetchedThreads.length === 1;
          selectThread(fetchedThreads[0], openDirectlyOnMobile);
        } else if (selectedMerchantIdRef.current) {
          const updatedActive = fetchedThreads.find(
            (t) => t.merchant_id === selectedMerchantIdRef.current
          );
          if (updatedActive) {
            setSelectedThread((prev) => (prev ? { ...prev, ...updatedActive } : updatedActive));
          }
        }
      } catch (err) {
        console.error('Failed to load message threads:', err);
      } finally {
        setThreadsLoading(false);
      }
    },
    [selectThread]
  );

  useEffect(() => {
    if (visitorId) {
      loadThreads(visitorId, true);
    }
  }, [visitorId, isAuthenticated, loadThreads]);

  // Keep sidebar threads list fresh
  useEffect(() => {
    if (!visitorId) return;
    const interval = setInterval(() => {
      loadThreads(visitorId, false);
    }, 6000);
    return () => clearInterval(interval);
  }, [visitorId, loadThreads]);

  const handleThreadUpdated = useCallback((merchantId, updates) => {
    setThreads((prev) =>
      prev.map((t) =>
        t.merchant_id === merchantId
          ? {
            ...t,
            ...Object.fromEntries(
              Object.entries(updates).filter(([, v]) => v !== undefined)
            ),
          }
          : t
      )
    );
    setSelectedThread((prev) =>
      prev && prev.merchant_id === merchantId
        ? {
          ...prev,
          ...Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
          ),
        }
        : prev
    );
  }, []);

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

  const filteredThreads = threads.filter((t) =>
    (t.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 w-full h-full min-h-0 flex flex-col md:flex-row overflow-hidden bg-[#f8fafc]">
      {/* ─── LEFT SIDEBAR: SHOP / SELLER THREADS ─── */}
      <aside
        className={`w-full md:w-80 lg:w-96 xl:w-[400px] border-r border-slate-200/80 flex flex-col bg-white shrink-0 h-full min-h-0 min-w-0 ${mobileShowChat ? 'hidden md:flex' : 'flex'
          }`}
      >
        {/* Sidebar Header */}
        <div className="px-4 py-3.5 border-b border-slate-100 space-y-2.5 bg-slate-50/70 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/shop"
                className="md:hidden p-2 -ml-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                title="শপে ফিরুন"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), #ffffff)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>মেসেজ ইনবক্স</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Sparkles className="w-2.5 h-2.5" /> AI Engine
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  সেলার ও AI ইঞ্জিনের সাথে লাইভ চ্যাট
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadThreads(visitorId, false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="শপ বা বিক্রেতা খুঁজুন..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-xs transition-colors"
            />
          </div>
        </div>

        {/* Threads List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0 bg-white">
          {threadsLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 animate-pulse">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-100 rounded w-2/3" />
                    <div className="h-2.5 bg-slate-50 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredThreads.length > 0 ? (
            filteredThreads.map((thread) => {
              const isSelected = selectedThread?.merchant_id === thread.merchant_id;
              return (
                <button
                  key={thread.merchant_id}
                  type="button"
                  onClick={() => selectThread(thread, true)}
                  className={`w-full p-3.5 flex items-start gap-3 text-left transition-all ${isSelected
                      ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600 shadow-xs'
                      : 'hover:bg-slate-50'
                    }`}
                >
                  <div className="relative shrink-0">
                    <SellerAvatar src={thread.logo} name={thread.shop_name} size="lg" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${thread.is_ai_enabled ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      title={
                        thread.is_ai_enabled ? 'AI Auto-Reply Active' : 'Seller Support Mode'
                      }
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {thread.shop_name}
                      </h3>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {formatTime(thread.last_message_time)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 truncate mt-1">
                      {thread.last_message ? (
                        <>
                          {thread.last_message_role === 'user' && (
                            <span className="text-indigo-600 font-bold">আপনি: </span>
                          )}
                          {formatThreadLastMessage(thread.last_message)}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">
                          কথা শুরু করতে ট্যাপ করুন...
                        </span>
                      )}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      {thread.is_ai_enabled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Sparkles className="w-2.5 h-2.5" /> AI অ্যাসিস্ট্যান্ট
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          <UserCheck className="w-2.5 h-2.5" /> সেলার মোড
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center space-y-3">
              <Store className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">কোনো শপ পাওয়া যায়নি।</p>
              <Link
                href="/shop"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>শপ ঘুরে দেখুন</span>
              </Link>
            </div>
          )}
        </div>

        {/* Connected Identity Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5 truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate font-medium">
              {isAuthenticated ? `${customer?.name} হিসেবে সংযুক্ত` : 'গেস্ট মোডে চ্যাট করছেন'}
            </span>
          </span>
          {!isAuthenticated && (
            <Link
              href="/login"
              className="text-indigo-600 hover:text-indigo-700 font-bold shrink-0"
            >
              লগইন
            </Link>
          )}
        </div>
      </aside>

      {/* ─── RIGHT PANE: REUSABLE CONVERSATIONAL UI ENGINE ─── */}
      <section
        className={`w-full md:w-auto md:flex-1 flex flex-col h-full min-h-0 min-w-0 relative ${mobileShowChat ? 'flex' : 'hidden md:flex'
          }`}
      >
        {!selectedThread ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h2 className="text-lg font-bold text-white">একটি শপ নির্বাচন করুন</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                বাম পাশের তালিকা থেকে যেকোনো শপে ক্লিক করে সরাসরি AI অ্যাসিস্ট্যান্ট বা সেলারের সাথে লাইভ চ্যাট শুরু করুন।
              </p>
            </div>
          </div>
        ) : (
          <ChatEngineWindow
            thread={selectedThread}
            visitorId={visitorId}
            onBackMobile={() => setMobileShowChat(false)}
            onThreadUpdated={handleThreadUpdated}
          />
        )}
      </section>
    </div>
  );
}
