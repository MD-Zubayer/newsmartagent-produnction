'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bug, TrendingUp, Lightbulb, Rocket, MessageCircle,
  BookOpen, MessageSquare, Users, ArrowRight, Sparkles, Star
} from 'lucide-react';

const communityItems = [
  {
    slug: 'feedback',
    name: 'Feedback',
    emoji: '📢',
    icon: TrendingUp,
    desc: 'আমাদের platform সম্পর্কে আপনার মতামত দিন। আপনার feedback আমাদের আরও ভালো হতে সাহায্য করে।',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    border: 'rgba(99,102,241,0.25)',
    tag: 'General',
    category: 'Feedback',
  },
  {
    slug: 'bug-report',
    name: 'Report a Bug',
    emoji: '🐞',
    icon: Bug,
    desc: 'কোনো সমস্যা বা error হচ্ছে? আমাদের জানান, আমরা দ্রুত fix করব।',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.25)',
    tag: 'Bug',
    category: 'Bug',
  },
  {
    slug: 'feature-request',
    name: 'Feature Request',
    emoji: '💡',
    icon: Lightbulb,
    desc: 'নতুন কোনো feature চান? আইডিয়া দিন, আমরা roadmap এ যোগ করব।',
    color: '#eab308',
    bg: 'rgba(234,179,8,0.12)',
    border: 'rgba(234,179,8,0.25)',
    tag: 'Feature',
    category: 'Feature',
  },
  {
    slug: 'roadmap',
    name: 'Product Roadmap',
    emoji: '🚀',
    icon: Rocket,
    desc: 'আমরা কী কী নতুন feature আনছি তা দেখুন। Community vote দিয়ে প্রাধান্য ঠিক করুন।',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.25)',
    tag: 'Roadmap',
    category: 'Feature',
  },
  {
    slug: 'review',
    name: 'Write a Review',
    emoji: '⭐',
    icon: Star,
    desc: 'আমাদের service ব্যবহার করে কেমন লাগলো? অন্যদের জানতে সাহায্য করুন।',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    tag: 'Review',
    category: 'Feedback',
  },
  {
    slug: 'whatsapp',
    name: 'Join WhatsApp Group',
    emoji: '💬',
    icon: MessageCircle,
    desc: 'আমাদের WhatsApp community তে যোগ দিন। সরাসরি অন্য users এবং team এর সাথে কথা বলুন।',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.25)',
    tag: 'Community',
    category: null, // external link
    external: true,
    href: 'https://wa.me/yourgroup',
  },
  {
    slug: 'guide',
    name: 'User Guide & Templates',
    emoji: '📖',
    icon: BookOpen,
    desc: 'New Smart Agent কিভাবে ব্যবহার করবেন — step by step guide এবং ready-made templates।',
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.12)',
    border: 'rgba(14,165,233,0.25)',
    tag: 'Guide',
    category: null,
    href: '/docs',
  },
];

export { communityItems };

export default function CommunityHub() {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 50%, #1a0f2e 100%)' }}
    >
      {/* ── Hero ── */}
      <header className="relative pt-28 pb-14 px-6 text-center overflow-hidden">
        {/* BG orbs */}
        <div style={{
          position: 'absolute', top: '10%', left: '5%', width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '0%', right: '5%', width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 18px', borderRadius: 999,
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            color: '#a5b4fc', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20,
          }}>
            <Sparkles size={13} /> Community Hub
          </span>

          <h1 style={{
            fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 900, lineHeight: 1.15,
            background: 'linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 50%, #c4b5fd 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', marginBottom: 16,
          }}>
            আপনার কথা শুনতে চাই
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15, maxWidth: 540, margin: '0 auto 12px' }}>
            Feedback দিন, bug জানান, নতুন feature চান — সব এক জায়গায়।
            Community-র সাথে connect হন।
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
              <Users size={14} />
              <span>যে কেউ report করতে পারবেন</span>
            </div>
            <span style={{ color: '#334155' }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
              <MessageSquare size={14} />
              <span>Like ও Comment করুন</span>
            </div>
          </div>
        </motion.div>
      </header>

      {/* ── Cards Grid ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 100px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
          }}
        >
          {communityItems.map((item, i) => {
            const Icon = item.icon;
            const href = item.href || `/community/${item.slug}`;
            const isExternal = !!item.external;

            const CardContent = (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ scale: 1.025, y: -4 }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  padding: 24, borderRadius: 20, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${item.border}`,
                  transition: 'box-shadow 0.3s',
                  height: '100%', boxSizing: 'border-box',
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
                    {item.tag}
                  </span>
                </div>

                {/* Text */}
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.3 }}>
                  {item.name}
                </h2>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, flex: 1 }}>
                  {item.desc}
                </p>

                {/* CTA */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 18,
                  color: item.color, fontSize: 13, fontWeight: 700,
                }}>
                  {isExternal ? 'যোগ দিন' : item.category ? 'Report করুন / দেখুন' : 'দেখুন'}
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
