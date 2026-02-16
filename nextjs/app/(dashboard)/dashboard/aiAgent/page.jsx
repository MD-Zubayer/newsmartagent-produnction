"use client";

import { useEffect, useState } from "react";
import { 
  PencilIcon, 
  PlusIcon, 
  XMarkIcon, 
  TrashIcon, 
  CpuChipIcon, 
  GlobeAltIcon, 
  AdjustmentsHorizontalIcon, 
  CommandLineIcon,
  EyeIcon,
  EyeSlashIcon 
} from "@heroicons/react/24/outline";
import api from "@/lib/api";

export default function AIAgentPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [showToken, setShowToken] = useState(false);

  const initialFormState = {
    name: "",
    platform: "messenger",
    page_id: "",
    access_token: "",
    webhook_secret: "",
    system_prompt: "",
    greeting_message: "",
    ai_model: "gemini-2.5-flash",
    temperature: 0.7,
    max_tokens: 500,
    is_active: true,
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await api.get("/AgentAI/agents/");
      setAgents(res.data || []);
    } catch (err) {
      console.error("Failed to load AI Agents:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openModal = (agent = null) => {
    if (agent && agent.id) {
      // এডিট মোড: আইডি এবং ডাটা সেট করা
      setEditingAgent(agent);
      setFormData({ ...agent });
    } else {
      // ক্রিয়েট মোড
      setEditingAgent(null);
      setFormData(initialFormState);
    }
    setShowToken(false);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // আইডি চেক করে ডিসিশন নেওয়া (POST নাকি PUT)
    const agentId = editingAgent?.id || formData?.id;

    // ডাটা ক্লিনআপ (সিরিয়ালাইজার যেন অপ্রয়োজনীয় ফিল্ডে এরর না দেয়)
    const { id, created_at, ...cleanData } = formData;

    const payload = {
      ...cleanData,
      temperature: parseFloat(formData.temperature),
      max_tokens: parseInt(formData.max_tokens),
    };

    // এডিট করার সময় পাসওয়ার্ড/টোকেন ফিল্ড খালি থাকলে সেগুলো পেলোড থেকে বাদ দিন
    if (agentId) {
        if (!payload.access_token) delete payload.access_token;
        if (!payload.webhook_secret) delete payload.webhook_secret;
    }

    try {
      if (agentId && agentId !== "undefined") {
        // PUT রিকোয়েস্ট (আপডেট)
        console.log(`Updating agent: ${agentId}`);
        const res = await api.put(`/AgentAI/agents/${agentId}/`, payload);
        setAgents((prev) => prev.map((a) => (a.id === agentId ? res.data : a)));
        alert("Intelligence Updated Successfully!");
      } else {
        // POST রিকোয়েস্ট (নতুন)
        const res = await api.post("/AgentAI/agents/", payload);
        setAgents((prev) => [res.data, ...prev]);
        alert("Agent Deployed Successfully!");
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Backend Error Details:", err.response?.data);
      const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : "Check console for details";
      alert("Error: " + errorMsg);
    }
  };

  const handleDelete = async (targetId) => {
    if (!targetId || targetId === "undefined") {
        alert("Error: Valid Agent ID not found.");
        return;
    }

    if (!window.confirm("Are you sure you want to delete this agent?")) return;
    
    try {
      await api.delete(`/AgentAI/agents/${targetId}/`);
      setAgents((prev) => prev.filter((a) => a.id !== targetId));
    } catch (err) {
      console.error("Delete Error:", err);
      alert("Failed to delete agent.");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden pb-20 font-sans">
      
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e508_1px,transparent_1px),linear-gradient(to_bottom,#4f46e508_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-4">
              <CpuChipIcon className="h-4 w-4" /> AI Command Center
            </div>
            <h1 className="text-3xl md:text-5xl text-center md:text-left font-black text-gray-900 tracking-tighter">
              Manage Your <span className="text-indigo-600">AI Agents</span>
            </h1>
          </div>
          
          <button
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95 w-full md:w-auto"
          >
            <PlusIcon className="h-5 w-5 stroke-[3px]" />
            Add New Agent
          </button>
        </div>

        {/* Agents List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {agents.map((agent) => (
            <div key={agent.id} className="group bg-white/80 backdrop-blur-md py-7 px-4 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:border-indigo-200 transition-all hover:shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:rotate-12 transition-transform duration-500">
                  <CpuChipIcon className="h-8 w-8" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openModal(agent)} className="p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all">
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button onClick={() => handleDelete(agent.id)} className="p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <h2 className="text-2xl font-black text-gray-900 mb-2 truncate">{agent.name}</h2>
              <div className="flex flex-col md:flex-row items-center gap-2 mb-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg italic">
                  {agent.ai_model}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
                  {agent.platform}
                </span>
              </div>
              
              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${agent.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {agent.is_active ? "Live" : "Disabled"}
                    </span>
                </div>
                <span className="text-[10px] font-mono text-gray-300 uppercase">ID: {agent.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col border border-white">
            
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white/50 sticky top-0 backdrop-blur-md z-20">
              <h2 className="text-2xl font-black text-gray-900 uppercase">
                {editingAgent ? "Edit Intelligence" : "New AI Agent"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="bg-gray-50 text-gray-400 hover:text-rose-500 p-3 rounded-2xl transition-all">
                <XMarkIcon className="h-6 w-6 stroke-[3px]" />
              </button>
            </div>

            <form className="p-8 space-y-8 overflow-y-auto" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="Agent Name" />
                <select name="platform" value={formData.platform} onChange={handleChange} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none">
                  <option value="messenger">Facebook Messenger</option>
                  {/* <option value="facebook_comment">Facebook Comment</option> */}
                  <option value="WhatsApp">WhatsApp Business</option>
                </select>
              </div>

              <div className="space-y-4 bg-indigo-50/40 p-6 rounded-[2rem] border border-indigo-50">
                <input type="text" name="page_id" value={formData.page_id} onChange={handleChange} required className="w-full p-4 bg-white rounded-xl outline-none font-mono text-xs" placeholder="Page / Business ID" />
                <div className="relative">
                    <input 
                      type={showToken ? "text" : "password"} 
                      name="access_token" value={formData.access_token} onChange={handleChange} 
                      className="w-full p-4 bg-white rounded-xl outline-none font-mono text-xs pr-12" 
                      placeholder={editingAgent ? "Token (Leave blank to keep current)" : "Access Token"} 
                    />
                    <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      {showToken ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <select name="ai_model" value={formData.ai_model} onChange={handleChange} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none">
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                </select>
                <input type="number" name="max_tokens" value={formData.max_tokens} onChange={handleChange} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="Max Tokens" />
              </div>

              <textarea name="system_prompt" value={formData.system_prompt} onChange={handleChange} rows="5" className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-sm font-medium" placeholder="System Instructions..."></textarea>

              <div className="flex items-center gap-4 bg-emerald-50 p-5 rounded-2xl">
                <input type="checkbox" name="is_active" id="active" checked={formData.is_active} onChange={handleChange} className="w-6 h-6 accent-emerald-600" />
                <label htmlFor="active" className="text-sm font-black text-emerald-900">Activate Agent</label>
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all uppercase">
                {editingAgent ? "Update Intelligence" : "Deploy Agent"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}