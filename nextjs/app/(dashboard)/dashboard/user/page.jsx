"use client";

import React, { useEffect, useState } from "react";
import { 
  Zap, Activity, BarChart3, MessageSquare, TrendingUp, 
  Cpu, Globe, Info, Calendar, CreditCard, Hourglass 
} from "lucide-react";
import AnalyticsCharts from "app/(main)/components/AnalyticsCharts";
import PlatformTokenChart from "app/(main)/components/PlatformTokenChart"; 
import api from "@/lib/api";

// --- হেল্পার ফাংশনসমূহ ---
const formatDateTime = (dateStr) => {
  if (!dateStr) return { date: '--', time: '--' };
  const date = new Date(dateStr);
  return {
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  };
};

const calculateTimeLeft = (endDate) => {
  if (!endDate) return "N/A";
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end - now;
  if (diffMs <= 0) return "Expired";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days} Days ${hours} Hours`;
};

export default function UserDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // ক্লায়েন্ট সাইডে axios ইন্টারসেপ্টর অটোমেটিক ব্রাউজার কুকি হ্যান্ডেল করবে
        const [analyticsRes, userRes, subRes] = await Promise.all([
          api.get("/AgentAI/tokens/analytics/"),
          api.get("/users/me/"),
          api.get("/subscriptions/")
        ]);

        setData({
          analytics: analyticsRes.data,
          user: userRes.data,
          subscriptions: subRes.data
        });
      } catch (err) {
        console.error("Fetch Error:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-20 text-center flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-pink-500 mb-4"></div>
        <h2 className="text-gray-400 font-black text-xl uppercase italic">Loading Intelligence...</h2>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-20 text-center">
        <h2 className="text-red-500 font-black text-3xl italic uppercase">Connection Lost</h2>
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

  const { analytics, user, subscriptions } = data;
  const { summary, charts, recent_logs } = analytics;
  const currentSub = subscriptions?.find(sub => sub.is_active) || subscriptions?.[subscriptions.length - 1];

  return (
    <div className="p-2 md:p-10 bg-[#f8fafc] min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-l-8 border-pink-500 pl-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter italic uppercase">Agent Analytics</h1>
            <p className="text-gray-400 font-bold text-sm">Real-time Performance Intelligence</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System Health</p>
            <p className="text-2xl font-black text-emerald-500">{summary.success_rate}% Success</p>
          </div>
        </div>

        {/* Subscription & Token Balance Info */}
        {currentSub && (
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 py-8 px-5 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
             
             <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                      <Zap size={32} className="text-yellow-400 fill-yellow-400" />
                   </div>
                   <div >
                      <p className="text-[11px] md:text-xs font-black text-slate-400 uppercase tracking-widest md:mb-1 mb-0">Available Balance</p>
                      <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                        {user?.profile?.word_balance?.toLocaleString() || 0} <span className="text-[15px] md:text-lg text-slate-500 font-bold">Tokens</span>
                      </h2>
                   </div>
                </div>

                <div className="h-12 w-[1px] bg-white/10 hidden lg:block"></div>

                <div className="flex gap-8">
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={14} className="text-blue-400"/>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Date</p>
                      </div>
                      <p className="text-[16px] md:text-lg font-bold">{formatDateTime(currentSub.start_date).date}</p>
                   </div>
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard size={14} className="text-pink-400"/>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</p>
                      </div>
                      <p className="text-[16px] md:text-lg font-bold">{formatDateTime(currentSub.end_date).date}</p>
                   </div>
                </div>

                <div className="h-12 w-[1px] bg-white/10 hidden lg:block"></div>

                <div className="flex items-center gap-4 bg-white/5 px-2 md:px-6 py-3 rounded-2xl border border-white/10">
                   <Hourglass size={24} className="text-emerald-400 animate-pulse"/>
                   <div>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Subscription Valid For</p>
                      <p className="text-xl font-black">{calculateTimeLeft(currentSub.end_date)}</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Tokens" value={summary.total_tokens.toLocaleString()} icon={<Zap />} color="blue" subValue={`In: ${summary.input_tokens.toLocaleString()} | Out: ${summary.output_tokens.toLocaleString()}`} />
          <StatCard title="Total Requests" value={summary.total_messages} icon={<MessageSquare />} color="purple" />
          <StatCard title="Avg Latency" value={`${summary.avg_response_ms || 0}ms`} icon={<Activity />} color="orange" />
          <StatCard title="Total Failed" value={summary.failed_count} icon={<Info />} color="red" />
        </div>

        {/* Chart & Engine Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 bg-white px-2 py-8 rounded-[2.5rem] shadow-2xl border border-gray-100">
              <h3 className="text-lg md:text-xl font-black text-gray-800 mb-8 flex items-center gap-2 italic uppercase">
                <TrendingUp size={24} className="text-pink-500"/> Token Usage Trend
              </h3>
              <AnalyticsCharts trendData={charts.usage_trend} />
           </div>

           <div className="bg-white py-8 px-6 rounded-[2.5rem] shadow-2xl border border-gray-100">
              <h3 className="text-[16px]  md:text-xl font-black text-gray-800 mb-8 flex items-center gap-2 italic uppercase">
                <Cpu size={24} className="text-purple-600"/> Engine Distribution
              </h3>
              <div className="space-y-6">
                {charts.model_distribution.map((m, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between mb-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase">{m.model_name}</span>
                      <span className="text-xs font-black text-gray-700">{m.count} Req</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${(m.count / summary.total_messages) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>

        {/* Platform Analytics */}
        <div className="bg-white py-8 px-5 rounded-[2.5rem] shadow-xl border border-gray-100">
          <PlatformTokenChart recentLogs={recent_logs} />
        </div>

        {/* Live Activity Stream */}
        <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden">
          <div className="py-10 px-3 md:p-10 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm md:text-2xl font-black text-gray-800 italic uppercase flex items-center gap-3">
              <Globe size={28} className="text-emerald-500 animate-pulse"/> Live Activity Stream
            </h3>
            <div className="flex gap-2">
               <span className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></span>
               <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time update</p>
            </div>
          </div>

          <div className="p-3 md:p-6 space-y-4">
            {recent_logs.map((log) => {
              const { date, time } = formatDateTime(log.created_at);
              const isMessenger = log.platform.includes('messenger');
              
              return (
                <div key={log.id} className="group relative bg-white border border-slate-100 rounded-[2rem] p-5 hover:shadow-xl transition-all overflow-hidden hover:-translate-y-1">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isMessenger ? 'bg-blue-500' : 'bg-pink-500'}`} />
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                    <div className="flex items-center gap-4 min-w-[220px]">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg ${isMessenger ? 'bg-blue-600' : 'bg-pink-600'}`}>
                        {log.platform[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 leading-none mb-1">ID: {log.sender_id.slice(-6)}</p>
                        <p className="text-[10px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.platform.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="flex-1 border-l border-slate-100 pl-6 hidden lg:block">
                       <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Operation</p>
                       <p className="text-xs font-black text-slate-600 capitalize">{log.request_type.replace('_', ' ')}</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl px-6 py-3 flex items-center gap-6 border border-slate-100 group-hover:bg-white">
                      <div className="text-center">
                        <p className="text-[9px] font-black text-blue-500 uppercase">Inbound</p>
                        <p className="text-lg font-black text-slate-800 leading-none">{log.input_tokens}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-emerald-500 uppercase">Outbound</p>
                        <p className="text-lg font-black text-slate-800 leading-none">{log.output_tokens}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 min-w-[180px] justify-end text-right">
                      <div>
                        <p className="text-sm font-black text-slate-800">{time}</p>
                        <p className="text-[10px] font-bold text-slate-400">{date}</p>
                      </div>
                      <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-md ${log.success ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                        {log.success ? "Verified" : "Bypass"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subValue }) {
  const colorMap = {
    blue: "text-blue-600 bg-blue-50",
    purple: "text-purple-600 bg-purple-50",
    orange: "text-orange-600 bg-orange-50",
    red: "text-red-600 bg-red-50"
  };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col gap-4 group hover:-translate-y-1 transition-all">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-gray-900 tracking-tighter">{value}</p>
        {subValue && (
          <p className="text-[9px] font-black text-gray-400 mt-2 p-1 bg-gray-50 rounded-lg text-center border border-dashed border-gray-200">
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}