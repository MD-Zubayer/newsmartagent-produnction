"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function MessengerButton() {
  const pathname = usePathname();
  const [isHidden, setIsHidden] = useState(false);

  // যদি ড্যাশবোর্ড পেজে বা সাইনআপ পেজে থাকেন, তবে এটি দেখাবে না
  if (!pathname || pathname.startsWith("/dashboard") || pathname.includes("/signup")) {
    return null;
  }

  const messengerLink = "https://www.messenger.com/t/947204378476536/";

  return (
    <AnimatePresence>
      {!isHidden && (
        <motion.div
          drag
          dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
          dragElastic={0.1}
          dragMomentum={false}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          dragTransition={{ power: 0.2, timeConstant: 200 }}
          className="fixed bottom-8 left-8 z-[9999] p-3 touch-none"
          style={{ cursor: 'grab' }}
        >
          {/* Close Button (X) - Visible on hover or active/touch */}
          <button 
            onClick={(e) => {
               e.preventDefault();
               e.stopPropagation();
               setIsHidden(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute -top-1 -left-1 w-8 h-8 bg-white rounded-full shadow-lg z-30 flex items-center justify-center border border-gray-100 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 hover:bg-gray-50 active:scale-90"
          >
            <X size={14} className="text-gray-500" />
          </button>

          <a 
            href={messengerLink}
            target="_blank" 
            rel="noopener noreferrer" 
            className="block"
          >
            {/* Smaller High Quality Gradient Background */}
            <div className="relative w-12 h-12 md:w-14 md:h-14 bg-gradient-to-tr from-[#00c6ff] to-[#0072ff] rounded-[1.25rem] md:rounded-[1.5rem] flex items-center justify-center text-white shadow-[0_15px_30px_rgba(0,114,255,0.3)] hover:shadow-[0_20px_40px_rgba(0,114,255,0.4)] transition-all duration-500">
              
              {/* Messenger High-Def SVG Icon (Scaled down) */}
              <svg 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                className="md:w-7 md:h-7"
                fill="currentColor" 
              >
                <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.9 1.17 5.53 3.1 7.42V22l2.72-1.49c1.3.36 2.7.57 4.18.57 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.14 12.37l-2.43-2.6-4.75 2.6 5.23-5.55 2.5 2.6 4.67-2.6-5.22 5.55z"/>
              </svg>

              {/* Status Indicator (Pulse effect) */}
              <div className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 border-[3px] border-white rounded-full">
                <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
              </div>
            </div>

            {/* Tooltip on the Right */}
            <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest whitespace-nowrap shadow-xl">
               Contact Us
            </div>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}