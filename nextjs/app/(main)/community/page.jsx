'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bug, TrendingUp, Lightbulb, Rocket, MessageCircle,
  BookOpen, MessageSquare, Users, ArrowRight, Sparkles, Star
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const communityItems = [
  {
    slug: 'feedback',
    emoji: '📢',
    color: '#4f46e5', // Indigo
    bg: 'rgba(79,70,229,0.1)',
    border: 'rgba(79,70,229,0.2)',
    tag: { en: 'General', bn: 'সাধারণ' },
    name: { en: 'Feedback', bn: 'ফিডব্যাক' },
    desc: {
      en: 'Share your thoughts about our platform. Your feedback helps us improve.',
      bn: 'আমাদের platform সম্পর্কে আপনার মতামত দিন। আপনার feedback আমাদের আরও ভালো হতে সাহায্য করে।',
    },
    cta: { en: 'Give Feedback', bn: 'মতামত দিন' },
    category: 'Feedback',
  },
  {
    slug: 'bug-report',
    emoji: '🐞',
    color: '#e11d48', // Rose
    bg: 'rgba(225,29,72,0.1)',
    border: 'rgba(225,29,72,0.2)',
    tag: { en: 'Bug', bn: 'বাগ' },
    name: { en: 'Report a Bug', bn: 'বাগ রিপোর্ট করুন' },
    desc: {
      en: 'Found an issue or error? Let us know and we will fix it quickly.',
      bn: 'কোনো সমস্যা বা error হচ্ছে? আমাদের জানান, আমরা দ্রুত fix করব।',
    },
    cta: { en: 'Report Bug', bn: 'বাগ জানান' },
    category: 'Bug',
  },
  {
    slug: 'feature-request',
    emoji: '💡',
    color: '#f59e0b', // Amber
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.2)',
    tag: { en: 'Feature', bn: 'ফিচার' },
    name: { en: 'Feature Request', bn: 'ফিচার রিকোয়েস্ট' },
    desc: {
      en: 'Want a new feature? Share your idea and we will add it to our roadmap.',
      bn: 'নতুন কোনো feature চান? আইডিয়া দিন, আমরা roadmap এ যোগ করব।',
    },
    cta: { en: 'Suggest Feature', bn: 'আইডিয়া দিন' },
    category: 'Feature',
  },
  {
    slug: 'roadmap',
    emoji: '🚀',
    color: '#8b5cf6', // Violet
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.2)',
    tag: { en: 'Roadmap', bn: 'রোডম্যাপ' },
    name: { en: 'Product Roadmap', bn: 'প্রোডাক্ট রোডম্যাপ' },
    desc: {
      en: 'See what new features we are building. Vote to set priority.',
      bn: 'আমরা কী কী নতুন feature আনছি তা দেখুন। Community vote দিয়ে প্রাধান্য ঠিক করুন।',
    },
    cta: { en: 'View Roadmap', bn: 'রোডম্যাপ দেখুন' },
    category: 'Roadmap',
  },
  {
    slug: 'review',
    emoji: '⭐',
    color: '#d97706', // Yellow
    bg: 'rgba(217,119,6,0.1)',
    border: 'rgba(217,119,6,0.2)',
    tag: { en: 'Review', bn: 'রিভিউ' },
    name: { en: 'Write a Review', bn: 'রিভিউ লিখুন' },
    desc: {
      en: 'How was your experience with our service? Help others make the right choice.',
      bn: 'আমাদের service ব্যবহার করে কেমন লাগলো? অন্যদের জানতে সাহায্য করুন।',
    },
    cta: { en: 'Write Review', bn: 'রিভিউ লিখুন' },
    category: 'Review',
  },
  {
    slug: 'whatsapp',
    emoji: '💬',
    color: '#16a34a', // Green
    bg: 'rgba(22,163,74,0.1)',
    border: 'rgba(22,163,74,0.2)',
    tag: { en: 'Community', bn: 'কমিউনিটি' },
    name: { en: 'Join WhatsApp Group', bn: 'WhatsApp গ্রুপে যোগ দিন' },
    desc: {
      en: 'Join our WhatsApp community. Talk directly with other users and our team.',
      bn: 'আমাদের WhatsApp community তে যোগ দিন। সরাসরি অন্য users এবং team এর সাথে কথা বলুন।',
    },
    cta: { en: 'Join Now', bn: 'যোগ দিন' },
    category: null,
    external: true,
    href: 'https://wa.me/yourgroup',
  },
  {
    slug: 'guide',
    emoji: '📖',
    color: '#0284c7', // Light Blue
    bg: 'rgba(2,132,199,0.1)',
    border: 'rgba(2,132,199,0.2)',
    tag: { en: 'Guide', bn: 'গাইড' },
    name: { en: 'User Guide & Templates', bn: 'ইউজার গাইড ও টেমপ্লেট' },
    desc: {
      en: 'How to use New Smart Agent — step by step guide and ready-made templates.',
      bn: 'New Smart Agent কিভাবে ব্যবহার করবেন — step by step guide এবং ready-made templates।',
    },
    cta: { en: 'View Docs', bn: 'ডকস দেখুন' },
    category: null,
    href: '/docs',
  },
];

export { communityItems };

const t = {
  en: {
    badge: 'Community Hub',
    title: 'We Want to Hear From You',
    subtitle: 'Give feedback, report bugs, request features — all in one place. Connect with the community.',
    stat1: 'Anyone can report',
    stat2: 'Like & Comment',
  },
  bn: {
    badge: 'কমিউনিটি হাব',
    title: 'আপনার কথা শুনতে চাই',
    subtitle: 'Feedback দিন, bug জানান, নতুন feature চান — সব এক জায়গায়। Community-র সাথে connect হন।',
    stat1: 'যে কেউ report করতে পারবেন',
    stat2: 'Like ও Comment করুন',
  },
};

export default function CommunityHub() {
  const { lang } = useLanguage();
  const tx = t[lang] || t.en;

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* ── Background Colorful Gradients ── */}
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-400/20 blur-[120px] rounded-full mix-blend-multiply animate-pulse" />
        <div className="absolute top-20 -right-20 w-[500px] h-[500px] bg-rose-400/20 blur-[120px] rounded-full mix-blend-multiply" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-400/10 blur-[100px] rounded-full mix-blend-multiply" />
      </div>

      {/* ── Hero Section ── */}
      <header className="relative pt-32 pb-16 px-6 text-center z-10">
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow-xl shadow-indigo-500/10 border border-indigo-100 text-indigo-600 text-xs font-black tracking-widest uppercase mb-8 transform transition-transform hover:scale-105 cursor-default">
            <Sparkles size={16} className="text-amber-500" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{tx.badge}</span>
            <Sparkles size={16} className="text-amber-500" />
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
            {lang === 'bn' ? 'আপনার কথা' : 'We Want to Hear'}<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
              {lang === 'bn' ? 'শুনতে চাই' : 'From You'}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            {tx.subtitle}
          </p>

          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 mt-8">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 whitespace-nowrap">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0"><Users size={16} /></div>
              <span className="text-sm font-bold text-slate-700">{tx.stat1}</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 whitespace-nowrap">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0"><MessageSquare size={16} /></div>
              <span className="text-sm font-bold text-slate-700">{tx.stat2}</span>
            </div>
          </div>
        </motion.div>
      </header>

      {/* ── Nested Cards Grid ── */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {communityItems.map((item, i) => {
            const href = item.href || `/community/${item.slug}`;
            const isExternal = !!item.external;

            const CardContent = (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
                whileHover={{ y: -8 }}
                className="group cursor-pointer h-full"
              >
                {/* Outer Card (The colorful thick border) */}
                <div 
                  className="relative p-2 rounded-[2.5rem] h-full transition-all duration-500"
                  style={{
                    background: `linear-gradient(145deg, ${item.bg}, #ffffff)`,
                    boxShadow: `0 20px 40px -15px ${item.color}30, 0 0 0 1px ${item.border}`,
                  }}
                >
                  {/* Inner Card (The white content area) */}
                  <div className="relative bg-white/90 backdrop-blur-2xl h-full rounded-[2.25rem] p-8 flex flex-col border border-white overflow-hidden shadow-sm transition-all duration-300 group-hover:bg-white group-hover:shadow-lg">
                    
                    {/* Glowing blur behind icon */}
                    <div 
                      className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40" 
                      style={{ background: item.color }} 
                    />

                    {/* Realistic 3D Icon Container & Tag */}
                    <div className="flex items-start justify-between mb-8 relative z-10">
                      <div 
                        className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-4xl shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"
                        style={{
                          background: `linear-gradient(135deg, ${item.bg}, #ffffff)`,
                          border: `1px solid ${item.border}`,
                          boxShadow: `inset 0 4px 8px rgba(255,255,255,0.8), 0 10px 25px -5px ${item.color}40`,
                          filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.05))'
                        }}
                      >
                        {item.emoji}
                      </div>
                      
                      <span 
                        className="px-4 py-1.5 rounded-full text-xs font-black tracking-wide shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${item.color}, ${item.color}dd)`, 
                          color: '#fff',
                          boxShadow: `0 4px 10px ${item.color}40`
                        }}
                      >
                        {item.tag[lang] || item.tag.en}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex-1">
                      <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight group-hover:text-slate-800 transition-colors">
                        {item.name[lang] || item.name.en}
                      </h2>
                      <p className="text-base text-slate-500 font-medium leading-relaxed">
                        {item.desc[lang] || item.desc.en}
                      </p>
                    </div>

                    {/* Fancy CTA Button inside card */}
                    <div className="mt-8 relative z-10 flex items-center justify-between">
                      <div 
                        className="flex items-center gap-3 font-black text-sm px-5 py-2.5 rounded-2xl transition-all duration-300 group-hover:px-6"
                        style={{ 
                          background: item.bg,
                          color: item.color,
                          border: `1px solid ${item.border}`
                        }}
                      >
                        {item.cta[lang] || item.cta.en}
                        <ArrowRight size={16} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-1" />
                      </div>
                    </div>
                    
                  </div>
                </div>
              </motion.div>
            );

            return isExternal ? (
              <a key={item.slug} href={href} target="_blank" rel="noopener noreferrer" className="block outline-none">
                {CardContent}
              </a>
            ) : (
              <Link key={item.slug} href={href} className="block outline-none">
                {CardContent}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
