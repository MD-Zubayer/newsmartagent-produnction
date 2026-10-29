"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCustomer } from '@/lib/auth-context';
import { fetchStorefront } from '@/lib/api';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import AiMagicAuthModal from '@/components/AiMagicAuthModal';
import { ShoppingBag, Store, ShieldCheck, Clock, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { rememberSeller } from '@/lib/shop-brand';

export default function CheckoutLinkLandingPage() {
  const params = useParams();
  const code = params?.code;
  const router = useRouter();
  const { customer, isAuthenticated, isLoading: authLoading, loginWithInstantToken } = useCustomer();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    if (!code) return;

    fetchStorefront(`/session/resolve/${code}/`)
      .then(async (data) => {
        setSession(data);
        rememberSeller(data, code);
        try {
          await loginWithInstantToken(code);
        } catch (_) { }
        setLoading(false);
        if (data && data.status !== 'completed' && !data.is_expired) {
          router.replace(`/checkout/${code}`);
        }
      })
      .catch((err) => {
        setError(err.message || 'চেকআউট লিংকটি পাওয়া যায়নি বা মেয়াদ শেষ হয়ে গেছে।');
        setLoading(false);
      });
  }, [code, router]);

  // Direct redirect fallback to checkout page
  useEffect(() => {
    if (!authLoading && session && session.status !== 'completed' && !session.is_expired) {
      router.replace(`/checkout/${code}`);
    }
  }, [authLoading, session, code, router]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center animate-pulse">
            <ShoppingBag className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="absolute -inset-2 rounded-3xl border border-indigo-500/20 animate-spin" />
        </div>
        <p className="mt-4 text-sm text-slate-400">অর্ডার লোড হচ্ছে...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-100">লিংক পাওয়া যায়নি</h1>
        <p className="mt-2 text-sm text-slate-400 max-w-sm">{error || 'এই অর্ডার লিংকটির মেয়াদ শেষ হয়ে গেছে অথবা লিংকটি ভুল।'}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition-colors"
        >
          হোমপেজে যান
        </button>
      </div>
    );
  }

  const items = session.items || [];
  const isCompleted = session.status === 'completed';
  const isExpired = session.is_expired;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto">
      {/* Dynamic Shop Brand */}
      <div className="pt-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {session.merchant_avatar ? (
              <img
                src={session.merchant_avatar}
                alt={session.merchant_shop_name || session.merchant_name || 'Shop'}
                className="w-10 h-10 rounded-xl object-cover border border-indigo-400/30 bg-slate-800 shrink-0"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <img
                src="/logo.png"
                alt={session.merchant_shop_name || session.merchant_name || 'SmartShop'}
                className="w-10 h-10 rounded-xl object-cover border border-indigo-400/30 bg-slate-800 shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{session.merchant_shop_name || session.merchant_name || 'SmartShop'}</p>
              <p className="text-[11px] text-slate-400">নিরাপদ checkout</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/shop/' + code)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-600/35 text-xs font-bold transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Shop</span>
          </button>
        </div>
        <h1 className="text-2xl font-bold text-white mt-5">আপনার অর্ডারটি সম্পন্ন করুন</h1>
        <p className="text-xs text-slate-400 mt-1">ঠিকানা যাচাই করে দ্রুত ডেলিভারি নিশ্চিত করুন</p>
      </div>

      {/* Main Order Card */}
      <div className="my-auto py-4">
        <div className="glass-panel-elevated rounded-3xl p-5 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Status Alert if expired/completed */}
          {isCompleted && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>এই অর্ডারটি ইতিমধ্যে সম্পন্ন হয়েছে!</span>
            </div>
          )}

          {isExpired && !isCompleted && (
            <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>এই অর্ডারের মেয়াদ শেষ হয়েছে। নতুন করে অর্ডার করুন।</span>
            </div>
          )}

          {/* Items List */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">অর্ডার সারসংক্ষেপ</div>
            <div className="divide-y divide-slate-800/80">
              {items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0 text-slate-300 overflow-hidden">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                      {item.variant && <p className="text-xs text-slate-400 truncate">{item.variant}</p>}
                      <p className="text-xs text-indigo-400 font-semibold">পরিমাণ: {item.quantity || 1}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-white">৳{item.price * (item.quantity || 1)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">সর্বমোট (ডেলিভারি চার্জ ব্যতীত)</span>
              <span className="text-lg font-black text-indigo-400">৳{session.subtotal}</span>
            </div>
          </div>

          {/* Delivery Note */}
          <div className="mt-4 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2.5 text-xs text-slate-300">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ)</span>
          </div>

          {/* Action / Direct Checkout */}
          <div className="mt-6 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => router.push(`/checkout/${code}`)}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01]"
            >
              <span>অর্ডার সম্পন্ন করতে এগিয়ে যান</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="pt-2 pb-4 flex items-center justify-center gap-6 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>১০০% নিরাপদ চেকআউট</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>লাইভ কুরিয়ার ট্র্যাকিং</span>
        </div>
      </div>

      {/* Optional Auth Modal (only if triggered manually) */}
      {!isAuthenticated && showAiModal && (
        <AiMagicAuthModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          sessionCode={code}
          sessionData={session}
          onSuccess={() => router.push(`/checkout/${code}`)}
        />
      )}
    </div>
  );
}
