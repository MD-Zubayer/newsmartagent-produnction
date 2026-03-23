// app/docs/layout.jsx
"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BookOpenIcon, 
  UserPlusIcon, 
  CurrencyDollarIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  LightBulbIcon,
  EnvelopeIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ArrowRightIcon,
  ClipboardDocumentListIcon,
  ArrowsRightLeftIcon,
  HomeIcon
} from "@heroicons/react/24/outline";
import { DocsProvider, useDocs } from './DocsContext';

function DocsLayoutContent({ children }) {
  const { lang, setLang } = useDocs();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  
  // Extract slug from pathname (e.g., /docs/intro -> intro)
  const activeSlug = pathname.split('/').pop() || 'intro';


  const groups = [
    {
      title: lang === 'en' ? 'Welcome' : 'স্বাগতম',
      items: [
        { id: 'intro', title: lang === 'en' ? 'Introduction' : 'ভূমিকা', icon: <BookOpenIcon className="h-5 w-5" /> },
      ]
    },
    
    {
      title: lang === 'en' ? 'Registration' : 'রেজিস্ট্রেশন',
      items: [
        { id: 'registration', title: lang === 'en' ? 'Account Registration' : 'অ্যাকাউন্ট রেজিস্ট্রেশন', icon: <UserPlusIcon className="h-5 w-5" /> },
      ]
    },
    {
      title: lang === 'en' ? 'Security & Access' : 'নিরাপত্তা ও অ্যাক্সেস',
      items: [
        { id: 'email-verification', title: lang === 'en' ? 'Email Verification' : 'ইমেইল ভেরিফিকেশন', icon: <EnvelopeIcon className="h-5 w-5" /> },
        { id: 'login-steps', title: lang === 'en' ? 'Secure Login' : 'সুরক্ষিত লগইন', icon: <LockClosedIcon className="h-5 w-5" /> },
        { id: 'reset-password', title: lang === 'en' ? 'Reset Password' : 'পাসওয়ার্ড রিসেট', icon: <ShieldCheckIcon className="h-5 w-5" /> },
        { id: 'security-passwords', title: lang === 'en' ? 'Password Rules' : 'পাসওয়ার্ড নিয়ম', icon: <ShieldCheckIcon className="h-5 w-5" /> },
        { id: 'security-2fa', title: lang === 'en' ? '2FA Setup' : '2FA সেটআপ', icon: <ShieldCheckIcon className="h-5 w-5" /> },
      ]
    },
    {
      title: lang === 'en' ? 'Dashboard' : 'ড্যাশবোর্ড',
      items: [
        {id: 'dashboard-switching-display-mode', title: lang === 'en' ? 'Switching & Display Modes' : 'সুইচিং & ডিসপ্লে মোড', icon: <LightBulbIcon className="h-5 w-5" /> },
        { id: 'dashboard-overview', title: lang === 'en' ? 'Overview' : 'ওভারভিউ', icon: <CpuChipIcon className="h-5 w-5" /> },
        { id: 'dashboard-saving', title: lang === 'en' ? 'Ranking & Caching' : 'র‍্যাঙ্কিং ও ক্যাশিং', icon: <ShieldCheckIcon className="h-5 w-5" /> },
      ]
    },
    {
      title: lang === 'en' ? 'AI Agents' : 'AI এজেন্ট',
      items: [
        { id: 'ai-agent-selection', title: lang === 'en' ? 'Selection Guide' : 'নির্বাচন গাইড', icon: <LightBulbIcon className="h-5 w-5" /> },
        { id: 'ai-agent-gemini', title: lang === 'en' ? 'Google Gemini' : 'গুগল জেমিনি', icon: <CpuChipIcon className="h-5 w-5" /> },
        { id: 'ai-agent-gpt', title: lang === 'en' ? 'OpenAI GPT' : 'ওপেনএআই GPT', icon: <CpuChipIcon className="h-5 w-5" /> },
        { id: 'ai-agent-grok', title: lang === 'en' ? 'xAI Grok' : 'এক্সএআই গ্রোক', icon: <CpuChipIcon className="h-5 w-5" /> },
        { id: 'ai-agent-personality', title: lang === 'en' ? 'Personality Tuning' : 'ব্যক্তিত্ব টিউনিং', icon: <CpuChipIcon className="h-5 w-5" /> },
        { id: 'ai-prompt-examples', title: lang === 'en' ? 'Prompt Examples' : 'প্রম্পট উদাহরণ', icon: <LightBulbIcon className="h-5 w-5" /> },
        { id: 'ai-keywords-guide', title: lang === 'en' ? 'Keyword Triggers' : 'কীওয়ার্ড ট্রিগার', icon: <CpuChipIcon className="h-5 w-5" /> },
      ]
    },
    {
      title: lang === 'en' ? 'Platforms' : 'প্ল্যাটফর্ম',
      items: [
        { id: 'platform-facebook', title: lang === 'en' ? 'Facebook Page' : 'ফেসবুক পেজ', icon: <GlobeAltIcon className="h-5 w-5" /> },
        { id: 'platform-fb-permissions', title: lang === 'en' ? 'FB Permissions' : 'FB পারমিশন', icon: <ShieldCheckIcon className="h-5 w-5" /> },
        { id: 'platform-messenger', title: lang === 'en' ? 'Messenger Bot' : 'মেসেঞ্জার বট', icon: <GlobeAltIcon className="h-5 w-5" /> },
        { id: 'platform-whatsapp', title: lang === 'en' ? 'WhatsApp Business' : 'হোয়াটসঅ্যাপ বিজনেস', icon: <GlobeAltIcon className="h-5 w-5" /> },
        { id: 'platform-wa-cloud-api', title: lang === 'en' ? 'WA Cloud API' : 'WA ক্লাউড API', icon: <GlobeAltIcon className="h-5 w-5" /> },
        { id: 'platform-wa-templates', title: lang === 'en' ? 'WA Templates' : 'WA টেমপ্লেট', icon: <EnvelopeIcon className="h-5 w-5" /> },
        { id: 'platform-youtube', title: lang === 'en' ? 'YouTube Automation' : 'ইউটিউব অটোমেশন', icon: <GlobeAltIcon className="h-5 w-5" /> },
      ]
    },
    {
      title: lang === 'en' ? 'Billing & Finance' : 'বিলিং এবং ফিন্যান্স',
      items: [
        { id: 'billing-plans', title: lang === 'en' ? 'Subscription Plans' : 'সাবস্ক্রিপশন প্ল্যান', icon: <CurrencyDollarIcon className="h-5 w-5" /> },
        { id: 'billing-balance', title: lang === 'en' ? 'Add Balance' : 'ব্যালেন্স যুক্ত করা', icon: <CurrencyDollarIcon className="h-5 w-5" /> },
        { id: 'billing-invoices', title: lang === 'en' ? 'Invoice History' : 'ইনভয়েস হিস্টোরি', icon: <ClipboardDocumentListIcon className="h-5 w-5" /> },
        { id: 'billing-refunds', title: lang === 'en' ? 'Refund Policies' : 'রিফান্ড নীতিমালা', icon: <CurrencyDollarIcon className="h-5 w-5" /> },
      ]
    },
    {
      title: lang === 'en' ? 'CRM & Sales' : 'সিআরএম এবং সেলস',
      items: [
        { id: 'crm-leads', title: lang === 'en' ? 'Smart Leads' : 'স্মার্ট লিড', icon: <ClipboardDocumentListIcon className="h-5 w-5" /> },
        { id: 'crm-lead-status', title: lang === 'en' ? 'Lead Status' : 'লিড স্ট্যাটাস', icon: <LightBulbIcon className="h-5 w-5" /> },
        { id: 'crm-export-csv', title: lang === 'en' ? 'Exporting Leads' : 'লিড এক্সপোর্ট', icon: <ClipboardDocumentListIcon className="h-5 w-5" /> },
        { id: 'crm-orders', title: lang === 'en' ? 'Order Tracking' : 'অর্ডার ট্র্যাকিং', icon: <ClipboardDocumentListIcon className="h-5 w-5" /> },
        { id: 'order-labels', title: lang === 'en' ? 'Shipping Labels' : 'শিপিং লেবেল', icon: <ClipboardDocumentListIcon className="h-5 w-5" /> },
        { id: 'order-status-sync', title: lang === 'en' ? 'Courier Sync' : 'কুরিয়ার সিঙ্ক', icon: <ArrowsRightLeftIcon className="h-5 w-5" /> },
        { id: 'crm-spreadsheet', title: lang === 'en' ? 'Spreadsheet Sync' : 'স্প্রেডশিট সিঙ্ক', icon: <ClipboardDocumentListIcon className="h-5 w-5" /> },
      ]
    },
    {
      title: lang === 'en' ? 'P2P Features' : 'P2P ফিন্যান্স',
      items: [
        { id: 'transfer-money', title: lang === 'en' ? 'Transfer Money' : 'টাকা পাঠানো', icon: <ArrowsRightLeftIcon className="h-5 w-5" /> },
        { id: 'transfer-history', title: lang === 'en' ? 'Transfer History' : 'ট্রান্সফার হিস্টোরি', icon: <ArrowsRightLeftIcon className="h-5 w-5" /> },
      ]
    },
    {
      title: lang === 'en' ? 'Identity & Profile' : 'ইউজার প্রোফাইল',
      items: [
        { id: 'profile-settings', title: lang === 'en' ? 'User Settings' : 'ইউজার সেটিংস', icon: <UserPlusIcon className="h-5 w-5" /> },
        { id: 'profile-api-key', title: lang === 'en' ? 'Developer API' : 'ডেভেলপার API', icon: <ShieldCheckIcon className="h-5 w-5" /> },
      ]
    }
  ];

  const allItems = groups.flatMap(g => g.items);

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex flex-col lg:flex-row">
      
      {/* --- Mobile Header --- */}
      <div className="lg:hidden bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <HomeIcon className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
                <div className="bg-indigo-600 p-1.5 rounded-lg">
                    <CpuChipIcon className="h-5 w-5 text-white" />
                </div>
                <span className="font-black text-xl tracking-tighter">NSA Docs</span>
            </div>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-500">
            <BookOpenIcon className="h-6 w-6" />
        </button>
      </div>

      {/* --- Sidebar --- */}
      <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:sticky top-0 left-0 z-40 w-80 border-r border-gray-100 h-screen bg-white p-6 md:p-8 overflow-y-auto transition-transform duration-300`}>
        <div className="hidden lg:flex items-center gap-3 mb-10">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100">
            <CpuChipIcon className="h-6 w-6 text-white" />
          </div>
          <span className="font-black text-2xl tracking-tighter text-gray-900">NSA <span className="text-indigo-600">Docs</span></span>
        </div>

        {/* Back to Home Button */}
        <Link 
            href="/"
            className="flex items-center gap-2 px-4 py-2 mb-8 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-all w-fit"
        >
            <HomeIcon className="h-4 w-4" />
            {lang === 'en' ? 'Back to Home' : 'হোমে ফিরে যান'}
        </Link>

        {/* Language Switcher */}
        <div className="flex p-1 bg-gray-50 rounded-xl mb-8">
            <button 
                onClick={() => setLang('bn')} 
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${lang === 'bn' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}
            >
                বাংলা
            </button>
            <button 
                onClick={() => setLang('en')} 
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${lang === 'en' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}
            >
                English
            </button>
        </div>

        {/* Dropdown Navigation */}
        <div className="mb-6">
            <select 
                onChange={(e) => {
                    const id = e.target.value;
                    window.location.href = `/docs/${id}`;
                }}
                value={activeSlug}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'org.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
            >
                <option value="" disabled>{lang === 'en' ? 'Quick Jump...' : 'তাড়াতাড়ি দেখুন...'}</option>
                {allItems.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                ))}
            </select>
        </div>
        
        <nav className="space-y-8 pb-20">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 ml-4">{group.title}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/docs/${item.id}`}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold transition-all group ${
                      activeSlug === item.id 
                      ? 'bg-indigo-50 text-indigo-600' 
                      : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`${activeSlug === item.id ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                      {React.cloneElement(item.icon, { className: 'h-4 w-4' })}
                    </span>
                    <span className="text-xs truncate">{item.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 py-10 md:py-16 px-6 md:px-12 lg:px-24">
        {children}
      </main>
    </div>
  );
}

export default function DocsLayout({ children }) {
  return (
    <DocsProvider>
      <DocsLayoutContent>{children}</DocsLayoutContent>
    </DocsProvider>
  );
}
