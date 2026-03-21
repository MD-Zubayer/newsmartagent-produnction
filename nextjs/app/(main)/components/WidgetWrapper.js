"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export default function WidgetWrapper() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');

  if (isDashboard) return null;

  return (
    <Script 
      src="https://newsmartagent.com/widget.js" 
      data-key="9d94fbd8-167a-42d2-b3e8-389062ca8b49" 
      strategy="afterInteractive"
    />
  );
}