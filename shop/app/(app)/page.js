"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCustomer } from '@/lib/auth-context';
import { fetchStorefront } from '@/lib/api';
import {
  Package,
  Truck,
  ArrowRight,
  Store,
  ShieldCheck,
  MapPin,
  ShoppingBag,
  Zap,
  MessageSquare,
  Search,
  Sparkles,
  ChevronRight,
  LogIn,
} from 'lucide-react';

export default function CustomerHomePage() {
  const router = useRouter();
  const { customer, stats, isAuthenticated, isLoading: authLoading } = useCustomer();
  const [activeOrder, setActiveOrder] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [trackSearchId, setTrackSearchId] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      setLoadingOrders(true);
      fetchStorefront('/orders/')
        .then((orders) => {
          if (Array.isArray(orders)) {
            setRecentOrders(orders.slice(0, 5));
            const active = orders.find((o) =>
              ['pending', 'confirmed', 'shipped'].includes(o.status)
            );
            setActiveOrder(active || null);
          }
        })
        .catch((err) => console.error("Error fetching orders:", err))
        .finally(() => setLoadingOrders(false));
    }
  }, [isAuthenticated]);

  const handleQuickTrack = (e) => {
    e.preventDefault();
    if (!trackSearchId.trim()) return;
    router.push(`/orders/${encodeURIComponent(trackSearchId.trim())}`);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-6">
      {/* ─── APP OVERVIEW & HERO ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 lg:p-9 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 shadow-2xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 lg:max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>স্মার্ট কাস্টমার শপ হাব</span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              {isAuthenticated ? (
                <>
                  স্বাগতম, <span className="text-indigo-400">{customer?.name?.split(' ')[0] || 'গ্রাহক'}</span>!
                </>
              ) : (
                <>
                  অনলাইন অর্ডারের <span className="text-indigo-400">অল-ইন-ওয়ান</span> হাব
                </>
              )}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 mt-2 leading-7 max-w-2xl">
              মেসেঞ্জার, হোয়াটসঅ্যাপ এবং ওয়েবসাইটে করা আপনার সব অনলাইন অর্ডারের লাইভ ট্র্যাকিং, এক-ক্লিক ক্যাশ অন ডেলিভারি চেকআউট এবং সংরক্ষিত ডেলিভারি ঠিকানা এক জায়গায় সহজে ম্যানেজ করুন।
            </p>
          </div>

          {/* Quick Track Input */}
          <form onSubmit={handleQuickTrack} className="pt-2 flex flex-col sm:flex-row gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={trackSearchId}
                onChange={(e) => setTrackSearchId(e.target.value)}
                placeholder="অর্ডার নম্বর বা ট্র্যাকিং আইডি..."
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl glass-input placeholder-slate-400"
              />
            </div>
            <button
              type="submit"
              className="py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>ট্র্যাক করুন</span>
            </button>
          </form>

          {/* Guest Sign-in Callout if not logged in */}
          {!isAuthenticated && !authLoading && (
            <div className="pt-2 flex items-center justify-between gap-3 text-xs border-t border-slate-800/80">
              <span className="text-slate-400">অর্ডার হিস্টোরি ও সেভড ঠিকানার জন্য:</span>
              <Link
                href="/login"
                className="inline-flex items-center gap-1 py-1 px-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 font-bold transition-all shrink-0"
              >
                <LogIn className="w-3 h-3" />
                <span>গুগল দিয়ে সাইন ইন</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ─── AUTHENTICATED ACTIVE ORDER LIVE CARD ────────────────────── */}
      {isAuthenticated && activeOrder && (
        <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-slate-900 border border-indigo-500/30 shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">চলমান অর্ডার</span>
            </div>
            <span className="text-xs font-bold text-slate-400">#{activeOrder.id}</span>
          </div>

          <div className="mt-3">
            <h2 className="text-base font-bold text-slate-100 line-clamp-1">{activeOrder.product_name || 'পণ্য'}</h2>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-indigo-400" />
              <span>{activeOrder.shop_name}</span>
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">স্ট্যাটাস</p>
              <p className="text-xs font-bold text-indigo-300 capitalize">
                {activeOrder.status === 'confirmed' ? 'কনফার্মড' : (activeOrder.status === 'shipped' ? 'ডেলিভারির পথে' : 'অর্ডার গৃহীত')}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold text-right">মূল্য</p>
              <p className="text-sm font-black text-white">৳{activeOrder.total_price}</p>
            </div>
          </div>

          <Link
            href={`/orders/${activeOrder.public_id}`}
            className="mt-4 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Truck className="w-4 h-4" />
            <span>লাইভ ট্র্যাক করুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ─── QUICK METRICS GRID (IF LOGGED IN) ────────────────────── */}
      {isAuthenticated && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">মোট অর্ডার</p>
            <p className="text-lg font-black text-indigo-400 mt-0.5">{stats?.total_orders || recentOrders.length || 0}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">ডেলিভার্ড</p>
            <p className="text-lg font-black text-emerald-400 mt-0.5">{stats?.delivered_orders || 0}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">চলমান</p>
            <p className="text-lg font-black text-amber-400 mt-0.5">{stats?.active_orders || (activeOrder ? 1 : 0)}</p>
          </div>
        </div>
      )}

      {/* ─── APP KEY CAPABILITIES / HOW IT WORKS ────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          অ্যাপের মূল সুবিধাসমূহ
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-3 md:flex-col">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-100">লাইভ কুরিয়ার ট্র্যাকিং</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                পাঠাও এবং স্টেডফাস্ট কুরিয়ারের কনসাইনমেন্ট স্ট্যাটাস — পার্সেল হ্যান্ডওভার থেকে ডেলিভারি পর্যন্ত রিয়েল-টাইম আপডেট পান।
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-3 md:flex-col">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-100">ওয়ান-ক্লিক স্মার্ট চেকআউট</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                গুগল দিয়ে কোনো পাসওয়ার্ড টাইপ ছাড়াই এক ক্লিকে লগইন করুন এবং সংরক্ষিত ঠিকানায় সরাসরি ক্যাশ অন ডেলিভারি অর্ডার দিন।
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-3 md:flex-col">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-100">চ্যাট ও সোশ্যাল অর্ডার ইন্টিগ্রেশন</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                হোয়াটসঅ্যাপ বা ফেসবুক মেসেঞ্জারে অর্ডার করলেও তা স্বয়ংক্রিয়ভাবে আপনার গুগল অ্যাকাউন্টে যুক্ত হয়।
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RECENT ORDERS (IF LOGGED IN) ─────────────────────────── */}
      {isAuthenticated && recentOrders.length > 0 && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">সাম্প্রতিক অর্ডার</h2>
            <Link href="/orders" className="text-xs text-indigo-400 font-semibold hover:underline flex items-center gap-1">
              <span>সব দেখুন</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.public_id}`}
                className="block p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-slate-300">
                      <ShoppingBag className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate">{order.product_name || 'পণ্য'}</p>
                      <p className="text-[10px] text-slate-400">{order.shop_name}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-white">৳{order.total_price}</span>
                    <span className="block text-[10px] text-indigo-400 font-semibold mt-0.5 capitalize">
                      {order.status === 'delivered' ? 'ডেলিভার্ড' : (order.status === 'confirmed' ? 'কনফার্মড' : order.status)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ─── QUICK NAVIGATION TILES ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <Link
          href={isAuthenticated ? "/addresses" : "/login"}
          className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 flex items-center gap-3 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-200">সংরক্ষিত ঠিকানা</p>
            <p className="text-[10px] text-slate-400">ডেলিভারি লোকেশন</p>
          </div>
        </Link>

        <Link
          href={isAuthenticated ? "/account" : "/login"}
          className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 flex items-center gap-3 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-200">কাস্টমার প্রোফাইল</p>
            <p className="text-[10px] text-slate-400">অ্যাকাউন্ট ও সেটিংস</p>
          </div>
        </Link>
      </div>

      {/* ─── FOOTER WITH LEGAL LINKS ───────────────────────────────── */}
      <footer className="pt-6 pb-2 border-t border-slate-800/80 text-center space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-slate-400">
          <Link href="/privacy" className="hover:text-indigo-400 transition-colors">
            Privacy Policy (গোপনীয়তা নীতি)
          </Link>
          <span className="text-slate-600">•</span>
          <Link href="/terms" className="hover:text-indigo-400 transition-colors">
            Terms of Service (শর্তাবলী)
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>১০০% নিরাপদ ও সুরক্ষিত প্ল্যাটফর্ম</span>
        </div>

        <p className="text-[10px] text-slate-400">
          © 2026 SmartShop by NewSmartAgent. সর্বস্বত্ব সংরক্ষিত।
        </p>
      </footer>
    </div>
  );
}
