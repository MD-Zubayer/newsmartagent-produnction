// app/doc/page.jsx
"use client";
import React, { useState } from 'react';
import { 
  BookOpenIcon, 
  UserPlusIcon, 
  CurrencyDollarIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  LightBulbIcon
} from "@heroicons/react/24/outline";

export default function DocPage() {
  const [activeSection, setActiveSection] = useState('intro');

  const sections = [
    { id: 'intro', title: 'পরিচিতি', icon: <BookOpenIcon className="h-5 w-5" /> },
    { id: 'account', title: 'অ্যাকাউন্ট তৈরির নিয়ম', icon: <UserPlusIcon className="h-5 w-5" /> },
    { id: 'roles', title: 'User vs Agent', icon: <LightBulbIcon className="h-5 w-5" /> },
    { id: 'pricing', title: 'প্রাইসিং ও অফার', icon: <CurrencyDollarIcon className="h-5 w-5" /> },
    { id: 'setup', title: 'AI Agent সেটআপ', icon: <CpuChipIcon className="h-5 w-5" /> },
    { id: 'security', title: 'নিরাপত্তা ও সুবিধা', icon: <ShieldCheckIcon className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex">
      {/* --- Sidebar --- */}
      <aside className="hidden lg:block w-80 border-r border-gray-100 sticky top-0 h-screen bg-white p-8 overflow-y-auto">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100">
            <CpuChipIcon className="h-6 w-6 text-white" />
          </div>
          <span className="font-black text-2xl tracking-tighter text-gray-900">NSA <span className="text-indigo-600">Docs</span></span>
        </div>
        
        <nav className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 ml-4">Main Guide</p>
          {sections.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all group ${
                activeSection === item.id 
                ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className={`${activeSection === item.id ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                {item.icon}
              </span>
              {item.title}
              <ChevronRightIcon className={`h-4 w-4 ml-auto transition-all ${activeSection === item.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`} />
            </a>
          ))}
        </nav>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 py-16 px-6 md:px-12 lg:px-24 max-w-6xl">
        
        {/* Intro Section */}
        <section id="intro" className="mb-24 scroll-mt-20">
          <div className="inline-flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
            <span className="text-indigo-700 text-xs font-black uppercase tracking-widest">Welcome to Future</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight leading-[1.1] mb-8">
            স্মার্ট জীবনের জন্য <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">New Smart Agent</span>
          </h1>
          <div className="prose prose-indigo prose-lg text-gray-600 font-medium">
            <p className="leading-relaxed">
              New Smart Agent এমন অসাধারণ ও দুর্দান্ত সার্ভিস নিয়ে এসেছে যার মাধ্যমে আপনি আপনার ব্যক্তিগত কিংবা ব্যবসায়িক জীবনকে করে তুলতে পারেন আরও স্মার্ট ও অভাবনীয় গতিশীল। 
            </p>
            <p className="mt-4">
              আপনার সারাদিন কিংবা রাত জেগে কষ্ট করে কাস্টমার বা আপনার ভক্তদের উত্তর দিতে হবে না। এখন New Smart Agent এর সাথে আপনার <b>Facebook Page, WhatsApp</b> ইত্যাদি যুক্ত করলেই আপনার কাজ করে দিবে সে। আপনার চেয়ে আরও ভালো করে যেকোনো ভাষায় সব মেসেজ ও কমেন্টের উত্তর দিবে।
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <h4 className="font-black text-gray-900 flex items-center gap-2 mb-3">
                <div className="w-2 h-6 bg-indigo-600 rounded-full" /> অটোমেটেড অর্ডার
              </h4>
              <p className="text-gray-500 text-sm">এটি কাস্টমারের সাথে দামাদামি করে অর্ডার নিয়ে আপনার NSA ড্যাশবোর্ডে তালিকা করে রাখবে।</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <h4 className="font-black text-gray-900 flex items-center gap-2 mb-3">
                <div className="w-2 h-6 bg-green-500 rounded-full" /> পূর্ণ নিরাপত্তা
              </h4>
              <p className="text-gray-500 text-sm">আপনার ডাটা এবং সোশ্যাল একাউন্টের পূর্ণ নিরাপত্তা প্রদান করবে New Smart Agent।</p>
            </div>
          </div>
        </section>

        <hr className="my-16 border-gray-100" />

        {/* Account Creation */}
        <section id="account" className="mb-24 scroll-mt-20">
          <h2 className="text-3xl font-black text-gray-900 mb-8 flex items-center gap-4">
            <span className="bg-gray-900 text-white w-10 h-10 rounded-xl flex items-center justify-center text-sm">01</span>
            অ্যাকাউন্ট তৈরির নিয়ম
          </h2>
          <div className="bg-gray-50 p-8 md:p-12 rounded-[3rem] border border-gray-100">
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="font-black text-indigo-200 text-4xl">01</div>
                <div>
                  <h4 className="font-black text-gray-900 text-xl mb-2">সাইন-আপ শুরু করুন</h4>
                  <p className="text-gray-600">নেভ বারের উপরে থাকা <b>Signup</b> অথবা যেকোনো জায়গা থেকে <b>Get Started</b> বাটনে ক্লিক করলে লগইন পেজে নিয়ে যাবে। সেখানে নিচে থাকা <b>"Create Account"</b> লিংকে ক্লিক করুন।</p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="font-black text-indigo-200 text-4xl">02</div>
                <div>
                  <h4 className="font-black text-gray-900 text-xl mb-2">Created By ফিল্ড পূরণ (গুরুত্বপূর্ণ)</h4>
                  <p className="text-gray-600 mb-4">রেজিস্ট্রেশন ফরমে Created By ফিল্ডটি খুব সাবধানে পূরণ করুন:</p>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm font-bold text-gray-700 bg-white p-3 rounded-xl border border-gray-100">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full" /> নিজে নিজে তৈরি করলে: <span className="text-indigo-600">Self</span> সিলেক্ট করুন।
                    </li>
                    <li className="flex items-center gap-3 text-sm font-bold text-gray-700 bg-white p-3 rounded-xl border border-gray-100">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full" /> এজেন্টের মাধ্যমে করলে: <span className="text-indigo-600">Agent</span> সিলেক্ট করুন।
                    </li>
                  </ul>
                  <p className="mt-4 text-xs font-bold text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100">
                    * Agent সিলেক্ট করলে Agent ID এবং Agent OTP Key প্রদান করতে হবে।
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="font-black text-indigo-200 text-4xl">03</div>
                <div>
                  <h4 className="font-black text-gray-900 text-xl mb-2">ইমেইল ভেরিফিকেশন</h4>
                  <p className="text-gray-600">ফরম পূরণ করে সাইন আপ করলে আপনার ইমেইলে একটি ভেরিফিকেশন লিংক যাবে। লিংকে ক্লিক করলেই ড্যাশবোর্ড এক্সেস পাবেন।</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roles Section */}
        <section id="roles" className="mb-24 scroll-mt-20">
          <h2 className="text-3xl font-black text-gray-900 mb-8">User এবং Agent এর পার্থক্য</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="group p-8 bg-white border border-gray-100 rounded-[2.5rem] hover:border-indigo-200 transition-all shadow-sm">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all">U</div>
              <h4 className="font-black text-gray-900 text-xl mb-3">User (ইউজার)</h4>
              <p className="text-gray-500 text-sm">যারা মূলত New Smart Agent এর AI সার্ভিসটি নিজের ব্যবসা বা ব্যক্তিগত কাজে ব্যবহার করবে।</p>
            </div>
            <div className="group p-8 bg-white border border-gray-100 rounded-[2.5rem] hover:border-emerald-200 transition-all shadow-sm">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 font-black group-hover:bg-emerald-600 group-hover:text-white transition-all">A</div>
              <h4 className="font-black text-gray-900 text-xl mb-3">Agent (এজেন্ট)</h4>
              <p className="text-gray-500 text-sm">যারা এই সার্ভিসটি প্রচার করবে, ইনভাইট করবে এবং রেফারেলের মাধ্যমে আয় করবে।</p>
            </div>
          </div>
          <div className="mt-8 bg-indigo-900 p-8 rounded-[2.5rem] text-white">
            <p className="font-bold flex items-center gap-3 italic">
              <LightBulbIcon className="h-6 w-6 text-amber-400" />
              আপনি যেকোনো সময় ড্যাশবোর্ড থেকে User থেকে Agent বা Agent থেকে User এ সুইচ করতে পারবেন।
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mb-24 scroll-mt-20">
          <h2 className="text-3xl font-black text-gray-900 mb-8 italic">Pricing & Offers</h2>
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-dashed border-gray-200">
              <p className="text-xl font-bold text-gray-700">আমাদের সার্ভিস শুরু হবে মাত্র <span className="text-indigo-600 text-3xl font-black">১০০৳</span> থেকে।</p>
              <p className="mt-4 text-gray-500">আপনার প্রয়োজন অনুযায়ী বিভিন্ন মেয়াদের অফার বেছে নিতে পারবেন (ঠিক যেমন মোবাইল অপারেটরের অফারগুলো থাকে)।</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                <h5 className="font-black text-amber-900 mb-2 font-black italic">এজেন্ট রেফারেল অফার</h5>
                <p className="text-amber-800 text-sm">এজেন্টের মাধ্যমে আইডি খুললে ইউজারদের জন্য থাকবে আকর্ষণীয় স্পেশাল অফার।</p>
              </div>
              <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                <h5 className="font-black text-blue-900 mb-2">মেয়াদ বৃদ্ধি</h5>
                <p className="text-blue-800 text-sm">মেয়াদ শেষ হওয়ার আগেই পুনরায় অফার কিনলে পূর্বের অফারের মেয়াদ বেড়ে যাবে।</p>
              </div>
            </div>

            {/* Agent Commission Note */}
            <div className="p-8 bg-gradient-to-r from-gray-900 to-indigo-900 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100">
              <h4 className="font-black text-xl mb-4 flex items-center gap-3">
                <CurrencyDollarIcon className="h-7 w-7 text-emerald-400" /> এজেন্টের আয়
              </h4>
              <p className="leading-relaxed opacity-90">
                যেই Agent এর ID এবং OTP দিয়ে কেউ রেজিস্ট্রেশন করবে, সেই এজেন্ট ওই ইউজারের প্রথম <b>৫ মাসের পেমেন্টের ২০% কমিশন</b> পাবে। ইউজার প্রতিবার পেমেন্ট করার সাথে সাথে এজেন্টের ওয়ালেটে ২০% জমা হয়ে যাবে।
              </p>
            </div>
          </div>
        </section>

        {/* Setup Section */}
        <section id="setup" className="mb-24 scroll-mt-20">
          <h2 className="text-3xl font-black text-gray-900 mb-8">AI Agent সেটআপ</h2>
          <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100">
            <p className="font-bold text-indigo-900 mb-6">সেটআপ করা এখন পানির মতো সহজ:</p>
            <div className="bg-white p-6 rounded-3xl shadow-sm mb-6">
               <p className="text-gray-700 font-bold leading-relaxed">
                 আপনার শুধু <span className="text-indigo-600">Facebook Page ID</span> এবং <span className="text-indigo-600">Access Token</span> দিলেই Facebook Comment এবং Messenger এ স্বয়ংক্রিয়ভাবে AI যুক্ত হয়ে যাবে।
               </p>
            </div>
            <p className="text-gray-600 font-medium">বিস্তারিত গাইডেন্সের জন্য প্রত্যেক ইউজারের ড্যাশবোর্ডে টিউটোরিয়াল ভিডিও দেওয়া থাকবে। সেই ভিডিও দেখে সহজেই সবকিছু সেটআপ করে নিতে পারবেন।</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-16 border-t border-gray-100 text-center">
          <p className="text-gray-400 font-bold text-sm">© 2026 New Smart Agent. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}