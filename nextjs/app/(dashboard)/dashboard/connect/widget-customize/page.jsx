"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { 
  FaPalette, FaCommentDots, FaLayerGroup, FaCode, 
  FaArrowLeft, FaEye, FaCheckCircle, FaUpload,
  FaDesktop, FaMobileAlt, FaSpinner, FaLink, FaExpand
} from "react-icons/fa";
import { HiOutlineSparkles } from "react-icons/hi2";
import Link from "next/link";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

const DEFAULT_ICON = "/newsmartagent_ai_logo.jpeg";
const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
const SIZE_PRESETS = [
  { label: 'Small', value: 48 },
  { label: 'Medium', value: 60 },
  { label: 'Large', value: 76 },
];

export default function WidgetCustomizePage() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const [iconTab, setIconTab] = useState('device'); // 'device' or 'url'
  const [iconUrlInput, setIconUrlInput] = useState('');
  const [previewMode, setPreviewMode] = useState('desktop');
  const iconInputRef = useRef(null);

  const [settings, setSettings] = useState({
    primary_color: "#4f46e5",
    bubble_icon: "image",
    bubble_icon_url: "",
    bubble_size: 60,
    widget_position: "bottom-right",
    header_title: "Chat with AI",
    header_subtitle: "Online | Powered by Smart Agent",
    placeholder_text: "Type a message...",
    bubble_roundness: 28,
    show_bubble_background: true,
    is_enabled: true,
    allowed_domains: ""
  });

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  useEffect(() => { fetchAgents(); }, []);

  const fetchAgents = async () => {
    try {
      const res = await api.get("/AgentAI/agents/");
      const widgetAgents = res.data.filter(a => a.platform === 'web_widget');
      setAgents(widgetAgents);
      if (widgetAgents.length > 0) {
        applyAgent(widgetAgents[0]);
      } else {
        await autoCreateAgent();
      }
    } catch (err) {
      toast.error("Failed to load agents.");
    } finally {
      setLoading(false);
    }
  };

  const applyAgent = (agent) => {
    setSelectedAgent(agent);
    if (agent.widget_settings) {
      setSettings(prev => ({ ...prev, ...agent.widget_settings }));
    }
  };

  const autoCreateAgent = async () => {
    try {
      const res = await api.post("/AgentAI/agents/", {
        name: "My Website Widget",
        platform: "web_widget",
        ai_model: "gpt-4o-mini",
        system_prompt: "You are a helpful assistant for my website. Be friendly, concise, and helpful.",
        greeting_message: "👋 Hi there! How can I help you today?",
        is_active: true
      });
      setAgents([res.data]);
      applyAgent(res.data);
      toast.success("Your widget agent has been created!");
    } catch (err) {
      console.error("Failed to auto-create agent", err);
    }
  };

  const handleCreateAgent = async () => {
    try {
      const res = await api.post("/AgentAI/agents/", {
        name: `Widget Agent ${agents.length + 1}`,
        platform: "web_widget",
        ai_model: "gpt-4o-mini",
        system_prompt: "You are a helpful assistant for my website.",
        greeting_message: "👋 Hi! How can I help you today?",
        is_active: true
      });
      setAgents(prev => [res.data, ...prev]);
      applyAgent(res.data);
      toast.success("New widget agent created!");
    } catch (err) {
      toast.error("Failed to create agent.");
    }
  };

  const handleSave = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    try {
      const res = await api.patch(`/AgentAI/agents/${selectedAgent.id}/`, { widget_settings: settings });
      setSelectedAgent(res.data);
      if (res.data.widget_settings) setSettings(prev => ({ ...prev, ...res.data.widget_settings }));
      toast.success("Settings saved!");
    } catch (err) {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  // ── Icon from device ──────────────────────────────────────────────────────
  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedAgent) return;
    setIconUploading(true);
    try {
      const formData = new FormData();
      formData.append("icon", file);
      const res = await api.post(`/AgentAI/widget/upload-icon/${selectedAgent.id}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      set('bubble_icon_url', res.data.icon_url);
      set('bubble_icon', 'image');
      toast.success("Icon uploaded!");
    } catch {
      toast.error("Failed to upload icon.");
    } finally {
      setIconUploading(false);
    }
  };

  // ── Icon from URL ─────────────────────────────────────────────────────────
  const handleIconUrl = () => {
    const url = iconUrlInput.trim();
    if (!url) return toast.error("Please enter a URL.");
    set('bubble_icon_url', url);
    set('bubble_icon', 'image');
    toast.success("Icon URL applied!");
  };

  const handleResetIcon = () => {
    set('bubble_icon_url', '');
    setIconUrlInput('');
  };

  const effectiveIconUrl = settings.bubble_icon_url || DEFAULT_ICON;

  // ── Position grid ─────────────────────────────────────────────────────────
  const positionClasses = {
    'bottom-right': 'bottom-2 right-2',
    'bottom-left':  'bottom-2 left-2',
    'top-right':    'top-2 right-2',
    'top-left':     'top-2 left-2',
  };
  const previewWindowClasses = {
    'bottom-right': 'bottom-12 right-2',
    'bottom-left':  'bottom-12 left-2',
    'top-right':    'top-12 right-2',
    'top-left':     'top-12 left-2',
  };

  const embedCode = selectedAgent
    ? `<!-- New Smart Agent Widget -->\n<script src="https://newsmartagent.com/widget.js" \n  data-key="${selectedAgent.widget_key}" \n  defer></script>\n<!-- End New Smart Agent Widget -->`
    : "";

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Setting up your widget...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <Link href="/dashboard/connect" className="inline-flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-xs uppercase tracking-widest transition-colors mb-4">
              <FaArrowLeft /> Back to Connect
            </Link>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase">
              Widget <span className="text-indigo-600">Customizer</span>
            </h1>
          </div>
          <button onClick={handleSave} disabled={saving || !selectedAgent}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* ───── Controls ───── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Agent selector */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                <FaLayerGroup className="text-indigo-600" /> Select Agent
              </h3>
              <div className="space-y-2">
                {agents.map(a => (
                  <div key={a.id} onClick={() => applyAgent(a)}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${selectedAgent?.id === a.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}>
                    <p className={`font-black text-sm ${selectedAgent?.id === a.id ? 'text-indigo-900' : 'text-slate-600'}`}>{a.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {a.id}</p>
                  </div>
                ))}
                <button onClick={handleCreateAgent}
                  className="w-full p-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm hover:border-indigo-600 hover:text-indigo-600 transition-all">
                  + Create Another Widget Agent
                </button>
              </div>
            </div>

            {/* Appearance */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <FaPalette className="text-indigo-600" /> Appearance
              </h3>

              {/* Color */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Color</label>
                <div className="flex gap-3 items-center">
                  <input type="color" value={settings.primary_color}
                    onChange={e => set('primary_color', e.target.value)}
                    className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent" />
                  <input type="text" value={settings.primary_color}
                    onChange={e => set('primary_color', e.target.value)}
                    className="flex-1 p-3 bg-slate-50 rounded-xl font-mono text-sm outline-none border border-slate-100 uppercase" />
                </div>
              </div>

              {/* Bubble Icon */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bubble Icon</label>

                {/* Current icon preview */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div style={{ backgroundColor: settings.primary_color, width: 52, height: 52 }}
                    className="rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                    <img src={effectiveIconUrl} alt="icon" className="w-10 h-10 object-contain"
                      onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {settings.bubble_icon_url ? "Custom Icon" : "Default Logo"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{settings.bubble_icon_url || "newsmartagent_ai_logo.jpeg"}</p>
                  </div>
                  {settings.bubble_icon_url && (
                    <button onClick={handleResetIcon} className="text-[10px] text-red-400 font-black uppercase hover:text-red-600">Reset</button>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex rounded-xl overflow-hidden border border-slate-100">
                  <button onClick={() => setIconTab('device')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 ${iconTab === 'device' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                    <FaUpload /> Device
                  </button>
                  <button onClick={() => setIconTab('url')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 ${iconTab === 'url' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                    <FaLink /> URL
                  </button>
                </div>

                {iconTab === 'device' ? (
                  <>
                    <button onClick={() => iconInputRef.current?.click()} disabled={iconUploading || !selectedAgent}
                      className="w-full flex items-center justify-center gap-2 p-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-all disabled:opacity-50">
                      {iconUploading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
                      {iconUploading ? "Uploading..." : "Upload from Device"}
                    </button>
                    <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                    <p className="text-[10px] text-slate-400">Accepts: JPEG, PNG, GIF, WEBP, SVG</p>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" value={iconUrlInput} onChange={e => setIconUrlInput(e.target.value)}
                      placeholder="https://example.com/icon.png"
                      className="flex-1 p-3 bg-slate-50 rounded-xl text-xs outline-none border border-slate-100" />
                    <button onClick={handleIconUrl}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Bubble Size */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FaExpand /> Bubble Size — <span className="text-indigo-600">{settings.bubble_size}px</span>
                </label>
                <div className="flex gap-2">
                  {SIZE_PRESETS.map(p => (
                    <button key={p.value} onClick={() => set('bubble_size', p.value)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.bubble_size === p.value ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-100'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <input type="range" min={40} max={96} step={2} value={settings.bubble_size}
                  onChange={e => set('bubble_size', Number(e.target.value))}
                  className="w-full accent-indigo-600" />
              </div>

              {/* Bubble Roundness */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <HiOutlineSparkles className="text-indigo-600" /> Roundness — <span className="text-indigo-600">{settings.bubble_roundness}%</span>
                </label>
                <input type="range" min={0} max={100} step={2} value={settings.bubble_roundness}
                  onChange={e => set('bubble_roundness', Number(e.target.value))}
                  className="w-full accent-indigo-600" />
                <div className="flex justify-between text-[8px] font-black text-slate-300 uppercase tracking-widest">
                  <span>Square</span>
                  <span>Rounded</span>
                  <span>Circle</span>
                </div>
              </div>

              {/* Bubble Background Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                   <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Show Bubble Background</p>
                   <p className="text-[9px] text-slate-400 font-medium">Use primary color for bubble</p>
                </div>
                <button 
                  onClick={() => set('show_bubble_background', !settings.show_bubble_background)}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.show_bubble_background ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.show_bubble_background ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              {/* Widget Position — 2x2 grid */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Widget Position</label>
                <div className="grid grid-cols-2 gap-2">
                  {POSITIONS.map(pos => (
                    <button key={pos} onClick={() => set('widget_position', pos)}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.widget_position === pos ? 'bg-indigo-600 text-white shadow' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-100'}`}>
                      {pos.replace(/-/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <FaCommentDots className="text-indigo-600" /> Content
              </h3>
              {[
                { label: "Header Title", key: "header_title" },
                { label: "Header Subtitle", key: "header_subtitle" },
                { label: "Placeholder Text", key: "placeholder_text" },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{f.label}</label>
                  <input type="text" value={settings[f.key]} onChange={e => set(f.key, e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-xl font-medium text-sm outline-none border border-slate-100" />
                </div>
              ))}
            </div>

          </div>

          {/* ───── Preview & Code ───── */}
          <div className="lg:col-span-8 space-y-8">

            {/* Live Preview */}
            <div className="bg-slate-900 rounded-[3rem] p-8 md:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />

              <div className="relative z-10 flex flex-col min-h-[520px]">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/10">
                      <FaEye />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-lg tracking-tight uppercase italic">Live Preview</h3>
                      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Real-time</p>
                    </div>
                  </div>
                  <div className="bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5">
                    <button onClick={() => setPreviewMode('desktop')}
                      className={`p-2.5 rounded-xl transition-all ${previewMode === 'desktop' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/40 hover:text-white'}`}>
                      <FaDesktop />
                    </button>
                    <button onClick={() => setPreviewMode('mobile')}
                      className={`p-2.5 rounded-xl transition-all ${previewMode === 'mobile' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/40 hover:text-white'}`}>
                      <FaMobileAlt />
                    </button>
                  </div>
                </div>

                {/* Mock browser */}
                <div className={`mx-auto bg-white rounded-[2rem] overflow-hidden shadow-2xl border-4 border-slate-800 transition-all duration-500 ${previewMode === 'mobile' ? 'w-[300px]' : 'w-full max-w-xl'}`}>
                  <div className="relative bg-slate-50" style={{ minHeight: 420 }}>

                    {/* Background content */}
                    <div className="flex items-center justify-center h-full pt-16 pb-32">
                      <div className="text-center opacity-30">
                        <HiOutlineSparkles className="text-indigo-300 text-[80px] mx-auto" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">Your Website</p>
                      </div>
                    </div>

                    {/* Mini chat window */}
                    <div className={`absolute ${previewWindowClasses[settings.widget_position]} w-[220px] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden opacity-90 pointer-events-none`}>
                      <div style={{ backgroundColor: settings.primary_color }} className="p-3 text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-white/20 overflow-hidden shrink-0">
                          <img src={effectiveIconUrl} alt="" className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <p className="font-black text-[10px] uppercase italic leading-tight">{settings.header_title}</p>
                          <p className="text-[8px] opacity-70 font-semibold">{settings.header_subtitle}</p>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="bg-slate-100 rounded-xl p-2 max-w-[80%]">
                          <p className="text-[10px] text-slate-600">{selectedAgent?.greeting_message || "👋 Hi there!"}</p>
                        </div>
                        <div className="border-t border-slate-50 pt-2 flex gap-1">
                          <div className="flex-1 bg-slate-50 rounded-lg h-6 px-2 flex items-center">
                            <span className="text-[9px] text-slate-300">{settings.placeholder_text}</span>
                          </div>
                          <div style={{ backgroundColor: settings.primary_color }} className="w-6 h-6 rounded-lg flex-shrink-0" />
                        </div>
                      </div>
                    </div>

                    {/* Bubble */}
                    <div
                      style={{
                        backgroundColor: settings.show_bubble_background ? settings.primary_color : 'transparent',
                        width: Math.round(settings.bubble_size * 0.65),
                        height: Math.round(settings.bubble_size * 0.65),
                        borderRadius: `${Math.round(settings.bubble_roundness * 0.5)}%`,
                        border: settings.show_bubble_background ? 'none' : `2px solid ${settings.primary_color}`,
                        boxShadow: settings.show_bubble_background ? '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' : 'none',
                      }}
                      className={`absolute ${positionClasses[settings.widget_position]} flex items-center justify-center overflow-hidden pointer-events-none`}
                    >
                      <img src={effectiveIconUrl} alt=""
                        className="object-contain"
                        style={{ 
                          width: settings.show_bubble_background ? Math.round(settings.bubble_size * 0.45) : Math.round(settings.bubble_size * 0.65), 
                          height: settings.show_bubble_background ? Math.round(settings.bubble_size * 0.45) : Math.round(settings.bubble_size * 0.65) 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Embed Code */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                  <span className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100 text-sm">
                    <FaCode />
                  </span>
                  Integration Manifest
                </h3>
                <button onClick={() => { navigator.clipboard.writeText(embedCode); toast.success("Copied!"); }}
                  className="px-4 py-2 bg-slate-50 text-indigo-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100">
                  Copy Snippet
                </button>
              </div>
              <div className="bg-slate-900/5 p-6 rounded-2xl border border-slate-100">
                <pre className="text-sm font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {embedCode || "Select an agent first to generate your embed code."}
                </pre>
                {selectedAgent && (
                  <div className="mt-6 flex items-start gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <FaCheckCircle className="text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                      Paste this snippet anywhere in your HTML, just before the closing <code>&lt;/body&gt;</code> tag.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
