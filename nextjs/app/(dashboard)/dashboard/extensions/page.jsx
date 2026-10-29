"use client";

import { useEffect, useMemo, useState } from "react";
import { AdjustmentsHorizontalIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon, CodeBracketIcon, CommandLineIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, PowerIcon, PuzzlePieceIcon, ShieldCheckIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import api from "@/lib/api";

const tabs = [
  ["overview", "Overview", Squares2X2Icon],
  ["configuration", "Configuration", AdjustmentsHorizontalIcon],
  ["versions", "Versions", ClockIcon],
  ["logs", "Execution logs", CommandLineIcon],
];

function StatusPill({ active }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><i className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />{active ? "Active" : "Disabled"}</span>;
}

function Metric({ label, value, icon: Icon, tone = "slate" }) {
  const colors = { slate: "bg-slate-50 text-slate-600", green: "bg-emerald-50 text-emerald-700", blue: "bg-blue-50 text-blue-700" };
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${colors[tone]}`}><Icon className="h-4 w-4" /></div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{value}</p></div>;
}

export default function ExtensionsPage() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [scope, setScope] = useState("agent");
  const [assignments, setAssignments] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedVersions, setSelectedVersions] = useState({});
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileDetails, setMobileDetails] = useState(false);

  const load = async () => {
    try {
      const [extensionResponse, agentResponse, assignmentResponse] = await Promise.all([
        api.get("/ai-extensions/extensions/"), api.get("/AgentAI/agents/"), api.get("/ai-extensions/assignments/"),
      ]);
      const loaded = extensionResponse.data?.results || extensionResponse.data || [];
      const loadedAgents = agentResponse.data?.results || agentResponse.data || [];
      setExtensions(loaded); setAgents(loadedAgents);
      setAssignments(assignmentResponse.data?.results || assignmentResponse.data || []);
      if (!selectedAgent && loadedAgents.length) setSelectedAgent(String(loadedAgents[0].id));
      if (!selectedId && loaded.length) setSelectedId(loaded[0].id);
      api.get("/ai-extensions/executions/").then((response) => setLogs(response.data?.results || response.data || [])).catch(() => {});
    } catch { toast.error("Extensions load করা যায়নি"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const assignmentFor = (extension) => assignments.find((item) => item.extension === extension.id && (scope === "user" ? item.scope === "user" : String(item.agent) === String(selectedAgent)));
  // Runtime requires both the scope assignment and the extension-level
  // global switch. This keeps the dashboard honest when an admin uses the
  // global kill switch.
  const isActive = (extension) => Boolean(extension?.is_enabled && assignmentFor(extension)?.is_enabled);
  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return value ? extensions.filter((item) => `${item.name} ${item.key} ${item.description}`.toLowerCase().includes(value)) : extensions; }, [extensions, query]);
  const selected = extensions.find((item) => item.id === selectedId) || filtered[0] || null;
  const assignment = selected ? assignmentFor(selected) : null;
  const version = selected?.versions?.find((item) => String(item.id) === String(selectedVersions[selected.id])) || selected?.versions?.find((item) => item.status === "stable") || selected?.versions?.[0];
  const selectedLogs = logs.filter((item) => item.extension === selected?.id).slice(0, 8);

  const toggle = async (extension) => {
    try {
      const active = isActive(extension);
      const targetEnabled = !active;
      if (scope === "agent" && !selectedAgent) return toast.error("আগে একটি agent নির্বাচন করুন");
      const existing = assignmentFor(extension);
      if (targetEnabled && !extension.is_enabled) {
        await api.post(`/ai-extensions/extensions/${extension.id}/enable/`);
        setExtensions((items) => items.map((item) => item.id === extension.id ? { ...item, is_enabled: true } : item));
      }
      if (existing) {
        const chosen = extension.versions?.find((item) => String(item.id) === String(selectedVersions[extension.id])) || extension.versions?.find((item) => item.status === "stable") || extension.versions?.[0];
        const update = { is_enabled: targetEnabled };
        if (chosen && targetEnabled) { update.version = chosen.id; update.config = chosen.default_config || {}; }
        await api.patch(`/ai-extensions/assignments/${existing.id}/`, update);
        setAssignments((items) => items.map((item) => item.id === existing.id ? { ...item, ...update } : item));
      } else {
        const chosen = extension.versions?.find((item) => String(item.id) === String(selectedVersions[extension.id])) || extension.versions?.find((item) => item.status === "stable") || extension.versions?.[0];
        if (!chosen) return toast.error("এই extension-এর কোনো version নেই");
        const payload = { extension: extension.id, version: chosen.id, scope, config: chosen.default_config || {}, is_enabled: true }; if (scope === "agent") payload.agent = Number(selectedAgent);
        const response = await api.post("/ai-extensions/assignments/", payload); setAssignments((items) => [...items, response.data]);
      }
      toast.success(active ? "Extension disabled" : "Extension enabled");
    } catch (error) { toast.error(error.response?.data?.detail || "Extension status update করা যায়নি"); }
  };

  const activeCount = extensions.filter(isActive).length;
  const providerCount = extensions.filter((item) => item.key?.endsWith("-provider")).length;

  return <main className="min-h-screen bg-[#f6f8fb] text-slate-900"><div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3 sm:px-5 lg:px-7">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><PuzzlePieceIcon className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><h1 className="text-lg font-black tracking-tight">Extensions</h1><span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">Workspace</span></div><p className="text-xs text-slate-500">Provider overrides, prompts and runtime controls</p></div></div><div className="flex w-full items-center gap-2 sm:w-auto"><select value={scope} onChange={(event) => setScope(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 sm:flex-none"><option value="agent">Selected agent</option><option value="user">All my agents</option></select><select value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)} disabled={scope === "user"} className="hidden h-9 min-w-0 max-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 disabled:bg-slate-100 sm:block sm:flex-none"><option value="">Select agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name || `Agent #${agent.id}`}</option>)}</select></div></header>

    <div className="grid min-h-0 flex-1 gap-3 py-3 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
      <aside className={`${mobileDetails ? "hidden lg:flex" : "flex"} min-h-[calc(100vh-150px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm`}><div className="border-b border-slate-100 p-3"><div className="relative"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search extensions" className="h-9 w-full rounded-lg bg-slate-100 pl-9 pr-3 text-xs outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-100" /></div><div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400"><span>{filtered.length} extensions</span><span>{activeCount} active</span></div></div><div className="custom-scrollbar flex-1 overflow-y-auto p-2">{loading ? <div className="p-5 text-center text-xs text-slate-400">Loading...</div> : filtered.map((extension) => <button key={extension.id} onClick={() => { setSelectedId(extension.id); setActiveTab("overview"); setMobileDetails(true); }} className={`group flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selected?.id === extension.id ? "bg-indigo-50 text-indigo-900" : "text-slate-700 hover:bg-slate-50"}`}><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected?.id === extension.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}><PuzzlePieceIcon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{extension.name}</p><p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">{extension.key}</p></div><i className={`h-2 w-2 shrink-0 rounded-full ${isActive(extension) ? "bg-emerald-500" : "bg-slate-300"}`} /></button>)}{!loading && !filtered.length && <div className="p-5 text-center text-xs text-slate-400">No extensions found</div>}</div><div className="border-t border-slate-100 p-3"><div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-[10px] leading-4 text-slate-500"><ShieldCheckIcon className="h-4 w-4 shrink-0 text-emerald-500" />Only approved server-side entry points can run.</div></div></aside>

      <section className={`${mobileDetails ? "" : "hidden lg:block"} min-h-[calc(100vh-150px)] min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm`}>{!selected ? <div className="flex min-h-[500px] items-center justify-center text-sm text-slate-400">Select an extension from the sidebar</div> : <><div className="border-b border-slate-100 p-5 sm:p-7"><button onClick={() => setMobileDetails(false)} className="mb-4 flex items-center gap-1 text-xs font-bold text-slate-400 lg:hidden"><ChevronRightIcon className="h-4 w-4 rotate-180" /> All extensions</button><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><PuzzlePieceIcon className="h-7 w-7" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-black tracking-tight sm:text-2xl">{selected.name}</h2><StatusPill active={isActive(selected)} /></div><p className="mt-1 break-all font-mono text-[11px] text-slate-400">{selected.key}</p></div></div><button onClick={() => toggle(selected)} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${isActive(selected) ? "bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}><PowerIcon className="h-4 w-4" />{isActive(selected) ? "Disable" : "Enable"}</button></div><p className="mt-5 max-w-3xl text-sm leading-6 text-slate-500">{selected.description || "No description available."}</p><nav className="-mb-5 mt-6 flex gap-4 overflow-x-auto pb-px sm:gap-5">{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setActiveTab(id)} className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-3 text-xs font-bold transition ${activeTab === id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-700"}`}><Icon className="h-4 w-4" />{label}</button>)}</nav></div>
        <div className="custom-scrollbar max-h-[calc(100vh-250px)] overflow-y-auto p-4 sm:max-h-[calc(100vh-285px)] sm:p-7">{activeTab === "overview" && <div className="space-y-6"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Status" value={isActive(selected) ? "Active" : "Off"} icon={PowerIcon} tone={isActive(selected) ? "green" : "slate"} /><Metric label="Versions" value={selected.versions?.length || 0} icon={ClockIcon} /><Metric label="Provider" value={selected.key?.endsWith("-provider") ? "OpenAI" : "Base"} icon={CodeBracketIcon} tone="blue" /><Metric label="Scope" value={assignment?.scope || "—"} icon={ShieldCheckIcon} /></div><div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-5"><h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Runtime</h3><dl className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-400">Selected version</dt><dd className="font-bold text-slate-700">{version ? `v${version.version}` : "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-400">Target</dt><dd className="font-mono text-[10px] text-slate-700">{version?.target || "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-400">Compatibility</dt><dd className="font-bold text-slate-700">{version?.compatible_base_version || "1.x"}</dd></div></dl></div><div className="rounded-2xl border border-slate-200 p-5"><h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Safety</h3><div className="mt-4 flex gap-3"><ShieldCheckIcon className="h-5 w-5 shrink-0 text-emerald-500" /><p className="text-xs leading-5 text-slate-500">Errors automatically return to the base Gemini implementation. No arbitrary code is uploaded from this dashboard.</p></div></div></div></div>}
        {activeTab === "configuration" && <div className="space-y-5"><div><h3 className="text-sm font-black">Configuration</h3><p className="mt-1 text-xs text-slate-500">Choose which version runs for the current scope.</p></div><label className="block max-w-md"><span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Active version</span><select value={selectedVersions[selected.id] || ""} onChange={(event) => setSelectedVersions((values) => ({ ...values, [selected.id]: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"><option value="">Stable version</option>{selected.versions?.map((item) => <option key={item.id} value={item.id}>{item.version} · {item.status}</option>)}</select></label><pre className="max-w-2xl overflow-x-auto rounded-xl bg-[#1e1e1e] p-4 font-mono text-xs leading-6 text-slate-200">{JSON.stringify(assignment?.config || version?.default_config || {}, null, 2)}</pre></div>}
        {activeTab === "versions" && <div><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Version history</h3><p className="mt-1 text-xs text-slate-500">Only one version is active per scope.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{selected.versions?.length || 0} total</span></div><div className="mt-5 space-y-3">{selected.versions?.map((item) => <div key={item.id} className={`rounded-xl border p-4 ${version?.id === item.id ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200"}`}><div className="flex justify-between gap-2"><span className="font-black text-slate-800">v{item.version}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-500">{item.status}</span></div><p className="mt-2 text-xs text-slate-500">Target: <span className="font-mono">{item.target}</span> · Base: {item.compatible_base_version || "1.x"}</p>{item.release_notes && <p className="mt-2 text-xs leading-5 text-slate-600">{item.release_notes}</p>}</div>)}</div></div>}
        {activeTab === "logs" && <div><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Execution logs</h3><p className="mt-1 text-xs text-slate-500">Recent runs for this extension.</p></div><button onClick={load} className="text-xs font-bold text-indigo-600">Refresh</button></div><div className="mt-5 space-y-2">{selectedLogs.length ? selectedLogs.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="flex min-w-0 items-center gap-3">{item.success ? <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-500" /> : <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-rose-500" />}<div className="min-w-0"><p className="text-xs font-bold text-slate-700">{item.success ? "Successful execution" : "Fallback / error"}</p><p className="truncate text-[10px] text-slate-400">{item.error_message || item.request_id || "runtime execution"}</p></div></div><span className="shrink-0 text-[10px] font-bold text-slate-400">{Math.round(item.latency_ms || 0)}ms</span></div>) : <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">No execution logs yet.</div>}</div></div>}</div>
      </>}</section>

      <aside className="hidden min-h-0 flex-col gap-3 xl:flex"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><AdjustmentsHorizontalIcon className="h-4 w-4" /> Scope & status</div><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Running for</p><p className="mt-1 truncate text-sm font-black text-slate-800">{scope === "user" ? "All my agents" : agents.find((agent) => String(agent.id) === String(selectedAgent))?.name || "Selected agent"}</p></div><button onClick={() => selected && toggle(selected)} className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-xs font-bold ${selected && isActive(selected) ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}><PowerIcon className="h-4 w-4" />{selected && isActive(selected) ? "Disable extension" : "Enable extension"}</button></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Workspace summary</p><div className="mt-4 space-y-3"><div className="flex justify-between text-xs"><span className="text-slate-500">Total extensions</span><b>{extensions.length}</b></div><div className="flex justify-between text-xs"><span className="text-slate-500">Provider targets</span><b>{providerCount}</b></div><div className="flex justify-between text-xs"><span className="text-slate-500">Active in scope</span><b className="text-emerald-600">{activeCount}</b></div></div></div><div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"><div className="flex gap-2"><CodeBracketIcon className="h-4 w-4 shrink-0 text-indigo-600" /><div><p className="text-xs font-black text-indigo-900">Developer note</p><p className="mt-1 text-[11px] leading-5 text-indigo-700">Configuration changes are scoped and versioned. Base Gemini remains the safe fallback.</p></div></div></div></aside>
    </div>
  </div></main>;
}
