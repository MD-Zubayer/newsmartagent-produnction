"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

export default function WidgetWrapper() {
  const pathname = usePathname();
  const isDashboard = pathname?.includes("dashboard");

  useEffect(() => {
    // যদি ড্যাশবোর্ডে থাকে, তবে জোর করে উইজেট এলিমেন্টগুলো রিমুভ করা
    if (isDashboard) {
      const widgetElement = document.getElementById("nsa-widget-container") || 
                           document.getElementById("nsa-wrap"); // আপনার উইজেটের আইডি অনুযায়ী
      if (widgetElement) {
        widgetElement.style.display = "none";
        // অথবা পুরোপুরি রিমুভ করতে চাইলে: widgetElement.remove();
      }
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