"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { MessageCircle, Save, RefreshCw, ShieldAlert, Send, EyeOff, Coins, AlertCircle } from "lucide-react";

const MODES = [
  { value: "off", title: "বন্ধ", desc: "কমেন্টে কিছুই করবে না" },
  { value: "fixed", title: "Fixed মেসেজ", desc: "আপনার লেখা টেমপ্লেট, টোকেন খরচ নেই" },
  { value: "ai", title: "AI স্মার্ট", desc: "কমেন্ট বুঝে উত্তর দেবে" },
  { value: "hybrid", title: "Hybrid (সুপারিশ)", desc: "AI intent বুঝে রিপ্লাই, ইনবক্স, স্প্যাম hide ও রিভিউ" },
];

const STATUS_STYLE = {
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  review: "bg-amber-50 text-amber-700 border-amber-200",
  skipped: "bg-slate-50 text-slate-600 border-slate-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

const DEFAULTS = {
  mode: "hybrid",
  public_reply_enabled: true,
  private_dm_enabled: true,
  hide_spam_enabled: true,
  reply_to_nested: false,
  fixed_templates: ["ধন্যবাদ! আপনার ইনবক্স চেক করুন, বিস্তারিত পাঠানো হয়েছে। 😊"],
  fixed_dm_template: "",
  reply_delay_min: 10,
  reply_delay_max: 40,
  hourly_reply_limit: 60,
  daily_ai_comment_limit: 300,
  low_balance_threshold: 2000,
  confidence_threshold: 0.6,
  hide_confidence_threshold: 0.85,
  only_post_ids: [],
  is_active: true,
};

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 accent-blue-600"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function NumberField({ label, value, onChange, hint, step = 1 }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function CommentsPage() {
  const [agents, setAgents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState("");
  const [notes, setNotes] = useState([]);
  const [noteForm, setNoteForm] = useState({ post_id: "", note: "" });

  const selected = agents.find((a) => a.agent_id === selectedId) || null;

  const loadAgents = useCallback(async () => {
    try {
      const res = await api.get("/settings/comment-automation/");
      setAgents(res.data || []);
      setSelectedId((prev) => prev ?? (res.data?.[0]?.agent_id ?? null));
    } catch {
      toast.error("এজেন্ট লিস্ট লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    if (!selectedId) return;
    try {
      const params = { agent_id: selectedId, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/settings/comment-automation/logs/", { params });
      setLogs(res.data.logs || []);
      setStats(res.data.stats || {});
    } catch {
      /* silent */
    }
  }, [selectedId, statusFilter]);

  const loadNotes = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await api.get("/settings/comment-automation/post-notes/", { params: { agent_id: selectedId } });
      setNotes(res.data || []);
    } catch {
      setNotes([]);
    }
  }, [selectedId]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  useEffect(() => {
    if (!selected) return;
    setForm({ ...DEFAULTS, ...(selected.settings || {}) });
    loadLogs();
    loadNotes();
  }, [selectedId, selected?.settings, loadLogs, loadNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadLogs(); }, [statusFilter, loadLogs]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        only_post_ids: Array.isArray(form.only_post_ids)
          ? form.only_post_ids
          : String(form.only_post_ids || "").split(/[\s,]+/).filter(Boolean),
      };
      await api.put(`/settings/comment-automation/${selectedId}/`, payload);
      toast.success("কমেন্ট অটোমেশন সেটিংস সেভ হয়েছে!");
      await loadAgents();
    } catch (err) {
      toast.error(err.response?.data?.error || "সেভ করা যায়নি।");
    } finally {
      setSaving(false);
    }
  };

  const removeSettings = async () => {
    if (!selectedId) return;
    if (!window.confirm("সেটিংস মুছে দিলে আগের (ডিফল্ট) আচরণে ফিরে যাবে। নিশ্চিত?")) return;
    try {
      await api.delete(`/settings/comment-automation/${selectedId}/`);
      toast.success("সেটিংস মুছে ফেলা হয়েছে।");
      await loadAgents();
    } catch {
      toast.error("মুছতে ব্যর্থ।");
    }
  };

  const saveNote = async () => {
    if (!noteForm.post_id.trim() || !noteForm.note.trim()) {
      return toast.error("পোস্ট আইডি ও নোট দিন।");
    }
    try {
      await api.post("/settings/comment-automation/post-notes/", { agent_id: selectedId, ...noteForm });
      toast.success("পোস্ট নোট সেভ হয়েছে।");
      setNoteForm({ post_id: "", note: "" });
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.error || "সেভ হয়নি।");
    }
  };

  const deleteNote = async (post_id) => {
    try {
      await api.delete("/settings/comment-automation/post-notes/", { params: { agent_id: selectedId, post_id } });
      loadNotes();
    } catch {
      toast.error("মুছতে ব্যর্থ।");
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500 font-semibold">লোড হচ্ছে...</div>;
  }

  if (!agents.length) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="text-2xl font-black text-slate-900 mb-2">কমেন্ট অটোমেশন</h1>
        <p className="text-slate-600">
          কোনো Facebook Page বা Instagram অ্যাকাউন্ট কানেক্ট করা নেই। আগে <b>Connect</b> পেজ থেকে কানেক্ট করুন।
        </p>
      </div>
    );
  }

  const isAI = form.mode === "ai" || form.mode === "hybrid";

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-blue-50 text-blue-600"><MessageCircle className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">কমেন্ট অটোমেশন</h1>
          <p className="text-sm text-slate-500">Facebook ও Instagram পাবলিক কমেন্টে কীভাবে উত্তর যাবে তা ঠিক করুন</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {agents.map((a) => (
          <button
            key={a.agent_id}
            onClick={() => setSelectedId(a.agent_id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${
              a.agent_id === selectedId ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
            }`}
          >
            {a.platform === "instagram" ? "Instagram" : "Facebook"} • {a.name}
            {!a.configured && <span className="ml-2 text-[10px] opacity-70">(ডিফল্ট)</span>}
          </button>
        ))}
      </div>

      {selected && !selected.configured && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          এই অ্যাকাউন্টে এখনো কমেন্ট অটোমেশন সেট করা নেই (আগের ডিফল্ট আচরণ চলছে)। নিচে মোড বেছে সেভ করলে নতুন সিস্টেম চালু হবে।
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          ["আজকের কমেন্ট", stats.total, MessageCircle],
          ["পাবলিক রিপ্লাই", stats.replied, Send],
          ["ইনবক্স মেসেজ", stats.dm, Send],
          ["Hide করা", stats.hidden, EyeOff],
          ["টোকেন খরচ", stats.tokens, Coins],
        ].map(([label, val, Icon]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <Icon className="w-4 h-4 text-slate-400 mb-1" />
            <div className="text-xl font-black text-slate-900">{val ?? 0}</div>
            <div className="text-[11px] font-semibold text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Mode */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <h2 className="font-black text-slate-900">মোড</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => set("mode", m.value)}
              className={`text-left rounded-2xl border p-4 transition ${
                form.mode === m.value ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="font-extrabold text-slate-900 text-sm">{m.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>

        {form.mode !== "off" && (
          <div className="divide-y divide-slate-100">
            <Toggle label="পাবলিক রিপ্লাই" hint="কমেন্টের নিচে সবার সামনে উত্তর" checked={form.public_reply_enabled} onChange={(v) => set("public_reply_enabled", v)} />
            <Toggle label="ইনবক্সে মেসেজ (Private DM)" hint={isAI ? "AI দরকার মনে করলে (দাম/প্রোডাক্ট/অর্ডার/ডেলিভারি/অভিযোগ)" : "নিচের Fixed ইনবক্স মেসেজ থাকলে পাঠাবে"} checked={form.private_dm_enabled} onChange={(v) => set("private_dm_enabled", v)} />
            {form.mode === "hybrid" && (
              <Toggle label="স্প্যাম / গালি স্বয়ংক্রিয় Hide" hint="AI নিশ্চিত হলে hide করবে, না হলে আপনার রিভিউতে রাখবে" checked={form.hide_spam_enabled} onChange={(v) => set("hide_spam_enabled", v)} />
            )}
            <Toggle label="রিপ্লাইয়ের উপর রিপ্লাইয়েও উত্তর" hint="বন্ধ রাখলে শুধু মূল কমেন্টে উত্তর যাবে" checked={form.reply_to_nested} onChange={(v) => set("reply_to_nested", v)} />
          </div>
        )}
      </section>

      {/* Fixed templates */}
      {form.mode !== "off" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
          <h2 className="font-black text-slate-900">Fixed টেমপ্লেট {isAI && <span className="text-xs font-semibold text-slate-400">(টোকেন শেষ/কম হলে এটিই ব্যবহার হবে)</span>}</h2>
          <p className="text-xs text-slate-500">প্রতি লাইনে একটি ভ্যারিয়েশন। প্রতিবার এলোমেলোভাবে একটি যাবে।</p>
          <textarea
            rows={4}
            value={(form.fixed_templates || []).join("\n")}
            onChange={(e) => set("fixed_templates", e.target.value.split("\n"))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <label className="block text-xs font-bold text-slate-600">Fixed ইনবক্স মেসেজ (ঐচ্ছিক)</label>
          <textarea
            rows={2}
            value={form.fixed_dm_template || ""}
            onChange={(e) => set("fixed_dm_template", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </section>
      )}

      {/* Limits */}
      {form.mode !== "off" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="font-black text-slate-900 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> সুরক্ষা ও টোকেন সীমা</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <NumberField label="রিপ্লাই দেরি (সর্বনিম্ন সেকেন্ড)" value={form.reply_delay_min} onChange={(v) => set("reply_delay_min", v)} />
            <NumberField label="রিপ্লাই দেরি (সর্বোচ্চ সেকেন্ড)" value={form.reply_delay_max} onChange={(v) => set("reply_delay_max", v)} hint="মানুষের মতো দেখাতে" />
            <NumberField label="ঘণ্টায় সর্বোচ্চ কমেন্ট প্রসেস" value={form.hourly_reply_limit} onChange={(v) => set("hourly_reply_limit", v)} />
            {isAI && (
              <>
                <NumberField label="দিনে সর্বোচ্চ AI কমেন্ট" value={form.daily_ai_comment_limit} onChange={(v) => set("daily_ai_comment_limit", v)} hint="প্রতি কমেন্টে ~৪০০-৫০০ টোকেন" />
                <NumberField label="কম ব্যালেন্স সীমা (টোকেন)" value={form.low_balance_threshold} onChange={(v) => set("low_balance_threshold", v)} hint="এর নিচে নামলে Fixed মোডে নামবে" />
                <NumberField label="নিশ্চয়তা সীমা (০-১)" step="0.05" value={form.confidence_threshold} onChange={(v) => set("confidence_threshold", v)} hint="এর কম হলে রিভিউতে যাবে" />
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">শুধু নির্দিষ্ট পোস্ট (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="পোস্ট আইডি, কমা দিয়ে আলাদা — খালি থাকলে সব পোস্ট"
              value={Array.isArray(form.only_post_ids) ? form.only_post_ids.join(", ") : form.only_post_ids}
              onChange={(e) => set("only_post_ids", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </button>
        {selected?.configured && (
          <button onClick={removeSettings} className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm">
            ডিফল্টে ফিরুন
          </button>
        )}
      </div>

      {/* Post notes */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
        <h2 className="font-black text-slate-900">পোস্ট/ভিডিও নোট <span className="text-xs font-semibold text-slate-400">(ঐচ্ছিক, খরচ নেই)</span></h2>
        <p className="text-xs text-slate-500">শুধু ভিডিও বা ছবির পোস্টে লেখা না থাকলে এখানে ১ লাইনে বলে দিন পোস্টটি কিসের। AI সেটাই ব্যবহার করবে।</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            placeholder="পোস্ট আইডি"
            value={noteForm.post_id}
            onChange={(e) => setNoteForm((p) => ({ ...p, post_id: e.target.value }))}
            className="sm:w-56 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="যেমন: এই ভিডিওতে Anker 20W চার্জার, দাম ১৪৯০ টাকা"
            value={noteForm.note}
            onChange={(e) => setNoteForm((p) => ({ ...p, note: e.target.value }))}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button onClick={saveNote} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">যোগ করুন</button>
        </div>
        {notes.map((n) => (
          <div key={n.post_id} className="flex items-center justify-between gap-3 text-sm bg-slate-50 rounded-xl px-3 py-2">
            <span className="truncate"><b>{n.post_id}</b> — {n.note}</span>
            <button onClick={() => deleteNote(n.post_id)} className="text-rose-600 text-xs font-bold">মুছুন</button>
          </div>
        ))}
      </section>

      {/* Logs */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-black text-slate-900">সাম্প্রতিক কমেন্ট</h2>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold"
            >
              <option value="">সব</option>
              <option value="done">সম্পন্ন</option>
              <option value="review">রিভিউ দরকার</option>
              <option value="skipped">স্কিপ</option>
              <option value="failed">ব্যর্থ</option>
            </select>
            <button onClick={loadLogs} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>

        {logs.length === 0 && <p className="text-sm text-slate-400">এখনো কোনো কমেন্ট প্রসেস হয়নি।</p>}
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-2xl border border-slate-100 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-slate-800">{l.commenter_name || "অজানা"}</span>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  {l.intent && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{l.intent}</span>}
                  <span className={`px-2 py-0.5 rounded-full border ${STATUS_STYLE[l.status] || ""}`}>
                    {l.status}{l.skip_reason ? ` • ${l.skip_reason}` : ""}
                  </span>
                  <span className="text-slate-400">{new Date(l.created_at).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-slate-700">“{l.comment_text}”</p>
              {l.public_reply_text && (
                <p className="text-xs text-emerald-700">↳ পাবলিক: {l.public_reply_text} {l.public_reply_sent ? "✓" : "✗"}</p>
              )}
              {l.dm_text && (
                <p className="text-xs text-indigo-700">↳ ইনবক্স: {l.dm_text} {l.dm_sent ? "✓" : "✗"}</p>
              )}
              {l.hidden && <p className="text-xs text-amber-700">↳ Hide করা হয়েছে</p>}
              {l.error && <p className="text-[11px] text-rose-600 break-words">{l.error}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

