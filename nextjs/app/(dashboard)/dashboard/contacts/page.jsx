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
  ArrowPathIcon,
  EllipsisVerticalIcon,
  PaperAirplaneIcon
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { toast } from 'react-hot-toast';

export default function Contacts() {
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
  
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  
  const messagesEndRefDesktop = useRef(null);
  const messagesEndRefMobile = useRef(null);
  const observer = useRef();

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        messagesEndRefDesktop.current?.scrollIntoView({ behavior: "auto" });
        messagesEndRefMobile.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    });
  };

  const lastMessageElementRef = useCallback(node => {
    if (historyLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      // Load more when top-most message becomes visible (if oldest-first)
      // Actually, if we use oldest-first, we need to load "more" at the TOP.
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

  useEffect(() => {
    if (historyMessages.length > 0 && historyPage === 1) {
      scrollToBottom();
    }
  }, [historyMessages]);

  const fetchAgents = async () => {
    try {
      const res = await api.get("/AgentAI/agents/");
      const agentList = Array.isArray(res?.data) ? res.data : [];
      setAgents(agentList);
      setSelectedAgent("all");
    } catch (err) {
      console.error("Failed to load agents:", err);
      toast.error("Failed to load agents.");
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async (agentId) => {
    setLoading(true);
    try {
      const res = await api.get(`/AgentAI/contacts/${agentId}/`);
      const list = Array.isArray(res?.data?.contacts) ? res.data.contacts : [];
      setContacts(list);
    } catch (err) {
      console.error("Failed to load contacts:", err);
      toast.error("Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoReply = async (contactId, e) => {
    e.stopPropagation(); // Don't open chat
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
    
    // Optimistically clear unread count since the API marks them as read automatically
    setContacts(prev => prev.map(c => 
      c.id === contact.id ? { ...c, unread_count: 0 } : c
    ));
    
    fetchHistory(contact.id, 1);
  };

  const fetchHistory = async (contactId, page) => {
    if (page === 1) setHistoryLoading(true);
    try {
      const res = await api.get(`/AgentAI/contacts/${contactId}/messages/?page=${page}`);
      const newMessages = Array.isArray(res?.data?.results) ? res.data.results : [];
      
      setHistoryMessages(prev => {
        // Since we want oldest first for display, we merge differently
        // newMessages are typically sent_at desc from API (newest first)
        const merged = page === 1 ? newMessages : [...prev, ...newMessages];
        
        const seen = new Set();
        const unique = [];
        for (const m of merged) {
          const key = m?.id ?? `${m?.sent_at ?? ""}|${m?.role ?? ""}|${m?.content ?? ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(m);
        }

        // Return sorted oldest to newest for WA style
        return unique.sort(
          (a, b) => new Date(a?.sent_at || 0) - new Date(b?.sent_at || 0)
        );
      });
      setHasMoreHistory(!!res.data.next);
    } catch (err) {
      console.error("Failed to load history:", err);
      toast.error("Failed to load message history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !historyContact) return;
    
    setSendingReply(true);
    try {
      const res = await api.post("/AgentAI/contacts/unified/reply/", {
        contact_id: historyContact.id,
        message: replyText
      });
      
      if (res.data.success) {
        toast.success("Message sent");
        setReplyText("");
        // Optimistic update or just refresh
        fetchHistory(historyContact.id, 1);
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
      toast.error(err.response?.data?.error || "Failed to send reply.");
    } finally {
      setSendingReply(false);
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     c.identifier?.includes(searchQuery))
  );

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return "Yesterday";
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative w-full h-[calc(100vh-100px)] bg-[#f0f2f5] font-sans flex flex-col overflow-hidden rounded-xl border border-gray-200">
      {/* WhatsApp-Style Header */}
      <div className="bg-[#00a884] h-24 absolute top-0 left-0 right-0 z-0 pointer-events-none"></div>

      <div className="relative z-10 w-full h-full p-0 sm:p-2 md:p-4 flex flex-col overflow-hidden">
        <div className="bg-white shadow-xl sm:rounded-lg flex-1 flex flex-col overflow-hidden border border-gray-200">
          {/* Dashboard Left Sidebar Header */}
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden pointer-events-auto">
            <div className="w-full md:w-96 border-r border-gray-200 flex flex-col bg-white">
              <div className="p-4 bg-[#f0f2f5] flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                  {selectedAgent === 'all' ? 'U' : agents.find(a => a.page_id === selectedAgent)?.name?.charAt(0) || 'A'}
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                  <CpuChipIcon className="h-6 w-6 cursor-pointer" />
                  <UsersIcon className="h-6 w-6 cursor-pointer" />
                  <EllipsisVerticalIcon className="h-6 w-6 cursor-pointer" />
                </div>
              </div>

              {/* Filters */}
              <div className="p-3 bg-white space-y-3">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search or start new chat"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-2 bg-[#f0f2f5] rounded-xl text-sm focus:outline-none"
                  />
                </div>
                
                <select 
                  value={selectedAgent} 
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 outline-none"
                >
                  <option value="all">All Platforms</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.page_id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact List */}
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {loading ? (
                  <div className="p-4 space-y-4">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="flex gap-4 animate-pulse">
                        <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredContacts.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {filteredContacts.map(contact => (
                      <div 
                        key={contact.id} 
                        onClick={() => openHistory(contact)}
                        className={`flex gap-4 p-4 cursor-pointer transition-colors ${
                          historyContact?.id === contact.id ? 'bg-[#f0f2f5]' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-black text-lg ${
                          contact.platform === 'whatsapp' ? 'bg-[#25d366]' : 'bg-[#0084ff]'
                        }`}>
                          {contact.name?.charAt(0) || contact.identifier.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0 border-b border-gray-100 pb-2">
                          <div className="flex justify-between items-baseline mb-1">
                            <h3 className="font-bold text-gray-900 truncate">
                              {contact.name || contact.identifier}
                            </h3>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                              {formatLastSeen(contact.last_message_time || contact.updated_at)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center group mt-1">
                            <p className={`text-sm truncate pr-2 ${contact.unread_count > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                              {contact.last_message || 'No messages yet'}
                            </p>
                            <div className="flex items-center gap-2">
                              {contact.unread_count > 0 && (
                                <span className="bg-[#25d366] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                                  {contact.unread_count}
                                </span>
                              )}
                              <button 
                                onClick={(e) => toggleAutoReply(contact.id, e)}
                                className={`flex-shrink-0 w-3 h-3 rounded-full ${
                                  contact.is_auto_reply_enabled ? 'bg-[#25d366]' : 'bg-rose-500'
                                } shadow-sm border border-white`}
                                title={contact.is_auto_reply_enabled ? "AI Responding" : "AI Blocked"}
                              />
                            </div>
                          </div>
                          <span className="text-[9px] font-black uppercase text-gray-300 tracking-widest mt-1 inline-block">
                            {contact.agent_name || contact.platform}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400">
                    <UsersIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-bold">No contacts found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Chat Area (WhatsApp Layout) */}
            <div className="flex-1 hidden md:flex flex-col bg-[#efeae2] relative overflow-hidden">
              {!isModalOpen ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-64 h-64 relative mb-8">
                     <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full"></div>
                     <ChatBubbleLeftRightIcon className="w-full h-full text-[#adb5bd] opacity-40" />
                  </div>
                  <h2 className="text-3xl font-light text-[#41525d] mb-4">Select a chat to start</h2>
                  <p className="text-sm text-[#8696a0] max-w-sm">
                    Connect with your customers across platform. Select a contact to view history and reply.
                  </p>
                  <div className="mt-auto pt-10 text-xs text-[#8696a0] flex items-center gap-2">
                     <CpuChipIcon className="h-4 w-4" /> End-to-end AI responses enabled
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="p-3 bg-[#f0f2f5] border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        historyContact?.platform === 'whatsapp' ? 'bg-[#25d366]' : 'bg-[#0084ff]'
                      }`}>
                        {historyContact?.name?.charAt(0) || historyContact?.identifier.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 leading-tight">
                          {historyContact?.name || historyContact?.push_name || historyContact?.identifier}
                        </h3>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                          {historyContact?.is_auto_reply_enabled ? 'AI Auto-Reply Active' : 'Manual Mode Only'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-gray-500">
                      <MagnifyingGlassIcon className="h-5 w-5 cursor-pointer" />
                      <EllipsisVerticalIcon className="h-5 w-5 cursor-pointer" />
                      <button onClick={() => setIsModalOpen(false)}>
                        <XMarkIcon className="h-6 w-6 text-gray-400 hover:text-rose-500" />
                      </button>
                    </div>
                  </div>

                  {/* Messages Area (Oldest first display, loads more at top) */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-[url('https://w0.peakpx.com/wallpaper/580/650/wallpaper-whatsapp-background.jpg')] bg-repeat bg-[size:400px]">
                    {hasMoreHistory && (
                      <div ref={lastMessageElementRef} className="flex justify-center p-4">
                        {historyLoading ? <ArrowPathIcon className="h-5 w-5 text-[#00a884] animate-spin" /> : <span className="text-xs text-indigo-500 cursor-pointer font-bold">Load earlier messages</span>}
                      </div>
                    )}
                    
                    {historyMessages.map((msg, index) => (
                      <div 
                        key={msg.id || index}
                        className={`flex flex-col ${msg.role === 'assistant' ? 'items-start' : 'items-end'}`}
                      >
                        <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-sm shadow-sm relative ${
                          msg.role === 'assistant' 
                          ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100' 
                          : 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          <div className="flex items-center justify-end gap-1 mt-1 -mr-1">
                            <span className="text-[9px] text-gray-400">
                               {msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                            </span>
                            {msg.role === 'assistant' && (
                               <CheckCircleIcon className="h-3 w-3 text-[#53bdeb]" />
                            )}
                          </div>
                          {msg.role === 'assistant' && msg.tokens_used > 0 && (
                            <div className="absolute -bottom-4 left-0 text-[8px] font-black text-gray-400 uppercase tracking-tighter opacity-0 hover:opacity-100 transition-opacity">
                               {msg.tokens_used} tokens
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRefDesktop} />
                  </div>

                  {/* Reply Section */}
                  <div className="p-3 bg-[#f0f2f5] flex items-end gap-3">
                    <div className="p-2 text-gray-500 hover:text-gray-700 cursor-pointer">
                       <CpuChipIcon className="h-7 w-7" />
                    </div>
                    <div className="flex-1 bg-white rounded-xl flex items-end p-2 border border-gray-100 shadow-sm focus-within:ring-1 focus-within:ring-[#00a884]/20 transition-all">
                      <textarea
                        placeholder="Type a message"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={1}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1.5 px-2 resize-none max-h-32"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                      />
                    </div>
                    <button
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyText.trim()}
                      className={`p-3 rounded-full transition-all flex items-center justify-center ${
                        replyText.trim() && !sendingReply
                        ? 'bg-[#00a884] text-white shadow-md'
                        : 'bg-gray-300 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {sendingReply ? (
                        <ArrowPathIcon className="h-6 w-6 animate-spin" />
                      ) : (
                        <PaperAirplaneIcon className="h-6 w-6 rotate-0" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Experience (Simplified overlay for chat) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] md:hidden flex flex-col bg-[#efeae2]">
           <div className="p-3 bg-[#00a884] text-white flex items-center gap-4">
              <button onClick={() => setIsModalOpen(false)}>
                <XMarkIcon className="h-6 w-6" />
              </button>
              <div className="flex-1 flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                    {historyContact?.name?.charAt(0)}
                 </div>
                 <h3 className="font-bold truncate">{historyContact?.name || historyContact?.identifier}</h3>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[url('https://w0.peakpx.com/wallpaper/580/650/wallpaper-whatsapp-background.jpg')] bg-repeat bg-[size:300px]">
              {historyMessages.map((msg, index) => (
                <div key={msg.id || index} className={`flex flex-col ${msg.role === 'assistant' ? 'items-start' : 'items-end'}`}>
                   <div className={`max-w-[85%] px-3 py-1.5 rounded-lg text-sm shadow-sm ${
                      msg.role === 'assistant' ? 'bg-white' : 'bg-[#dcf8c6]'
                   }`}>
                      {msg.content}
                   </div>
                </div>
              ))}
              <div ref={messagesEndRefMobile} />
           </div>

           <div className="p-3 bg-[#f0f2f5] flex items-center gap-3">
              <input 
                type="text" 
                placeholder="Message"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 bg-white rounded-full px-4 py-2 text-sm focus:outline-none"
              />
              <button onClick={handleSendReply} className="p-2 bg-[#00a884] text-white rounded-full">
                 <PaperAirplaneIcon className="h-6 w-6" />
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
