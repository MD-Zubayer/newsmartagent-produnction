"use client";
import React, { useEffect, useState } from 'react';
import api from '@/lib/api'; 
import { 
    Users, Key, TrendingUp, Clock, AlertCircle, 
    DollarSign, Wallet, CheckCircle, XCircle, BarChart3, PieChart, Activity 
} from 'lucide-react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, 
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { motion } from 'framer-motion';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, ArcElement, 
    PointElement, LineElement, Title, Tooltip, Legend, Filler
);

export default function AgentDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('agent-state/')
            .then(res => setStats(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 2000,
            easing: 'easeOutQuart',
        },
        plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 6 } }
        }
    };

    const monthlyAvgData = (stats?.monthly_history && stats.monthly_history.length > 0
        ? stats.monthly_history
        : []).map(Number);

    const totalCumulativeData = monthlyAvgData.reduce((acc, curr, i) => 
        [...acc, (Number(curr) || 0) + (acc[i - 1] || 0)], []);

    const monthLabels = stats?.monthly_labels && stats.monthly_labels.length === monthlyAvgData.length
        ? stats.monthly_labels
        : monthlyAvgData.map((_, i) => `Month ${i + 1}`);

    const barData = {
        labels: monthLabels,
        datasets: [{
            label: 'Monthly Commission (৳)',
            data: monthlyAvgData,
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderRadius: 8,
        }]
    };

    const lineData = {
        labels: monthLabels,
        datasets: [{
            fill: true,
            label: 'Cumulative Growth (৳)',
            data: totalCumulativeData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            pointRadius: 4,
        }]
    };

    const doughnutData = {
        labels: ['Active Sub', 'Inactive'],
        datasets: [{
            data: [stats?.active_subscriptions || 0, stats?.inactive_subscriptions || 0],
            backgroundColor: ['#10B981', '#F43F5E'],
            cutout: '75%',
            borderWidth: 0
        }]
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-indigo-600 border-solid"></div>
        </div>
    );

    return (
        <div className="p-4 md:p-6 space-y-6 md:space-y-8 bg-[#f8fafc] min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Agent Intelligence</h1>
                    <p className="text-sm md:text-base text-slate-500">Real-time business data and forecasting</p>
                </div>
                <div className="flex items-center self-start md:self-auto gap-3 px-4 py-2 md:px-6 md:py-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
                    <span className="text-xs md:text-sm font-bold text-slate-500 uppercase">Status:</span>
                    <span className={`text-xs md:text-sm font-black ${stats?.is_otp_active ? 'text-green-600' : 'text-red-500'}`}>
                        {stats?.is_otp_active ? 'VERIFIED' : 'PENDING'}
                    </span>
                </div>
            </div>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                  { title: "Commission Earned", value: `৳${stats?.commission_balance}`, icon: <DollarSign/>, color: "orange", index: 0 },
                  { title: "Available Balance", value: `৳${stats?.acount_balance}`, icon: <Wallet/>, color: "blue", index: 1 },
                  { title: "Total Referrals", value: stats?.total_referrals, icon: <Users/>, color: "indigo", index: 2 },
                  { title: "Active Subs", value: stats?.active_subscriptions, icon: <CheckCircle/>, color: "green", index: 3 },
                ].map((card) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: card.index * 0.06, duration: 0.45, ease: "easeOut" }}
                    viewport={{ once: true }}
                    whileHover={{ y: -6 }}
                    className="group cursor-default"
                  >
                    <StatCard {...card} />
                  </motion.div>
                ))}
            </div>

            {/* Subscription Detail Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
                    <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase mb-1">Total Subscriptions</p>
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{stats?.total_subscriptions || 0}</p>
                </div>
                <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center border-b-4 border-b-green-500">
                    <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase mb-1">Currently Active</p>
                    <p className="text-2xl md:text-3xl font-black text-green-600">{stats?.active_subscriptions || 0}</p>
                </div>
                <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center border-b-4 border-b-red-500">
                    <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase mb-1">Currently Inactive</p>
                    <p className="text-2xl md:text-3xl font-black text-red-500">{stats?.inactive_subscriptions || 0}</p>
                </div>
            </div>

            {/* Charts Section - 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <BarChart3 className="text-indigo-500" size={20} /> 5-Month Monthly Avg
                    </h2>
                    <div className="h-64 md:h-80">
                        <Bar data={barData} options={chartOptions} />
                    </div>
                </div>

                <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="text-emerald-500" size={20} /> 5-Month Cumulative Growth
                    </h2>
                    <div className="h-64 md:h-80">
                        <Line data={lineData} options={chartOptions} />
                    </div>
                </div>
            </div>

            {/* Charts Section - 2 (Subscription Ratio) */}
            <div className="flex justify-center">
                <div className="w-full max-w-2xl bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-6 self-start">Subscription Ratio</h2>
                    <div className="relative w-full h-56 md:h-64 flex justify-center">
                        <Doughnut data={doughnutData} options={chartOptions} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl md:text-4xl font-black text-slate-800">{stats?.total_subscriptions}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Total Users</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, index }) {
  const colorPalettes = {
    orange: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.12)', glow: '#f59e0b' },
    blue: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.12)', glow: '#3b82f6' },
    indigo: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.12)', glow: '#6366f1' },
    green: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.12)', glow: '#10b981' },
  };

  const palette = colorPalettes[color] || colorPalettes.indigo;

  return (
    <div
      className="relative p-2 rounded-[2rem] h-full transition-all duration-500"
      style={{
        background: `linear-gradient(145deg, ${palette.bg}, #ffffff)`,
        boxShadow: `0 20px 40px -15px ${palette.glow}30, 0 0 0 1px ${palette.border}`,
      }}
    >
      <div className="relative bg-white/90 backdrop-blur-2xl h-full rounded-[1.75rem] p-5 md:p-6 flex items-center gap-4 md:gap-6 border border-white overflow-hidden shadow-sm transition-all duration-300 group-hover:bg-white group-hover:shadow-lg">
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40" style={{ background: palette.color }} />

        <div
          className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-xl md:text-2xl shrink-0 transition-transform duration-500 group-hover:scale-105 relative z-10"
          style={{
            background: `linear-gradient(135deg, ${palette.bg}, #ffffff)`,
            border: `1px solid ${palette.border}`,
            boxShadow: `inset 0 4px 8px rgba(255,255,255,0.8), 0 8px 16px ${palette.glow}25`,
            color: palette.color,
          }}
        >
          {icon}
        </div>

        <div className="relative z-10 flex-1 min-w-0">
          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 text-gray-400">{title}</p>
          <p className="text-lg md:text-2xl font-black text-gray-900 tracking-tighter leading-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}
