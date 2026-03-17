"use client";

import { useEffect, useState } from "react";
import { 
  UsersIcon, 
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  FunnelIcon,
  CpuChipIcon
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { toast } from 'react-hot-toast';

export default function ContactsPage() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      fetchContacts(selectedAgent);
    }
  }, [selectedAgent]);

  const fetchAgents = async () => {
    try {
      const res = await api.get("/AgentAI/agents/");
      setAgents(res.data || []);
      if (res.data.length > 0) {
        setSelectedAgent(res.data[0].page_id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to load agents:", err);
      toast.error("Failed to load agents.");
      setLoading(false);
    }
  };

  const fetchContacts = async (agentId) => {
    setLoading(true);
    try {
      const res = await api.get(`/AgentAI/contacts/${agentId}/`);
      setContacts(res.data.contacts || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
      toast.error("Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoReply = async (contactId) => {
    try {
      const res = await api.post(`/AgentAI/contacts/toggle-reply/${contactId}/`);
      if (res.data.success) {
        setContacts(prev => prev.map(c => 
          c.id === contactId ? { ...c, is_auto_reply_enabled: res.data.is_auto_reply_enabled } : c
        ));
        toast.success(res.data.is_auto_reply_enabled ? "Auto-reply enabled" : "Auto-reply disabled");
      }
    } catch (err) {
      console.error("Failed to toggle auto-reply:", err);
      toast.error("Failed to update setting.");
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     c.identifier.includes(searchQuery))
  );

  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden pb-20 font-sans">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e508_1px,transparent_1px),linear-gradient(to_bottom,#4f46e508_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-4">
              <UsersIcon className="h-4 w-4" /> CRM & Control
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter">
              Contact <span className="text-indigo-600">Sync</span>
            </h1>
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:min-w-[250px]">
              <FunnelIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select 
                value={selectedAgent} 
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/20"
              >
                {agents.map(agent => (
                  <option key={agent.id} value={agent.page_id}>
                    {agent.name} ({agent.platform})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 md:min-w-[300px]">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>

        {/* Contacts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-40 bg-white border border-slate-200 rounded-[2rem] animate-pulse"></div>
            ))}
          </div>
        ) : filteredContacts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredContacts.map(contact => (
              <div key={contact.id} className="group bg-white/80 backdrop-blur-md p-6 rounded-[2.5rem] shadow-sm border border-gray-100 hover:border-indigo-200 transition-all hover:shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:rotate-12 ${
                    contact.platform === 'whatsapp' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <ChatBubbleLeftRightIcon className="h-6 w-6" />
                  </div>
                  
                  <button 
                    onClick={() => toggleAutoReply(contact.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${
                      contact.is_auto_reply_enabled 
                      ? 'bg-emerald-500 text-white shadow-emerald-100 shadow-lg hover:bg-emerald-600' 
                      : 'bg-rose-500 text-white shadow-rose-100 shadow-lg hover:bg-rose-600'
                    }`}
                  >
                    {contact.is_auto_reply_enabled ? (
                      <><CheckCircleIcon className="h-4 w-4" /> AI Enabled</>
                    ) : (
                      <><NoSymbolIcon className="h-4 w-4" /> AI Blocked</>
                    )}
                  </button>
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-1 truncate">
                  {contact.name || "Unknown Name"}
                </h3>
                <p className="text-sm font-mono text-gray-400 mb-4">{contact.identifier}</p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                    {contact.platform}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${contact.is_auto_reply_enabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                    <span className="text-[9px] font-black uppercase text-gray-400">
                      {contact.is_auto_reply_enabled ? 'Responding' : 'Ignored'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200">
            <UsersIcon className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-black text-gray-400">No contacts found</h3>
            <p className="text-sm text-gray-400">Contacts will appear here after they message your agent.</p>
          </div>
        )}
      </div>
    </div>
  );
}
