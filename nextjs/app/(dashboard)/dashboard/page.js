// dashboard/page.js

"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation"; // usePathname যোগ করুন
import { useAuth } from "@/context/AuthContext";

export default function DashboardMainPage() {
  const router = useRouter();
  const pathname = usePathname(); // বর্তমান পাথ চেক করার জন্য
  const { user } = useAuth();

  useEffect(() => {
    // শুধুমাত্র যদি ইউজার ঠিক "/dashboard" পাথে থাকে, তখনই রিডাইরেক্ট হবে
    if (user && pathname === "/dashboard") {
      const savedView = localStorage.getItem("active_view") || user.id_type || "user";
      router.push(`/dashboard/${savedView}`);
    }
  }, [user, pathname]);

  return null; 
}