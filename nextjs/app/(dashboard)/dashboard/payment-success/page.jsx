"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Home } from "lucide-react";

export default function PaymentSuccessPage() {
  const [mounted, setMounted] = useState(false);
  const [transactionId] = useState(() => 
    `TRX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div 
        className={`max-w-md w-full bg-white dark:bg-gray-900/90 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 transform transition-all duration-700 ease-out ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <div className="p-8 sm:p-10 text-center flex flex-col items-center">
          {/* Animated checkmark circle */}
          <div className="w-24 h-24 bg-green-50 dark:bg-green-500/10 rounded-full flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 bg-green-400 dark:bg-green-500 rounded-full animate-ping opacity-20 duration-1000"></div>
            <div className="absolute inset-2 bg-green-100 dark:bg-green-500/20 rounded-full animate-pulse blur-sm"></div>
            <CheckCircle2 className="w-12 h-12 text-green-500 dark:text-green-400 z-10" />
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight">
            Payment Successful!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm sm:text-base leading-relaxed">
            Thank you for your purchase. We've successfully received your payment and your transaction is now complete.
          </p>

          <div className="w-full bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-6 mb-8 border border-gray-100 dark:border-gray-800/80">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">Transaction ID</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">
                {mounted ? transactionId : "TRX-........"}
              </span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">Date</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {mounted 
                  ? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : "Loading..."
                }
              </span>
            </div>
            <div className="flex justify-between items-center pt-4 mt-1 border-t border-gray-200 dark:border-gray-700/80">
              <span className="text-base font-medium text-gray-900 dark:text-white">Amount Paid</span>
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-teal-500 dark:from-green-400 dark:to-teal-300">
                $99.00
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Link 
              href="/dashboard" 
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl transition-all shadow-lg active:scale-[0.98]"
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link 
              href="/dashboard/history" 
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 font-medium rounded-xl transition-all border border-gray-200 dark:border-gray-700 active:scale-[0.98]"
            >
              <FileText className="w-4 h-4" />
              <span>History</span>
            </Link>
          </div>
        </div>
        
        {/* Bottom decorative bar */}
        <div className="h-2 w-full bg-gradient-to-r from-green-400 via-teal-400 to-emerald-400"></div>
      </div>
    </div>
  );
}
