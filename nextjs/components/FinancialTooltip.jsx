"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

export const FINANCIAL_DEFINITIONS = {
  revenue: {
    title: "Total Revenue (মোট বিক্রি / টার্নওভার)",
    definition: "সফলভাবে সম্পন্ন হওয়া সমস্ত অর্ডারের মোট বিক্রয়মূল্য। স্টোরে কাস্টমারদের দেওয়া মূল টাকার সমষ্টি।",
  },
  cogs: {
    title: "COGS / Cost of Goods Sold (পণ্যের ক্রয় খরচ)",
    definition: "যেসব পণ্য বিক্রি হয়েছে, সেগুলো পাইকারি কেনা বা প্রস্তুত করতে আপনার সরাসরি যে মূলধন খরচ হয়েছিল।",
  },
  gross_profit: {
    title: "Gross Profit (মোট অর্জিত লাভ)",
    definition: "পণ্য বিক্রি করার পর পণ্যের মূল ক্রয় খরচ (COGS) বাদ দিলে আপনার কাছে যে মূল মুনাফা অবশিষ্ট থাকে।",
  },
  gross_margin: {
    title: "Gross Margin (মোট লাভের হার %)",
    definition: "মোট বিক্রির কত শতাংশ টাকা আপনার ব্যবসায়ে প্রকৃত লাভ বা মুনাফা হিসেবে থাকে।",
  },
  locked_capital: {
    title: "Stock Capital Locked (ইনভেন্টরিতে আটকে থাকা মূলধন)",
    definition: "বর্তমানে গুদামে অবিক্রীত স্টকের পেছনে আপনার যে পরিমাণ নগদ টাকা আটকে রয়েছে। এটি আপনার ব্যবসায়িক ওয়ার্কিং ক্যাপিটাল।",
  },
  potential_turnover: {
    title: "Potential Retail Turnover (সম্ভাব্য মোট বিক্রয়মূল্য)",
    definition: "বর্তমানে স্টকে থাকা সব পণ্য যদি বর্তমান রিটেল মূল্যে সম্পূর্ণ বিক্রি হয়ে যায়, তাহলে সর্বমোট কত টাকা ক্যাশ আসবে।",
  },
  potential_profit: {
    title: "Expected Catalog Profit (স্টক থেকে সম্ভাব্য মোট লাভ)",
    definition: "স্টকে থাকা সমস্ত পণ্য সম্পূর্ণ বিক্রি হলে ক্রয়মূল্য বাদ দিয়ে সর্বমোট কত টাকা নিট লাভ অর্জিত হতে পারে।",
  },
  discounts: {
    title: "Discounts & Returns (ছাড় ও রিটার্ন ক্ষতি)",
    definition: "গ্রাহকদের দেওয়া ক্যাম্পেইন বা অফার ছাড় এবং ফেরত আসা (RTO) পার্সেলের কারণে হওয়া কুরিয়ার ডেলিভারি ক্ষতি।",
  },
  unit_profit: {
    title: "Unit Profit (প্রতি পিসে একক লাভ)",
    definition: "একটি নির্দিষ্ট পণ্য ১ পিস বিক্রি করলে ক্রয় খরচ বাদ দিয়ে আপনার কাছে নিট কত টাকা লাভ থাকে।",
  },
  markup: {
    title: "Markup on Cost (মার্কআপ / ইনভেস্টমেন্টের উপর লাভ %)",
    definition: "ক্রয়মূল্যের কত শতাংশ বাড়িয়ে আপনি পণ্যটির বিক্রয়মূল্য নির্ধারণ করেছেন (ROI)।",
  },
  effective_price: {
    title: "Effective Selling Price (কার্যকরী বিক্রয়মূল্য)",
    definition: "কাস্টমার বাস্তবে যে মূল্যে পণ্যটি ক্রয় করেন (অফার বা সেল প্রাইস থাকলে সেটি, না থাকলে রেগুলার বেস প্রাইস)।",
  },
};

export default function FinancialTooltip({
  termKey,
  title,
  definition,
  children,
  align = "auto", // "auto" | "left" | "right" | "center"
  className = "",
  showIcon = true,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const preset = termKey ? FINANCIAL_DEFINITIONS[termKey] : null;
  const dTitle = title || preset?.title || "Financial Metric (আর্থিক তথ্য)";
  const dDef =
    definition ||
    preset?.definition ||
    "পণ্য ক্রয়-বিক্রয়ের তথ্যের ভিত্তিতে তৈরি করা হিসাব।";

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  // Determine horizontal alignment class
  const getAlignClass = () => {
    if (align === "left") return "left-0 translate-x-0";
    if (align === "right") return "right-0 translate-x-0";
    if (align === "center") return "left-1/2 -translate-x-1/2";
    // "auto": center by default, with mobile safe boundaries
    return "left-0 sm:left-1/2 sm:-translate-x-1/2";
  };

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center gap-1 group/ft cursor-pointer select-none ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((v) => !v);
      }}
    >
      <span className="border-b border-dotted border-slate-400 group-hover/ft:border-indigo-600 transition-colors">
        {children}
      </span>
      {showIcon && (
        <HelpCircle className="w-3.5 h-3.5 text-slate-400 group-hover/ft:text-indigo-600 transition-colors shrink-0" />
      )}

      {/* Popover Card */}
      {open && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-[999] bottom-full mb-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900/98 text-white p-3.5 sm:p-4 shadow-2xl backdrop-blur-xl border border-slate-700/80 text-xs animate-in fade-in zoom-in-95 duration-150 pointer-events-auto text-left font-sans normal-case tracking-normal ${getAlignClass()}`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
            <span className="font-black text-xs text-indigo-300 leading-snug">
              {dTitle}
            </span>
            <span className="text-[9px] uppercase tracking-wider font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-800/60 shrink-0">
              Metric
            </span>
          </div>

          {/* Bengali Definition */}
          <p className="mt-2 text-slate-200 leading-relaxed text-[11px] font-normal">
            {dDef}
          </p>

          {/* Mouse hover invisible bridge to prevent mouseleave gap */}
          <div className="absolute -bottom-3 inset-x-0 h-3" />
        </div>
      )}
    </span>
  );
}
