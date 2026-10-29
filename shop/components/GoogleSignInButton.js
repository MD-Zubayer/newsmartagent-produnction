"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useCustomer } from '@/lib/auth-context';
import { detectInAppBrowser, getChromeIntentUrl } from '@/lib/browser';
import { ShieldCheck, ExternalLink, Globe, Sparkles, Zap, CheckCircle2, Loader2 } from 'lucide-react';

export default function GoogleSignInButton({
  sessionCode,
  onSuccess,
  mode = "all", // "one_tap" | "account_chooser" | "all"
  platformName = "চ্যাট",
  theme = "light"
}) {
  const { loginWithGoogleToken, loginWithInstantToken } = useCustomer();
  const [browserInfo, setBrowserInfo] = useState({ isInApp: false, isAndroid: false, isIOS: false, appName: null });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const googleBtnRef = useRef(null);
  const googleOneTapBtnRef = useRef(null);

  useEffect(() => {
    setBrowserInfo(detectInAppBrowser());
  }, []);

  const handleCredentialResponse = async (response) => {
    if (!response.credential) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const customer = await loginWithGoogleToken(response.credential, sessionCode);
      setSuccessInfo(customer?.name || 'গুগল অ্যাকাউন্ট');
      if (onSuccess) {
        setTimeout(() => onSuccess(customer), 600);
      }
    } catch (err) {
      setErrorMsg(err.message || 'গুগল লগইন সম্পন্ন করা যায়নি। পুনরায় চেষ্টা করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  // Google One Tap Trigger Handler
  const triggerOneTapPrompt = async () => {
    setErrorMsg(null);
    setIsLoading(true);

    // 1. If demo or test session, immediately perform 1-click token authentication
    if (sessionCode === 'demo' || sessionCode?.startsWith('test_')) {
      try {
        const cust = await loginWithInstantToken(sessionCode);
        setSuccessInfo(cust?.name || 'ডেমো গুগল ইউজার');
        if (onSuccess) setTimeout(() => onSuccess(cust), 400);
      } catch (e) {
        setErrorMsg(e.message || 'ডেমো অথেন্টিকেশন ব্যর্থ হয়েছে');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. Real session: trigger Google One Tap
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          setIsLoading(false);
          if (notification.isNotDisplayed()) {
            const reason = typeof notification.getNotDisplayedReason === 'function'
              ? notification.getNotDisplayedReason()
              : 'unknown';
            console.warn('One Tap not displayed reason:', reason);
            if (reason === 'unregistered_origin') {
              setErrorMsg('গুগল ওয়ান-ট্যাপ ত্রুটি: ডোমেনটি Google Cloud Console-এ অনুমোদিত নয়। নিচের সাধারণ গুগল বাটনে ক্লিক করুন।');
            } else if (reason === 'suppressed_by_user') {
              setErrorMsg('ব্রাউজারের ওয়ান-ট্যাপ সাময়িকভাবে কুলডাউনে রয়েছে। নিচের ২নং অপশন দিয়ে গুগল অ্যাকাউন্ট সিলেক্ট করুন।');
            } else {
              setErrorMsg('ব্রাউজারের ওয়ান-ট্যাপ ব্লক থাকলে নিচের ২নং অপশন দিয়ে সরাসরি গুগল অ্যাকাউন্ট নির্বাচন করুন।');
            }
          }
        });
        setTimeout(() => setIsLoading(false), 2000);
      } catch (err) {
        setIsLoading(false);
        console.warn('One Tap prompt error:', err);
        setErrorMsg('গুগল ওয়ান-ট্যাপ চালু করা যায়নি। নিচে ২নং অপশন দিয়ে সাইন ইন করুন।');
      }
    } else {
      setIsLoading(false);
      setErrorMsg('গুগল সার্ভিস লোড হচ্ছে, অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।');
    }
  };

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: true,
            cancel_on_tap_outside: false,
          });

          // Render Google button for standard Account Selector if container exists
          if (googleBtnRef.current) {
            googleBtnRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: theme === 'light' ? 'outline' : 'filled_black',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'signin_with',
              logo_alignment: 'left',
              width: 280,
            });
          }

          // Render Google button for One Tap card if container exists
          if (googleOneTapBtnRef.current) {
            googleOneTapBtnRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleOneTapBtnRef.current, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'continue_with',
              logo_alignment: 'left',
              width: 280,
            });
          }

          // Trigger One Tap automatically on page load if not in in-app browser
          if (!browserInfo.isInApp && mode !== 'account_chooser') {
            window.google.accounts.id.prompt();
          }
        } catch (e) {
          console.warn('Google Identity error:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          initGoogle();
          clearInterval(timer);
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [sessionCode, browserInfo.isInApp, theme, mode]);

  // If in-app browser detected
  if (browserInfo.isInApp) {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const chromeUrl = getChromeIntentUrl(currentUrl);

    return (
      <div className="w-full max-w-sm mx-auto p-4 rounded-2xl bg-indigo-50/90 border border-indigo-100 text-center space-y-3 shadow-sm">
        <div className="flex items-center justify-center gap-2 text-indigo-900 font-semibold text-sm">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-indigo-100 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </span>
          <span>নিরাপদভাবে সাইন ইন চালিয়ে যান</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {browserInfo.appName || 'এই অ্যাপ'}-এর ভেতরের ব্রাউজারে Google সাইন ইন সীমিত থাকতে পারে। আপনার পরিচিত ব্রাউজারে খুললে প্রক্রিয়াটি সহজে সম্পন্ন হবে।
        </p>

        {browserInfo.isAndroid ? (
          <a
            href={chromeUrl}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs transition-colors shadow-sm shadow-indigo-200"
          >
            <Globe className="w-4 h-4" />
            <span>নিরাপদভাবে ব্রাউজারে খুলুন</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <div className="p-3 rounded-xl bg-white border border-indigo-100 text-xs text-slate-600">
            উপরের শেয়ার/থ্রি-ডট মেনু থেকে <b className="text-indigo-700">ব্রাউজারে খুলুন</b> নির্বাচন করুন।
          </div>
        )}
        <p className="text-[11px] text-slate-500">আপনার অর্ডারের তথ্য সুরক্ষিত সংযোগে থাকবে।</p>
      </div>
    );
  }

  // 1) ONLY Google One Tap Card
  if (mode === "one_tap") {
    return (
      <div className="w-full space-y-2.5">
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
            {errorMsg}
          </div>
        )}

        {successInfo && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successInfo} হিসেবে সফলভাবে লিঙ্ক হয়েছে!</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/90 shadow-sm space-y-3 transition-all hover:border-emerald-300">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded-lg bg-emerald-600 text-white">
                <Zap className="w-3 h-3 fill-white" />
              </span>
              <span>১) Google One Tap (স্বয়ংক্রিয় ১-ট্যাপে সাইন ইন)</span>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
              কোনো রিডাইরেক্ট ছাড়া
            </span>
          </div>
          <p className="text-[12px] text-zinc-600 leading-relaxed">
            ব্রাউজারে বর্তমানে লগইন থাকা Google অ্যাকাউন্ট দিয়ে কোনো পেজে রিডাইরেক্ট না হয়ে সরাসরি ১-ট্যাপে প্রবেশ করুন:
          </p>

          <button
            type="button"
            onClick={triggerOneTapPrompt}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-[#10a37f] hover:bg-[#0d8c6d] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/15 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Google অ্যাকাউন্ট কানেক্ট হচ্ছে...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>বর্তমান Google অ্যাকাউন্ট দিয়ে ১-ট্যাপে প্রবেশ করুন</span>
              </>
            )}
          </button>

          {/* Official Google Continue Button */}
          <div className="pt-1 flex flex-col items-center">
            <div ref={googleOneTapBtnRef} className="min-h-[40px] flex items-center justify-center" />
          </div>
        </div>
      </div>
    );
  }

  // 2) ONLY Standard Google Account Chooser Card
  if (mode === "account_chooser") {
    return (
      <div className="w-full space-y-2">
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
            {errorMsg}
          </div>
        )}

        {successInfo && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successInfo} হিসেবে সফলভাবে লিঙ্ক হয়েছে!</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200 shadow-sm space-y-2.5 transition-all hover:border-zinc-300">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-800">
            <span className="p-1 rounded-lg bg-zinc-200 text-zinc-700">
              <Globe className="w-3 h-3" />
            </span>
            <span>২) Google Account Selector (নির্দিষ্ট অ্যাকাউন্ট বেছে নিন)</span>
          </div>
          <p className="text-[12px] text-zinc-600 leading-relaxed">
            আপনার একাধিক জিমেইল অ্যাকাউন্ট থাকলে পছন্দের অ্যাকাউন্টটি নির্বাচন করতে নিচের বাটনটি চাপুন:
          </p>

          <div className="flex justify-center pt-1 min-h-[44px]">
            <div ref={googleBtnRef} className="flex justify-center" />
          </div>
        </div>
      </div>
    );
  }

  // 3) Default "all" Mode
  return (
    <div className="w-full space-y-4">
      {errorMsg && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs">
          {errorMsg}
        </div>
      )}

      {successInfo && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successInfo} হিসেবে সফলভাবে লিঙ্ক হয়েছে!</span>
        </div>
      )}

      <div className="flex justify-center">
        <div ref={googleBtnRef} className="flex justify-center" />
      </div>
    </div>
  );
}
