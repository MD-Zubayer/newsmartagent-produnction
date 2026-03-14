"use client";
import { useEffect } from "react";
import { useDisplay } from "./DisplayContext";

export default function ViewportFix() {
  const { isDesktopMode, isMounted } = useDisplay();

  useEffect(() => {
    if (!isMounted) return;

    const setViewport = () => {
      const meta = document.querySelector('meta[name="viewport"]');
      if (!meta) return;

      if (isDesktopMode) {
        // Desktop Mode: Scale to fit 1024px
        const screenWidth = window.screen.width;
        const scale = screenWidth < 1024 ? screenWidth / 1024 : 1;
        meta.setAttribute("content", `width=1024, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=2.0`);
      } else {
        // Mobile Mode: Use standard device-width
        meta.setAttribute("content", "width=device-width, initial-scale=1");
      }
    };

    setViewport();
    window.addEventListener("orientationchange", () => setTimeout(setViewport, 200));
    window.addEventListener("resize", setViewport);
    
    return () => {
      window.removeEventListener("orientationchange", setViewport);
      window.removeEventListener("resize", setViewport);
    };
  }, [isDesktopMode, isMounted]);

  return null;
}
