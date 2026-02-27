"use client";

import { usePathname } from "next/navigation";

export default function MessengerButton() {
  const pathname = usePathname();

  // যদি ড্যাশবোর্ড পেজে থাকেন, তবে এটি দেখাবে না
  if (!pathname || pathname.startsWith("/dashboard")) return null;

  // --- আপনার মেসেঞ্জার লিঙ্ক সেট করার নিয়ম ---
  // https://m.me/ YOUR_USERNAME
  // উদাহরণ: আপনার ফেসবুক ইউজারনেম যদি 'shanto.ai' হয়, তবে লিঙ্ক হবে 'https://m.me/shanto.ai'
  const messengerLink = "https://www.messenger.com/t/947204378476536/";

  return (
    <a 
      href={messengerLink}
      target="_blank" 
      rel="noopener noreferrer" 
      className="fixed bottom-8 left-8 z-[9999] group"
    >
      {/* High Quality Gradient Background */}
      <div className="relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-tr from-[#00c6ff] to-[#0072ff] rounded-[2rem] flex items-center justify-center text-white shadow-[0_20px_40px_rgba(0,114,255,0.4)] hover:scale-110 active:scale-95 transition-all duration-500 animate-bounce-slow">
        
        {/* Messenger High-Def SVG Icon */}
        <svg 
          viewBox="0 0 24 24" 
          width="36" 
          height="36" 
          fill="currentColor" 
          className="drop-shadow-md"
        >
          <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.9 1.17 5.53 3.1 7.42V22l2.72-1.49c1.3.36 2.7.57 4.18.57 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.14 12.37l-2.43-2.6-4.75 2.6 5.23-5.55 2.5 2.6 4.67-2.6-5.22 5.55z"/>
        </svg>

        {/* Status Indicator (Pulse effect) */}
        <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full">
          <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
        </div>
      </div>

      {/* Tooltip on the Right (since button is on the left) */}
      <div className="absolute left-24 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-[10px] font-black px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest whitespace-nowrap shadow-xl">
         Chat with us
      </div>
    </a>
  );
}