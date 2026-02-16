"use client";

import { useState, useEffect, cloneElement, isValidElement } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import ProactiveRefresh from "@/(main)/components/ProactiveRefresh";
import Sidebar from "../../(main)/components/Sidebar";
import TopNav from "../../(main)/components/TopNav";

function DashboardContent({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [viewMode, setViewMode] = useState(null);

  useEffect(() => {
    if (user) {
      // URL থেকে মোড ডিটেক্ট করা
      if (pathname.includes("/dashboard/agent")) {
        setViewMode("agent");
      } else if (pathname.includes("/dashboard/user")) {
        setViewMode("user");
      } else if (!viewMode) {
        // যদি শুধু /dashboard এ থাকে, তবে ডিফল্ট মোডে রিডাইরেক্ট করা
        const savedView = localStorage.getItem("active_view") || user.id_type || "user";
        setViewMode(savedView);
        router.push(`/dashboard/${savedView}`);
      }
    }
  }, [user, pathname]);

  const handleViewSwitch = () => {
    const nextView = viewMode === "agent" ? "user" : "agent";
    setViewMode(nextView);
    localStorage.setItem("active_view", nextView);
    // 🔥 URL পরিবর্তন করে দেওয়া হচ্ছে
    router.push(`/dashboard/${nextView}`);
  };

  if (!viewMode) return <div className="h-screen flex items-center justify-center font-bold">Initializing...</div>;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar viewMode={viewMode} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <TopNav viewMode={viewMode} onSwitch={handleViewSwitch} />
        <main className="p-4 flex-1 ml-12 md:ml-64 overflow-y-auto">
          {isValidElement(children) ? cloneElement(children, { viewMode }) : children}
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