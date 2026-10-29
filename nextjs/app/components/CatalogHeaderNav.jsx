"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Package, Plus, TableProperties, Sparkles } from "lucide-react";

/**
 * Unified ChatGPT-style segmented toggle component.
 * Sleek, pill-shaped, dark/neutral background with smooth white active pill and subtle elevation.
 * Available options:
 *   - 'list'        : Products List (Mobile: List)
 *   - 'add'         : Add Product   (Mobile: Add)
 *   - 'spreadsheet' : Spreadsheet   (Mobile: Spreadsheet)
 */
export default function CatalogHeaderNav({
  activeTab = "list",
  onTabChange,
  sheetId,
  productCount = 0,
  isEditing = false,
  editingName = "",
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSelect = (tab) => {
    if (tab === "spreadsheet") {
      if (sheetId) {
        router.push(`/dashboard/sheet/${sheetId}`);
      }
      return;
    }
    if (tab === "list" || tab === "add") {
      if (pathname.startsWith("/dashboard/sheet/")) {
        router.push(`/dashboard/products${tab === "add" ? "?tab=add" : ""}`);
        return;
      }
      if (onTabChange) {
        onTabChange(tab);
      } else {
        router.push(`/dashboard/products${tab === "add" ? "?tab=add" : ""}`);
      }
    }
  };

  return (
    <div className="flex w-full items-center justify-center pb-4 pt-1 sm:pb-6">
      {/* ChatGPT-style Segmented Control */}
      <div className="inline-flex items-center rounded-full bg-[#f1f2f4] p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] border border-slate-200/60">
        {/* Tab 1: Products List */}
        <button
          type="button"
          onClick={() => handleSelect("list")}
          className={`relative flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 select-none ${
            activeTab === "list"
              ? "bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Package size={15} className={activeTab === "list" ? "text-indigo-600" : "text-slate-500"} />
          <span className="hidden sm:inline">Products List</span>
          <span className="sm:hidden">List</span>
          {productCount > 0 && (
            <span
              className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeTab === "list"
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {productCount}
            </span>
          )}
        </button>

        {/* Tab 2: Add Product */}
        <button
          type="button"
          onClick={() => handleSelect("add")}
          className={`relative flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 select-none ${
            activeTab === "add"
              ? "bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Plus size={15} className={activeTab === "add" ? "text-indigo-600" : "text-slate-500"} />
          <span className="hidden sm:inline">
            {isEditing ? (editingName ? `Edit: ${editingName.slice(0, 15)}...` : "Edit Product") : "Add Product"}
          </span>
          <span className="sm:hidden">{isEditing ? "Edit" : "Add"}</span>
        </button>

        {/* Tab 3: Spreadsheet */}
        <button
          type="button"
          onClick={() => handleSelect("spreadsheet")}
          disabled={!sheetId}
          className={`relative flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 select-none ${
            activeTab === "spreadsheet"
              ? "bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] font-bold"
              : "text-slate-600 hover:text-slate-900 disabled:opacity-40"
          }`}
        >
          <TableProperties size={15} className={activeTab === "spreadsheet" ? "text-indigo-600" : "text-slate-500"} />
          <span>Spreadsheet</span>
        </button>
      </div>
    </div>
  );
}

