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

function DashboardContent({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [viewMode, setViewMode] = useState(null);
  
  // 🔥 লেআউটের সব লজিক এখন এই এক লাইনে!
  const { notifications, unreadCount, markAsRead } = useNotifications(user);

  // --- View Mode Logic (সংশোধিত) ---
  useEffect(() => {
    if (user) {
      // ১. আগে চেক করি পাথ থেকে ভিউ মোড বের করা যায় কি না
      if (pathname.includes("/dashboard/agent")) {
        setViewMode("agent");
      } else if (pathname.includes("/dashboard/user")) {
        setViewMode("user");
      } 
      // ২. যদি এমন কোনো পাথে থাকি যেটা সরাসরি agent/user না (যেমন manual-payment)
      // কিন্তু viewMode এখনো সেট হয়নি (রিলোড এর কারণে), তখন শুধু স্টেট সেট হবে, রিডাইরেক্ট না
      else if (!viewMode) {
        const savedView = localStorage.getItem("active_view") || user.id_type || "user";
        setViewMode(savedView);
        
        // ৩. গুরুত্বপূর্ণ: শুধুমাত্র যদি রুট ড্যাশবোর্ডে থাকে তবেই রিডাইরেক্ট করবে
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

  if (!viewMode) return <div className="h-screen flex items-center justify-center font-bold font-mono">Initializing...</div>;

  return (
    <div 
      className="flex h-screen bg-gray-100 overflow-x-auto" 
      style={{ minWidth: "1024px" }} // 🔥 FORCE DESKTOP VIEW ON MOBILE
    >
      <Sidebar viewMode={viewMode} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* 🔥 TopNav এখন হুক থেকে আসা ফ্রেশ ডাটা পাবে */}
        <TopNav 
          viewMode={viewMode} 
          onSwitch={handleViewSwitch} 
          notifications={notifications} 
          unreadCount={unreadCount}
          markAsRead={markAsRead}
        />
        <main className="p-4 flex-1 ml-12 md:ml-64 overflow-y-auto">
          {/* চিল্ড্রেন পেজগুলোও (যেমন NotificationsPage) চাইলে viewMode পাবে */}
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