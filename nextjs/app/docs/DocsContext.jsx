// app/(main)/docs/DocsContext.jsx
"use client";
import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  BookOpenIcon,
  UserPlusIcon,
  EnvelopeIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  LightBulbIcon,
  CpuChipIcon,
  ShoppingCartIcon,
  TableCellsIcon,
  DocumentTextIcon,
  GiftIcon,
  BanknotesIcon,
  ClockIcon,
  BellIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  ClipboardDocumentListIcon,
  CogIcon
} from "@heroicons/react/24/outline";

const DocsContext = createContext();

export const getDocsGroups = (lang) => [
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
      { id: 'dashboard-switching-display-mode', title: lang === 'en' ? 'Switching & Display Modes' : 'সুইচিং & ডিসপ্লে মোড', icon: <LightBulbIcon className="h-5 w-5" /> },
      { id: 'dashboard-overview', title: lang === 'en' ? 'Overview' : 'ওভারভিউ', icon: <CpuChipIcon className="h-5 w-5" /> },
      { id: 'dashboard-saving', title: lang === 'en' ? 'Ranking & Caching' : 'র‍্যাঙ্কিং ও ক্যাশিং', icon: <ShieldCheckIcon className="h-5 w-5" /> },
      { id: 'dashboard-order', title: lang === 'en' ? 'Order Center' : 'অর্ডার সেন্টার', icon: <ShoppingCartIcon className="h-5 w-5" /> },
      { id: 'dashboard-sheet', title: lang === 'en' ? 'Spreadsheet Sync' : 'স্প্রেডশিট সিঙ্ক', icon: <TableCellsIcon className="h-5 w-5" /> },
      { id: 'dashboard-docs', title: lang === 'en' ? 'Documents Sync' : 'ডকুমেন্টস সিঙ্ক', icon: <DocumentTextIcon className="h-5 w-5" /> },
      { id: 'dashboard-offers', title: lang === 'en' ? 'Active Offers' : 'সক্রিয় অফার', icon: <GiftIcon className="h-5 w-5" /> },
      { id: 'dashboard-payments', title: lang === 'en' ? 'Payment' : 'পেমেন্টস', icon: <BanknotesIcon className="h-5 w-5" /> },
      { id: 'dashboard-history', title: lang === 'en' ? 'History' : 'হিস্ট্রি', icon: <ClockIcon className="h-5 w-5" /> },
      { id: 'dashboard-notifications', title: lang === 'en' ? 'Notifications' : 'নোটিফিকেশন', icon: <BellIcon className="h-5 w-5" /> },
      { id: 'dashboard-connect-facebook', title: lang === 'en' ? 'Connect Facebook' : 'ফেসবুক কানেক্ট', icon: <GlobeAltIcon className="h-5 w-5" /> },
      { id: 'dashboard-connect-whatsapp', title: lang === 'en' ? 'Connect WhatsApp' : 'হোয়াটসঅ্যাপ কানেক্ট', icon: <GlobeAltIcon className="h-5 w-5" /> },
      { id: 'dashboard-connect-widget', title: lang === 'en' ? 'Web Widget' : 'ওয়েব উইজেট', icon: <GlobeAltIcon className="h-5 w-5" /> },
      { id: 'dashboard-ai-agent', title: lang === 'en' ? 'Agent Management' : 'এজেন্ট ম্যানেজমেন্ট', icon: <CpuChipIcon className="h-5 w-5" /> },
      { id: 'dashboard-crm', title: lang === 'en' ? 'CRM Interface' : 'সিআরএম ইন্টারফেস', icon: <TableCellsIcon className="h-5 w-5" /> },
      { id: 'dashboard-contacts', title: lang === 'en' ? 'Live Chat' : 'লাইভ চ্যাট', icon: <EnvelopeIcon className="h-5 w-5" /> },
      { id: 'dashboard-settings', title: lang === 'en' ? 'Settings' : 'সেটিংস', icon: <CogIcon className="h-5 w-5" /> },
      { id: 'agent-dashboard-overview', title: lang === 'en' ? 'Referral & Earnings' : 'রেফারেল ও আর্নিং', icon: <CurrencyDollarIcon className="h-5 w-5" /> },
      { id: 'agent-dashboard-accounts', title: lang === 'en' ? 'Accounts' : 'অ্যাকাউন্টস', icon: <BanknotesIcon className="h-5 w-5" /> },
      { id: 'agent-dashboard-my-referrals', title: lang === 'en' ? 'My Network' : 'আমার নেটওয়ার্ক', icon: <UserPlusIcon className="h-5 w-5" /> },
      { id: 'agent-dashboard-otp-settings', title: lang === 'en' ? 'OTP Settings' : 'ওটিপি সেটিংস', icon: <ShieldCheckIcon className="h-5 w-5" /> },
    ]
  },
];

export function DocsProvider({ children }) {
  const [lang, setLang] = useState('en');
  const [supportEmail, setSupportEmail] = useState('support@newsmartagent.com');

  React.useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.newsmartagent.com'}/api/settings/public-settings/`)
      .then(res => res.json())
      .then(data => {
        if (data.support_email) {
          setSupportEmail(data.support_email);
        }
      })
      .catch(err => console.error('Error fetching support email:', err));
  }, []);

  const groups = useMemo(() => getDocsGroups(lang), [lang]);
  const allItems = useMemo(() => groups.flatMap(g => g.items), [groups]);

  const getNavigation = (currentId) => {
    const currentIndex = allItems.findIndex(item => item.id === currentId);
    return {
      prev: currentIndex > 0 ? allItems[currentIndex - 1] : null,
      next: currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null,
    };
  };

  return (
    <DocsContext.Provider value={{ lang, setLang, supportEmail, groups, allItems, getNavigation }}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs() {
  return useContext(DocsContext);
}
