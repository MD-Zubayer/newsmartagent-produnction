"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

export default function WidgetWrapper() {
  const pathname = usePathname();
  const isDashboard = pathname?.includes("dashboard");

  useEffect(() => {
    // ড্যাশবোর্ডে গেলে উইজেট রিমুভ করার ফাংশন
    const removeNSAWidget = () => {
      const wrap = document.getElementById("nsa-wrap");
      if (wrap) {
        wrap.remove(); // পুরো উইজেট র‍্যাপার রিমুভ করবে
      }
      
      // যদি উইজেটের স্টাইল ট্যাগ থেকে যায় সেটিও রিমুভ করা ভালো
      const styles = document.querySelectorAll('style');
      styles.forEach(s => {
        if (s.textContent.includes('#nsa-wrap')) s.remove();
      });
    };

    if (isDashboard) {
      removeNSAWidget();
    }
  }, [pathname, isDashboard]);

  if (isDashboard) return null;

  return (
    <Script
      src="https://newsmartagent.com/widget.js"
      data-key="9d94fbd8-167a-42d2-b3e8-389062ca8b49"
      strategy="afterInteractive"
    />
  );
}