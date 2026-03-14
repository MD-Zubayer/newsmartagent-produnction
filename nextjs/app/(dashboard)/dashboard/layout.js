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

  if (!viewMode || !isDisplayMounted) return <div className="h-screen flex items-center justify-center font-bold font-mono">Initializing...</div>;

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