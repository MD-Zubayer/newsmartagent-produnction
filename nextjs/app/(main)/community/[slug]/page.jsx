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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://newsmartagent.com/api';

// ── Config per slug ────────────────────────────────────────────────────────
const SLUG_CONFIG = {
  'feedback': {
    name: 'Feedback', emoji: '📢', icon: TrendingUp,
    desc: 'আমাদের platform সম্পর্কে আপনার মতামত দিন। আপনার feedback আমাদের আরও ভালো করে।',
    color: '#6366f1', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)',
    category: 'Feedback',
    placeholder: 'আপনার feedback বিস্তারিত লিখুন…',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
  'bug-report': {
    name: 'Bug Report', emoji: '🐞', icon: Bug,
    desc: 'কোনো সমস্যা বা error পেয়েছেন? আমাদের জানান — আমরা দ্রুত fix করব।',
    color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)',
    category: 'Bug',
    placeholder: 'কী সমস্যা হচ্ছে? কোথায় হচ্ছে? কীভাবে reproduce করা যায় — বিস্তারিত লিখুন…',
    gradient: 'linear-gradient(135deg, #ef4444, #f97316)',
  },
  'feature-request': {
    name: 'Feature Request', emoji: '💡', icon: Lightbulb,
    desc: 'নতুন feature চান? আপনার idea share করুন — community vote দেবে।',
    color: '#eab308', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.3)',
    category: 'Feature',
    placeholder: 'কোন feature চান? কেন দরকার? কিভাবে কাজ করবে — বিস্তারিত লিখুন…',
    gradient: 'linear-gradient(135deg, #eab308, #f59e0b)',
  },
  'roadmap': {
    name: 'Product Roadmap', emoji: '🚀', icon: Rocket,
    desc: 'আমরা কী কী বানাচ্ছি তা দেখুন এবং vote দিয়ে প্রাধান্য ঠিক করুন।',
    color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)',
    category: 'Feature',
    placeholder: 'Roadmap সম্পর্কে আপনার মতামত বা নতুন idea লিখুন…',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
  },
  'review': {
    name: 'Write a Review', emoji: '⭐', icon: Star,
    desc: 'আমাদের service কেমন লাগলো? অন্যদের review দেখুন এবং নিজেও লিখুন।',
    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)',
    category: 'Feedback',
    placeholder: 'আপনার experience শেয়ার করুন — কী ভালো লাগলো, কী আরও উন্নত হতে পারে…',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
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
function StarRating({ value, onChange, size = 36, readonly = false }) {
  const [hovered, setHovered] = useState(0);
  const labels = ['', 'খুব খারাপ', 'খারাপ', 'ঠিকঠাক', 'ভালো', 'অসাধারণ'];
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
function BugReportForm({ onSubmit, isSubmitting, config }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', details: '', steps: '', expected: '', actual: '' });
  const h = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.details.trim()) return toast.error('Title ও Details দিন');
    const combined = `${form.details}\n\n**Steps to Reproduce:**\n${form.steps}\n\n**Expected:** ${form.expected}\n**Actual:** ${form.actual}`;
    onSubmit({ name: form.name, email: form.email, title: form.title, details: combined });
    setForm({ name: '', email: '', title: '', details: '', steps: '', expected: '', actual: '' });
  };

  return (
    <div style={formCardStyle(config)}>
      <FormHeader config={config} subtitle="Bug যত বিস্তারিত বলবেন, তত দ্রুত fix হবে" />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input name="name" value={form.name} onChange={h} placeholder="আপনার নাম (optional)" style={inp} />
          <input type="email" name="email" value={form.email} onChange={h} placeholder="Email (optional)" style={inp} />
        </div>
        <input name="title" value={form.title} onChange={h} placeholder="Bug-এর সংক্ষিপ্ত শিরোনাম *" required style={inp} />
        <textarea name="details" value={form.details} onChange={h} placeholder="Bug-টি কী? বিস্তারিত বর্ণনা করুন *" rows={3} required style={{ ...inp, resize: 'vertical' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>🔁 Steps to Reproduce (optional)</label>
            <textarea name="steps" value={form.steps} onChange={h} placeholder="১. প্রথমে এটা করুন&#10;২. তারপর এটা&#10;৩. Bug দেখা যায়" rows={3} style={{ ...inp, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>✅ Expected (কী হওয়া উচিত)</label>
              <input name="expected" value={form.expected} onChange={h} placeholder="যা হওয়া উচিত ছিল" style={inp} />
            </div>
            <div>
              <label style={labelStyle}>❌ Actual (কী হচ্ছে)</label>
              <input name="actual" value={form.actual} onChange={h} placeholder="আসলে যা হচ্ছে" style={inp} />
            </div>
          </div>
        </div>

        <SubmitButton isSubmitting={isSubmitting} config={config} label="Bug Report জমা দিন" />
      </form>
    </div>
  );
}

// ── Feature Request Form ───────────────────────────────────────────────────
function FeatureRequestForm({ onSubmit, isSubmitting, config }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', details: '', useCase: '', priority: 'Medium' });
  const h = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.details.trim()) return toast.error('Title ও Details দিন');
    const combined = `${form.details}\n\n**Use Case:** ${form.useCase}\n**Priority:** ${form.priority}`;
    onSubmit({ name: form.name, email: form.email, title: form.title, details: combined });
    setForm({ name: '', email: '', title: '', details: '', useCase: '', priority: 'Medium' });
  };

  return (
    <div style={formCardStyle(config)}>
      <FormHeader config={config} subtitle="আপনার idea আমাদের roadmap-এ যোগ হতে পারে!" />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input name="name" value={form.name} onChange={h} placeholder="আপনার নাম (optional)" style={inp} />
          <input type="email" name="email" value={form.email} onChange={h} placeholder="Email (optional)" style={inp} />
        </div>
        <input name="title" value={form.title} onChange={h} placeholder="Feature-এর নাম / শিরোনাম *" required style={inp} />
        <textarea name="details" value={form.details} onChange={h} placeholder="Feature-টি কীভাবে কাজ করবে? বিস্তারিত বলুন *" rows={3} required style={{ ...inp, resize: 'vertical' }} />
        <div>
          <label style={labelStyle}>💼 Use Case — কেন এই feature দরকার?</label>
          <textarea name="useCase" value={form.useCase} onChange={h} placeholder="আপনার কাজে এই feature কীভাবে সাহায্য করবে?" rows={2} style={{ ...inp, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>⚡ Priority</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Low', 'Medium', 'High'].map((p) => (
              <button
                key={p} type="button"
                onClick={() => setForm({ ...form, priority: p })}
                style={{
                  padding: '7px 18px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid',
                  background: form.priority === p ? config.bg : 'transparent',
                  borderColor: form.priority === p ? config.color : 'rgba(255,255,255,0.1)',
                  color: form.priority === p ? config.color : '#64748b',
                }}
              >{p}</button>
            ))}
          </div>
        </div>
        <SubmitButton isSubmitting={isSubmitting} config={config} label="Feature Request Submit করুন" />
      </form>
    </div>
  );
}

// ── Review Form ────────────────────────────────────────────────────────────
function ReviewForm({ onSubmit, isSubmitting, config }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', details: '', rating: 0 });
  const h = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (form.rating === 0) return toast.error('অনুগ্রহ করে star rating দিন');
    if (!form.details.trim()) return toast.error('Review লিখুন');
    const combined = `⭐ Rating: ${form.rating}/5\n\n${form.details}`;
    onSubmit({ name: form.name, email: form.email, title: form.title || `${form.rating} Star Review`, details: combined });
    setForm({ name: '', email: '', title: '', details: '', rating: 0 });
  };

  return (
    <div style={formCardStyle(config)}>
      <FormHeader config={config} subtitle="আপনার মতামত অন্যদের সঠিক সিদ্ধান্ত নিতে সাহায্য করে" />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Star Rating */}
        <div style={{
          padding: '20px 24px', borderRadius: 16, textAlign: 'center',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        }}>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14, fontWeight: 600 }}>
            New Smart Agent-কে কত stars দেবেন?
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <StarRating value={form.rating} onChange={(r) => setForm({ ...form, rating: r })} size={42} />
          </div>
          {form.rating === 0 && (
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 10 }}>⬆ Star-এ click করুন</p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input name="name" value={form.name} onChange={h} placeholder="আপনার নাম (optional)" style={inp} />
          <input type="email" name="email" value={form.email} onChange={h} placeholder="Email (optional)" style={inp} />
        </div>
        <input name="title" value={form.title} onChange={h} placeholder="Review-এর শিরোনাম (optional)" style={inp} />
        <textarea name="details" value={form.details} onChange={h}
          placeholder="আপনার experience বিস্তারিত লিখুন — কী ভালো লাগলো, কী আরও উন্নত হতে পারে… *"
          rows={4} required style={{ ...inp, resize: 'vertical' }} />

        <SubmitButton isSubmitting={isSubmitting} config={config} label="Review Submit করুন" />
      </form>
    </div>
  );
}

// ── General Form (Feedback / Roadmap) ─────────────────────────────────────
function GeneralForm({ onSubmit, isSubmitting, config }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', details: '' });
  const h = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.details.trim()) return toast.error('Title ও Details দিন');
    onSubmit(form);
    setForm((f) => ({ ...f, title: '', details: '' }));
  };

  return (
    <div style={formCardStyle(config)}>
      <FormHeader config={config} subtitle="বিস্তারিত লিখলে দ্রুত সমাধান পাবেন" />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input name="name" value={form.name} onChange={h} placeholder="আপনার নাম (optional)" style={inp} />
          <input type="email" name="email" value={form.email} onChange={h} placeholder="Email (optional)" style={inp} />
        </div>
        <input name="title" value={form.title} onChange={h} placeholder="সংক্ষিপ্ত শিরোনাম *" required style={inp} />
        <textarea name="details" value={form.details} onChange={h} placeholder={config.placeholder} rows={4} required style={{ ...inp, resize: 'vertical' }} />
        <SubmitButton isSubmitting={isSubmitting} config={config} label={`Submit ${config.name}`} />
      </form>
    </div>
  );
}

// ── Shared Form Sub-components ─────────────────────────────────────────────
function FormHeader({ config, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 13, fontSize: 22, flexShrink: 0,
        background: config.bg, border: `1px solid ${config.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{config.emoji}</div>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>নতুন {config.name}</h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function SubmitButton({ isSubmitting, config, label }) {
  return (
    <motion.button type="submit" disabled={isSubmitting}
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
      style={{
        padding: '13px', borderRadius: 12, border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
        fontWeight: 800, fontSize: 14, width: '100%',
        background: isSubmitting ? 'rgba(99,102,241,0.3)' : config.gradient,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: isSubmitting ? 'none' : `0 4px 20px ${config.color}40`,
        marginTop: 4,
      }}>
      {isSubmitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
      {isSubmitting ? 'Submitting…' : label}
    </motion.button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function CommunitySlugPage({ params }) {
  const { slug } = use(params);
  const router = useRouter();
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', color: '#94a3b8', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 18 }}>Page পাওয়া যায়নি।</p>
        <Link href="/community" style={{ color: '#a5b4fc', textDecoration: 'none' }}>← Community Hub এ ফিরুন</Link>
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
      setReports(data.reports || []);
      if (data.stats) setStats(data.stats);
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
      toast.success('✅ সফলভাবে জমা হয়েছে!');
    } catch {
      toast.error('জমা দেওয়া যায়নি');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (id) => {
    const wasLiked = !!likedMap[id];
    const newMap = { ...likedMap, [id]: !wasLiked };
    if (wasLiked) delete newMap[id];
    setLikedMap(newMap);
    setLikedReports(newMap);
    setReports((prev) =>
      prev.map((r) => r.id === id ? { ...r, like_count: wasLiked ? Math.max(0, r.like_count - 1) : r.like_count + 1 } : r)
    );
    try {
      const res = await fetch(`${API_BASE}/community/${id}/like/`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReports((prev) => prev.map((r) => r.id === id ? { ...r, like_count: data.like_count } : r));
      }
    } catch {}
  };

  const handleComment = async (reportId) => {
    const text = (commentDrafts[reportId] || '').trim();
    const name = (commentingName[reportId] || 'Anonymous').trim();
    if (!text) return toast.error('Comment লিখুন');
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
      toast.success('💬 Comment হয়েছে!');
    } catch { toast.error('Comment জমা হয়নি'); }
  };

  const handleReply = async (id) => {
    const text = (replyDrafts[id] || '').trim();
    if (!text) return toast.error('Reply লিখুন');
    try {
      const res = await fetch(`${API_BASE}/community/${id}/reply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        credentials: 'include',
      });
      if (!res.ok) { if (res.status === 403) return toast.error('Admin only'); throw new Error(); }
      const updated = await res.json();
      setReports((prev) => prev.map((r) => r.id === id ? updated : r));
      setReplyDrafts((d) => ({ ...d, [id]: '' }));
      toast.success('↩ Reply হয়েছে!');
    } catch { toast.error('Reply জমা হয়নি'); }
  };

  const toggleComments = (id) => setExpandedComments((s) => ({ ...s, [id]: !s[id] }));
  const toggleReplies = (id) => setExpandedReplies((s) => ({ ...s, [id]: !s[id] }));

  // ── Choose Submission Form per slug ────────────────────────────────────
  const renderForm = () => {
    if (slug === 'bug-report') return <BugReportForm onSubmit={handleSubmit} isSubmitting={isSubmitting} config={config} />;
    if (slug === 'feature-request') return <FeatureRequestForm onSubmit={handleSubmit} isSubmitting={isSubmitting} config={config} />;
    if (slug === 'review') return <ReviewForm onSubmit={handleSubmit} isSubmitting={isSubmitting} config={config} />;
    return <GeneralForm onSubmit={handleSubmit} isSubmitting={isSubmitting} config={config} />;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 50%, #1a0f2e 100%)' }}>

      {/* ── Decorative BG orbs ── */}
      <div style={{ position: 'fixed', top: '10%', left: '5%', width: 500, height: 500, background: `radial-gradient(circle, ${config.color}15 0%, transparent 70%)`, borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '5%', right: '5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Hero Header ── */}
      <header style={{ padding: '110px 24px 40px', maxWidth: 920, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Link href="/community" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28,
          color: '#64748b', fontSize: 13, fontWeight: 600, textDecoration: 'none',
          padding: '7px 16px', borderRadius: 999,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          transition: 'color 0.2s'
        }}>
          <ArrowLeft size={14} /> Community Hub
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
                boxShadow: `0 8px 32px ${config.color}40`,
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
                fontSize: 'clamp(1.6rem, 4vw, 2.8rem)', fontWeight: 900, lineHeight: 1.15,
                background: 'linear-gradient(135deg, #e0e7ff, #a5b4fc)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                margin: 0,
              }}>
                {config.name}
              </h1>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.7, maxWidth: 620, margin: 0 }}>
            {config.desc}
          </p>

          {/* Stats bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
            {[
              { label: 'মোট', value: stats.total, color: '#818cf8', icon: '📊' },
              { label: 'Open', value: stats.open, color: '#fb923c', icon: '🔓' },
              { label: 'In Review', value: stats.in_review, color: '#facc15', icon: '👀' },
              { label: 'Resolved', value: stats.resolved, color: '#4ade80', icon: '✅' },
            ].map((s) => (
              <div key={s.label} style={{
                padding: '7px 18px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: `${s.color}15`, border: `1px solid ${s.color}30`, color: s.color,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>{s.icon}</span> {s.label}: {s.value}
              </div>
            ))}
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
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder={`${config.name} খুঁজুন…`}
              style={{
                width: '100%', paddingLeft: 36, paddingRight: searchInput ? 36 : 14,
                paddingTop: 8, paddingBottom: 8,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 10, color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={13} />
              </button>
            )}
          </div>
          {['All', 'Open', 'In Review', 'Resolved'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{
                padding: '7px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid',
                ...(statusFilter === s
                  ? { background: config.bg, borderColor: config.color, color: config.color }
                  : { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#64748b' }
                ), transition: 'all 0.2s'
              }}>{s}</button>
          ))}
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
              <p style={{ fontSize: 16, color: '#64748b', marginBottom: 8 }}>
                এখনও কোনো {config.name} নেই।
              </p>
              <p style={{ fontSize: 13, color: '#374151' }}>প্রথমটি submit করে শুরু করুন!</p>
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
              />
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ── Report Card ────────────────────────────────────────────────────────────
function ReportCard({ report, idx, config, slug, isLiked, onLike, expandedComments, expandedReplies, toggleComments, toggleReplies, commentDraft, commentName, onCommentDraft, onCommentName, onComment, replyDraft, onReplyDraft, onReply }) {
  const showComments = !!expandedComments[report.id];
  const showReplies = !!expandedReplies[report.id];

  // Extract rating from details text if review
  const ratingMatch = slug === 'review' && report.details?.match(/⭐ Rating: (\d)\/5/);
  const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: idx * 0.04 }}
      style={{
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '22px 24px',
        borderLeft: `3px solid ${config.color}`,
      }}
      whileHover={{ boxShadow: `0 8px 40px ${config.color}18` }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusPill status={report.status} />
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

      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.4 }}>
        {report.title}
      </h3>

      {/* Star display for reviews */}
      {slug === 'review' && rating > 0 && (
        <div style={{ marginBottom: 10 }}>
          <StarRating value={rating} onChange={() => {}} readonly size={20} />
        </div>
      )}

      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 14 }}>
        {report.details?.replace(/⭐ Rating: \d\/5\n\n/, '')}
      </p>

      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        <motion.button whileTap={{ scale: 0.86 }} onClick={() => onLike(report.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px',
            borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12, border: '1px solid',
            background: isLiked ? config.bg : 'transparent',
            borderColor: isLiked ? config.color : 'rgba(255,255,255,0.1)',
            color: isLiked ? config.color : '#64748b', transition: 'all 0.2s',
          }}>
          <ThumbsUp size={13} fill={isLiked ? 'currentColor' : 'none'} />
          {report.like_count || 0} Helpful
        </motion.button>

        <button onClick={() => toggleComments(report.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
            borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', color: '#64748b', transition: 'all 0.2s',
          }}>
          <MessageSquare size={13} />
          {report.comment_count || 0} Comments
          {showComments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {report.replies?.length > 0 && (
          <button onClick={() => toggleReplies(report.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
              borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#c4b5fd',
            }}>
            <Reply size={13} />
            {report.replies.length} NSA Reply
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
                <div key={i} style={{ padding: '13px 16px', borderRadius: 12, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>NSA TEAM</span>
                    <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>{reply.by}</span>
                    <span style={{ fontSize: 10, color: '#475569' }}>• {reply.at}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#c4b5fd', lineHeight: 1.6 }}>{reply.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin reply input */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <textarea value={replyDraft} onChange={(e) => onReplyDraft(e.target.value)}
          placeholder="Admin reply (admin only)…" rows={2}
          style={{ flex: 1, padding: '9px 13px', fontSize: 12, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', resize: 'vertical', outline: 'none' }} />
        <button onClick={() => onReply(report.id)}
          style={{ padding: '0 14px', borderRadius: 10, cursor: 'pointer', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Reply size={13} /> Post
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {report.comments?.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>
                    {c.by?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px', flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>{c.by}</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>• {c.at}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{c.text}</p>
                  </div>
                </div>
              ))}

              {/* New Comment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <input value={commentName} onChange={(e) => onCommentName(e.target.value)}
                  placeholder="আপনার নাম (optional)"
                  style={{ padding: '8px 13px', borderRadius: 9, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', outline: 'none' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea value={commentDraft} onChange={(e) => onCommentDraft(e.target.value)}
                    placeholder="আপনার comment লিখুন…" rows={2}
                    style={{ flex: 1, padding: '9px 13px', fontSize: 12, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', resize: 'vertical', outline: 'none' }} />
                  <button onClick={() => onComment(report.id)}
                    style={{ padding: '0 16px', borderRadius: 10, cursor: 'pointer', background: 'linear-gradient(135deg,#059669,#0d9488)', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Send size={13} /> Post
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
function StatusPill({ status }) {
  const c = {
    Open: { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.25)', color: '#fb923c', icon: Clock, label: 'Open' },
    'In Review': { bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.25)', color: '#facc15', icon: Sparkles, label: 'In Review' },
    Resolved: { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)', color: '#4ade80', icon: CheckCircle2, label: 'Resolved' },
  }[status] || { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.2)', color: '#94a3b8', icon: AlertCircle, label: status || 'Unknown' };
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
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '22px 24px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[80, 60].map((w) => <div key={w} style={{ width: w, height: 24, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }} />)}
      </div>
      <div style={{ height: 18, width: '55%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />
      <div style={{ height: 13, width: '90%', borderRadius: 5, background: 'rgba(255,255,255,0.04)', marginBottom: 6 }} />
      <div style={{ height: 13, width: '70%', borderRadius: 5, background: 'rgba(255,255,255,0.03)' }} />
    </div>
  );
}

// ── Style Helpers ──────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '11px 14px', borderRadius: 11, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0',
  transition: 'border-color 0.2s',
};

const labelStyle = {
  display: 'block', fontSize: 11, color: '#64748b', fontWeight: 700,
  marginBottom: 6, letterSpacing: '0.04em',
};

function formCardStyle(config) {
  return {
    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)',
    border: `1px solid ${config.border}`, borderRadius: 22, padding: 26,
    boxShadow: `0 8px 40px ${config.color}12`,
  };
}
