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
  Sparkles, CheckCircle2, Clock, AlertCircle, Star
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
  },
  'bug-report': {
    name: 'Bug Report', emoji: '🐞', icon: Bug,
    desc: 'কোনো সমস্যা বা error পেয়েছেন? আমাদের জানান — আমরা দ্রুত fix করব।',
    color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)',
    category: 'Bug',
    placeholder: 'কী সমস্যা হচ্ছে? কোথায় হচ্ছে? কীভাবে হচ্ছে — বিস্তারিত লিখুন…',
  },
  'feature-request': {
    name: 'Feature Request', emoji: '💡', icon: Lightbulb,
    desc: 'নতুন feature চান? আপনার idea share করুন — community vote দেবে।',
    color: '#eab308', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.3)',
    category: 'Feature',
    placeholder: 'কোন feature চান? কেন দরকার? কিভাবে কাজ করবে — বিস্তারিত লিখুন…',
  },
  'roadmap': {
    name: 'Product Roadmap', emoji: '🚀', icon: Rocket,
    desc: 'আমরা কী কী বানাচ্ছি তা দেখুন এবং vote দিয়ে প্রাধান্য ঠিক করুন।',
    color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)',
    category: 'Feature',
    placeholder: 'Roadmap সম্পর্কে আপনার মতামত বা নতুন idea লিখুন…',
  },
  'review': {
    name: 'Write a Review', emoji: '⭐', icon: Star,
    desc: 'আমাদের service কেমন লাগলো? অন্যদের review দেখুন এবং নিজেও লিখুন।',
    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)',
    category: 'Feedback',
    placeholder: 'আপনার experience শেয়ার করুন — কী ভালো লাগলো, কী আরও উন্নত হতে পারে…',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function getLikedReports() {
  try { return JSON.parse(localStorage.getItem('nsa_liked') || '{}'); } catch { return {}; }
}
function setLikedReports(obj) {
  localStorage.setItem('nsa_liked', JSON.stringify(obj));
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function CommunitySlugPage({ params }) {
  const { slug } = use(params);
  const router = useRouter();
  const config = SLUG_CONFIG[slug];

  // If no config, handle external/redirect slugs
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
      const params = new URLSearchParams({ category: config.category });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(`${API_BASE}/community/?${params}`, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) throw new Error('Load failed');
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

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/community/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, category: config.category }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Submit failed');
      const payload = await res.json();
      setReports((prev) => [payload, ...prev]);
      setStats((s) => ({ ...s, total: s.total + 1, open: s.open + 1 }));
      toast.success('✅ Report জমা হয়েছে!');
    } catch {
      toast.error('জমা দেওয়া যায়নি');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Like ────────────────────────────────────────────────────────────────
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

  // ── Comment ─────────────────────────────────────────────────────────────
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

  // ── Admin Reply ─────────────────────────────────────────────────────────
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

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 50%, #1a0f2e 100%)' }}>

      {/* ── Hero Header ── */}
      <header style={{ padding: '120px 24px 48px', maxWidth: 900, margin: '0 auto', position: 'relative' }}>
        <Link href="/community" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24,
          color: '#64748b', fontSize: 13, fontWeight: 600, textDecoration: 'none',
          padding: '6px 14px', borderRadius: 999,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          transition: 'color 0.2s'
        }}>
          <ArrowLeft size={14} /> Community Hub
        </Link>

        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: config.bg, border: `1px solid ${config.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>
              {config.emoji}
            </div>
            <div>
              <span style={{
                display: 'inline-block', padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: config.bg, border: `1px solid ${config.border}`, color: config.color,
                marginBottom: 6, letterSpacing: '0.08em'
              }}>
                {config.category}
              </span>
              <h1 style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1.2,
                background: 'linear-gradient(135deg, #e0e7ff, #a5b4fc)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                margin: 0,
              }}>
                {config.name}
              </h1>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, maxWidth: 620, margin: 0 }}>
            {config.desc}
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
            {[
              { label: 'মোট', value: stats.total, color: '#818cf8' },
              { label: 'Open', value: stats.open, color: '#fb923c' },
              { label: 'In Review', value: stats.in_review, color: '#facc15' },
              { label: 'Resolved', value: stats.resolved, color: '#4ade80' },
            ].map((s) => (
              <div key={s.label} style={{
                padding: '6px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: `${s.color}15`, border: `1px solid ${s.color}30`, color: s.color,
              }}>
                {s.label}: {s.value}
              </div>
            ))}
          </div>
        </motion.div>
      </header>

      {/* ── Main Grid ── */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 100px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Submit Form */}
        <SubmissionForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          config={config}
        />

        {/* Filter + Search */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
          padding: '14px 18px', borderRadius: 14,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Report খুঁজুন…"
              style={{
                width: '100%', paddingLeft: 34, paddingRight: searchInput ? 34 : 12,
                paddingTop: 7, paddingBottom: 7,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 9, color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); }}
                style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status chips */}
          {['All', 'Open', 'In Review', 'Resolved'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid',
                ...(statusFilter === s
                  ? { background: config.bg, borderColor: config.color, color: config.color }
                  : { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#64748b' }
                ), transition: 'all 0.2s'
              }}>{s}</button>
          ))}
        </div>

        {/* Reports List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}

          {!loading && reports.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 18, color: '#475569',
            }}>
              <Icon size={36} style={{ margin: '0 auto 12px', opacity: 0.3, color: config.color }} />
              <p style={{ fontSize: 14 }}>এখনও কোনো {config.name} নেই। প্রথমটি submit করুন!</p>
            </div>
          )}

          <AnimatePresence>
            {reports.map((report, idx) => (
              <ReportCard
                key={report.id} report={report} idx={idx} config={config}
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
function ReportCard({ report, idx, config, isLiked, onLike, expandedComments, expandedReplies, toggleComments, toggleReplies, commentDraft, commentName, onCommentDraft, onCommentName, onComment, replyDraft, onReplyDraft, onReply }) {
  const showComments = !!expandedComments[report.id];
  const showReplies = !!expandedReplies[report.id];

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: idx * 0.04 }}
      style={{
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18, padding: '20px 22px',
      }}
      whileHover={{ boxShadow: `0 8px 32px ${config.color}18` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <StatusPill status={report.status} />
        <span style={{
          fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: '0.12em',
          padding: '4px 10px', background: 'rgba(255,255,255,0.04)',
          borderRadius: 999, border: '1px solid rgba(255,255,255,0.07)',
        }}>{report.id}</span>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: 6, lineHeight: 1.4 }}>
        {report.title}
      </h3>
      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65, marginBottom: 12 }}>
        {report.details}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Users size={11} style={{ color: '#475569' }} />
        <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{report.submittedBy || 'Anonymous'}</span>
        <Clock size={11} style={{ color: '#475569' }} />
        <span style={{ fontSize: 11, color: '#475569' }}>{report.submittedAt}</span>
      </div>

      {/* Action Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
        paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap',
      }}>
        <motion.button whileTap={{ scale: 0.86 }} onClick={() => onLike(report.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
            borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12, border: '1px solid',
            background: isLiked ? config.bg : 'transparent',
            borderColor: isLiked ? config.color : 'rgba(255,255,255,0.1)',
            color: isLiked ? config.color : '#64748b', transition: 'all 0.2s',
          }}>
          <ThumbsUp size={13} fill={isLiked ? 'currentColor' : 'none'} />
          {report.like_count || 0}
        </motion.button>

        <button onClick={() => toggleComments(report.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
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
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#c4b5fd', transition: 'all 0.2s',
            }}>
            <Reply size={13} />
            {report.replies.length} Reply
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
                <div key={i} style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <span style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>NSA TEAM</span>
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
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {report.comments?.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 800,
                  }}>{c.by?.[0]?.toUpperCase() || 'A'}</div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <input value={commentName} onChange={(e) => onCommentName(e.target.value)}
                  placeholder="আপনার নাম (optional)"
                  style={{ padding: '8px 13px', borderRadius: 9, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', outline: 'none' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea value={commentDraft} onChange={(e) => onCommentDraft(e.target.value)}
                    placeholder="আপনার comment লিখুন…" rows={2}
                    style={{ flex: 1, padding: '9px 13px', fontSize: 12, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', resize: 'vertical', outline: 'none' }} />
                  <button onClick={() => onComment(report.id)}
                    style={{ padding: '0 14px', borderRadius: 10, cursor: 'pointer', background: 'linear-gradient(135deg,#059669,#0d9488)', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
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

// ── Submit Form ────────────────────────────────────────────────────────────
function SubmissionForm({ onSubmit, isSubmitting, config }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', details: '' });
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.details.trim()) return toast.error('Title ও Details দিন');
    onSubmit(form);
    setForm((f) => ({ ...f, title: '', details: '' }));
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)',
      border: `1px solid ${config.border}`, borderRadius: 20, padding: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, fontSize: 20, flexShrink: 0,
          background: config.bg, border: `1px solid ${config.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{config.emoji}</div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>নতুন {config.name} Submit করুন</h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>বিস্তারিত লিখলে দ্রুত সমাধান পাবেন</p>
        </div>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input name="name" value={form.name} onChange={handleChange} placeholder="আপনার নাম (optional)" style={inp} />
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email (optional)" style={inp} />
        </div>
        <input name="title" value={form.title} onChange={handleChange} placeholder="সংক্ষিপ্ত শিরোনাম *" required style={inp} />
        <textarea name="details" value={form.details} onChange={handleChange} placeholder={config.placeholder} rows={4} required style={{ ...inp, resize: 'vertical' }} />

        <motion.button type="submit" disabled={isSubmitting}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          style={{
            padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14, width: '100%',
            background: isSubmitting ? 'rgba(99,102,241,0.3)' : `linear-gradient(135deg, ${config.color}, ${config.color}cc)`,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: `0 4px 20px ${config.color}35`,
          }}>
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {isSubmitting ? 'Submitting…' : `Submit ${config.name}`}
        </motion.button>
      </form>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const c = {
    Open: { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.25)', color: '#fb923c', icon: Clock },
    'In Review': { bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.25)', color: '#facc15', icon: Sparkles },
    Resolved: { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)', color: '#4ade80', icon: CheckCircle2 },
  }[status] || { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.2)', color: '#94a3b8', icon: AlertCircle };
  const Icon = c.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      <Icon size={10} /> {status}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '20px 22px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[70, 90].map((w) => <div key={w} style={{ width: w, height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }} />)}
      </div>
      <div style={{ height: 16, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />
      <div style={{ height: 13, width: '88%', borderRadius: 5, background: 'rgba(255,255,255,0.04)' }} />
    </div>
  );
}

const inp = {
  width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0',
};
