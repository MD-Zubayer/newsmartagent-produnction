"use client";

import React, { useMemo } from "react";
import { Globe, ChevronDown, Bell, Crown, RefreshCw, User, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Topbar({ viewMode, onSwitch }) {
  const { user, loading } = useAuth(); 
  const pathname = usePathname();

  const initials = useMemo(() => {
    if (!user?.name) return "??";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [user]);

  return (
    <nav className="flex items-center justify-between px-8 py-3 bg-white/70 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50 w-full h-20 shadow-sm">
      
      {/* --- LEFT SIDE: Role & Status --- */}
      <div className="flex items-center gap-4">
        {/* <div className="relative group">
          <div className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 ${
            viewMode === 'agent' 
            ? 'bg-amber-50 text-amber-600 border border-amber-100 shadow-inner' 
            : 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-inner'
          }`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${viewMode === 'agent' ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${viewMode === 'agent' ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
            </span>
            {viewMode === 'agent' ? <ShieldCheck size={14} className="animate-bounce" /> : <User size={14} />}
            {viewMode} Mode Active
          </div>
        </div> */}
      </div>

      {/* --- RIGHT SIDE: Actions & Profile --- */}
      <div className="flex items-center gap-3">
        
        {/* 🔥 Super Modern Switch Button */}
        <div className="ml-4">
          <button 
            onClick={onSwitch}
            className={`relative overflow-hidden flex items-center md:gap-3 gap-2 px-2 md:px-5  py-2.5 rounded-2xl md:text-[11px] text-[8px] font-black uppercase tracking-widest transition-all duration-500 active:scale-95 shadow-lg group ${
              viewMode === 'agent'
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200'
            }`}
          >
            {/* Animated Background Shine */}
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
            
            <RefreshCw size={15} className="group-hover:rotate-180 transition-transform duration-700 ease-in-out" />
            <span className="relative line-clamp-1">Switch to {viewMode === 'agent' ? 'User' : 'Agent'}</span>
            {/* <Sparkles size={14} className="animate-pulse" /> */}
          </button>
        </div>

        {/* Action Icons */}
        <div className="flex items-center bg-gray-50/50 p-1.5 rounded-2xl border border-gray-100 gap-1">
          <Link href="/">
            <button className="p-2 text-gray-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-xl transition-all duration-300">
              <Globe size={18} />
            </button>
          </Link>

          <Link href="/dashboard/notifications">
            <button className={`p-2 rounded-xl transition-all duration-300 relative ${
              pathname.includes("notifications") ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:bg-white hover:text-indigo-600"
            }`}>
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
          </Link>
        </div>

        {/* Profile Section */}
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 pl-3 ml-2 border-l border-gray-100 group transition-all"
        >
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-xs font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
              {user ? user.name : "Guest User"}
            </span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">View Profile</span>
          </div>

          <div className="relative group-hover:scale-105 transition-transform duration-300">
            <div className={`flex items-center justify-center w-11 h-11 rounded-2xl font-black text-xs text-white shadow-xl transition-all duration-500 ${
              viewMode === 'agent' 
              ? 'bg-gradient-to-br from-amber-400 to-orange-600' 
              : 'bg-gradient-to-br from-indigo-500 to-purple-600'
            }`}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : initials}
            </div>
            {/* Online Status Indicator */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-md">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </Link>
      </div>
    </nav>
  );
}