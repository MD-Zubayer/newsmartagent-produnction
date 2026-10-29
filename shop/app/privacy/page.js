import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: "গোপনীয়তা নীতি | Privacy Policy",
  description: "SmartShop গ্রাহকের তথ্য সুরক্ষার নীতি।"
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 max-w-2xl mx-auto space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <Link href="/" className="text-xs text-indigo-400 font-semibold hover:underline">
          ← হোমপেজে ফিরে যান
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">গোপনীয়তা নীতি (Privacy Policy)</h1>
        <p className="text-xs text-slate-400 mt-1">সর্বশেষ আপডেট: অক্টোবর ২০২৬</p>
      </div>

      <div className="space-y-4 text-xs leading-relaxed text-slate-300">
        <section className="space-y-1">
          <h2 className="text-sm font-bold text-white">১. যেসব তথ্য আমরা সংগ্রহ করি</h2>
          <p>
            আমরা শুধুমাত্র অর্ডার প্রসেসিং ও ডেলিভারির জন্য প্রয়োজনীয় তথ্য সংগ্রহ করি: গ্রাহকের নাম, ইমেইল (Google Sign-In থেকে), ডেলিভারি ঠিকানা ও মোবাইল নম্বর।
          </p>
        </section>

        <section className="space-y-1">
          <h2 className="text-sm font-bold text-white">২. তথ্যের ব্যবহার</h2>
          <p>
            আপনার তথ্য শুধুমাত্র পার্সেল ডেলিভারি, কুরিয়ার ট্র্যাকিং এবং অর্ডার কনফার্মেশন নোটিফিকেশন পাঠানোর উদ্দেশ্যে সংশ্লিষ্ট মার্চেন্ট ও কুরিয়ার পার্টনারের (যেমন পাঠাও/স্টেডফাস্ট) সাথে শেয়ার করা হয়।
          </p>
        </section>

        <section className="space-y-1">
          <h2 className="text-sm font-bold text-white">৩. তথ্য সুরক্ষা</h2>
          <p>
            গ্রাহকের ডেটা আধুনিক এনক্রিপশন ও সিকিউর সেশনের মাধ্যমে কঠোরভাবে সংরক্ষিত থাকে। কোনো তৃতীয় পক্ষের কাছে তথ্য বিক্রি বা প্রচারমূলক উদ্দেশ্যে হস্তান্তর করা হয় না।
          </p>
        </section>
      </div>
    </div>
  );
}
