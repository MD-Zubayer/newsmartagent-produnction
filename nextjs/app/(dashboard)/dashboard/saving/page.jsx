"use client";

import React, { useEffect, useState } from "react";
// ⚡ PiggyBank আইকন ইম্পোর্ট করা হলো
import { Table, Search, AlertTriangle, Zap, BarChart3, Loader2, PiggyBank, Trash2, Clock } from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

export default function RankingReportPage() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [rankingData, setRankingData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleting, setIsDeleting] = useState(null);
  const [isUpdatingScope, setIsUpdatingScope] = useState(null);
  const [isRequestingSpecial, setIsRequestingSpecial] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isSpecialAgent, setIsSpecialAgent] = useState(false);
  const [specialAgentStatus, setSpecialAgentStatus] = useState('none');

  // ১. এজেন্ট লিস্ট লোড করা
  useEffect(() => {
    // ... scope unchanged ...
    const fetchAgents = async () => {
      try {
        const response = await api.get("/AgentAI/agents/");
        setAgents(response.data);
        if (response.data.length > 0) {
          setSelectedAgent(response.data[0]);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Fetch Agents Error:", err);
        setError(true);
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  // ২. সিলেক্টেড এজেন্ট অনুযায়ী ডাটা লোড করা
  const fetchData = async () => {
    if (!selectedAgent) return;
    try {
      setLoading(true);
      const agentId = selectedAgent.page_id;

      const [rankingRes, metricsRes] = await Promise.all([
        api.get(`/AgentAI/ranking/${agentId}/`),
        api.get(`/AgentAI/metrics/${agentId}/`)
      ]);


      setRankingData(rankingRes.data.data || []);
      setIsStaff(rankingRes.data.is_staff || false);
      setIsSpecialAgent(rankingRes.data.is_special_agent || false);
      setSpecialAgentStatus(rankingRes.data.special_agent_status || 'none');
      setMetrics(metricsRes.data);
    } catch (err) {
      console.error("Fetch Data Error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // ৫. WebSocket কানেকশন (Real-time updates)
  useEffect(() => {
    fetchData(); // Initial load

    // WebSockets connection setup
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/ws/notifications/`;
    let socket = null;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("✅ Dashboard WebSocket Connected for Real-time Updates");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Only react to cache update events for the currently selected agent
          if (data.action === "CACHE_UPDATE" && selectedAgent && data.agent_id === selectedAgent.page_id) {
            console.log("⚡ Live update received! Fetching new ranking data...");
            fetchData(); // Fetch silently without full page loading spinner
          }
        } catch (err) {
          console.error("Socket Data Parse Error:", err);
        }
      };

      socket.onclose = () => console.log("ℹ️ Dashboard WebSocket Closed.");
    } catch (err) {
      console.error("WebSocket setup error:", err);
    }

    return () => {
      if (socket) socket.close();
    };
  }, [selectedAgent]);

  // ৩. ডিলিট লজিক
  const handleDelete = async (msg_hash) => {
    if (!selectedAgent || !confirm("Are you sure you want to delete this message from cache? The next time this message is sent, it will trigger a fresh AI response.")) return;

    try {
      setIsDeleting(msg_hash);
      const agentId = selectedAgent.page_id;
      await api.delete(`/AgentAI/ranking/delete/${agentId}/${msg_hash}/`);
      toast.success("Message removed from cache successfully");
      fetchData(); // Refresh list
    } catch (err) {
      console.error("Delete Error:", err);
      toast.error("Failed to delete message from cache");
    } finally {
      setIsDeleting(null);
    }
  };

  // ৪. স্কোপ আপডেট লজিক
  const handleScopeChange = async (msg_hash, newScope) => {
    if (!selectedAgent) return;

    try {
      setIsUpdatingScope(msg_hash);
      const agentId = selectedAgent.page_id;
      await api.post(`/AgentAI/ranking/update-scope/${agentId}/${msg_hash}/`, {
        new_scope: newScope
      });
      toast.success(`Cache scope updated to ${newScope.replace('_', ' ')}`);
      fetchData(); // Refresh data to show updated scope
    } catch (err) {
      console.error("Scope Update Error:", err);
      toast.error("Failed to update cache scope");
    } finally {
      setIsUpdatingScope(null);
    }
  };

  // ৫. Special Agent রিকুয়েস্ট লজিক
  const handleRequestSpecialAgent = async () => {
    if (!selectedAgent) return;
    try {
      setIsRequestingSpecial(true);
      const agentId = selectedAgent.page_id;
      const res = await api.post(`/AgentAI/ranking/request-special/${agentId}/`);

      toast.success(res.data.message || "Request submitted successfully!");
      setSpecialAgentStatus('pending'); // Optimistic update

      // Update the global agents list to reflect the new state
      const updatedAgents = agents.map(agent =>
        agent.page_id === agentId
          ? { ...agent, special_agent_status: 'pending' }
          : agent
      );
      setAgents(updatedAgents);
      setSelectedAgent(updatedAgents.find(a => a.page_id === agentId));

    } catch (err) {
      console.error("Request Special Agent Error:", err);
      toast.error(err.response?.data?.error || "Failed to submit request.");
    } finally {
      setIsRequestingSpecial(false);
    }
  };

  const filteredData = rankingData.filter((item) =>
    item.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && agents.length === 0) {
    return (
      <div className="p-20 text-center flex flex-col items-center justify-center">
        <Loader2 className="animate-spin h-12 w-12 text-pink-500 mb-4" />
        <h2 className="text-gray-400 font-black text-xl uppercase italic">Loading Infrastructure...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-20 text-center">
        <AlertTriangle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
        <h2 className="text-rose-500 font-black text-3xl italic uppercase">Connection Lost</h2>
        <p className="text-gray-400 font-bold mt-2">API is not responding. Check your backend server.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-pink-500 text-white font-bold rounded-xl"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-10 bg-[#f8fafc] min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header & Agent Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-8 border-pink-500 pl-6">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter italic uppercase">Ranking Report</h1>
            <p className="text-gray-400 font-bold text-sm">Most Frequently Asked Questions & Savings</p>

            {/* ⚡ নতুন: এজেন্ট ড্রপডাউন */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Agent:</span>
              <select
                className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-pink-300 shadow-sm min-w-[200px]"
                value={selectedAgent?.id || ""}
                onChange={(e) => {
                  const agent = agents.find(a => a.id === parseInt(e.target.value));
                  setSelectedAgent(agent);
                  setSpecialAgentStatus(agent?.special_agent_status || 'none');
                }}
              >
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name} ({agent.page_id})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3">
              {isSpecialAgent ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-full shadow-sm">
                  <span className="text-yellow-600">🌟</span>
                  <span className="text-[10px] font-black tracking-widest text-yellow-700 uppercase">Special Agent (1 Year Cache)</span>
                </div>
              ) : (
                <>
                  {specialAgentStatus === 'pending' ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 border border-gray-200 text-gray-500 rounded-xl cursor-wait shadow-inner">
                      <Clock size={16} className="animate-spin-slow" />
                      <span className="text-sm font-bold">Request Pending...</span>
                    </div>
                  ) : specialAgentStatus === 'rejected' ? (
                    <button onClick={handleRequestSpecialAgent} disabled={isRequestingSpecial} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 transition-all rounded-xl border border-red-200 font-bold group shadow-sm">
                      <Zap size={18} className="group-hover:scale-110 transition-transform" />
                      <span className="text-sm">Request Premium Cache Again</span>
                    </button>
                  ) : (
                    <button onClick={handleRequestSpecialAgent} disabled={isRequestingSpecial} className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white transition-all rounded-xl shadow-md hover:shadow-lg font-black group">
                      {isRequestingSpecial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap size={18} className="group-hover:scale-110 transition-transform" />}
                      <span className="text-sm">Request Premium Cache</span>
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-pink-300 w-full md:w-80 outline-none shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Performance Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-gray-100 group hover:shadow-md transition-all">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Cache Hit Rate</p>
              <h3 className="text-2xl md:text-3xl font-black text-pink-500 italic leading-none">{metrics.hit_rate}%</h3>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 group-hover:scale-x-110 transition-transform origin-left duration-500" style={{ width: `${metrics.hit_rate}%` }}></div>
              </div>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-gray-100 group hover:shadow-md transition-all">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Hits</p>
              <div className="flex items-center gap-2">
                <Zap className="text-yellow-500 fill-yellow-500 group-hover:scale-110 transition-transform" size={20} />
                <h3 className="text-2xl md:text-3xl font-black text-gray-800 tabular-nums">{metrics.metrics.cache_hit || 0}</h3>
              </div>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-gray-100 group hover:shadow-md transition-all">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Cache Miss</p>
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-rose-500 group-hover:animate-bounce" size={20} />
                <h3 className="text-2xl md:text-3xl font-black text-gray-800 tabular-nums">{metrics.metrics.cache_miss || 0}</h3>
              </div>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-gray-100 group hover:shadow-md transition-all">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Queries</p>
              <div className="flex items-center gap-2">
                <BarChart3 className="text-blue-500 group-hover:scale-110 transition-transform" size={20} />
                <h3 className="text-2xl md:text-3xl font-black text-gray-800 tabular-nums">{metrics.total_queries}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Ranking Table */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center">
              <Loader2 className="animate-spin h-10 w-10 text-pink-500" />
            </div>
          )}

          <div className="px-6 py-8 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-pink-500" size={24} />
              <h2 className="text-xl font-black text-gray-800 uppercase italic">Top Active Queries</h2>
            </div>
          </div>

          {/* Mobile Display: Card Layout */}
          <div className="lg:hidden divide-y divide-gray-100">
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (
                <div key={index} className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${index < 3 ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        {index + 1}
                      </span>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Query ID: {item.msg_hash?.slice(-6)}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.msg_hash)}
                      disabled={isDeleting === item.msg_hash}
                      className="p-2 text-rose-500 bg-rose-50 rounded-lg active:scale-95"
                    >
                      {isDeleting === item.msg_hash ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    </button>
                  </div>
                  
                  <p className="text-sm font-bold text-slate-800 bg-slate-50/50 p-4 rounded-xl border border-slate-100">{item.text}</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col items-center">
                      <Zap className="text-yellow-500 mb-1" size={14} />
                      <p className="text-lg font-black text-slate-800 tabular-nums">{item.frequency}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Frequency</p>
                    </div>
                    <div className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col items-center">
                      <PiggyBank className="text-emerald-500 mb-1" size={14} />
                      <p className="text-lg font-black text-emerald-700 tabular-nums">{item.token_savings}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Savings</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Cache Scope:</span>
                    <select
                      value={item.current_scope}
                      disabled={!isStaff || isUpdatingScope === item.msg_hash}
                      onChange={(e) => handleScopeChange(item.msg_hash, e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none"
                    >
                      <option value="agent_specific">Agent Only</option>
                      <option value="global">Global</option>
                      {isSpecialAgent && <option value="special">Special Agent</option>}
                    </select>
                  </div>
                </div>
              ))
            ) : (
                <div className="p-10 text-center text-slate-400 font-bold">No results found</div>
            )}
          </div>

          {/* Desktop Display: Table Layout */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Rank</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Message Content</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Frequency</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Savings</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Cache Scope</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50/80 transition-all group">
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-black text-lg shadow-sm
                          ${index < 3 ? 'bg-pink-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-8 py-6 max-w-lg">
                        <p className="font-bold text-slate-800 text-sm leading-relaxed line-clamp-3">{item.text}</p>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xl font-black text-slate-900 tabular-nums">{item.frequency}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Queries</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="inline-flex flex-col items-center px-4 py-2 bg-emerald-50 rounded-2xl border border-emerald-100">
                          <span className="text-xl font-black text-emerald-700 tabular-nums">{item.token_savings}</span>
                          <span className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest underline decoration-dotted decoration-emerald-200">Tokens Saved</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <select
                          value={item.current_scope}
                          disabled={!isStaff || isUpdatingScope === item.msg_hash}
                          onChange={(e) => handleScopeChange(item.msg_hash, e.target.value)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider outline-none border-2 transition-all min-w-[140px] shadow-sm
                            ${item.current_scope === 'global'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-300'
                              : item.current_scope === 'special'
                                ? 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-300'
                                : 'bg-pink-50 text-pink-700 border-pink-100 hover:border-pink-300'
                            } ${(!isStaff || isUpdatingScope === item.msg_hash) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                        >
                          <option value="agent_specific">Agent Specific</option>
                          <option value="global">Global Sync</option>
                          {isSpecialAgent && <option value="special">Specialized</option>}
                        </select>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => handleDelete(item.msg_hash)}
                          disabled={isDeleting === item.msg_hash}
                          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-300 ml-auto"
                        >
                          {isDeleting === item.msg_hash ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
