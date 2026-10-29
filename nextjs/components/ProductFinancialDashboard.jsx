"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import {
  TrendingUp,
  Wallet,
  Package,
  Percent,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { motion } from "framer-motion";
import api from "@/lib/api";
import toast from "react-hot-toast";
import FinancialTooltip from "./FinancialTooltip";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// Helper to extract the leaf (last) category name from hierarchical category paths
export function getCategoryLeaf(categoryStr) {
  if (!categoryStr) return "Uncategorized";
  const str = String(categoryStr);
  const delimiter = str.includes(">")
    ? ">"
    : str.includes("›")
    ? "›"
    : str.includes("/")
    ? "/"
    : str.includes("→")
    ? "→"
    : null;
  if (!delimiter) return str.trim();
  const parts = str
    .split(delimiter)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : str.trim();
}

// --- Overview Style StatCard ---
function StatCard({ title, termKey, value, icon, color, subValue, align = "auto" }) {
  const colorPalettes = {
    blue: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.14)", glow: "#3b82f6" },
    purple: { color: "#a855f7", bg: "rgba(168, 85, 247, 0.08)", border: "rgba(168, 85, 247, 0.14)", glow: "#a855f7" },
    orange: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.14)", glow: "#f59e0b" },
    red: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.14)", glow: "#ef4444" },
    green: { color: "#10b981", bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.14)", glow: "#10b981" },
    indigo: { color: "#6366f1", bg: "rgba(99, 102, 241, 0.08)", border: "rgba(99, 102, 241, 0.14)", glow: "#6366f1" },
  };

  const palette = colorPalettes[color] || colorPalettes.indigo;

  return (
    <div
      className="relative p-1.5 sm:p-2 rounded-[1.75rem] sm:rounded-[2rem] h-full transition-all duration-300 hover:-translate-y-0.5 group/card"
      style={{
        background: `linear-gradient(145deg, ${palette.bg}, #ffffff)`,
        boxShadow: `0 20px 40px -15px ${palette.glow}25, 0 0 0 1px ${palette.border}`,
      }}
    >
      <div className="relative bg-white/95 backdrop-blur-2xl h-full rounded-[1.5rem] sm:rounded-[1.75rem] p-3.5 sm:p-4 md:p-5 flex flex-col justify-between gap-3 border border-white shadow-xs transition-all duration-300 group-hover/card:bg-white group-hover/card:shadow-xl">
        {/* Glow Orb in corner with clipped boundary */}
        <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[1.75rem] overflow-hidden pointer-events-none">
          <div
            className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover/card:opacity-45"
            style={{ background: palette.color }}
          />
        </div>

        {/* 3D Icon Box */}
        <div
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg shrink-0 transition-transform duration-500 group-hover/card:scale-105 relative z-10"
          style={{
            background: `linear-gradient(135deg, ${palette.bg}, #ffffff)`,
            border: `1px solid ${palette.border}`,
            boxShadow: `inset 0 3px 6px rgba(255,255,255,0.8), 0 6px 14px ${palette.glow}20`,
            color: palette.color,
          }}
        >
          {icon}
        </div>

        {/* Text Details */}
        <div className="relative z-10 flex-1 min-w-0">
          <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-1 text-slate-500 flex items-center">
            {termKey ? (
              <FinancialTooltip termKey={termKey} align={align}>
                {title}
              </FinancialTooltip>
            ) : (
              <span>{title}</span>
            )}
          </div>

          <p
            className="text-base sm:text-lg md:text-xl xl:text-[1.35rem] font-black text-gray-900 tracking-tight leading-tight break-all"
            title={typeof value === "string" ? value : ""}
          >
            {value}
          </p>

          {/* Redesigned Sub-Metric Pill (Clean, Modern, Non-Clipped) */}
          {subValue && (
            <div className="mt-2.5 pt-2 border-t border-slate-100/90 flex items-center min-w-0">
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9.5px] sm:text-[10.5px] font-bold tracking-tight max-w-full"
                style={{
                  backgroundColor: palette.bg,
                  color: palette.color,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: palette.color }}
                />
                <span className="truncate">{subValue}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductFinancialDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30"); // "7" | "30" | "90"
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async (days = timeRange, isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get(`datasheet/products/financial-summary/?days=${days}`);
      setData(res.data);
    } catch (err) {
      console.error("Failed fetching financial summary:", err);
      toast.error("ফাইন্যান্সিয়াল অ্যানালিটিক্স লোড করা সম্ভব হয়নি");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary(timeRange);
  }, [timeRange]);

  const inv = data?.inventory_valuation || {};
  const sales = data?.sales_performance || {};
  const charts = data?.charts || {};

  // 1. Daily Revenue vs COGS vs Gross Profit Chart
  const trendChartData = useMemo(() => {
    const list = charts.daily_trend || [];
    const labels = list.map((item) => {
      const d = new Date(item.date);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });

    return {
      labels,
      datasets: [
        {
          label: "Revenue (মোট বিক্রি)",
          data: list.map((item) => item.revenue),
          borderColor: "#10b981", // Emerald
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: "Cost of Goods (ক্রয় খরচ)",
          data: list.map((item) => item.cogs),
          borderColor: "#94a3b8", // Slate
          backgroundColor: "rgba(148, 163, 184, 0.08)",
          borderWidth: 2,
          borderDash: [4, 4],
          tension: 0.35,
          fill: false,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: "Gross Profit (মোট লাভ)",
          data: list.map((item) => item.profit),
          borderColor: "#6366f1", // Indigo
          backgroundColor: "rgba(99, 102, 241, 0.12)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [charts.daily_trend]);

  // 2. Category Capital Allocation Doughnut
  const categoryChartData = useMemo(() => {
    const catList = charts.category_capital || [];
    const labels = catList.map((c) => c.category || "Uncategorized");
    const dataValues = catList.map((c) => c.capital || 0);

    const colors = [
      "#6366f1",
      "#10b981",
      "#f59e0b",
      "#ec4899",
      "#06b6d4",
      "#8b5cf6",
      "#64748b",
    ];

    return {
      labels,
      datasets: [
        {
          data: dataValues,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: "#ffffff",
        },
      ],
    };
  }, [charts.category_capital]);

  return (
    <div className="space-y-6 md:space-y-8 animate-fadeIn text-slate-800 font-sans pb-10">
      {/* Overview-Style Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-l-8 border-indigo-600 pl-4 sm:pl-6">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tighter italic uppercase">
            Profit & Financial Analytics
          </h1>
          <p className="text-gray-400 font-bold text-xs sm:text-sm mt-0.5">
            Real-time Cost Price, Gross Margin & Inventory Valuation
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross Margin</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-black text-emerald-500">
            {sales.realized_margin_percent || 0}% Realized
          </p>
        </div>
      </div>

      {/* Date Filter Bar (Exact Overview Style) */}
      <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-[1.75rem] sm:rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0 shadow-sm">
            <Filter size={20} />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight italic">
              Timeline Filter
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold">
              {timeRange} দিনের হিসাব ও আর্থিক অ্যানালিটিক্স
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 shadow-xs">
            {[
              { id: "7", label: "7 Days" },
              { id: "30", label: "30 Days" },
              { id: "90", label: "90 Days" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTimeRange(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 select-none ${timeRange === tab.id
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchSummary(timeRange, true)}
            disabled={refreshing || loading}
            title="রিফ্রেশ করুন"
            className="p-2 sm:px-3 sm:py-2 flex items-center gap-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors shadow-xs text-xs font-bold"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-12 sm:p-16 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col items-center justify-center space-y-3">
          <RefreshCw size={26} className="text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Calculating Financial Ledger & Metrics...
          </p>
        </div>
      ) : (
        <>
          {/* 6 Key Financial KPI Cards (Overview Style) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
            {/* Card 1: Total Revenue */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="h-full relative hover:z-40 focus-within:z-40"
            >
              <StatCard
                title="Total Revenue"
                termKey="revenue"
                align="left"
                value={`৳${(sales.total_revenue || 0).toLocaleString()}`}
                icon={<TrendingUp size={22} />}
                color="green"
                subValue={`${sales.total_orders || 0} orders processed`}
              />
            </motion.div>

            {/* Card 2: Cost of Goods (COGS) */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="h-full relative hover:z-40 focus-within:z-40"
            >
              <StatCard
                title="Cost of Goods (COGS)"
                termKey="cogs"
                align="left"
                value={`৳${(sales.total_cogs || 0).toLocaleString()}`}
                icon={<Wallet size={22} />}
                color="blue"
                subValue="Inventory acquisition cost"
              />
            </motion.div>

            {/* Card 3: Realized Gross Profit */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="h-full relative hover:z-40 focus-within:z-40"
            >
              <StatCard
                title="Gross Profit (মোট লাভ)"
                termKey="gross_profit"
                align="center"
                value={`+৳${(sales.gross_profit || 0).toLocaleString()}`}
                icon={<Percent size={22} />}
                color="indigo"
                subValue={`Margin: ${sales.realized_margin_percent || 0}%`}
              />
            </motion.div>

            {/* Card 4: Stock Capital Locked */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full relative hover:z-40 focus-within:z-40"
            >
              <StatCard
                title="Capital Locked"
                termKey="locked_capital"
                align="center"
                value={`৳${(inv.total_locked_capital || 0).toLocaleString()}`}
                icon={<Package size={22} />}
                color="purple"
                subValue={`${inv.total_units || 0} units in inventory`}
              />
            </motion.div>

            {/* Card 5: Potential Retail Value */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="h-full relative hover:z-40 focus-within:z-40"
            >
              <StatCard
                title="Potential Turnover"
                termKey="potential_turnover"
                align="right"
                value={`৳${(inv.total_potential_turnover || 0).toLocaleString()}`}
                icon={<BarChart3 size={22} />}
                color="orange"
                subValue={`Exp Profit: ৳${(inv.total_unrealized_profit || 0).toLocaleString()}`}
              />
            </motion.div>

            {/* Card 6: Customer Discounts */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="h-full relative hover:z-40 focus-within:z-40"
            >
              <StatCard
                title="Discounts Given"
                termKey="discounts"
                align="right"
                value={`৳${(sales.total_discounts_given || 0).toLocaleString()}`}
                icon={<AlertTriangle size={22} />}
                color="red"
                subValue={`RTO Loss: ৳${(sales.rto_loss || 0).toLocaleString()}`}
              />
            </motion.div>
          </div>

          {/* Pricing Loss Alert Banner */}
          {(inv.loss_products_count || 0) > 0 && (
            <div className="bg-red-50/90 border border-red-200 rounded-[1.75rem] p-4 sm:p-5 flex items-start sm:items-center gap-3.5 shadow-sm text-xs text-red-800">
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-red-900">
                  Pricing Alert: {inv.loss_products_count} catalog item(s) are priced below their cost price!
                </p>
                <p className="text-red-700 mt-0.5">
                  এই পণ্যগুলোর বিক্রয়মূল্য কেনা দামের চেয়ে কম রাখা হয়েছে। অনুগ্রহ করে প্রোডাক্ট ক্যাটালগে দাম রিভিউ করুন।
                </p>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Chart 1: Revenue vs Cost vs Profit Trend (2 Columns) */}
            <div className="lg:col-span-2 bg-white p-4 sm:p-6 md:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col justify-between">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-tight italic flex items-center gap-2">
                    <TrendingUp size={20} className="text-indigo-600" />
                    Revenue, Cost & Profit Trend
                  </h3>
                  <p className="text-[11px] font-bold text-gray-400">
                    দৈনিক বিক্রি, খরচ এবং মোট লাভের গতিবিধি ({timeRange} দিন)
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Revenue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Cost
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> Profit
                  </span>
                </div>
              </div>

              <div className="h-[260px] sm:h-[300px] w-full">
                <Line
                  data={trendChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: "#0f172a",
                        padding: 10,
                        titleFont: { size: 11, weight: "bold" },
                        bodyFont: { size: 11 },
                        callbacks: {
                          label: (context) =>
                            ` ${context.dataset.label}: ৳${Number(context.raw || 0).toLocaleString()}`,
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { font: { size: 10, weight: "600" }, color: "#94a3b8" },
                      },
                      y: {
                        grid: { color: "#f8fafc" },
                        ticks: {
                          font: { size: 10, weight: "600" },
                          color: "#94a3b8",
                          callback: (val) => `৳${Number(val).toLocaleString()}`,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Chart 2: Category Capital Allocation (1 Column) */}
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col justify-between">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-tight italic flex items-center gap-2">
                  <Package size={20} className="text-purple-600" />
                  Category Capital Allocation
                </h3>
                <p className="text-[11px] font-bold text-gray-400">
                  ইনভেন্টরি পুঁজির ক্যাটাগরিভিত্তিক বণ্টন
                </p>
              </div>

              <div className="my-auto flex items-center justify-center py-4">
                <div className="h-[190px] w-[190px] sm:h-[210px] sm:w-[210px]">
                  {charts.category_capital?.length > 0 ? (
                    <Doughnut
                      data={categoryChartData}
                      options={{
                        cutout: "70%",
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            backgroundColor: "#0f172a",
                            padding: 10,
                            callbacks: {
                              label: (context) =>
                                ` Capital: ৳${Number(context.raw || 0).toLocaleString()}`,
                            },
                          },
                        },
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      কোনো ক্যাটাগরি ডেটা পাওয়া যায়নি
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-3 text-xs">
                {(charts.category_capital || []).slice(0, 5).map((c, idx) => {
                  const leafCategory = getCategoryLeaf(c.category);
                  const fullCategory = c.category || "Uncategorized";
                  const color = [
                    "#6366f1",
                    "#10b981",
                    "#f59e0b",
                    "#ec4899",
                    "#06b6d4",
                    "#8b5cf6",
                    "#64748b",
                  ][idx % 7];

                  return (
                    <div key={idx} className="flex items-center justify-between text-slate-600 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {/* Mobile: Show ONLY the leaf (last) category for clean readability */}
                        <span
                          className="truncate font-bold text-slate-700 sm:hidden"
                          title={fullCategory}
                        >
                          {leafCategory}
                        </span>
                        {/* Desktop: Show full category hierarchy */}
                        <span
                          className="truncate font-semibold hidden sm:inline"
                          title={fullCategory}
                        >
                          {fullCategory}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 shrink-0">
                        ৳{Number(c.capital).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Products Profitability Matrix Table (Exact Overview Style) */}
          <div className="bg-white p-4 sm:p-6 md:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-gray-100">
            <div className="mb-4 border-b border-gray-100 pb-4">
              <h3 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-tight italic flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-600" />
                Product Profitability Matrix (শীর্ষ লাভজনক পণ্যসমূহ)
              </h3>
              <p className="text-[11px] font-bold text-gray-400">
                ক্রয় ও বিক্রয় মূল্যের পার্থক্যের ভিত্তিতে লাভজনকতার তালিকা
              </p>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/80 uppercase text-[10px] font-black text-gray-400 tracking-wider">
                  <tr>
                    <th className="p-3 sm:p-3.5">Product Name</th>
                    <th className="p-3 sm:p-3.5">Category</th>
                    <th className="p-3 sm:p-3.5">
                      <FinancialTooltip termKey="effective_price">Selling Price</FinancialTooltip>
                    </th>
                    <th className="p-3 sm:p-3.5">Cost Price</th>
                    <th className="p-3 sm:p-3.5">
                      <FinancialTooltip termKey="unit_profit">Unit Profit</FinancialTooltip>
                    </th>
                    <th className="p-3 sm:p-3.5">
                      <FinancialTooltip termKey="gross_margin">Gross Margin</FinancialTooltip>
                    </th>
                    <th className="p-3 sm:p-3.5">Stock</th>
                    <th className="p-3 sm:p-3.5 text-right">
                      <FinancialTooltip termKey="potential_profit">Potential Profit</FinancialTooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(charts.top_profitable_products || []).map((p) => {
                    const isLoss = p.unit_profit < 0;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="p-3 sm:p-3.5 font-bold text-slate-900">{p.name}</td>
                        <td className="p-3 sm:p-3.5 text-slate-500 max-w-[140px] truncate" title={p.category}>
                          <span className="sm:hidden font-medium">{getCategoryLeaf(p.category)}</span>
                          <span className="hidden sm:inline">{p.category}</span>
                        </td>
                        <td className="p-3 sm:p-3.5 font-bold text-slate-800">
                          ৳{p.effective_price}
                          {p.sale_price && (
                            <span className="ml-1 text-[10px] text-slate-400 line-through font-normal">
                              ৳{p.base_price}
                            </span>
                          )}
                        </td>
                        <td className="p-3 sm:p-3.5 text-slate-600 font-mono">
                          {p.cost_price ? `৳${p.cost_price}` : "Not set"}
                        </td>
                        <td className="p-3 sm:p-3.5">
                          <span
                            className={`font-black ${isLoss ? "text-rose-600" : "text-emerald-700"
                              }`}
                          >
                            {isLoss ? `Loss: ৳${Math.abs(p.unit_profit)}` : `+৳${p.unit_profit}`}
                          </span>
                        </td>
                        <td className="p-3 sm:p-3.5">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${p.margin_percent >= 35
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : p.margin_percent >= 20
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                          >
                            {p.margin_percent}%
                          </span>
                        </td>
                        <td className="p-3 sm:p-3.5 font-bold text-slate-700">{p.stock} units</td>
                        <td className="p-3 sm:p-3.5 font-black text-slate-900 text-right">
                          ৳{p.potential_profit.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
