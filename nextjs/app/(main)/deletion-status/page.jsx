"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HiOutlineShieldCheck, HiOutlineTrash, HiOutlineClock, HiOutlineLink, HiOutlineHome } from 'react-icons/hi';
import { FaShieldAlt, FaFacebook } from 'react-icons/fa';

function DeletionContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || searchParams.get('code'); // Handling both common param names

  return (
    <div className="max-w-2xl w-full relative group">
      {/* Cinematic Backdrop Pulse */}
      <div className="absolute inset-0 bg-emerald-500/10 rounded-[3rem] blur-3xl animate-pulse group-hover:bg-emerald-500/15 transition-all duration-1000"></div>
      
      <div className="relative bg-white/80 backdrop-blur-2xl border border-white rounded-[3rem] shadow-[0_32px_120px_-20px_rgba(16,185,129,0.15)] p-8 md:p-16 overflow-hidden">
        
        {/* Floating Success Icon */}
        <div className="w-24 h-24 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 mb-10 mx-auto shadow-inner border border-emerald-100/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-700">
          <HiOutlineShieldCheck className="text-5xl" />
        </div>

        <header className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-[10px] font-black text-emerald-700 uppercase tracking-[0.3em]">
            Request Received
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter italic leading-none">
            Data <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Deletion</span>
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest opacity-70">
            Privacy Enforcement Protocol
          </p>
        </header>

        {/* Confirmation ID Card */}
        <div className="bg-slate-950 rounded-[2rem] p-8 mb-12 relative overflow-hidden group/id">
           <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"></div>
           <div className="relative z-10 space-y-3">
              <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.4em] text-center">Confirmation Hash</p>
              <div className="flex items-center justify-center gap-4">
                 <code className="text-xl md:text-3xl font-mono font-black text-white tracking-widest break-all">
                    {id || "PROTOCOL_PENDING"}
                 </code>
              </div>
           </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
              <HiOutlineTrash className="text-emerald-600 text-2xl" />
              <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Scope</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                ফেসবুক পেজ, মেসেজ এবং আপনার মেটা ইন্টিগ্রেশন সংক্রান্ত সমস্ত ডেটা স্থায়ীভাবে মুছে ফেলা হচ্ছে।
              </p>
           </div>
           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
              <HiOutlineClock className="text-emerald-600 text-2xl" />
              <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Timeline</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                পরবর্তী ৭ কর্মদিবসের মধ্যে আমাদের সার্ভার থেকে আপনার সমস্ত অ্যাক্টিভিটি ক্লিন হয়ে যাবে।
              </p>
           </div>
        </div>

        {/* Footer Guarantee */}
        <div className="text-center pt-8 border-t border-slate-100 space-y-8">
           <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
             আপনার প্রাইভেসি আমাদের সর্বোচ্চ অগ্রাধিকার। আপনার তথ্য আমাদের সিস্টেমে আর সংরক্ষিত থাকবে না।
           </p>
           
           <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => window.location.href = '/'}
                className="group/btn relative px-8 py-4 bg-slate-950 text-white rounded-full font-black text-xs uppercase tracking-[0.2em] overflow-hidden transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                <HiOutlineHome className="text-lg relative z-10" />
                <span className="relative z-10">Return Home</span>
              </button>
              
              <button 
                onClick={() => window.location.href = '/privacy-policy'}
                className="px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-full font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-slate-50 active:scale-95 flex items-center gap-3 shadow-sm"
              >
                <HiOutlineLink className="text-lg" />
                Full Policy
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

export default function DeletionStatus() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-100/20 rounded-full blur-[100px]"></div>
      </div>

      <Suspense fallback={
        <div className="flex flex-col items-center gap-4 text-emerald-600">
           <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
           <p className="font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Initialising Security Protocol...</p>
        </div>
      }>
        <DeletionContent />
      </Suspense>
      
      <p className="absolute bottom-8 left-0 right-0 text-center text-[8px] font-bold text-slate-300 uppercase tracking-[0.6em] pointer-events-none">
        © 2026 NewSmartAgent Privacy Systems.
      </p>
    </div>
  );
}