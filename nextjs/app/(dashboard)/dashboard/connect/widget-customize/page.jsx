"use client";

import { useState, useEffect } from "react";
import { 
  FaPalette, FaCommentDots, FaLayerGroup, FaCode, 
  FaArrowLeft, FaEye, FaCheckCircle, FaExclamationCircle,
  FaDesktop, FaMobileAlt
} from "react-icons/fa";
import { HiOutlineSparkles } from "react-icons/hi2";
import Link from "next/link";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

export default function WidgetCustomizePage() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState('desktop');

  const [settings, setSettings] = useState({
    primary_color: "#4f46e5",
    bubble_icon: "chat",
    widget_position: "bottom-right",
    header_title: "Chat with AI",
    header_subtitle: "Online | Powered by Smart Agent",
    placeholder_text: "Type a message...",
    is_enabled: true,
    allowed_domains: ""
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await api.get("/AgentAI/agents/");
      const widgetAgents = res.data.filter(a => a.platform === 'web_widget');
      setAgents(widgetAgents);
      if (widgetAgents.length > 0) {
        handleSelectAgent(widgetAgents[0]);
      }
    } catch (err) {
      toast.error("Failed to load agents.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
    if (agent.widget_settings) {
      setSettings(agent.widget_settings);
    }
  };

  const handleCreateAgent = async () => {
    try {
      const res = await api.post("/AgentAI/agents/", {
        name: "My Web Widget",
        platform: "web_widget",
        ai_model: "gpt-4o-mini",
        system_prompt: "You are a helpful assistant for my website.",
        is_active: true
      });
      setAgents([res.data, ...agents]);
      handleSelectAgent(res.data);
      toast.success("New widget agent created!");
    } catch (err) {
      toast.error("Failed to create agent.");
    }
  };

  const handleSave = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    try {
      const res = await api.patch(`/AgentAI/agents/${selectedAgent.id}/`, {
        widget_settings: settings
      });
      setSelectedAgent(res.data);
      toast.success("Settings saved!");
    } catch (err) {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const embedCode = selectedAgent ? `
<!-- New Smart Agent Widget -->
<script src="https://newsmartagent.com/static/widget.js" 
  data-key="${selectedAgent.widget_key}" 
  defer></script>
<!-- End New Smart Agent Widget -->
  `.trim() : "";

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="space-y-2">
            <Link 
              href="/dashboard/connect"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-xs uppercase tracking-widest transition-colors mb-4"
            >
              <FaArrowLeft /> Back to Connect
            </Link>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase">
              Widget <span className="text-indigo-600">Customizer</span>
            </h1>
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <button 
              onClick={handleSave}
              disabled={saving || !selectedAgent}
              className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Controls */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Agent Selection */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                <FaLayerGroup className="text-indigo-600" /> Select Agent
              </h3>
              <div className="space-y-3">
                {agents.map(a => (
                  <div 
                    key={a.id}
                    onClick={() => handleSelectAgent(a)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedAgent?.id === a.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}
                  >
                    <p className={`font-black text-sm ${selectedAgent?.id === a.id ? 'text-indigo-900' : 'text-slate-600'}`}>{a.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {a.id}</p>
                  </div>
                ))}
                <button 
                  onClick={handleCreateAgent}
                  className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm hover:border-indigo-600 hover:text-indigo-600 transition-all"
                >
                  + Create New Widget Agent
                </button>
              </div>
            </div>

            {/* Customization */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                  <FaPalette className="text-indigo-600" /> Appearance
                </h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Primary Color</label>
                    <div className="flex gap-4">
                      <input 
                        type="color" 
                        value={settings.primary_color} 
                        onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                        className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-none"
                      />
                      <input 
                        type="text" 
                        value={settings.primary_color} 
                        onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                        className="flex-1 p-3 bg-slate-50 rounded-xl font-mono text-sm outline-none border border-slate-100 uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Widget Position</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['bottom-left', 'bottom-right'].map(pos => (
                        <button 
                          key={pos}
                          onClick={() => setSettings({...settings, widget_position: pos})}
                          className={`p-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${settings.widget_position === pos ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                          {pos.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                  <FaCommentDots className="text-indigo-600" /> Content
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Header Title</label>
                    <input 
                      type="text" 
                      value={settings.header_title} 
                      onChange={(e) => setSettings({...settings, header_title: e.target.value})}
                      className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none border border-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Header Subtitle</label>
                    <input 
                      type="text" 
                      value={settings.header_subtitle} 
                      onChange={(e) => setSettings({...settings, header_subtitle: e.target.value})}
                      className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none border border-slate-100 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Preview & Code */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Live Preview */}
            <div className="bg-slate-900 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-50"></div>
              
              <div className="relative z-10 flex flex-col h-full min-h-[500px]">
                <div className="flex justify-between items-center mb-12">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md border border-white/10">
                      <FaEye />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-xl tracking-tight uppercase italic">Live Matrix Preview</h3>
                      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Real-time Visualization</p>
                    </div>
                  </div>
                  <div className="bg-white/5 p-1.5 rounded-2xl flex gap-2 border border-white/5">
                    <button 
                      onClick={() => setPreviewMode('desktop')}
                      className={`p-3 rounded-xl transition-all ${previewMode === 'desktop' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/40 hover:text-white'}`}
                    >
                      <FaDesktop />
                    </button>
                    <button 
                      onClick={() => setPreviewMode('mobile')}
                      className={`p-3 rounded-xl transition-all ${previewMode === 'mobile' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/40 hover:text-white'}`}
                    >
                      <FaMobileAlt />
                    </button>
                  </div>
                </div>

                {/* Mock Phone/Desktop View */}
                <div className={`mx-auto flex-1 bg-white rounded-[2rem] overflow-hidden transition-all duration-700 relative shadow-2xl border-4 border-slate-800 ${previewMode === 'mobile' ? 'w-[320px]' : 'w-full max-w-2xl'}`}>
                  <div className="w-full h-full bg-slate-50 flex items-end p-8 relative">
                    <div className="text-center w-full pb-20">
                      <HiOutlineSparkles className="text-indigo-100 text-[120px] mx-auto opacity-20" />
                      <p className="text-slate-300 font-bold uppercase tracking-widest text-xs mt-4">Your Website Content Preview</p>
                    </div>

                    {/* The Actual Mock Widget */}
                    <div className={`absolute ${settings.widget_position === 'bottom-right' ? 'bottom-8 right-8' : 'bottom-8 left-8'} flex flex-col items-end gap-4`}>
                      
                      {/* Window */}
                      <div className="w-[300px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500 scale-95 opacity-80 pointer-events-none">
                        <div style={{ backgroundColor: settings.primary_color }} className="p-5 text-white">
                          <p className="font-black text-sm uppercase tracking-tight italic">{settings.header_title}</p>
                          <p className="text-[9px] font-bold opacity-70 uppercase tracking-widest">{settings.header_subtitle}</p>
                        </div>
                        <div className="h-48 p-4 flex flex-col gap-3">
                          <div className="max-w-[80%] bg-slate-100 p-3 rounded-2xl rounded-bl-none">
                            <p className="text-xs text-slate-600 font-medium">{selectedAgent?.greeting_message || "Hello! How can I help you?"}</p>
                          </div>
                          <div className="mt-auto pt-4 border-t border-slate-50 flex items-center gap-2">
                            <div className="flex-1 h-8 bg-slate-50 rounded-xl px-3 flex items-center">
                              <span className="text-[10px] text-slate-300 font-bold italic">{settings.placeholder_text}</span>
                            </div>
                            <div style={{ backgroundColor: settings.primary_color }} className="w-8 h-8 rounded-xl opacity-80"></div>
                          </div>
                        </div>
                      </div>

                      {/* Bubble */}
                      <div 
                        style={{ backgroundColor: settings.primary_color }}
                        className="w-16 h-16 rounded-[1.5rem] shadow-xl flex items-center justify-center text-white scale-110"
                      >
                        <FaCommentDots size={24} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Embed Code */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
                    <FaCode />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic">Integration Manifest</h3>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(embedCode);
                    toast.success("Code copied!");
                  }}
                  className="px-4 py-2 bg-slate-50 text-indigo-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
                >
                  Copy Snippet
                </button>
              </div>
              
              <div className="bg-slate-900/5 p-8 rounded-[2rem] border border-slate-100 relative group/code">
                <pre className="text-sm font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {embedCode || "Select an agent first to generate your unique embed code."}
                </pre>
                {selectedAgent && (
                  <div className="mt-8 flex items-start gap-4 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <FaCheckCircle className="text-indigo-600 shrink-0 mt-1" />
                    <div>
                      <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-1">Deployment Instructions</p>
                      <p className="text-xs text-indigo-700 font-medium leading-relaxed opacity-80">
                        Copy this script and paste it anywhere in your HTML, preferably just before the closing <code>&lt;/body&gt;</code> tag.
                      </p>
                    </div>
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
