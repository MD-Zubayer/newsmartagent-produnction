'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Bug, TrendingUp, Lightbulb, Rocket, MessageCircle,
  BookOpen, MessageSquare, Users, ThumbsUp, ChevronDown,
  ChevronUp, Send, Reply, Loader2, Search, X, ArrowLeft,
  Sparkles, CheckCircle2, Clock, AlertCircle, Star,
  Zap, Target, Trophy, Heart, Flag, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://newsmartagent.com/api';

// ── Config per slug ────────────────────────────────────────────────────────
const SLUG_CONFIG = {
  'feedback': {
    name: { en: 'Feedback', bn: 'ফিডব্যাক' }, emoji: '📢', icon: TrendingUp,
    desc: { en: 'Share your thoughts about our platform. Your feedback helps us improve continuously.', bn: 'আমাদের platform সম্পর্কে আপনার মতামত দিন। আপনার feedback আমাদের আরও ভালো করে।' },
    color: '#4f46e5', bg: 'rgba(79,70,229,0.08)', border: 'rgba(79,70,229,0.15)',
    category: 'Feedback',
    placeholder: { en: 'Describe your feedback in detail…', bn: 'আপনার feedback বিস্তারিত লিখুন…' },
    gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  },
  'bug-report': {
    name: { en: 'Bug Report', bn: 'বাগ রিপোর্ট' }, emoji: '🐞', icon: Bug,
    desc: { en: 'Found a problem or error? Let us know — we will fix it quickly.', bn: 'কোনো সমস্যা বা error পেয়েছেন? আমাদের জানান — আমরা দ্রুত fix করব।' },
    color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.15)',
    category: 'Bug',
    placeholder: { en: 'What is the issue? Where does it happen? How to reproduce it — describe in detail…', bn: 'কী সমস্যা হচ্ছে? কোথায় হচ্ছে? কীভাবে reproduce করা যায় — বিস্তারিত লিখুন…' },
    gradient: 'linear-gradient(135deg, #dc2626, #ea580c)',
  },
  'feature-request': {
    name: { en: 'Feature Request', bn: 'ফিচার রিকোয়েস্ট' }, emoji: '💡', icon: Lightbulb,
    desc: { en: 'Want a new feature? Share your idea — the community will vote.', bn: 'নতুন feature চান? আপনার idea share করুন — community vote দেবে।' },
    color: '#ca8a04', bg: 'rgba(202,138,4,0.08)', border: 'rgba(202,138,4,0.15)',
    category: 'Feature',
    placeholder: { en: 'What feature do you want? Why is it needed? How will it work — describe in detail…', bn: 'কোন feature চান? কেন দরকার? কিভাবে কাজ করবে — বিস্তারিত লিখুন…' },
    gradient: 'linear-gradient(135deg, #ca8a04, #d97706)',
  },
  'roadmap': {
    name: { en: 'Product Roadmap', bn: 'প্রোডাক্ট রোডম্যাপ' }, emoji: '🚀', icon: Rocket,
    desc: { en: 'See what we are building and vote to set priorities.', bn: 'আমরা কী কী বানাচ্ছি তা দেখুন এবং vote দিয়ে প্রাধান্য ঠিক করুন।' },
    color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.15)',
    category: 'Roadmap',
    placeholder: { en: 'Share your thoughts or a new idea for the roadmap…', bn: 'Roadmap সম্পর্কে আপনার মতামত বা নতুন idea লিখুন…' },
    gradient: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
  },
  'review': {
    name: { en: 'Write a Review', bn: 'রিভিউ লিখুন' }, emoji: '⭐', icon: Star,
    desc: { en: 'How was your experience with our service? View others reviews and write your own.', bn: 'আমাদের service কেমন লাগলো? অন্যদের review দেখুন এবং নিজেও লিখুন।' },
    color: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.15)',
    category: 'Review',
    placeholder: { en: 'Share your experience — what you liked and what could be improved…', bn: 'আপনার experience শেয়ার করুন — কী ভালো লাগলো, কী আরও উন্নত হতে পারে…' },
    gradient: 'linear-gradient(135deg, #d97706, #dc2626)',
  },
};

// ── UI Translations ────────────────────────────────────────────────────────
const TX = {
  en: {
    backLink: 'Community Hub',
    totalLabel: 'Total', openLabel: 'Open', reviewLabel: 'In Review', resolvedLabel: 'Resolved',
    searchPlaceholder: 'Search…', filterAll: 'All', filterOpen: 'Open', filterReview: 'In Review', filterResolved: 'Resolved',
    emptyTitle: 'No entries yet.', emptyBtn: 'Be the first to submit!',
    likeBtn: 'Helpful', commentsBtn: 'Comments', replyBtn: 'NSA Reply',
    adminPlaceholder: 'Admin reply (admin only)…', adminPost: 'Post',
    commentNamePlaceholder: 'Your name (optional)', commentPlaceholder: 'Write your comment…', commentPost: 'Post',
    nsaTeam: 'NSA TEAM', anonymous: 'Anonymous',
    newTitle: 'New', formSubtitle: 'The more detail you provide, the faster we can help',
    namePh: 'Your name (optional)', emailPh: 'Email (optional)',
    titlePh: 'Short title *', detailsPh: 'Describe in detail *',
    bugTitlePh: 'Brief title for the bug *', bugDetailsPh: 'What is the bug? Describe in detail *',
    stepsLabel: '🔁 Steps to Reproduce (optional)', stepsPh: '1. First do this\n2. Then this\n3. Bug appears',
    expectedLabel: '✅ Expected (what should happen)', expectedPh: 'What was supposed to happen',
    actualLabel: '❌ Actual (what happens)', actualPh: 'What actually happens',
    featTitlePh: 'Feature name / title *', featDetailsPh: 'How will this feature work? Describe in detail *',
    useCaseLabel: '💼 Use Case — why do you need this feature?', useCasePh: 'How will this feature help your work?',
    priorityLabel: '⚡ Priority',
    starPrompt: 'How many stars do you give New Smart Agent?', starHint: '⬆ Click on a star to rate',
    starLabels: ['', 'Very Poor', 'Poor', 'Average', 'Good', 'Excellent'],
    reviewTitlePh: 'Review title (optional)',
    reviewDetailsPh: 'Share your experience in detail — what you liked and what could be improved… *',
    submitBug: 'Submit Bug Report', submitFeature: 'Submit Feature Request', submitReview: 'Submit Review', submitGeneral: 'Submit',
    avgRating: 'Average Rating', totalReviews: 'Total Reviews',
    toastTitle: 'Please provide Title and Details',
    toastRating: 'Please give a star rating',
    toastDetails: 'Please write your review',
    toastSuccess: '✅ Submitted successfully!',
    toastFail: 'Could not submit',
    toastComment: '💬 Comment posted!', toastCommentFail: 'Comment could not be posted',
    toastReply: '↩ Reply posted!', toastReplyFail: 'Reply could not be posted',
    toastCommentWrite: 'Please write a comment', toastAdminOnly: 'Admin only',
    notFound: 'Page not found.', notFoundLink: '← Back to Community Hub',
    langBtn: 'বাংলা',
  },
  bn: {
    backLink: 'Community Hub',
    totalLabel: 'মোট', openLabel: 'Open', reviewLabel: 'In Review', resolvedLabel: 'Resolved',
    searchPlaceholder: 'খুঁজুন…', filterAll: 'সব', filterOpen: 'Open', filterReview: 'In Review', filterResolved: 'Resolved',
    emptyTitle: 'এখনও কোনো entry নেই।', emptyBtn: 'প্রথমটি submit করুন!',
    likeBtn: 'Helpful', commentsBtn: 'Comments', replyBtn: 'NSA Reply',
    adminPlaceholder: 'Admin reply (admin only)…', adminPost: 'Post',
    commentNamePlaceholder: 'Your name (optional)', commentPlaceholder: 'Your comment…', commentPost: 'Post',
    nsaTeam: 'NSA টিম', anonymous: 'অজ্ঞাত',
    newTitle: 'নতুন', formSubtitle: 'বিস্তারিত লিখলে দ্রুত সমাধান পাবেন',
    namePh: 'আপনার নাম (optional)', emailPh: 'Email (optional)',
    titlePh: 'সংক্ষিপ্ত শিরোনাম *', detailsPh: 'বিস্তারিত বর্ণনা করুন *',
    bugTitlePh: 'Bug-এর সংক্ষিপ্ত শিরোনাম *', bugDetailsPh: 'Bug-টি কী? বিস্তারিত বর্ণনা করুন *',
    stepsLabel: '🔁 Steps to Reproduce (optional)', stepsPh: '১. প্রথমে এটা করুন\n২. তারপর এটা\n৩. Bug দেখা যায়',
    expectedLabel: '✅ Expected (কী হওয়া উচিত)', expectedPh: 'যা হওয়া উচিত ছিল',
    actualLabel: '❌ Actual (কী হচ্ছে)', actualPh: 'আসলে যা হচ্ছে',
    featTitlePh: 'Feature-এর নাম / শিরোনাম *', featDetailsPh: 'Feature-টি কীভাবে কাজ করবে? বিস্তারিত বলুন *',
    useCaseLabel: '💼 Use Case — কেন এই feature দরকার?', useCasePh: 'আপনার কাজে এই feature কীভাবে সাহায্য করবে?',
    priorityLabel: '⚡ Priority',
    starPrompt: 'New Smart Agent-কে কত stars দেবেন?', starHint: '⬆ Star-এ click করুন',
    starLabels: ['', 'খুব খারাপ', 'খারাপ', 'ঠিকঠাক', 'ভালো', 'অসাধারণ'],
    reviewTitlePh: 'Review-এর শিরোনাম (optional)',
    reviewDetailsPh: 'আপনার experience বিস্তারিত লিখুন — কী ভালো লাগলো, কী আরও উন্নত হতে পারে… *',
    submitBug: 'Bug Report জমা দিন', submitFeature: 'Feature Request Submit করুন', submitReview: 'Review Submit করুন', submitGeneral: 'Submit করুন',
    avgRating: 'গড় রেটিং', totalReviews: 'মোট রিভিউ',
    toastTitle: 'Title ও Details দিন',
    toastRating: 'অনুগ্রহ করে star rating দিন',
    toastDetails: 'Review লিখুন',
    toastSuccess: '✅ সফলভাবে জমা হয়েছে!',
    toastFail: 'জমা দেওয়া যায়নি',
    toastComment: '💬 Comment হয়েছে!', toastCommentFail: 'Comment জমা হয়নি',
    toastReply: '↩ Reply হয়েছে!', toastReplyFail: 'Reply জমা হয়নি',
    toastCommentWrite: 'Comment লিখুন', toastAdminOnly: 'Admin only',
    notFound: 'Page পাওয়া যায়নি।', notFoundLink: '← Community Hub এ ফিরুন',
    langBtn: 'English',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function getLikedReports() {
  try { return JSON.parse(localStorage.getItem('nsa_liked') || '{}'); } catch { return {}; }
}
function setLikedReports(obj) {
  localStorage.setItem('nsa_liked', JSON.stringify(obj));
}

// ── Star Rating Component ──────────────────────────────────────────────────
function StarRating({ value, onChange, size = 36, readonly = false, lang = 'bn' }) {
  const [hovered, setHovered] = useState(0);
  const labels = TX[lang]?.starLabels || TX.bn.starLabels;
  const display = readonly ? value : (hovered || value);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <motion.button
            key={s}
            type="button"
            onClick={() => !readonly && onChange(s)}
            onMouseEnter={() => !readonly && setHovered(s)}
            onMouseLeave={() => !readonly && setHovered(0)}
            whileTap={readonly ? {} : { scale: 0.8 }}
            animate={{ scale: display >= s ? 1.1 : 1 }}
            style={{
              background: 'none', border: 'none', cursor: readonly ? 'default' : 'pointer',
              padding: 2, lineHeight: 1,
            }}
          >
            <Star
              size={size}
              fill={display >= s ? '#f59e0b' : 'none'}
              color={display >= s ? '#f59e0b' : '#475569'}
              style={{ transition: 'all 0.15s', filter: display >= s ? 'drop-shadow(0 0 6px #f59e0b88)' : 'none' }}
            />
          </motion.button>
        ))}
        {!readonly && display > 0 && (
          <motion.span
            key={display}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700, marginLeft: 6 }}
          >
            {labels[display]}
          </motion.span>
        )}
      </div>
      {readonly && value > 0 && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>
          {'★'.repeat(value)}{'☆'.repeat(5 - value)} ({value}/5)
        </div>
      )}
    </div>
  );
}

// ── Bug Report Extra Fields ────────────────────────────────────────────────
function BugReportForm({ onSubmit, isSubmitting, config, tx, lang }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', details: '', steps: '', expected: '', actual: '' });
  const h = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.details.trim()) return toast.error(tx.toastTitle);
    const combined = `${form.details}\n\n**Steps to Reproduce:**\n${form.steps}\n\n**Expected:** ${form.expected}\n**Actual:** ${form.actual}`;
    onSubmit({ name: form.name, email: form.email, title: form.title, details: combined });
    setForm({ name: '', email: '', title: '', details: '', steps: '', expected: '', actual: '' });
  };

  return (
    <div style={formCardStyle(config)}>
      <FormHeader config={config} tx={tx} lang={lang} />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input name="name" value={form.name} onChange={h} placeholder={tx.namePh} style={inp} />
          <input type="email" name="email" value={form.email} onChange={h} placeholder={tx.emailPh} style={inp} />
        </div>
        <input name="title" value={form.title} onChange={h} placeholder={tx.bugTitlePh} required style={inp} />
        <textarea name="details" value={form.details} onChange={h} placeholder={tx.bugDetailsPh} rows={3} required style={{ ...inp, resize: 'vertical' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>{tx.stepsLabel}</label>
            <textarea name="steps" value={form.steps} onChange={h} placeholder={tx.stepsPh} rows={3} style={{ ...inp, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>{tx.expectedLabel}</label>
              <input name="expected" value={form.expected} onChange={h} placeholder={tx.expectedPh} style={inp} />
            </div>
            <div>
              <label style={labelStyle}>{tx.actualLabel}</label>
              <input name="actual" value={form.actual} onChange={h} placeholder={tx.actualPh} style={inp} />
            </div>
          </div>
        </div>

        <SubmitButton isSubmitting={isSubmitting} config={config} label={tx.submitBug} lang={lang} />
      </form>
    </div>
  );
}

// ── Feature Request Form ───────────────────────────────────────────────────
function FeatureRequestForm({ onSubmit, isSubmitting, config, tx, lang }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', details: '', useCase: '', priority: 'Medium' });
  const h = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.details.trim()) return toast.error(tx.toastTitle);
    const combined = `${form.details}\n\n**Use Case:** ${form.useCase}\n**Priority:** ${form.priority}`;
    onSubmit({ name: form.name, email: form.email, title: form.title, details: combined });
    setForm({ name: '', email: '', title: '', details: '', useCase: '', priority: 'Medium' });
  };

  return (
    <div style={formCardStyle(config)}>
      <FormHeader config={config} tx={tx} lang={lang} />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input name="name" value={form.name} onChange={h} placeholder={tx.namePh} style={inp} />
          <input type="email" name="email" value={form.email} onChange={h} placeholder={tx.emailPh} style={inp} />
        </div>
        <input name="title" value={form.title} onChange={h} placeholder={tx.featTitlePh} required style={inp} />
        <textarea name="details" value={form.details} onChange={h} placeholder={tx.featDetailsPh} rows={3} required style={{ ...inp, resize: 'vertical' }} />
        <div>
          <label style={labelStyle}>{tx.useCaseLabel}</label>
          <textarea name="useCase" value={form.useCase} onChange={h} placeholder={tx.useCasePh} rows={2} style={{ ...inp, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>{tx.priorityLabel}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Low', 'Medium', 'High'].map((p) => (
              <button
                key={p} type="button"
                onClick={() => setForm({ ...form, priority: p })}
                style={{
                  padding: '7px 18px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid',
                  background: form.priority === p ? config.bg : '#fff',
                  borderColor: form.priority === p ? config.color : 'rgba(0,0,0,0.06)',
                  color: form.priority === p ? config.color : '#64748b',
                  transition: 'all 0.2s',
                }}
              >{p}</button>
            ))}
          </div>
        </div>
        <SubmitButton isSubmitting={isSubmitting} config={config} label={tx.submitFeature} lang={lang} />
      </form>
    </div>
  );
}

// ── Review Form ────────────────────────────────────────────────────────────
function ReviewForm({ onSubmit, isSubmitting, config, tx, lang }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', details: '', rating: 0 });
  const h = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (form.rating === 0) return toast.error(tx.toastRating);
    if (!form.details.trim()) return toast.error(tx.toastDetails);
    const combined = `⭐ Rating: ${form.rating}/5\n\n${form.details}`;
    onSubmit({ name: form.name, email: form.email, title: form.title || `${form.rating} Star Review`, details: combined, rating: form.rating });
    setForm({ name: '', email: '', title: '', details: '', rating: 0 });
  };

  return (
    <div style={formCardStyle(config)}>
      <FormHeader config={config} tx={tx} lang={lang} />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          padding: '20px 24px', borderRadius: 16, textAlign: 'center',
          background: config.bg, border: `1px solid ${config.border}`,
        }}>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 14, fontWeight: 700 }}>
            {tx.starPrompt}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <StarRating value={form.rating} onChange={(r) => setForm({ ...form, rating: r })} size={42} lang={lang} />
          </div>
          {form.rating === 0 && (
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 10 }}>{tx.starHint}</p>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input name="name" value={form.name} onChange={h} placeholder={tx.namePh} style={inp} />
          <input type="email" name="email" value={form.email} onChange={h} placeholder={tx.emailPh} style={inp} />
        </div>
        <input name="title" value={form.title} onChange={h} placeholder={tx.reviewTitlePh} style={inp} />
        <textarea name="details" value={form.details} onChange={h}
          placeholder={tx.reviewDetailsPh}
          rows={4} required style={{ ...inp, resize: 'vertical' }} />
        <SubmitButton isSubmitting={isSubmitting} config={config} label={tx.submitReview} lang={lang} />
      </form>
    </div>
  );
}

// ── General Form (Feedback / Roadmap) ─────────────────────────────────────
function GeneralForm({ onSubmit, isSubmitting, config, tx, lang }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', details: '' });
  const h = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.details.trim()) return toast.error(tx.toastTitle);
    onSubmit(form);
    setForm((f) => ({ ...f, title: '', details: '' }));
  };

  return (
    <div style={formCardStyle(config)}>
      <FormHeader config={config} tx={tx} lang={lang} />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input name="name" value={form.name} onChange={h} placeholder={tx.namePh} style={inp} />
          <input type="email" name="email" value={form.email} onChange={h} placeholder={tx.emailPh} style={inp} />
        </div>
        <input name="title" value={form.title} onChange={h} placeholder={tx.titlePh} required style={inp} />
        <textarea name="details" value={form.details} onChange={h} placeholder={config.placeholder[lang] || config.placeholder.en} rows={4} required style={{ ...inp, resize: 'vertical' }} />
        <SubmitButton isSubmitting={isSubmitting} config={config} label={tx.submitGeneral} lang={lang} />
      </form>
    </div>
  );
}

// ── Shared Form Sub-components ─────────────────────────────────────────────
function FormHeader({ config, tx, lang }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 13, fontSize: 22, flexShrink: 0,
        background: config.bg, border: `1px solid ${config.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{config.emoji}</div>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', margin: 0 }}>
          {tx.newTitle} {config.name[lang] || config.name.en}
        </h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{tx.formSubtitle}</p>
      </div>
    </div>
  );
}

function SubmitButton({ isSubmitting, config, label, lang }) {
  return (
    <motion.button type="submit" disabled={isSubmitting}
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
      style={{
        padding: '13px', borderRadius: 12, border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
        fontWeight: 800, fontSize: 14, width: '100%',
        background: isSubmitting ? 'rgba(79,70,229,0.3)' : config.gradient,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: isSubmitting ? 'none' : `0 4px 20px ${config.color}30`,
        marginTop: 4,
      }}>
      {isSubmitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
      {isSubmitting ? (lang === 'bn' ? 'জমা হচ্ছে…' : 'Submitting…') : label}
    </motion.button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function CommunitySlugPage({ params }) {
  const { slug } = use(params);
  const router = useRouter();
  const { lang, setLang } = useLanguage();
  const tx = TX[lang] || TX.bn;
  const config = SLUG_CONFIG[slug];

  if (!config) {
    if (slug === 'guide') {
      if (typeof window !== 'undefined') router.push('/docs');
      return null;
    }
    if (slug === 'whatsapp') {
      if (typeof window !== 'undefined') window.location.href = 'https://wa.me/yourgroup';
      return null;
    }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 18 }}>{tx.notFound}</p>
        <Link href="/community" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>{tx.notFoundLink}</Link>
      </div>
    );
  }

  const Icon = config.icon;

  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, in_review: 0 });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [likedMap, setLikedMap] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [expandedReplies, setExpandedReplies] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentingName, setCommentingName] = useState({});
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const searchTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ category: config.category });
      if (statusFilter !== 'All') p.set('status', statusFilter);
      if (search) p.set('search', search);
      const res = await fetch(`${API_BASE}/community/?${p}`, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const loadedReports = data.reports || [];
      setReports(loadedReports);
      if (data.stats) setStats(data.stats);

      // Sync likedMap with server data
      const newLikedMap = { ...getLikedReports() };
      loadedReports.forEach(r => {
        if (r.is_liked) newLikedMap[String(r.id)] = true;
      });
      setLikedMap(newLikedMap);
      setLikedReports(newLikedMap);
    } catch {
      toast.error('Reports লোড হয়নি');
    } finally {
      setLoading(false);
    }
  }, [config.category, statusFilter, search]);

  useEffect(() => { setLikedMap(getLikedReports()); }, []);
  useEffect(() => { load(); }, [load]);

  const handleSearchInput = (v) => {
    setSearchInput(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v), 400);
  };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/community/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, category: config.category }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setReports((prev) => [payload, ...prev]);
      setStats((s) => ({ ...s, total: s.total + 1, open: s.open + 1 }));
      toast.success(tx.toastSuccess);
    } catch {
      toast.error(tx.toastFail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (reportId) => {
    const wasLiked = !!likedMap[reportId];
    
    // Toggle likedMap locally
    const nextLikedMap = { ...likedMap };
    if (wasLiked) {
      delete nextLikedMap[reportId];
    } else {
      nextLikedMap[reportId] = true;
    }
    setLikedMap(nextLikedMap);
    setLikedReports(nextLikedMap);

    // Optimistic report state update
    setReports((prev) =>
      prev.map((r) => {
        if (String(r.id) === String(reportId)) {
          const count = r.like_count || 0;
          return { ...r, like_count: wasLiked ? Math.max(0, count - 1) : count + 1 };
        }
        return r;
      })
    );

    try {
      const res = await fetch(`${API_BASE}/community/${reportId}/like/`, { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (res.ok) {
        const data = await res.json();
        // Sync with server data (exact count)
        setReports((prev) =>
          prev.map((r) => String(r.id) === String(reportId) ? { ...r, like_count: data.like_count } : r)
        );
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleComment = async (reportId) => {
    const text = (commentDrafts[reportId] || '').trim();
    const name = (commentingName[reportId] || 'Anonymous').trim();
    if (!text) return toast.error(tx.toastCommentWrite);
    try {
      const res = await fetch(`${API_BASE}/community/${reportId}/comment/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, name }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      const newComment = await res.json();
      setReports((prev) => prev.map((r) =>
        r.id === reportId
          ? { ...r, comments: [...(r.comments || []), newComment], comment_count: (r.comment_count || 0) + 1 }
          : r
      ));
      setCommentDrafts((d) => ({ ...d, [reportId]: '' }));
      toast.success(tx.toastComment);
    } catch { toast.error(tx.toastCommentFail); }
  };

  const handleReply = async (id) => {
    const text = (replyDrafts[id] || '').trim();
    if (!text) return toast.error(tx.adminPost);
    try {
      const res = await fetch(`${API_BASE}/community/${id}/reply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        credentials: 'include',
      });
      if (!res.ok) { if (res.status === 403) return toast.error(tx.toastAdminOnly); throw new Error(); }
      const updated = await res.json();
      setReports((prev) => prev.map((r) => r.id === id ? updated : r));
      setReplyDrafts((d) => ({ ...d, [id]: '' }));
      toast.success(tx.toastReply);
    } catch { toast.error(tx.toastReplyFail); }
  };

  const toggleComments = (id) => setExpandedComments((s) => ({ ...s, [id]: !s[id] }));
  const toggleReplies = (id) => setExpandedReplies((s) => ({ ...s, [id]: !s[id] }));

  // ── Choose Submission Form per slug ────────────────────────────────────
  const renderForm = () => {
    if (slug === 'bug-report') return <BugReportForm onSubmit={handleSubmit} isSubmitting={isSubmitting} config={config} tx={tx} lang={lang} />;
    if (slug === 'feature-request') return <FeatureRequestForm onSubmit={handleSubmit} isSubmitting={isSubmitting} config={config} tx={tx} lang={lang} />;
    if (slug === 'review') return <ReviewForm onSubmit={handleSubmit} isSubmitting={isSubmitting} config={config} tx={tx} lang={lang} />;
    return <GeneralForm onSubmit={handleSubmit} isSubmitting={isSubmitting} config={config} tx={tx} lang={lang} />;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── Decorative BG orbs ── */}
      <div style={{ position: 'fixed', top: '10%', left: '5%', width: 500, height: 500, background: `radial-gradient(circle, ${config.color}08 0%, transparent 70%)`, borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0, transform: 'translateZ(0)', willChange: 'filter' }} />
      <div style={{ position: 'fixed', bottom: '5%', right: '5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0, transform: 'translateZ(0)', willChange: 'filter' }} />

      {/* ── Hero Header ── */}
      <header style={{ padding: '110px 24px 40px', maxWidth: 920, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Language toggle */}
        <div style={{ position: 'absolute', top: 16, right: 0, zIndex: 10 }}>
          <div style={{ display: 'inline-flex', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}>
            <button onClick={() => setLang('en')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', background: lang === 'en' ? 'rgba(79,70,229,0.1)' : 'transparent', color: lang === 'en' ? '#4f46e5' : '#64748b', transition: 'all 0.2s' }}>EN</button>
            <button onClick={() => setLang('bn')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', borderLeft: '1px solid rgba(0,0,0,0.05)', background: lang === 'bn' ? 'rgba(79,70,229,0.1)' : 'transparent', color: lang === 'bn' ? '#4f46e5' : '#64748b', transition: 'all 0.2s' }}>বাং</button>
          </div>
        </div>

        <Link href="/community" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28,
          color: '#64748b', fontSize: 13, fontWeight: 700, textDecoration: 'none',
          padding: '7px 16px', borderRadius: 999,
          background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          transition: 'all 0.2s'
        }}>
          <ArrowLeft size={14} /> {tx.backLink}
        </Link>

        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18, flexWrap: 'wrap' }}>
            {/* Animated icon */}
            <motion.div
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 72, height: 72, borderRadius: 22, flexShrink: 0,
                background: config.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
                boxShadow: `0 8px 32px ${config.color}30`,
              }}
            >
              {config.emoji}
            </motion.div>
            <div>
              <span style={{
                display: 'inline-block', padding: '4px 14px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                background: config.bg, border: `1px solid ${config.border}`, color: config.color,
                marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {config.category}
              </span>
              <h1 style={{
                fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 900, lineHeight: 1.15,
                color: '#1e293b',
                margin: 0,
              }}>
                {config.name[lang] || config.name.en}
              </h1>
            </div>
          </div>
          <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.7, maxWidth: 620, margin: 0 }}>
            {config.desc[lang] || config.desc.en}
          </p>

          {/* Stats bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
            {slug === 'review' ? (
              <>
                <div style={{
                  padding: '7px 18px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)', color: '#d97706',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>⭐</span> {tx.avgRating}: {stats.avg_rating || 0}/5
                </div>
                <div style={{
                  padding: '7px 18px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#4f46e5',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>📊</span> {tx.totalReviews}: {stats.total}
                </div>
              </>
            ) : (
              [
                { label: tx.totalLabel, value: stats.total, color: '#818cf8', icon: '📊' },
                { label: tx.openLabel, value: stats.open, color: '#fb923c', icon: '🔓' },
                { label: tx.reviewLabel, value: stats.in_review, color: '#facc15', icon: '👀' },
                { label: tx.resolvedLabel, value: stats.resolved, color: '#4ade80', icon: '✅' },
              ].map((s) => (
                <div key={s.label} style={{
                  padding: '7px 18px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: `${s.color}15`, border: `1px solid ${s.color}30`, color: s.color,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>{s.icon}</span> {s.label}: {s.value}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </header>

      {/* ── Main Content ── */}
      <main style={{ maxWidth: 920, margin: '0 auto', padding: '0 20px 100px', display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', zIndex: 1 }}>

        {/* Submission Form */}
        {renderForm()}

        {/* Filter + Search */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
          padding: '14px 18px', borderRadius: 16,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder={`${config.name[lang] || config.name.en} ${tx.searchPlaceholder}`}
              style={{
                width: '100%', paddingLeft: 36, paddingRight: searchInput ? 36 : 14,
                paddingTop: 10, paddingBottom: 10,
                background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12, color: '#1e293b', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              }}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={13} />
              </button>
            )}
          </div>
          {[tx.filterAll, tx.filterOpen, tx.filterReview, tx.filterResolved].map((label, i) => {
            const val = ['All', 'Open', 'In Review', 'Resolved'][i];
            return (
              <button key={val} onClick={() => setStatusFilter(val)}
                style={{
                  padding: '7px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid',
                  ...(statusFilter === val
                    ? { background: config.bg, borderColor: config.color, color: config.color }
                    : { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#64748b' }
                  ), transition: 'all 0.2s'
                }}>{label}</button>
            );
          })}
        </div>

        {/* Reports List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}

          {!loading && reports.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              style={{
                textAlign: 'center', padding: '70px 20px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px dashed ${config.border}`, borderRadius: 20, color: '#475569',
              }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>{config.emoji}</div>
              <p style={{ fontSize: 16, color: '#64748b', marginBottom: 8 }}>{tx.emptyTitle}</p>
              <p style={{ fontSize: 13, color: '#374151' }}>{tx.emptyBtn}</p>
            </motion.div>
          )}

          <AnimatePresence>
            {reports.map((report, idx) => (
              <ReportCard
                key={report.id} report={report} idx={idx} config={config} slug={slug}
                isLiked={!!likedMap[report.id]}
                onLike={handleLike}
                expandedComments={expandedComments} expandedReplies={expandedReplies}
                toggleComments={toggleComments} toggleReplies={toggleReplies}
                commentDraft={commentDrafts[report.id] || ''} commentName={commentingName[report.id] || ''}
                onCommentDraft={(v) => setCommentDrafts((d) => ({ ...d, [report.id]: v }))}
                onCommentName={(v) => setCommentingName((d) => ({ ...d, [report.id]: v }))}
                onComment={handleComment}
                replyDraft={replyDrafts[report.id] || ''}
                onReplyDraft={(v) => setReplyDrafts((d) => ({ ...d, [report.id]: v }))}
                onReply={handleReply}
                tx={tx} lang={lang}
              />
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ── Report Card ────────────────────────────────────────────────────────────
function ReportCard({ report, idx, config, slug, isLiked, onLike, expandedComments, expandedReplies, toggleComments, toggleReplies, commentDraft, commentName, onCommentDraft, onCommentName, onComment, replyDraft, onReplyDraft, onReply, tx, lang }) {
  const showComments = !!expandedComments[report.id];
  const showReplies = !!expandedReplies[report.id];

  // Extract rating from backend field or details text
  const ratingMatch = !report.rating && slug === 'review' && report.details?.match(/⭐ Rating: (\d)\/5/);
  const rating = report.rating || (ratingMatch ? parseInt(ratingMatch[1]) : 0);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: idx * 0.04 }}
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.06)', borderRadius: 20, padding: '22px 24px',
        borderLeft: `3px solid ${config.color}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        transform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
      }}
      whileHover={{ boxShadow: `0 8px 30px rgba(0,0,0,0.06)`, y: -2 }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusPill status={report.status} tx={tx} />
          <span style={{ fontSize: 10, color: '#374155', fontWeight: 700, letterSpacing: '0.1em', padding: '3px 9px', background: 'rgba(255,255,255,0.04)', borderRadius: 999, border: '1px solid rgba(255,255,255,0.07)' }}>
            #{report.id}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569' }}>
          <Users size={11} />
          <span style={{ fontWeight: 600 }}>{report.submittedBy || 'Anonymous'}</span>
          <span style={{ color: '#334155' }}>•</span>
          <Clock size={11} />
          <span>{report.submittedAt}</span>
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 8, lineHeight: 1.4 }}>
        {report.title}
      </h3>

      {/* Star display for reviews */}
      {slug === 'review' && rating > 0 && (
        <div style={{ marginBottom: 10 }}>
          <StarRating value={rating} onChange={() => {}} readonly size={20} />
        </div>
      )}

      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 14 }}>
        {report.details?.replace(/⭐ Rating: \d\/5\n\n/, '')}
      </p>

      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap' }}>
        <motion.button whileTap={{ scale: 0.86 }} onClick={() => onLike(report.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px',
            borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12, border: '1px solid',
            background: isLiked ? config.bg : '#fff',
            borderColor: isLiked ? config.color : 'rgba(0,0,0,0.08)',
            color: isLiked ? config.color : '#64748b', transition: 'all 0.2s',
            boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
          }}>
          <ThumbsUp size={13} fill={isLiked ? 'currentColor' : 'none'} />
          {report.like_count || 0} {tx.likeBtn}
        </motion.button>

        <button onClick={() => toggleComments(report.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
            borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            background: '#fff', border: '1px solid rgba(0,0,0,0.08)', color: '#64748b', transition: 'all 0.2s',
            boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
          }}>
          <MessageSquare size={13} />
          {report.comment_count || 0} {tx.commentsBtn}
          {showComments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {report.replies?.length > 0 && (
          <button onClick={() => toggleReplies(report.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
              borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed',
              boxShadow: '0 2px 5px rgba(124,58,237,0.05)',
            }}>
            <Reply size={13} />
            {report.replies.length} {tx.replyBtn}
            {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* NSA Replies */}
      <AnimatePresence>
        {showReplies && report.replies?.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {report.replies.map((reply, i) => (
                <div key={i} style={{ padding: '13px 16px', borderRadius: 12, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>{tx.nsaTeam}</span>
                    <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>{reply.by}</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>• {reply.at}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, margin: 0 }}>{reply.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin reply input */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <textarea value={replyDraft} onChange={(e) => onReplyDraft(e.target.value)}
          placeholder={tx.adminPlaceholder} rows={2}
          style={{ flex: 1, padding: '10px 14px', fontSize: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid rgba(0,0,0,0.06)', color: '#1e293b', resize: 'vertical', outline: 'none' }} />
        <button onClick={() => onReply(report.id)}
          style={{ padding: '0 14px', borderRadius: 10, cursor: 'pointer', background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)', color: '#4f46e5', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Reply size={13} /> {tx.adminPost}
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              {report.comments?.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>
                    {c.by?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 12, padding: '10px 14px', flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 800 }}>{c.by || tx.anonymous}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>• {c.at}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: 0 }}>{c.text}</p>
                  </div>
                </div>
              ))}

              {/* New Comment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <input value={commentName} onChange={(e) => onCommentName(e.target.value)}
                  placeholder={tx.commentNamePlaceholder}
                  style={{ padding: '8px 13px', borderRadius: 9, fontSize: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', color: '#1e293b', outline: 'none' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea value={commentDraft} onChange={(e) => onCommentDraft(e.target.value)}
                    placeholder={tx.commentPlaceholder} rows={2}
                    style={{ flex: 1, padding: '9px 13px', fontSize: 12, borderRadius: 10, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', color: '#1e293b', resize: 'vertical', outline: 'none' }} />
                  <button onClick={() => onComment(report.id)}
                    style={{ padding: '0 16px', borderRadius: 10, cursor: 'pointer', background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: 12, border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Send size={13} /> {tx.commentPost}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

// ── Status Pill ────────────────────────────────────────────────────────────
function StatusPill({ status, tx }) {
  const c = {
    Open: { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.25)', color: '#fb923c', icon: Clock, label: tx.filterOpen },
    'In Review': { bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.25)', color: '#facc15', icon: Sparkles, label: tx.filterReview },
    Resolved: { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)', color: '#4ade80', icon: CheckCircle2, label: tx.filterResolved },
  }[status] || { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.2)', color: '#94a3b8', icon: AlertCircle, label: status || tx.unknown };
  const StatusIcon = c.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      <StatusIcon size={10} /> {c.label}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 20, padding: '22px 24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[80, 60].map((w, i) => <div key={i} style={{ width: w, height: 24, borderRadius: 999, background: '#f1f5f9' }} />)}
      </div>
      <div style={{ height: 18, width: '55%', borderRadius: 6, background: '#f8fafc', marginBottom: 10 }} />
      <div style={{ height: 13, width: '90%', borderRadius: 5, background: '#f1f5f9', marginBottom: 6 }} />
      <div style={{ height: 13, width: '70%', borderRadius: 5, background: '#f8fafc' }} />
    </div>
  );
}

// ── Style Helpers ──────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  background: '#fff', border: '1px solid rgba(0,0,0,0.08)', color: '#1e293b',
  transition: 'all 0.2s',
  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
};

const labelStyle = {
  display: 'block', fontSize: 11, color: '#475569', fontWeight: 800,
  marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase',
};

function formCardStyle(config) {
  return {
    background: '#fff',
    border: `1px solid rgba(0,0,0,0.05)`, borderRadius: 24, padding: 28,
    boxShadow: `0 10px 30px rgba(0,0,0,0.04)`,
    position: 'relative', overflow: 'hidden',
  };
}
