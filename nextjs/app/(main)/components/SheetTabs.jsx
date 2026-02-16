"use client";

import { FaPlus, FaTimes } from "react-icons/fa";

export default function SheetTabs({ sheets, activeSheetId, setActiveSheetId, addSheet, deleteSheet }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1 border border-gray-200/50 shadow-inner">
        {sheets.map((sheet) => (
          <div
            key={sheet.id}
            onClick={() => setActiveSheetId(sheet.id)}
            className={`flex items-center px-5 py-2 cursor-pointer gap-3 rounded-xl transition-all duration-300 ${
              sheet.id === activeSheetId 
              ? "bg-white text-indigo-600 shadow-md font-black" 
              : "text-gray-500 hover:bg-white/50 font-bold hover:text-gray-700"
            }`}
          >
            <span className="text-sm whitespace-nowrap">{sheet.name}</span>
            {sheets.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteSheet(sheet.id); }}
                className={`p-1 rounded-md transition-all ${sheet.id === activeSheetId ? "hover:bg-red-50 text-gray-300 hover:text-red-500" : "text-transparent group-hover:text-gray-300"}`}
              >
                <FaTimes className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button 
        onClick={addSheet} 
        className="p-3 bg-white border border-gray-200 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"
      >
        <FaPlus className="w-3 h-3" />
      </button>
    </div>
  );
}
