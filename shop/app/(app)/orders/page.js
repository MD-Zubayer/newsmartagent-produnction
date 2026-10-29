"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCustomer } from '@/lib/auth-context';
import { fetchStorefront } from '@/lib/api';
import {
  Package,
  Search,
  ShoppingBag,
  ArrowRight,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  LogIn,
  ShieldCheck,
  Loader2
} from 'lucide-react';

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useCustomer();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackInput, setTrackInput] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      const query = filter !== 'all' ? `?status=${filter}` : '';
      fetchStorefront(`/orders/${query}`)
        .then((data) => {
          if (Array.isArray(data)) setOrders(data);
        })
        .catch((err) => console.error("Error loading orders:", err))
        .finally(() => setLoading(false));
    }
  }, [filter, isAuthenticated]);

  const filteredOrders = orders.filter((o) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      o.product_name?.toLowerCase().includes(term) ||
      o.shop_name?.toLowerCase().includes(term) ||
      String(o.id).includes(term)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>ডেলিভার্ড</span>
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
            <Truck className="w-3 h-3 text-indigo-600" />
            <span>ডেলিভারির পথে</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>কনফার্মড</span>
          </span>
        );
      case 'cancelled':
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>{status === 'returned' ? 'রিটার্ন' : 'বাতিল'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>অপেক্ষমাণ</span>
          </span>
        );
    }
  };

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    if (!trackInput.trim()) return;
    router.push(`/orders/${encodeURIComponent(trackInput.trim())}`);
  };

  // If visitor is unauthenticated, show order search and sign-in prompt
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="space-y-6 animate-fadeIn py-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">অর্ডার অনুসন্ধান</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">আপনার অর্ডারের ট্র্যাকিং নম্বর দিয়ে সরাসরি স্ট্যাটাস দেখুন</p>
        </div>

        {/* Track search card */}
        <div className="rounded-[2rem] p-6 sm:p-7 bg-white border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-4">
          <form onSubmit={handleTrackSubmit} className="space-y-3.5">
            <label className="text-xs font-black text-slate-700 block">
              অর্ডার নম্বর বা ট্র্যাকিং আইডি লিখুন:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                placeholder="যেমন: #12345 বা পাবলিক ট্র্যাকিং কোড"
                className="w-full text-xs pl-10 pr-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all hover:scale-101 active:scale-99"
            >
              <Truck className="w-4 h-4" />
              <span>অর্ডার ট্র্যাক করুন</span>
            </button>
          </form>
        </div>

        {/* Sign in banner */}
        <div className="rounded-[2rem] p-6 sm:p-8 bg-white border border-slate-200/80 shadow-md shadow-slate-100 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto shadow-xs">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">সব অর্ডার একসাথে দেখতে চান?</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed font-medium">
              গুগল দিয়ে এক ক্লিকে সাইন ইন করলে সব শপের আগের ও বর্তমান অর্ডার স্বয়ংক্রিয়ভাবে তালিকায় দেখতে পাবেন।
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95"
          >
            <LogIn className="w-4 h-4" />
            <span>গুগল দিয়ে সাইন ইন করুন</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">আমার অর্ডারসমূহ</h1>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">সব দোকানের সব অর্ডারের হিস্টোরি ও ট্র্যাকিং</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="অর্ডার নম্বর বা পণ্যের নাম দিয়ে খুঁজুন..."
          className="w-full text-xs pl-10 pr-3.5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-xs transition-all"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'সব অর্ডার' },
          { id: 'active', label: 'চলমান' },
          { id: 'delivered', label: 'ডেলিভার্ড' },
          { id: 'cancelled', label: 'বাতিল/রিটার্ন' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`text-xs px-4 py-2 rounded-xl font-bold shrink-0 transition-all ${
              filter === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-xs'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">
          <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mx-auto mb-2.5" />
          <span className="font-semibold text-slate-500">অর্ডার লোড হচ্ছে...</span>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl sm:rounded-[1.5rem] p-4 sm:p-5 bg-white border border-slate-200/80 shadow-md shadow-slate-100 hover:shadow-xl hover:border-indigo-300 transition-all duration-200 space-y-3"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">#{order.id}</span>
                  <span className="text-[11px] text-slate-500 font-semibold">• {order.shop_name}</span>
                </div>
                {getStatusBadge(order.status)}
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {order.product_image || order.items?.[0]?.image_url ? (
                    <img
                      src={order.product_image || order.items?.[0]?.image_url}
                      alt={order.product_name || 'পণ্য'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingBag className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{order.product_name || 'পণ্য'}</p>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    মোট প্রদেয়: <span className="text-indigo-600 font-black text-xs sm:text-sm">৳{order.total_price}</span>
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  তারিখ: {new Date(order.created_at).toLocaleDateString('bn-BD')}
                </span>
                <Link
                  href={`/orders/${order.public_id}`}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-bold hover:underline"
                >
                  <span>ট্র্যাক ও বিবরণ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center space-y-3 rounded-3xl bg-white border border-slate-200 p-8 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 mx-auto flex items-center justify-center text-slate-400">
            <Package className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-slate-800">কোনো অর্ডার পাওয়া যায়নি</p>
          <p className="text-xs text-slate-500">আপনার ফিল্টার পরিবর্তন করে দেখতে পারেন</p>
        </div>
      )}
    </div>
  );
}
