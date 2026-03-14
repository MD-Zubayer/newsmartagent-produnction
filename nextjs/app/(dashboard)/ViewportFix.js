"use client";
import { useEffect } from "react";

export default function ViewportFix() {
  useEffect(() => {
    const setZoom = () => {
      // ফোনের আসল প্রস্থ কত তা বের করা
      const screenWidth = window.screen.width;
      if (screenWidth < 1024) {
        const scale = screenWidth / 1024;
        const meta = document.querySelector('meta[name="viewport"]');
        if (meta) {
          // একদম নিখুঁত স্কেল সেট করা যাতে স্লাইড করতে না হয়
          meta.setAttribute("content", `width=1024, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=2.0, user-scalable=yes`);
        }
      }
    };

    setZoom();
    // স্ক্রিন রোটেট করলে যেন আবার ঠিক হয়
    window.addEventListener("orientationchange", () => setTimeout(setZoom, 200));
  }, []);

  return null;
}
