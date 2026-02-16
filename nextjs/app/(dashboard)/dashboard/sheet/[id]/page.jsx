"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation"; // URL থেকে আইডি পাওয়ার জন্য
import Spreadsheet from "app/(main)/components/Spreadsheet";

export default function SheetPage() {
  const params = useParams();
  const [activeSheetId, setActiveSheetId] = useState(null);

  useEffect(() => {
    // URL-এ যদি আইডি থাকে তবে সেটি সেট করবে
    if (params?.id) {
      setActiveSheetId(params.id);
    } else {
      setActiveSheetId(1); // ডিফল্ট আইডি
    }
  }, [params]);

  return (
    <div className="h-screen bg-[#f8fafc] flex flex-col p-0 sm:p-4 overflow-hidden">
      {/* মোবাইলে টাইটেল হাইড করে স্পেস বাঁচানো যায় */}
      <h1 className="hidden sm:block text-xl font-black mb-3 px-2 text-slate-800 tracking-tight">
        Workspace / <span className="text-indigo-600">Spreadsheet</span>
      </h1>

      <div className="flex-1 border-none sm:border border-slate-200 rounded-none sm:rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/50">
        {activeSheetId ? (
          <Spreadsheet sheetId={activeSheetId} />
        ) : (
          <div className="h-full flex items-center justify-center bg-white">
             <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
}