// dashboard/layout.js
"use client";

import { useState, useEffect, cloneElement, isValidElement } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import ProactiveRefresh from "@/(main)/components/ProactiveRefresh";
import Sidebar from "../../(main)/components/Sidebar";
import TopNav from "../../(main)/components/TopNav";
import { useNotifications } from "@/hooks/useNotifications"; // 🔥 আমাদের সেই কাস্টম হুক
import DashboardAI from "@/(main)/components/DashboardAI";
import { motion } from "framer-motion";

import { useDisplay } from "../DisplayContext";

function DashboardContent({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [viewMode, setViewMode] = useState(null);
  const { isDesktopMode, isMounted: isDisplayMounted } = useDisplay();
  
  // 🔥 লেআউটের সব লজিক এখন এই এক লাইনে!
  const { notifications, unreadCount, markAsRead } = useNotifications(user);

  // --- View Mode Logic ---
  useEffect(() => {
    if (user) {
      if (pathname.includes("/dashboard/agent")) {
        setViewMode("agent");
      } else if (pathname.includes("/dashboard/user")) {
        setViewMode("user");
      } 
      else if (!viewMode) {
        const savedView = localStorage.getItem("active_view") || user.id_type || "user";
        setViewMode(savedView);
        
        if (pathname === "/dashboard" || pathname === "/dashboard/") {
           router.push(`/dashboard/${savedView}`);
        }
      }
    }
  }, [user, pathname, viewMode, router]);

  const handleViewSwitch = () => {
    const nextView = viewMode === "agent" ? "user" : "agent";
    setViewMode(nextView);
    localStorage.setItem("active_view", nextView);
    router.push(`/dashboard/${nextView}`);
  };

  if (!viewMode || !isDisplayMounted) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50/50 backdrop-blur-xl relative overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-400/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-pink-400/10 rounded-full blur-[100px] animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center space-y-8">
          <div className="relative">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="w-24 h-24 md:w-32 md:h-32 border-2 border-indigo-100/50 rounded-[2.5rem] flex items-center justify-center"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-2xl flex items-center justify-center border border-indigo-50">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-lg animate-pulse" />
              </div>
            </motion.div>
            <div className="absolute -inset-4 border-2 border-dashed border-indigo-200/50 rounded-[3rem] animate-spin-slow" />
          </div>

          <div className="text-center space-y-2">
            <motion.h2 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter italic uppercase"
            >
              Initializing <span className="text-indigo-600">Neural</span> Hub
            </motion.h2>
            <div className="flex items-center justify-center gap-1.5">
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex h-screen bg-gray-100 ${isDesktopMode ? 'overflow-x-auto' : ''}`}
      style={isDesktopMode ? { minWidth: "1024px" } : {}}
    >
      <Sidebar viewMode={viewMode} isDesktopMode={isDesktopMode} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <TopNav 
          viewMode={viewMode} 
          onSwitch={handleViewSwitch} 
          notifications={notifications} 
          unreadCount={unreadCount}
          markAsRead={markAsRead}
        />
        <main className={`p-4 flex-1 overflow-y-auto ${isDesktopMode ? 'ml-40' : 'ml-0 md:ml-40'}`}>
          {isValidElement(children) ? cloneElement(children, { viewMode }) : children}
          <DashboardAI />
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      <ProactiveRefresh />
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}