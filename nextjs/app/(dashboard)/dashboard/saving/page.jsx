"use client";

import React, { useEffect, useState } from "react";
// ⚡ PiggyBank আইকন ইম্পোর্ট করা হলো
import { Table, Search, AlertTriangle, Zap, BarChart3, Loader2, PiggyBank, Trash2 } from "lucide-react";
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
  const [isStaff, setIsStaff] = useState(false);
  const [isSpecialAgent, setIsSpecialAgent] = useState(false);

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
      setMetrics(metricsRes.data);
    } catch (err) {
      console.error("Fetch Data Error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Active Agent:</span>
              <select 
                className="bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-pink-300"
                value={selectedAgent?.id || ""}
                onChange={(e) => {
                  const agent = agents.find(a => a.id === parseInt(e.target.value));
                  setSelectedAgent(agent);
                }}
              >
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name} ({agent.page_id})</option>
                ))}
              </select>
              {isSpecialAgent && (
                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border border-yellow-200 flex items-center gap-1">
                  <Zap size={10} fill="currentColor" /> Special
                </span>
              )}
            </div>
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

        {/* ⚡ নতুন: পারফরম্যান্স মেট্রিক্স কার্ডস */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Cache Hit Rate</p>
              <h3 className="text-3xl font-black text-pink-500 italic">{metrics.hit_rate}%</h3>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500" style={{ width: `${metrics.hit_rate}%` }}></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Hits</p>
              <div className="flex items-center gap-2">
                <Zap className="text-yellow-500" size={20} />
                <h3 className="text-3xl font-black text-gray-800">{metrics.metrics.cache_hit || 0}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">API Call Misses</p>
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-rose-500" size={20} />
                <h3 className="text-3xl font-black text-gray-800">{metrics.metrics.cache_miss || 0}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Queries</p>
              <div className="flex items-center gap-2">
                <BarChart3 className="text-blue-500" size={20} />
                <h3 className="text-3xl font-black text-gray-800">{metrics.total_queries}</h3>
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
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Rank</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Message Content</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Frequency</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Token Savings</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Cache Scope</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-black text-lg 
                          ${index < 3 ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-8 py-6 font-bold text-gray-700 text-md max-w-md break-words">
                        {item.text}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <Zap className="text-yellow-500" size={18} />
                          <span className="text-2xl font-black text-gray-900">{item.frequency}</span>
                          <span className="text-sm font-bold text-gray-400">times</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <PiggyBank className="text-green-500" size={18} />
                          <span className="text-2xl font-black text-green-700">{item.token_savings}</span>
                          <span className="text-sm font-bold text-gray-400">tokens</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <select
                            value={item.current_scope}
                            disabled={!isStaff || isUpdatingScope === item.msg_hash}
                            onChange={(e) => handleScopeChange(item.msg_hash, e.target.value)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider outline-none border-2 transition-all
                              ${item.current_scope === 'global' 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-300' 
                                : item.current_scope === 'special'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-100 hover:border-yellow-300'
                                : 'bg-pink-50 text-pink-700 border-pink-100 hover:border-pink-300'
                              } ${(!isStaff || isUpdatingScope === item.msg_hash) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                          >
                            <option value="agent_specific">Agent Only</option>
                            <option value="global">Global</option>
                            {isSpecialAgent && <option value="special">Special Agent</option>}
                          </select>
                          {isUpdatingScope === item.msg_hash && <Loader2 size={12} className="animate-spin text-gray-400" />}
                          {!isStaff && (
                            <span className="text-[9px] font-bold text-gray-400 italic">Staff Only</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => handleDelete(item.msg_hash)}
                          disabled={isDeleting === item.msg_hash}
                          className="p-3 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all duration-300 group-hover:opacity-100 md:opacity-0"
                          title="Delete from Cache"
                        >
                          {isDeleting === item.msg_hash ? (
                            <Loader2 className="animate-spin" size={20} />
                          ) : (
                            <Trash2 size={20} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-20 text-gray-400 font-bold">
                      {loading ? "Loading data..." : "No messages found matching your search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
