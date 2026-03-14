"use client";

import { useEffect } from "react";

export default function ViewportHandler() {
  useEffect(() => {
    // Force browser to recalculate layout/zoom
    const updateViewport = () => {
      const meta = document.querySelector('meta[name="viewport"]');
      if (meta) {
        meta.setAttribute("content", "width=1024, initial-scale=0.1, minimum-scale=0.1");
        
        // Very slight delay then set it to standard for desktop view
        setTimeout(() => {
          meta.setAttribute("content", "width=1024");
        }, 100);
      }
    };

    updateViewport();
    
    // Also handle window resize just in case
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return null;
}
