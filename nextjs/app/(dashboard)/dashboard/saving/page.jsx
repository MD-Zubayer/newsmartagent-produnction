"use client";

import React, { useEffect, useState } from "react";
// ⚡ PiggyBank আইকন ইম্পোর্ট করা হলো
import { Table, Search, AlertTriangle, Zap, BarChart3, Loader2, PiggyBank } from "lucide-react";
import api from "@/lib/api";

export default function RankingReportPage() {
  const [rankingData, setRankingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchRankingData = async () => {
      try {
        setLoading(true);
        const agentId = "947204378476536";
        const response = await api.get(`/AgentAI/ranking/${agentId}/`);
        
        setRankingData(response.data);
      } catch (err) {
        console.error("Fetch Error:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchRankingData();
  }, []);

  const filteredData = rankingData.filter((item) =>
    item.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-20 text-center flex flex-col items-center justify-center">
        <Loader2 className="animate-spin h-12 w-12 text-pink-500 mb-4" />
        <h2 className="text-gray-400 font-black text-xl uppercase italic">Loading Ranking Report...</h2>
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
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-8 border-pink-500 pl-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter italic uppercase">Ranking Report</h1>
            <p className="text-gray-400 font-bold text-sm">Most Frequently Asked Questions & Savings</p>
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

        {/* Ranking Table */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-100 flex items-center gap-3">
            <BarChart3 className="text-pink-500" size={24} />
            <h2 className="text-xl font-black text-gray-800 uppercase italic">Top Active Queries</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Rank</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Message Content</th>
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Frequency</th>
                  {/* ⚡ নতুন কলাম: Token Savings */}
                  <th className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Token Savings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-black text-lg 
                          ${index < 3 ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-8 py-6 font-bold text-gray-700 text-md">
                        {item.text}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <Zap className="text-yellow-500" size={18} />
                          <span className="text-2xl font-black text-gray-900">{item.frequency}</span>
                          <span className="text-sm font-bold text-gray-400">times</span>
                        </div>
                      </td>
                      {/* ⚡ নতুন ডাটা: Token Savings */}
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <PiggyBank className="text-green-500" size={18} />
                          <span className="text-2xl font-black text-green-700">{item.token_savings}</span>
                          <span className="text-sm font-bold text-gray-400">tokens</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-20 text-gray-400 font-bold">
                      No messages found matching your search.
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