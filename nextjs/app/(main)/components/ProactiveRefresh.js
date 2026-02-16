'use client'

import { useEffect } from "react";
import api from "@/lib/api";

export default function ProactiveRefresh({ accessTokenLifetimeSec = 1800 }) {
  // accessTokenLifetimeSec = Access Token lifetime in seconds (default 2 min)

  useEffect(() => {
    // Refresh 20 seconds আগে, token expire হওয়ার আগে
    const refreshBeforeExpiry = 60; // seconds

    const intervalTime = (accessTokenLifetimeSec - refreshBeforeExpiry) * 1000;

    const interval = setInterval(async () => {
      try {
        const res = await api.post('/token/refresh/');
        console.log("Token refreshed proactively ✅", res);
      } catch (err) {
        console.error('Proactive refresh failed ❌', err);
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [accessTokenLifetimeSec]);

  return null;
}
