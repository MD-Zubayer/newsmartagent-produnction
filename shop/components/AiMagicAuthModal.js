"use client";

import React, { useState, useEffect, useRef } from 'react';
import GoogleSignInButton from './GoogleSignInButton';
import {
  ShoppingBag,
  RotateCcw,
  X,
  ChevronDown,
  Sparkles,
  Plus,
  ArrowUp,
  CheckCircle2,
  Check,
  ShieldCheck
} from 'lucide-react';

export default function AiMagicAuthModal({
  isOpen = true,
  onClose,
  sessionCode = "demo",
  sessionData = null,
  initialCustomer = null,
  onSuccess
}) {
  const hasOrderData = Boolean(
    sessionData?.items &&
    sessionData.items.length > 0 &&
    (sessionData?.total_price || sessionData?.subtotal)
  );

  // Progressive Stream Phases:
  // For Order Flow:
  // 0: thinking
  // 1: typing order intro
  // 2: show order receipt div
  // 3: typing option 1 description (Google One Tap intro)
  // 4: show div 1 (Google One Tap card)
  // 5: typing option 2 description (Account chooser intro)
  // 6: show div 2 (Account chooser card) & complete
  //
  // For Direct Platform Link (No Order Flow):
  // 0: thinking
  // 1: typing direct welcome intro
  // 2: typing option 1 description (Google One Tap intro)
  // 3: show div 1 (Google One Tap card)
  // 4: typing option 2 description (Account chooser intro)
  // 5: show div 2 (Account chooser card) & complete
  const [streamPhase, setStreamPhase] = useState(0);

  const [displayedTextOrder, setDisplayedTextOrder] = useState('');
  const [displayedTextOpt1, setDisplayedTextOpt1] = useState('');
  const [displayedTextOpt2, setDisplayedTextOpt2] = useState('');

  const [showThoughtDetails, setShowThoughtDetails] = useState(false);
  const [promptSeed, setPromptSeed] = useState(0);
  const [authSuccessCustomer, setAuthSuccessCustomer] = useState(initialCustomer || null);

  const timersRef = useRef([]);
  const messageEndRef = useRef(null);

  const platform = sessionData?.source_platform || 'whatsapp';
  const platformName =
    platform === 'whatsapp' ? 'হোয়াটসঅ্যাপ' :
    platform === 'messenger' ? 'মেসেঞ্জার' :
    platform === 'instagram' ? 'ইনস্টাগ্রাম' : 'চ্যাট';

  // Dynamic Pool of Greetings & Intros
  const orderIntros = [
    `আসসালামু আলাইকুম! 👋 আপনার ${platformName} চ্যাটে চূড়ান্ত করা অর্ডারটি পেয়েছি। সব তথ্য যাচাই করে কার্ট বিবরণ নিচে প্রস্তুত করা হলো:`,
    `আসসালামু আলাইকুম! 🤖 আমি আপনার স্মার্ট শপ এআই সহকারী। ${platformName}-এ আলোচনা অনুযায়ী আপনার অর্ডারের তথ্য সফলভাবে লোড করা হয়েছে:`,
    `সালাম ও স্বাগতম! ✨ আপনার ${platformName} চ্যাট সেশনটি ভেরিফাই করা হয়েছে। নির্বাচিত পণ্য ও মোট মূল্যের বিবরণ নিচে সাজিয়ে দেওয়া হলো:`,
    `আসসালামু আলাইকুম! 📦 আপনার ${platformName} অর্ডার রিকোয়েস্টটি সফলভাবে প্রসেস করা হয়েছে! পণ্যের তালিকা ও হিসাব নিচে দেখে নিন:`,
    `নিরাপদ চ্যাট সেশন অ্যাক্টিভ! 🛡️ ${platformName}-এ আপনার শুরু করা অর্ডারটির তথ্য নিচে তুলে ধরা হলো:`
  ];

  const directIntros = [
    `আসসালামু আলাইকুম! 👋 ${platformName} চ্যাট থেকে আপনাকে স্বাগতম। আপনার ${platformName} প্রোফাইলের সাথে শপ অ্যাকাউন্ট লিঙ্ক করতে নিচে ২টি সহজ Google সাইন-ইন পদ্ধতি রয়েছে:`,
    `আসসালামু আলাইকুম! 🤖 আমি আপনার স্মার্ট শপ এআই সহকারী। ${platformName} থেকে সরাসরি যুক্ত হওয়ার জন্য ধন্যবাদ। প্রোফাইল সক্রিয় করতে নিচে ২টি বিকল্প দেওয়া হলো:`,
    `সালাম ও স্বাগতম! ✨ ${platformName}-এর সাথে আপনার শপ কানেক্ট করার জন্য প্রস্তুত। নিরাপদ চেকআউট নিশ্চিত করতে নিচের যেকোনো একটি উপায়ে সাইন ইন করুন:`,
    `আসসালামু আলাইকুম! 🛍️ ${platformName} চ্যাট কানেকশন সনাক্ত করা হয়েছে। অ্যাকাউন্টটি সুরক্ষিত রাখতে নিচে ২টি সহজ Google সাইন-আপ অপশন রয়েছে:`
  ];

  const opt1Descriptions = [
    `১. আপনি যদি কোনো পেজে রিডাইরেক্ট না হয়ে, আপনার ব্রাউজারে থাকা বর্তমান Google অ্যাকাউন্ট দিয়ে সরাসরি ১-ট্যাপে প্রবেশ করতে চান, তবে নিচের বাটনটি ব্যবহার করুন:`,
    `১. কোনো ঝামেলা ছাড়াই এবং নতুন কোনো পেজে না গিয়ে সরাসরি বর্তমান ডিভাইসে লগইন থাকা Google অ্যাকাউন্ট দিয়ে ১-ক্লিকে সাইন ইন করার অপশন:`,
    `১. দ্রুততম উপায়: আপনার ব্রাউজারের বর্তমান সচল Google অ্যাকাউন্টে ১-ট্যাপে সাইন ইন সম্পন্ন করতে নিচের বাটনটি চাপুন:`
  ];

  const opt2Descriptions = [
    `২. অথবা আপনি যদি অন্য কোনো নির্দিষ্ট Google অ্যাকাউন্ট বেছে নিয়ে সাইন ইন করতে চান, তবে নিচের অপশনটি ব্যবহার করুন:`,
    `২. আর আপনি যদি একাধিক অ্যাকাউন্টের মধ্য থেকে অন্য কোনো নির্দিষ্ট Google অ্যাকাউন্ট নির্বাচন করতে চান, তবে নিচের বাটনটি ব্যবহার করুন:`,
    `২. বিকল্প উপায়: নির্দিষ্ট কোনো জিমেইল অ্যাকাউন্ট সিলেক্ট করে লগইন করতে চাইলে নিচে অফিসিয়াল Google বাটনটিতে ট্যাপ করুন:`
  ];

  const clearAllTimers = () => {
    timersRef.current.forEach((t) => {
      clearTimeout(t);
      clearInterval(t);
    });
    timersRef.current = [];
  };

  const typeString = (fullString, setDisplayText, onDone, speed = 14) => {
    let charIdx = 0;
    const interval = setInterval(() => {
      charIdx += 2;
      if (charIdx >= fullString.length) {
        setDisplayText(fullString);
        clearInterval(interval);
        if (onDone) onDone();
      } else {
        setDisplayText(fullString.slice(0, charIdx));
      }
    }, speed);
    timersRef.current.push(interval);
  };

  const startStream = () => {
    clearAllTimers();
    setStreamPhase(0);
    setDisplayedTextOrder('');
    setDisplayedTextOpt1('');
    setDisplayedTextOpt2('');
    setAuthSuccessCustomer(null);

    const seed = Math.floor(Math.random() * 100);
    setPromptSeed(seed);

    const activeOrderIntro = orderIntros[seed % orderIntros.length];
    const activeDirectIntro = directIntros[seed % directIntros.length];
    const activeOpt1Desc = opt1Descriptions[seed % opt1Descriptions.length];
    const activeOpt2Desc = opt2Descriptions[seed % opt2Descriptions.length];

    if (hasOrderData) {
      const t0 = setTimeout(() => {
        setStreamPhase(1);
        typeString(activeOrderIntro, setDisplayedTextOrder, () => {
          const tOrderDiv = setTimeout(() => {
            setStreamPhase(2);
            const tOpt1DescStart = setTimeout(() => {
              setStreamPhase(3);
              typeString(activeOpt1Desc, setDisplayedTextOpt1, () => {
                const tDiv1 = setTimeout(() => {
                  setStreamPhase(4);
                  const tOpt2DescStart = setTimeout(() => {
                    setStreamPhase(5);
                    typeString(activeOpt2Desc, setDisplayedTextOpt2, () => {
                      const tDiv2 = setTimeout(() => {
                        setStreamPhase(6);
                      }, 350);
                      timersRef.current.push(tDiv2);
                    });
                  }, 400);
                  timersRef.current.push(tOpt2DescStart);
                }, 350);
                timersRef.current.push(tDiv1);
              });
            }, 450);
            timersRef.current.push(tOpt1DescStart);
          }, 350);
          timersRef.current.push(tOrderDiv);
        });
      }, 400);
      timersRef.current.push(t0);
    } else {
      const t0 = setTimeout(() => {
        setStreamPhase(1);
        typeString(activeDirectIntro, setDisplayedTextOrder, () => {
          const tOpt1Start = setTimeout(() => {
            setStreamPhase(2);
            typeString(activeOpt1Desc, setDisplayedTextOpt1, () => {
              const tDiv1 = setTimeout(() => {
                setStreamPhase(3);
                const tOpt2Start = setTimeout(() => {
                  setStreamPhase(4);
                  typeString(activeOpt2Desc, setDisplayedTextOpt2, () => {
                    const tDiv2 = setTimeout(() => {
                      setStreamPhase(5);
                    }, 350);
                    timersRef.current.push(tDiv2);
                  });
                }, 400);
                timersRef.current.push(tOpt2Start);
              }, 350);
              timersRef.current.push(tDiv1);
            });
          }, 400);
          timersRef.current.push(tOpt1Start);
        });
      }, 400);
      timersRef.current.push(t0);
    }
  };

  const handleLoginSuccess = (customer) => {
    setAuthSuccessCustomer(customer);
    if (onSuccess) {
      setTimeout(() => {
        onSuccess(customer);
      }, 600);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startStream();
    }
    return () => clearAllTimers();
  }, [isOpen, sessionCode, hasOrderData]);

  // Items & Pricing
  const items = sessionData?.items || [];
  const totalPrice = sessionData?.total_price || sessionData?.subtotal || items.reduce((acc, it) => acc + (it.price * (it.quantity || 1)), 0);
  const merchantName = sessionData?.merchant_shop_name || sessionData?.merchant_name || 'স্মার্ট শপ';

  // Smooth scroll to bottom
  useEffect(() => {
    if (streamPhase > 1 && messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [streamPhase, displayedTextOpt1, displayedTextOpt2, authSuccessCustomer]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        {/* ChatGPT Clean Light Header */}
        <header className="px-5 py-3.5 border-b border-zinc-200/80 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-zinc-900">ChatGPT</span>
                <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded-md border border-zinc-200">4o mini</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-normal">
                {authSuccessCustomer ? 'সফলভাবে লিঙ্ক হয়েছে ✓' : 'স্মার্ট শপ এআই প্রমাণীকরণ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={startStream}
              title="পুনরায় শুরু করুন"
              className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* ChatGPT Scrollable Conversation Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#fcfcfd]">
          {/* AI Message Bubble */}
          <div className="flex gap-3 items-start">
            <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>

            <div className="flex-1 space-y-3.5 text-sm">
              {/* ChatGPT Thought Process Pill */}
              <div className="inline-block">
                <button
                  onClick={() => setShowThoughtDetails(!showThoughtDetails)}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-800 bg-zinc-100/90 hover:bg-zinc-200/80 px-2.5 py-1 rounded-full transition-colors border border-zinc-200/60"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="font-medium">
                    {authSuccessCustomer ? 'Customer authenticated successfully' : 'Thought for a few seconds'}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${showThoughtDetails ? 'rotate-180' : ''}`} />
                </button>

                {showThoughtDetails && (
                  <div className="mt-2 p-3 rounded-xl bg-zinc-100/90 text-[11px] text-zinc-600 space-y-1 border border-zinc-200/80 font-mono">
                    <p>• Platform origin: {platform}</p>
                    <p>• Order payload status: {hasOrderData ? `Active (${items.length} items)` : 'Direct platform visitor'}</p>
                    <p>• Sequential UI: Option 1 (One Tap) → Option 2 (Account Chooser)</p>
                    <p>• Platform auto-linking: Active</p>
                  </div>
                )}
              </div>

              {/* Text 1: Streamed Greeting / Order Intro */}
              {streamPhase >= 1 && (
                <p className="text-[14px] leading-relaxed text-zinc-800">
                  {displayedTextOrder}
                  {streamPhase === 1 && <span className="inline-block w-2 h-4 bg-zinc-800 ml-0.5 animate-pulse align-middle" />}
                </p>
              )}

              {/* Order Summary Div (Only rendered when hasOrderData is true) */}
              {hasOrderData && streamPhase >= 2 && (
                <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-700 pb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      <span>{merchantName}</span>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full capitalize">
                      {platformName} লিঙ্কড ✓
                    </span>
                  </div>

                  <div className="space-y-2 pt-0.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div className="truncate pr-2">
                          <span className="font-semibold text-zinc-800">{item.name}</span>
                          {item.variant && <span className="text-zinc-500 text-[11px]"> ({item.variant})</span>}
                          <span className="text-zinc-400 text-[11px] font-medium"> × {item.quantity || 1}</span>
                        </div>
                        <span className="font-bold text-zinc-900 shrink-0">৳{(item.price || 0) * (item.quantity || 1)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2.5 border-t border-zinc-100 flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-medium">সর্বমোট পরিশোধযোগ্য মূল্য:</span>
                    <span className="font-black text-emerald-700 text-sm">৳{totalPrice}</span>
                  </div>
                </div>
              )}

              {/* Option 1 Description: Streamed text explaining Google One Tap */}
              {((hasOrderData && streamPhase >= 3) || (!hasOrderData && streamPhase >= 2)) && (
                <p className="text-[14px] leading-relaxed text-zinc-800 pt-1">
                  {displayedTextOpt1}
                  {((hasOrderData && streamPhase === 3) || (!hasOrderData && streamPhase === 2)) && (
                    <span className="inline-block w-2 h-4 bg-zinc-800 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>
              )}

              {/* Div 1: Google One Tap Card */}
              {((hasOrderData && streamPhase >= 4) || (!hasOrderData && streamPhase >= 3)) && (
                <div className="rounded-2xl bg-white border border-zinc-200/90 shadow-sm p-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <GoogleSignInButton
                    sessionCode={sessionCode}
                    mode="one_tap"
                    platformName={platformName}
                    theme="light"
                    onSuccess={handleLoginSuccess}
                  />
                </div>
              )}

              {/* Option 2 Description: Streamed text explaining Account Chooser */}
              {((hasOrderData && streamPhase >= 5) || (!hasOrderData && streamPhase >= 4)) && (
                <p className="text-[14px] leading-relaxed text-zinc-800 pt-1">
                  {displayedTextOpt2}
                  {((hasOrderData && streamPhase === 5) || (!hasOrderData && streamPhase === 4)) && (
                    <span className="inline-block w-2 h-4 bg-zinc-800 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>
              )}

              {/* Div 2: Google Account Chooser Card */}
              {((hasOrderData && streamPhase >= 6) || (!hasOrderData && streamPhase >= 5)) && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="rounded-2xl bg-white border border-zinc-200/90 shadow-sm p-3.5">
                    <GoogleSignInButton
                      sessionCode={sessionCode}
                      mode="account_chooser"
                      platformName={platformName}
                      theme="light"
                      onSuccess={handleLoginSuccess}
                    />
                  </div>

                  {/* Guaranteed platform linking badge */}
                  <div className="text-center pt-1">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 bg-zinc-100/90 px-3 py-1.5 rounded-full border border-zinc-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>উভয় মাধ্যমের যেকোনো একটি দিয়ে সাইন ইন করলেই আপনার <b>{platformName}</b> চ্যাট অ্যাকাউন্টের সাথে লিঙ্ক হয়ে যাবে</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Success Badge */}
              {authSuccessCustomer && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-300">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold">সফলভাবে গুগল অ্যাকাউন্ট লিঙ্ক হয়েছে!</p>
                    <p className="text-[11px] text-emerald-700">স্বাগতম {authSuccessCustomer?.name}। চেকআউটে নিয়ে যাওয়া হচ্ছে...</p>
                  </div>
                </div>
              )}

              {/* End Anchor */}
              <div ref={messageEndRef} />
            </div>
          </div>
        </div>

        {/* ChatGPT Bottom Input Bar */}
        <footer className="p-3.5 sm:p-4 border-t border-zinc-200 bg-white shrink-0">
          <div className="max-w-2xl mx-auto relative flex items-center bg-zinc-100/90 border border-zinc-300/80 rounded-3xl px-4 py-2.5 text-sm text-zinc-500 shadow-inner">
            <button className="p-1 rounded-full hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors mr-2">
              <Plus className="w-4 h-4" />
            </button>
            <input
              type="text"
              readOnly
              placeholder="লগইন অপশন নির্বাচন করুন..."
              className="bg-transparent text-xs sm:text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none flex-1 font-medium cursor-default"
            />
            <button
              disabled
              className="w-7 h-7 rounded-full bg-zinc-300 text-white flex items-center justify-center shrink-0 ml-2"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-1.5">
            <p className="text-[10px] text-zinc-400">
              ChatGPT can make mistakes. Verify important info.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
