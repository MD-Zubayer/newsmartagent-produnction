"use client";

import React, { useState } from 'react';
import { useCustomer } from '@/lib/auth-context';
import { fetchStorefront } from '@/lib/api';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import {
  User,
  Mail,
  Phone,
  MessageSquare,
  ShieldCheck,
  LogOut,
  Smartphone,
  ExternalLink,
  Edit2,
  Check,
  X,
  Share2
} from 'lucide-react';

export default function CustomerAccountPage() {
  const { customer, stats, logout, refreshCustomer } = useCustomer();

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneVal, setPhoneVal] = useState(customer?.primary_phone || '');
  const [isSaving, setIsSaving] = useState(false);

  const identities = customer?.identities || [];

  const handleSavePhone = async () => {
    setIsSaving(true);
    try {
      await fetchStorefront('/auth/me/', {
        method: 'PATCH',
        body: JSON.stringify({ primary_phone: phoneVal })
      });
      await refreshCustomer();
      setIsEditingPhone(false);
    } catch (err) {
      alert("ফোন নম্বর সেভ করা সম্ভব হয়নি।");
    } finally {
      setIsSaving(false);
    }
  };

  const getPlatformMeta = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'whatsapp':
        return {
          name: 'WhatsApp',
          badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          iconBg: 'bg-[#25D366]/15 border-[#25D366]/30 text-[#25D366]',
          icon: (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.072-1.803-.414-1.428-.593-2.342-2.029-2.413-2.123-.07-.095-.583-.777-.583-1.481 0-.705.367-1.05.5-1.196.133-.146.29-.182.387-.182.097 0 .193.001.277.006.088.005.207-.033.324.249.12.289.412 1.006.448 1.08.036.074.06.16.012.256-.048.096-.073.155-.145.241-.072.086-.153.193-.218.259-.073.073-.149.153-.064.298.084.145.375.619.805 1.002.553.493 1.02.645 1.165.717.145.072.23.06.315-.038.085-.098.362-.423.459-.568.097-.145.193-.121.326-.072.133.048.844.398.989.471.145.072.242.108.278.17.036.06.036.357-.108.762zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.176L2 22l4.965-1.302A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.143c-1.625 0-3.14-.492-4.407-1.334l-.316-.211-2.951.774.787-2.877-.231-.368A8.107 8.107 0 013.857 12c0-4.49 3.653-8.143 8.143-8.143 4.49 0 8.143 3.653 8.143 8.143 0 4.49-3.653 8.143-8.143 8.143z" />
            </svg>
          )
        };
      case 'messenger':
      case 'facebook':
        return {
          name: 'Messenger',
          badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          iconBg: 'bg-[#0084FF]/15 border-[#0084FF]/30 text-[#0084FF]',
          icon: (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.914 1.455 5.518 3.735 7.195V22l3.414-1.874c.907.251 1.868.39 2.851.39 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.004 12.457l-2.559-2.73-4.997 2.73 5.498-5.836 2.62 2.73 4.936-2.73-5.498 5.836z" />
            </svg>
          )
        };
      case 'telegram':
        return {
          name: 'Telegram',
          badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
          iconBg: 'bg-[#229ED9]/15 border-[#229ED9]/30 text-[#229ED9]',
          icon: (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          )
        };
      case 'instagram':
        return {
          name: 'Instagram',
          badgeClass: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
          iconBg: 'bg-gradient-to-tr from-[#F58529]/20 via-[#DD2A7B]/20 to-[#8134AF]/20 border-[#DD2A7B]/30 text-[#E1306C]',
          icon: (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          )
        };
      default:
        return {
          name: 'Web Chat',
          badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
          iconBg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
          icon: <MessageSquare className="w-5 h-5" />
        };
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-24 md:pb-12 text-slate-800">
      <div>
        <h1 className="text-xl font-bold text-slate-900">কাস্টমার অ্যাকাউন্ট</h1>
        <p className="text-xs text-slate-500 mt-0.5">আপনার প্রোফাইল ও সংযুক্ত মেসেজিং অ্যাকাউন্টসমূহ</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-md space-y-4">
        <div className="flex items-center gap-4">
          {customer?.avatar_url ? (
            <img
              src={customer.avatar_url}
              alt={customer.name}
              className="w-16 h-16 rounded-3xl border-2 border-indigo-500/50 object-cover shadow-md shadow-indigo-500/10"
            />
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center text-indigo-600 text-xl font-black">
              {customer?.name?.charAt(0) || 'U'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900 truncate">{customer?.name}</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
              <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>{customer?.email}</span>
            </p>
            {customer?.email?.endsWith('@customer.newsmartagent.com') ? (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Smartphone className="w-3 h-3" />
                <span>প্ল্যাটফর্ম অটো-অ্যাকাউন্ট</span>
              </div>
            ) : (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                <span>গুগল ভেরিফাইড আইডি</span>
              </div>
            )}
          </div>
        </div>

        {customer?.email?.endsWith('@customer.newsmartagent.com') && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2.5">
            <p className="text-xs text-slate-700 leading-relaxed">
              আপনার ব্রাউজারে মেসেজিং প্ল্যাটফর্ম থেকে অটো-অ্যাকাউন্ট তৈরি হয়েছে। সব ডিভাইস থেকে সহজে অ্যাকাউন্ট ও অর্ডার ম্যানেজ করতে <strong className="text-indigo-900 font-bold">Google দিয়ে লিংক করুন</strong>:
            </p>
            <GoogleSignInButton onSuccess={() => refreshCustomer()} />
          </div>
        )}

        {/* Primary Phone Input / Edit */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-slate-500">মোবাইল:</span>
            {isEditingPhone ? (
              <input
                type="tel"
                value={phoneVal}
                onChange={(e) => setPhoneVal(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-32 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:border-indigo-500 outline-none"
              />
            ) : (
              <span className="font-mono font-bold text-slate-900">
                {customer?.primary_phone || 'সেট করা নেই'}
              </span>
            )}
          </div>

          <div>
            {isEditingPhone ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSavePhone}
                  disabled={isSaving}
                  className="p-1.5 bg-emerald-600 rounded-lg text-white hover:bg-emerald-700"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsEditingPhone(false)}
                  className="p-1.5 bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setPhoneVal(customer?.primary_phone || '');
                  setIsEditingPhone(true);
                }}
                className="p-1.5 text-slate-400 hover:text-indigo-600"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Linked Messaging Platforms */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <span>সংযুক্ত মেসেজিং অ্যাকাউন্ট</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">{identities.length}টি সংযুক্ত</span>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          হোয়াটসঅ্যাপ, মেসেঞ্জার বা টেলিগ্রামে অর্ডার দিলে সেগুলো স্বয়ংক্রিয়ভাবে আপনার এই গুগল অ্যাকাউন্টে চলে আসে।
        </p>

        {identities.length > 0 ? (
          <div className="space-y-2 pt-1">
            {identities.map((id) => {
              const meta = getPlatformMeta(id.platform);
              return (
                <div
                  key={id.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 shadow-sm ${meta.iconBg}`}>
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900">{meta.name}</p>
                        {id.display_name && (
                          <span className="text-[11px] text-slate-500 font-medium truncate">
                            ({id.display_name})
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        ID: {id.platform_user_id}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${meta.badgeClass}`}>
                    লিংকড
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
            এখনও কোনো চ্যাট অ্যাকাউন্ট সরাসরি লিংক করা হয়নি। যেকোনো শপের মেসেঞ্জারে বা হোয়াটসঅ্যাপে অর্ডার করলেই লিঙ্ক হয়ে যাবে।
          </div>
        )}
      </div>

      {/* Install as App / PWA Tip */}
      <div className="p-4 rounded-3xl bg-indigo-50 border border-indigo-200/80 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-900">হোম স্ক্রিনে ইনস্টল করুন</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            ব্রাউজার মেনু থেকে &quot;Add to Home Screen&quot; দিয়ে সাধারণ অ্যাপের মতো ব্যবহার করুন
          </p>
        </div>
      </div>

      {/* Logout Button */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>লগআউট করুন</span>
        </button>
      </div>
    </div>
  );
}
