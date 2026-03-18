"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { 
  UsersIcon, 
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  FunnelIcon,
  CpuChipIcon,
  XMarkIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { toast } from 'react-hot-toast';

export default function ContactsPage() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // History Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  
  const observer = useRef();
  const lastMessageElementRef = useCallback(node => {
    if (historyLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreHistory) {
        setHistoryPage(prevPageNumber => prevPageNumber + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [historyLoading, hasMoreHistory]);

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      fetchContacts(selectedAgent);
    }
  }, [selectedAgent]);

  useEffect(() => {
    if (historyContact && historyPage > 1) {
      fetchHistory(historyContact.id, historyPage);
    }
  }, [historyPage]);

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

  const openHistory = (contact) => {
    setHistoryContact(contact);
    setHistoryMessages([]);
    setHistoryPage(1);
    setHasMoreHistory(true);
    setIsModalOpen(true);
    fetchHistory(contact.id, 1);
  };

  const fetchHistory = async (contactId, page) => {
    if (page === 1) setHistoryLoading(true);
    try {
      const res = await api.get(`/AgentAI/contacts/${contactId}/messages/?page=${page}`);
      const newMessages = res.data.results || [];
      setHistoryMessages(prev => page === 1 ? newMessages : [...prev, ...newMessages]);
      setHasMoreHistory(!!res.data.next);
    } catch (err) {
      console.error("Failed to load history:", err);
      toast.error("Failed to load message history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     c.identifier?.includes(searchQuery))
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
              <div key={contact.id} className="group bg-white/80 backdrop-blur-md p-6 rounded-[2.5rem] shadow-sm border border-gray-100 hover:border-indigo-200 transition-all hover:shadow-xl flex flex-col">
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

                <div className="flex-1">
                  <h3 className="text-xl font-black text-gray-900 mb-1 truncate">
                    {contact.name || contact.push_name || contact.identifier}
                  </h3>
                  {contact.push_name && contact.name && contact.name !== contact.push_name && (
                    <p className="text-xs font-bold text-indigo-400 mb-1">@{contact.push_name}</p>
                  )}
                  <p className="text-sm font-mono text-gray-400 mb-4">{contact.identifier}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col gap-4">
                  <button 
                    onClick={() => openHistory(contact)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-tighter hover:bg-indigo-100 transition-colors"
                  >
                    <ChatBubbleLeftRightIcon className="h-4 w-4" /> View Chat History
                  </button>

                  <div className="flex items-center justify-between">
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

        {/* History Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 backdrop-blur-xl bg-white/40">
            <div className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <ChatBubbleLeftRightIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 leading-tight">
                      {historyContact?.name || historyContact?.push_name || historyContact?.identifier}
                    </h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Message history</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:text-rose-500 hover:bg-rose-50 transition-all"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                {historyMessages.length === 0 && !historyLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-4">
                    <ChatBubbleLeftRightIcon className="h-12 w-12 opacity-20" />
                    <p className="font-bold text-center">No messages found in this conversation</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col space-y-6">
                      {historyMessages.map((msg, index) => (
                        <div 
                          key={msg.id || index} 
                          ref={index === historyMessages.length - 1 ? lastMessageElementRef : null}
                          className={`flex flex-col ${msg.role === 'assistant' ? 'items-start' : 'items-end'}`}
                        >
                          <div className={`max-w-[85%] px-6 py-4 rounded-[2rem] text-sm font-bold shadow-sm ${
                            msg.role === 'assistant' 
                            ? 'bg-gray-50 text-gray-700 rounded-bl-none border border-gray-100/50' 
                            : 'bg-indigo-600 text-white rounded-br-none shadow-indigo-100 shadow-xl'
                          }`}>
                            {msg.content}
                          </div>
                          <span className="mt-2 px-2 text-[9px] font-black uppercase text-gray-300 tracking-tighter">
                            {msg.sent_at 
                              ? new Date(msg.sent_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) 
                              : 'Just now'} 
                            {msg.role === 'assistant' && msg.tokens_used > 0 && ` • ${msg.tokens_used} tokens`}
                          </span>
                        </div>
                      ))}
                    </div>
                    {historyLoading && (
                      <div className="flex justify-center p-4">
                        <ArrowPathIcon className="h-6 w-6 text-indigo-400 animate-spin" />
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Modal Footer */}
              <div className="p-8 border-t border-gray-50 bg-gray-50/50 flex justify-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                  Total {historyMessages.length} messages loaded
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

