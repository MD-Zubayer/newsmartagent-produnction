"use client";

import React, { useEffect, useState } from "react";
import {
  Zap, Activity, BarChart3, MessageSquare, TrendingUp,
  Cpu, Globe, Info, Calendar, CreditCard, Hourglass
} from "lucide-react";
import AnalyticsCharts from "app/(main)/components/AnalyticsCharts";
import PlatformTokenChart from "app/(main)/components/PlatformTokenChart";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

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

// --- Skeleton Components ---
const Skeleton = ({ className }) => (
  <div className={`relative overflow-hidden bg-gray-200 rounded-xl ${className}`}>
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
      animate={{ x: ["-100%", "100%"] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
    />
  </div>
);

const DashboardSkeleton = () => (
  <div className="p-3 md:p-10 bg-[#f8fafc] min-h-screen font-sans">
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-gray-200 pl-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 md:h-12 md:w-64" />
          <Skeleton className="h-4 w-32 md:w-40" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      {/* Hero Skeleton (Subscription) */}
      <div className="relative bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-gray-100 shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 flex items-center gap-6">
            <Skeleton className="w-16 h-16 md:w-24 md:h-24 rounded-3xl" />
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-48" />
            </div>
          </div>
          <div className="lg:col-span-4 flex justify-between gap-8 px-8">
            <div className="space-y-2"><Skeleton className="h-2 w-16" /><Skeleton className="h-6 w-24" /></div>
            <div className="space-y-2"><Skeleton className="h-2 w-16" /><Skeleton className="h-6 w-24" /></div>
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-16 w-full rounded-3xl" />
          </div>
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-4">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-2 w-12" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Activity Stream Skeleton */}
      <div className="bg-white rounded-[3rem] p-6 md:p-10 border border-gray-100 space-y-8">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 md:h-32 w-full rounded-[2rem]" />
        ))}
      </div>
    </div>

    {/* Cinematic Loading Overlay */}
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/40 backdrop-blur-md">
      <div className="relative mb-8">
        <div className="w-20 h-20 border-4 border-pink-500/20 rounded-full animate-ping"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-indigo-600 rounded-2xl rotate-45 animate-spin-slow shadow-lg shadow-pink-500/40" />
        </div>
      </div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-slate-900 font-black text-2xl tracking-[0.2em] uppercase italic text-center px-6"
      >
        Synchronizing Neural Gateways
      </motion.h2>
      <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-[10px]">Accessing Real-time Intelligence...</p>
    </div>
  </div>
);

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
    return <DashboardSkeleton />;
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
  const activeSubs = subscriptions?.filter(s => s.is_active) || [];
  const totalScheduleSlots = activeSubs.reduce((acc, s) => acc + (s.offer?.schedule_messages || 0), 0);
  const remainingSchedules = user?.profile?.schedule_balance || 0;
  const usedSchedules = Math.max(totalScheduleSlots - remainingSchedules, 0);

  return (
    <div className="p-3 md:p-10 bg-[#f8fafc] min-h-screen font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-10">

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
        <div className="space-y-6">
          {currentSub && (
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-pink-500/20 transition-all duration-700"></div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                <div className="lg:col-span-5 flex items-center gap-4 md:gap-6 min-w-0">
                  <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl group-hover:scale-110 transition-transform duration-500">
                    <Zap size={32} className="text-yellow-400 fill-yellow-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1 md:mb-2">Total Available Balance</p>
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-tight min-w-0">
                      <span className="max-w-full break-all">{user?.profile?.word_balance?.toLocaleString() || 0}</span>
                      <span className="text-xs sm:text-sm md:text-xl text-slate-500 font-bold uppercase tracking-widest shrink-0">Tokens</span>
                    </h2>
                  </div>
                </div>

                <div className="lg:col-span-4 flex justify-between lg:justify-center items-center gap-6 md:gap-12 px-2 lg:border-x lg:border-white/10">
                  <div className="text-center lg:text-left">
                    <div className="flex items-center gap-2 mb-2 justify-center lg:justify-start">
                      <Calendar size={14} className="text-blue-400" />
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Start</p>
                    </div>
                    <p className="text-sm md:text-xl font-black">{formatDateTime(currentSub.start_date).date}</p>
                  </div>
                  <div className="text-center lg:text-left">
                    <div className="flex items-center gap-2 mb-2 justify-center lg:justify-start">
                      <CreditCard size={14} className="text-pink-400" />
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global End</p>
                    </div>
                    <p className="text-sm md:text-xl font-black">{formatDateTime(currentSub.end_date).date}</p>
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <div className="bg-white/5 backdrop-blur-sm px-6 py-4 rounded-2xl md:rounded-3xl border border-white/10 flex items-center gap-4 group/box hover:bg-white/10 transition-all duration-300">
                    <Hourglass size={24} className="text-emerald-400 animate-pulse" />
                    <div>
                      <p className="text-[9px] md:text-[10px] font-black text-emerald-400/70 uppercase tracking-widest mb-0.5">Time Remaining</p>
                      <p className="text-lg md:text-2xl font-black tracking-tighter">{calculateTimeLeft(currentSub.end_date)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
          <StatCard title="Total Tokens" value={summary.total_tokens.toLocaleString()} icon={<Zap />} color="blue" subValue={`In: ${summary.input_tokens.toLocaleString()} | Out: ${summary.output_tokens.toLocaleString()}`} />
          <StatCard title="Total Requests" value={summary.total_messages} icon={<MessageSquare />} color="purple" />
          <StatCard title="Memory Costs" value={summary.memory_extraction_tokens?.toLocaleString() || '0'} icon={<Activity />} color="orange" subValue="Background Sync" />
          <StatCard title="Avg Latency" value={`${summary.avg_response_ms || 0}ms`} icon={<Activity />} color="orange" />
          <StatCard title="Total Failed" value={summary.failed_count} icon={<Info />} color="red" />
          <StatCard title="Schedule Contacts" value={(remainingSchedules || 0).toLocaleString()} icon={<Calendar />} color="green" subValue={`Used: ${usedSchedules.toLocaleString()} / ${totalScheduleSlots.toLocaleString() || '0'}`} />
        </div>

        {/* Chart & Engine Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white px-2 py-8 rounded-[2.5rem] shadow-2xl border border-gray-100">
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-8 flex items-center gap-2 italic uppercase">
              <TrendingUp size={24} className="text-pink-500" /> Token Usage Trend
            </h3>
            <AnalyticsCharts trendData={charts.usage_trend} />
          </div>

          <div className="bg-white py-8 px-6 rounded-[2.5rem] shadow-2xl border border-gray-100">
            <h3 className="text-[16px]  md:text-xl font-black text-gray-800 mb-8 flex items-center gap-2 italic uppercase">
              <Cpu size={24} className="text-purple-600" /> Engine Distribution
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
           <h3 className="text-lg md:text-xl font-black text-gray-800 mb-8 flex items-center gap-2 italic uppercase px-4">
              <BarChart3 size={24} className="text-cyan-500" /> Platform Wise Analytics
            </h3>
          <PlatformTokenChart data={charts.platform_distribution} />
        </div>

        {/* --- Detailed Subscription Breakdown (Moved & Redesigned) --- */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-l-8 border-indigo-600 pl-6 h-12">
            <div>
              <h3 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight italic uppercase">Active Passports</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Active Subscriptions & Model Access</p>
            </div>
            <div className="bg-indigo-50 px-4 py-2 rounded-xl">
              <p className="text-[10px] font-black text-indigo-600 uppercase">Active Slots: {subscriptions?.filter(s => s.is_active).length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {activeSubs.map((sub) => {
              const percent = Math.round((sub.remaining_tokens / sub.offer.tokens) * 100);
              const isLow = percent < 15;
              const schedTotal = sub.offer?.schedule_messages || 0;
              const schedRemaining = sub.remaining_schedule_messages ?? 0;

              return (
                <div key={sub.id} className="relative bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 hover:shadow-2xl transition-all group overflow-hidden">
                  {/* Decorative Background */}
                  <div className={`absolute top-0 right-0 w-32 h-32 ${isLow ? 'bg-rose-500/5' : 'bg-indigo-500/5'} rounded-full blur-3xl pointer-events-none`} />

                  <div className="flex flex-col gap-6 relative z-10">
                    {/* Top Row: Icon & Name */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isLow ? 'bg-rose-600' : 'bg-indigo-600'}`}>
                          <Zap size={24} className="text-white fill-current" />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter">{sub.offer.name}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {sub.offer.allowed_models?.map(model => (
                              <span key={model.id} className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg uppercase tracking-tight border border-slate-200/50">
                                {model.model_name}
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2 text-[10px] text-gray-500 mt-2 flex-wrap">
                            <span className="px-2 py-1 bg-gray-100 rounded-full">Duration: {sub.offer.duration_days}d</span>
                            <span className="px-2 py-1 bg-gray-100 rounded-full">Price: {sub.offer.price} BDT</span>
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">Schedules: {schedRemaining}/{schedTotal}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${isLow ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {isLow ? 'Low Fuel' : 'Optimal'}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Token Stats */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-100">
                      <div>
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Remaining</p>
                        <p className={`text-xl font-black ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>{sub.remaining_tokens.toLocaleString()}</p>
                      </div>
                      <div className="border-l border-slate-200 pl-4">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Limit</p>
                        <p className="text-xl font-black text-slate-500">{sub.offer.tokens.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Bottom Row: Progress & Expiry */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-400 transition-colors group-hover:text-indigo-600">Usage Meter</span>
                        <span className={isLow ? 'text-rose-500' : 'text-indigo-600'}>{percent}% Left</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${isLow ? 'bg-gradient-to-r from-rose-500 to-rose-400' : 'bg-gradient-to-r from-indigo-600 to-blue-500'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar size={12} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Valid Until: {formatDateTime(sub.end_date).date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Activity Stream */}
        <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden">
          <div className="py-10 px-3 md:p-10 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm md:text-2xl font-black text-gray-800 italic uppercase flex items-center gap-3">
              <Globe size={28} className="text-emerald-500 animate-pulse" /> Live Activity Stream
            </h3>
            <div className="flex gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></span>
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time update</p>
            </div>
          </div>

          <div className="p-3 md:p-6 space-y-4">
            {recent_logs.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/80 px-6 py-10 text-center">
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                  No activity yet
                </p>
                <p className="text-xs font-bold text-slate-400">
                  Once you start sending requests, the latest interactions will appear here in real time.
                </p>
              </div>
            ) : (
              recent_logs.map((log) => {
                const { date, time } = formatDateTime(log.created_at);
                const platformSlug = (log.platform || "").toLowerCase();
                const isMessenger = platformSlug.includes("messenger");

                const platformLabel = platformSlug ? platformSlug.replace(/_/g, " ") : "Unknown Platform";
                
                // --- Platform Branding Colors ---
                const getPlatformColor = (slug) => {
                  if (!slug) return "bg-gray-600";
                  if (slug.includes("messenger")) return "bg-blue-600";
                  if (slug.includes("whatsapp")) return "bg-emerald-600";
                  if (slug.includes("instagram")) return "bg-rose-500";
                  if (slug.includes("telegram")) return "bg-sky-500";
                  if (slug.includes("youtube")) return "bg-red-600";
                  if (slug.includes("tiktok")) return "bg-zinc-900";
                  if (slug.includes("widget")) return "bg-indigo-600";
                  if (slug.includes("facebook_comment")) return "bg-blue-800";
                  return "bg-pink-600";
                };

                const platformColorClass = getPlatformColor(platformSlug);
                const requestLabel = log.request_type ? log.request_type.replace(/_/g, " ") : "Unknown Operation";
                const statusLabel = log.success === false ? "Failed" : "Success";
                const statusColorClass = log.success === false
                  ? "bg-rose-500 text-white shadow-rose-500/20"
                  : "bg-emerald-500 text-white shadow-emerald-500/20";
                let displayName = log.contact_name || log.sender_id || "Unknown";
                if (displayName.startsWith('@')) {
                  displayName = displayName.substring(1);
                }
                const avatarLabel = Array.from(displayName)[0].toUpperCase();

                return (
                  <div key={log.id} className="group relative bg-white border border-slate-100 rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-6 hover:shadow-2xl transition-all overflow-hidden hover:-translate-y-1">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${platformColorClass}`} />

                    {/* Mobile View: Vertical Stack */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-8 min-w-0">

                      {/* Source Device/Account */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`relative w-12 h-12 md:w-16 md:h-16 shrink-0 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-xl ${platformColorClass} group-hover:scale-110 transition-transform duration-500 overflow-hidden`}>
                          {log.contact_profile ? (
                             <>
                               <img 
                                 src={log.contact_profile} 
                                 alt={displayName} 
                                 className="w-full h-full object-cover" 
                                 onError={(e) => {
                                   e.currentTarget.style.display = 'none';
                                   if (e.currentTarget.nextElementSibling) {
                                     e.currentTarget.nextElementSibling.style.display = 'flex';
                                   }
                                 }} 
                               />
                               <span className="hidden w-full h-full items-center justify-center font-black text-xl text-white">
                                 {avatarLabel}
                               </span>
                             </>
                          ) : (
                             avatarLabel
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm md:text-base font-black text-slate-800 leading-tight truncate">{displayName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMessenger ? 'bg-blue-400' : 'bg-pink-400'}`}></span>
                            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{platformLabel}</p>
                          </div>
                        </div>
                      </div>

                      <div className="xl:border-l xl:border-slate-100 xl:pl-8">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Operation Type</p>
                        <p className="text-xs md:text-sm font-black text-slate-600 capitalize py-1.5 px-3 bg-slate-50 rounded-xl inline-block xl:bg-transparent xl:p-0">{requestLabel}</p>
                      </div>

                      <div className="flex items-center justify-between xl:justify-end gap-3 lg:gap-12 overflow-x-auto no-scrollbar">
                        <div className="bg-slate-50/80 rounded-2xl px-3 md:px-8 py-3 flex items-center gap-4 md:gap-10 border border-slate-100 group-hover:bg-white group-hover:border-slate-200 transition-all shrink-0">
                          <div className="text-center">
                            <p className="text-[8px] md:text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Inbound</p>
                            <p className="text-base md:text-xl font-black text-slate-800 tabular-nums leading-none">{log.input_tokens ?? 0}</p>
                          </div>
                          <div className="w-[1px] h-6 bg-slate-200"></div>
                          <div className="text-center">
                            <p className="text-[8px] md:text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Outbound</p>
                            <p className="text-base md:text-xl font-black text-slate-800 tabular-nums leading-none">{log.output_tokens ?? 0}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 md:gap-8 justify-end border-l border-slate-100 pl-3 md:pl-0 xl:border-0 xl:p-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-black text-slate-800 tabular-nums leading-tight">{time}</p>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tight">{date}</p>
                          </div>
                          <div className={`px-3 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-lg shrink-0 ${statusColorClass}`}>
                            {statusLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
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
    red: "text-red-600 bg-red-50",
    green: "text-emerald-600 bg-emerald-50"
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
