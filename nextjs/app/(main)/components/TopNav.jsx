"use client";

import React, { useMemo } from "react";
import { Globe, Bell, RefreshCw, Sparkles, Monitor, Smartphone, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDisplay } from "../../(dashboard)/DisplayContext";

export default function Topbar({ viewMode, onSwitch }) {
  const { user, loading } = useAuth(); 
  const pathname = usePathname();
  const { isDesktopMode, toggleDesktopMode, isSidebarOpen, toggleSidebar } = useDisplay();

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
    <nav className="flex items-center justify-between px-2 sm:px-4 md:px-8 py-2 md:py-3 bg-white/70 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50 w-full h-16 md:h-20 shadow-sm">
      
      {/* --- LEFT SIDE: Menu & Mode --- */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Mobile Menu Toggle */}
        {!isDesktopMode && (
          <button 
            onClick={toggleSidebar}
            className="p-1.5 sm:p-2 md:hidden text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            title="Menu"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}

        {/* Toggle Desktop Mode Button (Icon on mobile, text on desktop) */}
        <button 
          onClick={toggleDesktopMode}
          className={`flex items-center gap-1.5 p-1.5 sm:px-3 md:px-4 sm:py-2 rounded-xl md:rounded-2xl md:text-[11px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-sm border ${
            isDesktopMode 
            ? 'bg-indigo-600 text-white border-indigo-700' 
            : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'
          }`}
          title={isDesktopMode ? "Switch to Mobile View" : "Switch to Desktop View"}
        >
          {isDesktopMode ? <Monitor size={15} /> : <Smartphone size={15} />}
          <span className="hidden sm:inline">
            {isDesktopMode ? "Desktop" : "Mobile"}
          </span>
        </button>
      </div>

      {/* --- RIGHT SIDE: Actions & Profile --- */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
        
        {/* Role Switch Button */}
        <div>
          <button 
            onClick={onSwitch}
            className={`relative overflow-hidden flex items-center gap-1 px-2 sm:px-3 md:px-5 py-1.5 md:py-2.5 rounded-xl md:rounded-2xl md:text-[11px] text-[9px] font-black uppercase tracking-wider transition-all duration-500 active:scale-95 shadow-sm group ${
              viewMode === 'agent'
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-100'
            }`}
          >
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
            <RefreshCw size={12} className="group-hover:rotate-180 transition-transform duration-700 ease-in-out shrink-0" />
            <span className="relative"> {viewMode === 'agent' ? 'User' : 'Agent'}</span>
          </button>
        </div>

        {/* AI Assistant Button (Icon on mobile, labeled on desktop) */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-dashboard-ai"))}
          className="relative group flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 md:px-3.5 md:py-2 rounded-xl md:rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-extrabold text-xs shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
          title="AI Assistant"
        >
          <Sparkles size={14} className="text-amber-300 shrink-0" />
          <span className="hidden md:inline font-black tracking-wide text-[11px]">AI Assistant</span>
        </button>

        {/* Action Icons (Notifications & Storefront) */}
        <div className="flex items-center bg-gray-50/80 p-0.5 sm:p-1.5 rounded-xl md:rounded-2xl border border-gray-100 gap-0.5">
          <Link href="/dashboard/notifications" title="Notifications">
            <button className="relative p-1.5 sm:p-2 text-gray-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg sm:rounded-xl transition-all">
              <Bell size={15} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600" />
            </button>
          </Link>

          <Link href="/" title="Visit Storefront" className="hidden lg:block">
            <button className="p-1.5 sm:p-2 text-gray-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg sm:rounded-xl transition-all">
              <Globe size={15} />
            </button>
          </Link>
        </div>

        {/* Profile Section (Always Visible) */}
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2.5 border-l border-gray-100 group transition-all shrink-0"
        >
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-xs font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
              {user ? user.name : "Guest User"}
            </span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">View Profile</span>
          </div>

          <div className="relative group-hover:scale-105 transition-transform duration-300">
            <div className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-xl sm:rounded-2xl font-black text-[11px] sm:text-xs text-white shadow-sm transition-all duration-500 overflow-hidden ${
              viewMode === 'agent' 
              ? 'bg-gradient-to-br from-amber-400 to-orange-600' 
              : 'bg-gradient-to-br from-indigo-500 to-purple-600'
            }`}>
              {loading ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : user?.profile?.profile_photo ? (
                <img src={user.profile.profile_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            {/* Online Status Indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-white rounded-full flex items-center justify-center shadow-xs">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </Link>
      </div>
    </nav>
  );
}