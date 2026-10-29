"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomer } from '@/lib/auth-context';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { ShoppingBag, ShieldCheck, Zap, Truck, HeartHandshake } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useCustomer();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 max-w-md mx-auto">
      {/* Top Header */}
      <div className="pt-8 text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-600 to-indigo-400 p-0.5 shadow-2xl shadow-indigo-500/30 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="SmartShop Logo" className="w-full h-full object-cover" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Smart Customer Shop</h1>
        <p className="text-xs text-slate-400">
          আপনার সব অনলাইন শপের অর্ডার এক জায়গায় ট্র্যাক করুন
        </p>
      </div>

      {/* Main Login Card */}
      <div className="glass-panel-elevated rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-6 my-auto">
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-bold text-slate-100">সাইন ইন করুন</h2>
          <p className="text-xs text-slate-400">
            গুগল দিয়ে এক ক্লিকে সাইন ইন করুন — পাসওয়ার্ডের কোনো ঝামেলা নেই
          </p>
        </div>

        <GoogleSignInButton onSuccess={() => router.replace('/')} />

        {/* Feature Highlights */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <span>এক ট্যাপে ঠিকানা দিয়ে দ্রুত চেকআউট</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <span>পাঠাও ও রেডেক্স লাইভ কুরিয়ার ট্র্যাকিং</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300">
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <span>মেসেঞ্জার ও হোয়াটসঅ্যাপে হওয়া অর্ডারের হিস্টোরি</span>
          </div>
        </div>
      </div>

      {/* Security footer */}
      <div className="py-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>সুরক্ষিত এবং নিরাপদ প্ল্যাটফর্ম</span>
        </div>
      </div>
    </div>
  );
}
