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
  HomeIcon,
  ShoppingCartIcon,
  TableCellsIcon,
  DocumentTextIcon,
  GiftIcon,
  BanknotesIcon,
  ClockIcon,
  BellIcon,
  CogIcon
} from "@heroicons/react/24/outline";
import { DocsProvider, useDocs } from './DocsContext';

function DocsLayoutContent({ children }) {
  const { lang, setLang, groups, allItems } = useDocs();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Extract slug from pathname (e.g., /docs/intro -> intro)
  const activeSlug = pathname.split('/').pop() || 'intro';

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
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold transition-all group ${activeSlug === item.id
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
