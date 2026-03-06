"use client";
import React, { Suspense } from 'react'; // Suspense ইম্পোর্ট করুন
import { useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

// ১. মূল কন্টেন্ট যেখানে searchParams ব্যবহার হচ্ছে
function DeletionContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  return (
    <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-100">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldCheck className="w-10 h-10 text-green-600" />
      </div>
      
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Data Deletion Request</h1>
      <p className="text-slate-500 mb-8 italic text-sm">Your privacy is our priority.</p>
      
      <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-dashed border-slate-200">
        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2 text-center">Confirmation ID</p>
        <code className="text-blue-600 font-mono font-bold text-lg break-all">
          {id || "PROCESSING..."}
        </code>
      </div>
      
      <div className="space-y-4 text-left">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
          <p className="text-sm text-slate-600 font-medium">ফেসবুক পেজ এবং মেসেজ সংক্রান্ত সব তথ্য মুছে ফেলা হচ্ছে।</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
          <p className="text-sm text-slate-600 font-medium">আগামী ৭ কর্মদিবসের মধ্যে আপনার সব অ্যাক্টিভিটি সার্ভার থেকে ক্লিন হয়ে যাবে।</p>
        </div>
      </div>

      <button 
        onClick={() => window.location.href = '/'}
        className="mt-10 w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95"
      >
        Back to Home
      </button>
    </div>
  );
}

// ২. মেইন পেজ কম্পোনেন্ট যা Suspense দিয়ে মোড়ানো
export default function DeletionStatus() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-500 font-medium">Loading status...</div>}>
        <DeletionContent />
      </Suspense>
    </div>
  );
}