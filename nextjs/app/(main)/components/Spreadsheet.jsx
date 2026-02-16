"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { FixedSizeGrid as Grid, FixedSizeList as List, areEqual } from "react-window";
import { useRouter } from "next/navigation"; // URL চেঞ্জ করার জন্য
import * as XLSX from "xlsx"; 
import api from "@/lib/api";
import {
  Save,
  Undo2,
  Redo2,
  Download,
  Moon,
  Sun,
  Star,
  ZoomIn,
  ZoomOut,
  Type,
  FileSpreadsheet,
  Plus,
  Upload,
  Bold,
  Menu,
  FilePlus,
  Trash2,
  X,
  List as ListIcon 
} from "lucide-react";

/* ================= CONFIG ================= */
const CELL_WIDTH = 210; 
const CELL_HEIGHT = 38; 
const ROW_HEADER_WIDTH = 50; 
const COL_HEADER_HEIGHT = 30; 

/* ================= HELPERS ================= */
const getColumnLabel = (n) => {
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};

const evaluateFormula = (value) => {
  if (typeof value === 'string' && value.startsWith('=')) {
    try {
      return Function(`"use strict"; return (${value.substring(1)})`)();
    } catch {
      return "#ERR";
    }
  }
  return value;
};

// রেঞ্জ চেক ফাংশন
const isInRange = (r, c, start, end) => {
  if (!start || !end) return false;
  const minR = Math.min(start.row, end.row);
  const maxR = Math.max(start.row, end.row);
  const minC = Math.min(start.col, end.col);
  const maxC = Math.max(start.col, end.col);
  return r >= minR && r <= maxR && c >= minC && c <= maxC;
};

/* ================= CUSTOM AUTO SIZER ================= */
const AutoSizer = ({ children }) => {
  const parentRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!parentRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    resizeObserver.observe(parentRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={parentRef} className="w-full h-full overflow-hidden">
      {size.width > 0 && size.height > 0 && children(size)}
    </div>
  );
};

/* ================= HEADERS COMPONENTS ================= */
const ColumnHeader = ({ index, style, data }) => {
  const { dark } = data;
  return (
    <div style={style} className={`border-r border-b flex items-center justify-center font-bold text-xs transition-colors select-none ${dark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-300 text-slate-600"}`}>
      {getColumnLabel(index)}
    </div>
  );
};

const RowHeader = ({ index, style, data }) => {
  const { dark } = data;
  return (
    <div style={style} className={`border-b border-r flex items-center justify-center font-bold text-xs transition-colors select-none ${dark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-300 text-slate-600"}`}>
      {index + 1}
    </div>
  );
};

/* ================= VIRTUAL CELL ================= */
const Cell = memo(({ columnIndex, rowIndex, style, data }) => {
  const { sheet, selection, handleMouseDown, handleMouseEnter, updateCell, dark, zoom, fontSize, fontFamily } = data;
  
  const cellKey = `${rowIndex}-${columnIndex}`;
  const rawValue = sheet?.data?.[cellKey] || "";
  const formatting = sheet?.formatting?.[cellKey] || {};
  
  const isStartCell = selection.start.row === rowIndex && selection.start.col === columnIndex;
  const inRange = isInRange(rowIndex, columnIndex, selection.start, selection.end);

  const isImportant = typeof rawValue === 'string' && rawValue.endsWith('*');
  const cleanValue = isImportant ? rawValue.slice(0, -1) : rawValue;
  const displayValue = isStartCell ? rawValue : evaluateFormula(cleanValue);

  return (
    <div
      style={{
        ...style,
        fontFamily: fontFamily,
        fontSize: `${fontSize * (zoom / 100)}px`,
        fontWeight: isImportant ? 'bold' : formatting.bold ? 'bold' : 'normal'
      }}
      className={`border-r border-b flex items-center transition-all duration-75 px-1 relative
        ${dark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-200 bg-white text-slate-700"} 
        ${inRange && !isStartCell ? (dark ? "bg-indigo-900/40" : "bg-indigo-50") : ""}
        ${isStartCell ? "ring-[2px] ring-indigo-500 z-20 shadow-lg rounded-sm" : ""} 
        ${inRange ? "border-indigo-200" : ""}
        ${isImportant && !inRange ? (dark ? "bg-red-900/30 text-red-300" : "bg-rose-50 text-rose-600") : ""}
      `}
      onMouseDown={(e) => handleMouseDown(rowIndex, columnIndex, e)}
      onMouseEnter={() => handleMouseEnter(rowIndex, columnIndex)}
    >
      <input
        className="w-full h-full bg-transparent outline-none px-1 cursor-text"
        style={{ textAlign: 'left' }}
        value={displayValue}
        onChange={(e) => updateCell(rowIndex, columnIndex, e.target.value)}
        readOnly={!isStartCell} 
      />
      {isImportant && !inRange && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
      )}
    </div>
  );
}, areEqual);

/* ================= FILE MENU MODAL ================= */
const FileMenu = ({ isOpen, onClose, onCreate, loadFile, deleteFile, currentId }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.get('/datasheet/spreadsheets/')
         .then(res => setFiles(res.data || []))
         .catch(err => console.error("Failed to load files", err))
         .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-600 text-white">
          <h2 className="font-bold flex items-center gap-2"><ListIcon size={20}/> File Manager</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded"><X size={18}/></button>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700">
           <button onClick={onCreate} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors font-medium">
             <FilePlus size={18}/> Create New Spreadsheet
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
           {loading ? <div className="text-center p-4 text-slate-500">Loading files...</div> : 
             files.map(file => (
               <div key={file.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${currentId === file.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300"}`}>
                 <div onClick={() => loadFile(file.id)} className="flex-1 cursor-pointer">
                    <div className="font-semibold text-slate-700 dark:text-slate-200">{file.title || "Untitled"}</div>
                    <div className="text-xs text-slate-400">{new Date(file.updated_at).toLocaleDateString()}</div>
                 </div>
                 <button onClick={() => deleteFile(file.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="Delete">
                    <Trash2 size={16}/>
                 </button>
               </div>
             ))
           }
        </div>
      </div>
    </div>
  );
};

/* ================= MAIN COMPONENT ================= */
export default function Spreadsheet({ sheetId: initialSheetId }) {
  const router = useRouter(); 
  
  const [sheetId, setSheetId] = useState(initialSheetId);
  const [sheet, setSheet] = useState({ 
    rows: 100, cols: 26, data: {}, formatting: {}, title: "Untitled", is_dark_mode: false 
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dark, setDark] = useState(false);
  
  // Selection & UI
  const [selection, setSelection] = useState({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
  const [isDragging, setIsDragging] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('Inter, sans-serif');
  const [history, setHistory] = useState([]);
  const [pointer, setPointer] = useState(-1);

  // Refs
  const gridRef = useRef(null);
  const colHeaderRef = useRef(null);
  const rowHeaderRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Auto Save Ref
  const sheetRef = useRef(sheet);
  useEffect(() => { sheetRef.current = sheet; }, [sheet]);

  /* ---------------- AUTO SAVE ON EXIT ---------------- */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sheetRef.current && sheetId) {
        const payload = JSON.stringify({ ...sheetRef.current, is_dark_mode: sheetRef.current.is_dark_mode });
        // NOTE: এই URL টি আপনার Backend API এর পাথ, Front end এর URL নয়
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/datasheet/spreadsheets/${sheetId}/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true 
        }).catch(err => console.error("Exit save failed", err));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      handleBeforeUnload(); 
    };
  }, [sheetId]);

  /* ---------------- INIT & FETCH ---------------- */
  const fetchSheet = useCallback(async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/datasheet/spreadsheets/${id}/`);
      const newData = {
          ...res.data,
          data: res.data.data || {},
          formatting: res.data.formatting || {} 
      };
      setSheet(newData);
      setDark(res.data.is_dark_mode || false);
      setHistory([JSON.stringify(newData)]);
      setPointer(0);
      setSheetId(id);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSheetId) {
        fetchSheet(initialSheetId);
    } else {
        setLoading(false);
    }
  }, [initialSheetId, fetchSheet]);

  /* ---------------- KEYBOARD SHORTCUTS ---------------- */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' && e.key !== 'Enter' && !e.ctrlKey) return; 

      const { row, col } = selection.start;
      
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const newR = Math.max(0, row - 1);
        setSelection({ start: { row: newR, col }, end: { row: newR, col } });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const newR = Math.min(sheet.rows - 1, row + 1);
        setSelection({ start: { row: newR, col }, end: { row: newR, col } });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const newC = Math.max(0, col - 1);
        setSelection({ start: { row, col: newC }, end: { row, col: newC } });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const newC = Math.min(sheet.cols - 1, col + 1);
        setSelection({ start: { row, col: newC }, end: { row, col: newC } });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.ctrlKey) {
            handleBulkEdit(); 
        } else {
            const newR = Math.min(sheet.rows - 1, row + 1);
            setSelection({ start: { row: newR, col }, end: { row: newR, col } });
        }
      } 
      else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleBold();
      }
      else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave(); 
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection, sheet]);

  /* ---------------- ACTIONS & LOGIC ---------------- */
  const handleManualSave = async () => {
    setSaving(true);
    try {
      await api.put(`/datasheet/spreadsheets/${sheetId}/`, { ...sheet, is_dark_mode: dark });
    } catch (err) { console.error(err); } 
    finally { setTimeout(() => setSaving(false), 800); }
  };

  const updateCell = useCallback((r, c, value) => {
    setSheet((prev) => ({ ...prev, data: { ...prev.data, [`${r}-${c}`]: value } }));
  }, []);

  const pushToHistory = (newState) => {
    const newHistory = history.slice(0, pointer + 1);
    newHistory.push(JSON.stringify(newState));
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setPointer(newHistory.length - 1);
    setSheet(newState);
  };

  const handleBulkEdit = () => {
    const { start, end } = selection;
    const activeValue = sheet.data[`${start.row}-${start.col}`] || "";
    const newData = { ...sheet.data };
    
    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        newData[`${r}-${c}`] = activeValue;
      }
    }
    pushToHistory({ ...sheet, data: newData });
  };

  const toggleBold = () => {
    const { start, end } = selection;
    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);

    const newFormatting = { ...sheet.formatting };
    const firstKey = `${start.row}-${start.col}`;
    const isCurrentlyBold = newFormatting[firstKey]?.bold;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = `${r}-${c}`;
        newFormatting[key] = { ...newFormatting[key], bold: !isCurrentlyBold };
      }
    }
    pushToHistory({ ...sheet, formatting: newFormatting });
  };

  const toggleImportant = () => {
    const key = `${selection.start.row}-${selection.start.col}`;
    let val = sheet.data[key] || "";
    val = val.endsWith("*") ? val.slice(0, -1) : val + "*";
    const newState = { ...sheet, data: { ...sheet.data, [key]: val } };
    pushToHistory(newState);
  };

  const addRow = () => pushToHistory({ ...sheet, rows: sheet.rows + 1 });
  const addCol = () => pushToHistory({ ...sheet, cols: sheet.cols + 1 });

  const undo = () => {
    if (pointer > 0) {
      setSheet(JSON.parse(history[pointer - 1]));
      setPointer(pointer - 1);
    }
  };
  const redo = () => {
    if (pointer < history.length - 1) {
      setSheet(JSON.parse(history[pointer + 1]));
      setPointer(pointer + 1);
    }
  };

  /* ---------------- FILE MANAGER (FIXED URL PATTERN) ---------------- */
  const createNewFile = async () => {
     try {
        const res = await api.post('/datasheet/spreadsheets/', { 
            title: "New Spreadsheet", rows: 100, cols: 26, data: {}, formatting: {} 
        });
        
        // FIX: আপনার সঠিক URL প্যাটার্ন '/dashboard/sheet/[id]' এখানে বসানো হলো
        router.push(`/dashboard/sheet/${res.data.id}`); 
        
        setShowFileMenu(false);
     } catch (err) { console.error("Create failed", err); }
  };

  const loadFile = (id) => {
     // FIX: লোড করার সময়ও একই প্যাটার্ন ব্যবহার করা হলো
     router.push(`/dashboard/sheet/${id}`);
     setShowFileMenu(false);
  };

  const deleteFile = async (id) => {
      if(!confirm("Delete this file?")) return;
      try {
          await api.delete(`/datasheet/spreadsheets/${id}/`);
          if(id === sheetId) window.location.reload(); 
          else {
            setShowFileMenu(false); 
          }
      } catch(err) { console.error("Delete failed", err); }
  };

  /* ---------------- MOUSE SELECTION ---------------- */
  const handleMouseDown = useCallback((row, col, e) => {
    if (e.shiftKey) {
        setSelection(prev => ({ ...prev, end: { row, col } }));
    } else {
        setIsDragging(true);
        setSelection({ start: { row, col }, end: { row, col } });
    }
  }, []);

  const handleMouseEnter = useCallback((row, col) => {
    if (isDragging) {
      setSelection(prev => ({ ...prev, end: { row, col } }));
    }
  }, [isDragging]);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  /* ---------------- IMPORT / EXPORT ---------------- */
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: "binary" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const currentData = sheet.data || {};
      let lastUsedRow = -1;
      Object.keys(currentData).forEach(key => {
        const [r] = key.split('-').map(Number);
        if (r > lastUsedRow) lastUsedRow = r;
      });
      const startRowIndex = lastUsedRow + 1;
      const mergedData = { ...currentData }; 
      let maxCols = sheet.cols;
      jsonData.forEach((row, rowIndex) => {
        if (row.length > maxCols) maxCols = row.length;
        row.forEach((cellValue, colIndex) => {
          if (cellValue !== undefined && cellValue !== null) {
            mergedData[`${startRowIndex + rowIndex}-${colIndex}`] = String(cellValue);
          }
        });
      });
      pushToHistory({
        ...sheet,
        data: mergedData,
        rows: Math.max(sheet.rows, startRowIndex + jsonData.length + 10),
        cols: Math.max(sheet.cols, maxCols + 5)
      });
      e.target.value = null; 
    };
    reader.readAsBinaryString(file);
  };

  const exportCSV = () => {
    let csv = "";
    for (let r = 0; r < sheet.rows; r++) {
      let row = [];
      for (let c = 0; c < sheet.cols; c++) {
        let val = sheet.data[`${r}-${c}`] || "";
        val = val.replace(/"/g, '""'); 
        row.push(`"${val}"`);
      }
      csv += row.join(",") + "\n";
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheet.title}.csv`;
    a.click();
  };

  const onGridScroll = ({ scrollLeft, scrollTop }) => {
    if (colHeaderRef.current) colHeaderRef.current.scrollTo(scrollLeft);
    if (rowHeaderRef.current) rowHeaderRef.current.scrollTo(scrollTop);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-pulse flex flex-col items-center gap-2">
        <FileSpreadsheet className="text-indigo-400" size={40} />
      </div>
    </div>
  );

  return (
    <div className={`h-screen flex flex-col font-sans selection:bg-indigo-200 selection:text-indigo-900 
      ${dark ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      
      <FileMenu 
         isOpen={showFileMenu} 
         onClose={() => setShowFileMenu(false)}
         onCreate={createNewFile}
         loadFile={loadFile}
         deleteFile={deleteFile}
         currentId={sheetId}
      />

      {/* TOP HEADER */}
      <div className={`h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 border-b transition-colors 
        ${dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFileMenu(true)} className="hover:bg-indigo-500 hover:text-white p-2 rounded-lg transition-colors">
             <Menu size={20} />
          </button>
          <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-lg text-white shadow-md">
            <FileSpreadsheet size={20} strokeWidth={1.5} />
          </div>
          <input 
            value={sheet.title} 
            onChange={(e) => setSheet({...sheet, title: e.target.value})}
            className={`font-bold text-base sm:text-lg bg-transparent outline-none w-32 sm:w-auto overflow-hidden text-ellipsis whitespace-nowrap 
              ${dark ? "text-slate-100 placeholder-slate-500" : "text-slate-800 placeholder-slate-300"}`}
            placeholder="Untitled"
          />
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setDark(!dark)} className={`p-2 rounded-full transition-all ${dark ? "bg-slate-700 hover:bg-slate-600 text-yellow-400" : "bg-slate-100 hover:bg-slate-200 text-slate-500"}`}>
                {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={handleManualSave} disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-5 py-2 rounded-lg text-sm font-medium shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Save size={18} />}
                <span className="hidden sm:inline">Save</span>
            </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className={`py-2 px-3 sm:px-6 flex items-center gap-4 border-b overflow-x-auto no-scrollbar whitespace-nowrap ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button onClick={undo} disabled={pointer <= 0} className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 disabled:opacity-30"><Undo2 size={16}/></button>
            <button onClick={redo} disabled={pointer >= history.length - 1} className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 disabled:opacity-30"><Redo2 size={16}/></button>
        </div>
        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-600 shrink-0"></div>
        <div className="flex items-center gap-2">
            <button onClick={toggleBold} className={`p-1.5 rounded-lg transition-colors ${sheet.formatting?.[`${selection.start.row}-${selection.start.col}`]?.bold ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                <Bold size={16}/>
            </button>
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <Type size={14} className="text-slate-400"/>
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="bg-transparent text-sm outline-none text-slate-700 dark:text-slate-200 w-20">
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="serif">Serif</option>
                </select>
            </div>
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                <button onClick={() => setFontSize(s => Math.max(10, s-1))} className="w-7 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300">-</button>
                <span className="w-7 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">{fontSize}</span>
                <button onClick={() => setFontSize(s => Math.min(30, s+1))} className="w-7 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300">+</button>
            </div>
        </div>
        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-600 shrink-0"></div>
        <div className="flex items-center gap-1">
             <button onClick={() => setZoom(z => Math.max(40, z - 10))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500"><ZoomOut size={16}/></button>
             <span className="text-xs font-medium w-9 text-center text-slate-600 dark:text-slate-300">{zoom}%</span>
             <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500"><ZoomIn size={16}/></button>
        </div>
        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-600 shrink-0"></div>
        <div className="flex items-center gap-2">
            <button onClick={addRow} className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"><Plus size={16} /> <span className="text-xs font-medium">Row</span></button>
            <button onClick={addCol} className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"><Plus size={16} /> <span className="text-xs font-medium">Col</span></button>
        </div>
        <div className="flex-1"></div>
        <div className="flex items-center gap-2">
            <button onClick={toggleImportant} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs sm:text-sm font-medium ${dark ? "bg-slate-700 border-slate-600 text-slate-300 hover:text-yellow-400" : "bg-white border-slate-200 text-slate-600 hover:border-rose-400 hover:text-rose-500"}`}>
                <Star size={14} className={sheet.data[`${selection.start.row}-${selection.start.col}`]?.endsWith('*') ? "fill-rose-500 text-rose-500" : ""} /> Important
            </button>
            <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current.click()} className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"><Upload size={16} /></button>
            <button onClick={exportCSV} className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"><Download size={16} /></button>
        </div>
      </div>

      {/* FORMULA BAR */}
      <div className={`py-1.5 px-3 sm:px-6 flex items-center gap-2 text-sm ${dark ? "bg-slate-800" : "bg-slate-50"}`}>
         <div className="w-8 h-6 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-500">
            {getColumnLabel(selection.start.col)}{selection.start.row + 1}
         </div>
         <input 
            className={`w-full h-8 px-3 rounded-md outline-none text-xs sm:text-sm transition-all ${dark ? "bg-slate-700 text-slate-200 focus:bg-slate-600" : "bg-white border border-slate-200 text-slate-700 focus:border-indigo-400"}`}
            value={sheet.data[`${selection.start.row}-${selection.start.col}`] || ""}
            onChange={(e) => updateCell(selection.start.row, selection.start.col, e.target.value)}
            onBlur={() => pushToHistory(sheet)}
            placeholder="Type value (Press Ctrl+Enter to fill range)..."
         />
      </div>

      {/* GRID */}
      <div className={`flex-1 w-full overflow-hidden relative flex flex-col ${dark ? "bg-slate-900" : "bg-white"}`}>
        <div className="flex-1 relative">
            <AutoSizer>
                {({ height, width }) => {
                    const scaledCellWidth = Math.floor(CELL_WIDTH * (zoom / 100));
                    const scaledCellHeight = Math.floor(CELL_HEIGHT * (zoom / 100));
                    return (
                        <div style={{ height, width, display: 'grid', gridTemplateColumns: `${ROW_HEADER_WIDTH}px 1fr`, gridTemplateRows: `${COL_HEADER_HEIGHT}px 1fr` }}>
                            <div className={`border-r border-b z-30 ${dark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"}`} />
                            <div className="overflow-hidden">
                                <List ref={colHeaderRef} layout="horizontal" height={COL_HEADER_HEIGHT} itemCount={sheet.cols} itemSize={scaledCellWidth} width={width - ROW_HEADER_WIDTH} className="no-scrollbar" itemData={{ dark, zoom, fontSize }}>
                                    {ColumnHeader}
                                </List>
                            </div>
                            <div className="overflow-hidden">
                                <List ref={rowHeaderRef} layout="vertical" height={height - COL_HEADER_HEIGHT} itemCount={sheet.rows} itemSize={scaledCellHeight} width={ROW_HEADER_WIDTH} className="no-scrollbar" itemData={{ dark, zoom, fontSize }}>
                                    {RowHeader}
                                </List>
                            </div>
                            <Grid ref={gridRef} className="no-scrollbar outline-none" columnCount={sheet.cols} columnWidth={scaledCellWidth} height={height - COL_HEADER_HEIGHT} rowCount={sheet.rows} rowHeight={scaledCellHeight} width={width - ROW_HEADER_WIDTH} itemData={{ sheet, selection, handleMouseDown, handleMouseEnter, updateCell, dark, zoom, fontSize, fontFamily }} onScroll={onGridScroll}>
                                {Cell}
                            </Grid>
                        </div>
                    );
                }}
            </AutoSizer>
        </div>
      </div>

      {/* FOOTER */}
      <div className={`h-6 border-t flex items-center justify-between px-4 text-[10px] font-medium uppercase select-none ${dark ? "bg-slate-800 border-slate-700 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
         <div className="flex gap-4">
            <span>{sheet.rows}R x {sheet.cols}C</span>
            <span>Selection: {getColumnLabel(selection.start.col)}{selection.start.row + 1}</span>
         </div>
         <div className="hidden sm:flex gap-2 items-center">
            <span className={`w-1.5 h-1.5 rounded-full ${saving ? "bg-yellow-500 animate-pulse" : "bg-emerald-500"}`}></span>
            <span>{saving ? "Saving..." : "Auto Save On"}</span>
         </div>
      </div>
    </div>
  );
}