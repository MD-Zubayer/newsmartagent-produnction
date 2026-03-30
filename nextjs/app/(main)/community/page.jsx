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
    icon: TrendingUp,
    color: '#4f46e5',
    bg: 'rgba(79,70,229,0.06)',
    border: 'rgba(79,70,229,0.1)',
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
    icon: Bug,
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.06)',
    border: 'rgba(220,38,38,0.1)',
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
    icon: Lightbulb,
    color: '#ca8a04',
    bg: 'rgba(202,138,4,0.06)',
    border: 'rgba(202,138,4,0.1)',
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
    icon: Rocket,
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.06)',
    border: 'rgba(124,58,237,0.1)',
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
    icon: Star,
    color: '#d97706',
    bg: 'rgba(217,119,6,0.06)',
    border: 'rgba(217,119,6,0.1)',
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
    icon: MessageCircle,
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.06)',
    border: 'rgba(22,163,74,0.1)',
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
    icon: BookOpen,
    color: '#0284c7',
    bg: 'rgba(2,132,199,0.06)',
    border: 'rgba(2,132,199,0.1)',
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
    langBtn: 'বাংলা',
  },
  bn: {
    badge: 'কমিউনিটি হাব',
    title: 'আপনার কথা শুনতে চাই',
    subtitle: 'Feedback দিন, bug জানান, নতুন feature চান — সব এক জায়গায়। Community-র সাথে connect হন।',
    stat1: 'যে কেউ report করতে পারবেন',
    stat2: 'Like ও Comment করুন',
    langBtn: 'English',
  },
};

export default function CommunityHub() {
  const { lang, setLang } = useLanguage();
  const tx = t[lang] || t.en;

  return (
    <div
      className="min-h-screen"
      style={{ background: '#f8fafc' }}
    >
      {/* ── Hero ── */}
      <header className="relative pt-28 pb-14 px-6 text-center overflow-hidden">
        {/* BG orbs */}
        <div style={{
          position: 'absolute', top: '10%', left: '5%', width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none',
          transform: 'translateZ(0)', willChange: 'filter',
        }} />
        <div style={{
          position: 'absolute', bottom: '0%', right: '5%', width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none',
          transform: 'translateZ(0)', willChange: 'filter',
        }} />

        {/* Language Toggle Removed */}

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 18px', borderRadius: 999,
            background: 'rgba(79,70,229,0.08)',
            border: '1px solid rgba(79,70,229,0.15)',
            color: '#4f46e5', fontSize: 12, fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20,
          }}>
            <Sparkles size={13} /> {tx.badge}
          </span>

          <h1 style={{
            fontSize: 'clamp(2.2rem,6vw,4rem)', fontWeight: 900, lineHeight: 1.1,
            color: '#1e293b',
            marginBottom: 16,
          }}>
            {tx.title}
          </h1>
          <p style={{ color: '#475569', fontSize: 16, maxWidth: 540, margin: '0 auto 12px', lineHeight: 1.6 }}>
            {tx.subtitle}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
              <Users size={14} />
              <span>{tx.stat1}</span>
            </div>
            <span style={{ color: '#334155' }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
              <MessageSquare size={14} />
              <span>{tx.stat2}</span>
            </div>
          </div>
        </motion.div>
      </header>

      {/* ── Cards Grid ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 100px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {communityItems.map((item, i) => {
            const Icon = item.icon;
            const href = item.href || `/community/${item.slug}`;
            const isExternal = !!item.external;

            const CardContent = (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ scale: 1.03, y: -6, boxShadow: '0 12px 30px rgba(0,0,0,0.08)' }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  padding: 26, borderRadius: 24, cursor: 'pointer',
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  transition: 'all 0.3s',
                  height: '100%', boxSizing: 'border-box',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  transform: 'translateZ(0)',
                  WebkitBackfaceVisibility: 'hidden',
                }}
                whileTap={{ scale: 0.99 }}
              >
                {/* Icon + tag */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: item.bg, border: `1px solid ${item.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}>
                    {item.emoji}
                  </div>
                  <span style={{
                    padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: item.bg, border: `1px solid ${item.border}`, color: item.color,
                  }}>
                    {item.tag[lang] || item.tag.en}
                  </span>
                </div>

                {/* Text */}
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 10, lineHeight: 1.3 }}>
                  {item.name[lang] || item.name.en}
                </h2>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, flex: 1 }}>
                  {item.desc[lang] || item.desc.en}
                </p>

                {/* CTA */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 18,
                  color: item.color, fontSize: 13, fontWeight: 700,
                }}>
                  {item.cta[lang] || item.cta.en}
                  <ArrowRight size={14} />
                </div>
              </motion.div>
            );

            return isExternal ? (
              <a key={item.slug} href={href} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'block' }}>
                {CardContent}
              </a>
            ) : (
              <Link key={item.slug} href={href} style={{ textDecoration: 'none', display: 'block' }}>
                {CardContent}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
