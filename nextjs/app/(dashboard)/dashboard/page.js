"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardMainPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const savedView = localStorage.getItem("active_view") || user.id_type || "user";
      router.push(`/dashboard/${savedView}`);
    }
  }, [user]);

  return null; // অথবা ছোট একটি লোডার
}