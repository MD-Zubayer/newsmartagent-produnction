'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, Bug, CheckCircle2, Loader2, Send, Reply, Sparkles } from 'lucide-react';

const categories = ['Bug', 'Feedback', 'Feature'];

export default function CommunityDesk() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/community/', { cache: 'no-store', credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setReports(data.reports || []);
      } catch (err) {
        console.error(err);
        toast.error('লোড করা যাচ্ছে না');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/community/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Submit failed');
      const payload = await res.json();
      setReports((prev) => [payload, ...prev]);
      toast.success('Report submitted. আমরা দ্রুত দেখে নিচ্ছি!');
    } catch (err) {
      console.error(err);
      toast.error('পাঠানো যায়নি, আবার চেষ্টা করুন');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (id) => {
    const text = replyDrafts[id]?.trim();
    if (!text) return toast.error('Reply লিখুন');
    try {
      const res = await fetch(`/api/community/${id}/reply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Reply failed');
      const updated = await res.json();
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setReplyDrafts((d) => ({ ...d, [id]: '' }));
      toast.success('Reply posted');
    } catch (err) {
      console.error(err);
      toast.error('Reply জমা হয়নি');
    }
  };

  const openCount = useMemo(() => reports.filter((r) => r.status === 'Open').length, [reports]);
  const resolvedCount = useMemo(() => reports.filter((r) => r.status === 'Resolved').length, [reports]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 pb-20">
      <header className="pt-28 pb-10 max-w-6xl mx-auto px-6 text-center space-y-4">
        <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
          <Sparkles className="w-4 h-4" /> Community Desk
        </p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900">Report • Review • Resolve</h1>
        <p className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base">
          Feedback, bug report, roadmap—everything এক জায়গায়। Submit করুন, আর আমাদের টিম এখানেই আপডেট দেবে।
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-sm font-bold text-gray-600">
          <span className="px-3 py-1 bg-white rounded-full shadow-sm">Open: {openCount}</span>
          <span className="px-3 py-1 bg-white rounded-full shadow-sm">Resolved: {resolvedCount}</span>
          <span className="px-3 py-1 bg-white rounded-full shadow-sm">Total: {reports.length}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 grid lg:grid-cols-3 gap-8">
        <section className="lg:col-span-1">
          <SubmissionForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </section>

        <section className="lg:col-span-2 space-y-4">
          {loading && (
            <div className="bg-white/70 border border-slate-100 rounded-2xl p-5 text-sm text-gray-500">
              Loading reports...
            </div>
          )}
          {!loading && reports.length === 0 && (
            <div className="bg-white/80 border border-slate-100 rounded-2xl p-8 text-center text-sm text-gray-500">
              এখনও কোনো রিপোর্ট নেই। প্রথমটি সাবমিট করুন!
            </div>
          )}
          {reports.map((report) => (
            <article key={report.id} className="bg-white/80 backdrop-blur shadow-sm border border-slate-100 rounded-2xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Badge tone={report.category === 'Bug' ? 'red' : report.category === 'Feature' ? 'blue' : 'amber'}>
                      {report.category}
                    </Badge>
                    <StatusPill status={report.status} />
                    <span className="text-xs text-gray-400 font-bold">{report.id}</span>
                  </div>
                  <h3 className="text-lg font-black text-gray-900">{report.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{report.details}</p>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                    {report.submittedBy} • {report.submittedAt}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {report.replies.map((reply, idx) => (
                  <div key={idx} className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-[0.2em] mb-1">
                      {reply.by} • {reply.at}
                    </p>
                    <p className="text-sm text-indigo-900 leading-relaxed">{reply.text}</p>
                  </div>
                ))}

                <div className="flex items-start gap-2">
                  <textarea
                    value={replyDrafts[report.id] || ''}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [report.id]: e.target.value }))}
                    placeholder="Reply here…"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition px-3 py-2 text-sm"
                    rows={2}
                  />
                  <button
                    onClick={() => handleReply(report.id)}
                    className="h-10 px-3 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center gap-1 hover:bg-indigo-700 active:scale-95 transition"
                  >
                    <Reply className="w-4 h-4" /> Post
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function SubmissionForm({ onSubmit, isSubmitting }) {
  const [form, setForm] = useState({ name: '', email: '', category: 'Bug', title: '', details: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title || !form.details) return toast.error('Title & details লাগবে');
    onSubmit(form);
    setForm((f) => ({ ...f, title: '', details: '' }));
  };

  return (
    <div className="bg-white/90 backdrop-blur border border-slate-100 shadow-sm rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="w-5 h-5 text-indigo-600" />
        <div>
          <h2 className="text-lg font-black text-gray-900">Submit a report</h2>
          <p className="text-xs text-gray-500">বাগ, ফিডব্যাক বা নতুন আইডিয়া—সবই স্বাগতম</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Your name (optional)"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
          />
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email (for follow-up)"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            name="status"
            value={form.status}
            onChange={() => {}}
            disabled
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-gray-400"
          >
            <option>Will set to Open</option>
          </select>
        </div>

        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Short title"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
          required
        />

        <textarea
          name="details"
          value={form.details}
          onChange={handleChange}
          placeholder="Describe the issue or idea"
          rows={4}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
          required
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-black px-4 py-3 hover:bg-indigo-700 active:scale-95 transition disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {isSubmitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}

function Badge({ children, tone = 'blue' }) {
  const tones = {
    red: 'bg-red-50 text-red-700 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return <span className={`px-2.5 py-1 text-[11px] font-black rounded-full border ${tones[tone]}`}>{children}</span>;
}

function StatusPill({ status }) {
  const tone = status === 'Resolved' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : status === 'In Review' ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-slate-700 bg-slate-50 border-slate-200';
  const Icon = status === 'Resolved' ? CheckCircle2 : status === 'In Review' ? Sparkles : Bug;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black rounded-full border ${tone}`}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}
