"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Spreadsheet from "app/(main)/components/Spreadsheet";
import CatalogHeaderNav from "../../../../../components/CatalogHeaderNav";
import { useAuth } from "@/context/AuthContext";

export default function SheetPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [activeSheetId, setActiveSheetId] = useState(null);

  useEffect(() => {
    setActiveSheetId(params?.id || user?.sheet_id || 1);
  }, [params, user]);

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col overflow-hidden bg-slate-50 p-2 sm:p-4">
      {/* Unified ChatGPT-style Nav Bar */}
      <CatalogHeaderNav
        activeTab="spreadsheet"
        sheetId={activeSheetId || user?.sheet_id || 1}
      />

      <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {activeSheetId ? (
          <Spreadsheet sheetId={activeSheetId} />
        ) : (
          <div className="flex h-full items-center justify-center bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
