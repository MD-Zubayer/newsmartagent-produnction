"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

export default function WidgetWrapper() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  useEffect(() => {
    const cleanup = () => {
      // ১. উইজেটের মেইন কন্টেইনার ডিলিট করা
      const wrap = document.getElementById("nsa-wrap");
      if (wrap) wrap.remove();

      // ২. উইজেটের স্টাইল ট্যাগ ডিলিট করা
      const styles = document.querySelectorAll("style");
      styles.forEach((s) => {
        if (s.textContent.includes("#nsa-wrap")) s.remove();
      });

      // ৩. উইন্ডো থেকে স্টেট ক্লিন করা
      if (window.NSA_WIDGET_LOADED) {
        delete window.NSA_WIDGET_LOADED;
      }
    };

    if (isDashboard) {
      cleanup();
    }
  }, [pathname, isDashboard]);

  // ড্যাশবোর্ড হলে কিছুই রিটার্ন করবে না
  if (isDashboard) return null;

  return (
    <Script
      key={pathname} // ✅ এই কি-টি ম্যাজিকের মতো কাজ করবে
      src="https://newsmartagent.com/widget.js"
      data-key="9d94fbd8-167a-42d2-b3e8-389062ca8b49"
      strategy="afterInteractive"
    />
  );
}