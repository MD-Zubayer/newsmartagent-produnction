"use client";

import React from "react";
import FinancialTooltip from "@/components/FinancialTooltip";

const colorPalettes = {
  blue: {
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.08)",
    border: "rgba(59, 130, 246, 0.16)",
    glow: "#3b82f6",
    gradient: "from-blue-600 to-indigo-500",
  },
  purple: {
    color: "#a855f7",
    bg: "rgba(168, 85, 247, 0.08)",
    border: "rgba(168, 85, 247, 0.16)",
    glow: "#a855f7",
    gradient: "from-purple-600 to-indigo-500",
  },
  orange: {
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.16)",
    glow: "#f59e0b",
    gradient: "from-amber-500 to-orange-500",
  },
  red: {
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.16)",
    glow: "#ef4444",
    gradient: "from-rose-500 to-red-600",
  },
  green: {
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.16)",
    glow: "#10b981",
    gradient: "from-emerald-500 to-teal-600",
  },
  emerald: {
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.16)",
    glow: "#10b981",
    gradient: "from-emerald-500 to-teal-600",
  },
  indigo: {
    color: "#6366f1",
    bg: "rgba(99, 102, 241, 0.08)",
    border: "rgba(99, 102, 241, 0.16)",
    glow: "#6366f1",
    gradient: "from-indigo-600 to-purple-600",
  },
};

export default function OverviewStatCard({
  title,
  termKey,
  value,
  icon,
  color = "indigo",
  subValue,
  className = "",
}) {
  const palette = colorPalettes[color] || colorPalettes.indigo;

  return (
    <div
      className={`relative p-1.5 sm:p-2 rounded-[1.75rem] sm:rounded-[2rem] h-full transition-all duration-500 hover:-translate-y-1 group ${className}`}
      style={{
        background: `linear-gradient(145deg, ${palette.bg}, #ffffff)`,
        boxShadow: `0 20px 40px -15px ${palette.glow}25, 0 0 0 1px ${palette.border}`,
      }}
    >
      <div className="relative bg-white/95 backdrop-blur-2xl h-full rounded-[1.5rem] sm:rounded-[1.75rem] p-4 sm:p-5 flex flex-col justify-between gap-3 border border-white shadow-xs transition-all duration-300 group-hover:bg-white group-hover:shadow-xl">
        {/* Glow Orb in corner with clipped boundary */}
        <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[1.75rem] overflow-hidden pointer-events-none">
          <div
            className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-45"
            style={{ background: palette.color }}
          />
        </div>

        {/* 3D Icon Box */}
        <div
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg shrink-0 transition-transform duration-500 group-hover:scale-110 relative z-10"
          style={{
            background: `linear-gradient(135deg, ${palette.bg}, #ffffff)`,
            border: `1px solid ${palette.border}`,
            boxShadow: `inset 0 3px 6px rgba(255,255,255,0.9), 0 6px 14px ${palette.glow}20`,
            color: palette.color,
          }}
        >
          {icon}
        </div>

        {/* Text Details */}
        <div className="relative z-10 flex-1 min-w-0">
          <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-1 text-gray-500">
            {termKey ? (
              <FinancialTooltip termKey={termKey}>{title}</FinancialTooltip>
            ) : (
              <span>{title}</span>
            )}
          </div>

          <p className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 tracking-tight leading-tight break-words">
            {value}
          </p>

          {subValue && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-500 leading-tight">
              <span
                className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: palette.color }}
              />
              <span className="break-words">{subValue}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
