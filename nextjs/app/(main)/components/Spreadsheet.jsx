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
  },[]);

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
    <div style={style} className={`border-r border-b flex items-center justify-center font-bold text-xs uppercase tracking-wider transition-colors select-none ${dark ? "bg-slate-900 border-slate-800 text-slate-500" : "bg-slate-50/80 backdrop-blur-sm border-slate-200 text-slate-500"}`}>
      {getColumnLabel(index)}
    </div>
  );
};

const RowHeader = ({ index, style, data }) => {
  const { dark } = data;
  return (
    <div style={style} className={`border-b border-r flex items-center justify-center font-bold text-xs transition-colors select-none ${dark ? "bg-slate-900 border-slate-800 text-slate-500" : "bg-slate-50/80 backdrop-blur-sm border-slate-200 text-slate-500"}`}>
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
      className={`border-r border-b flex items-center transition-all duration-100 px-1.5 relative group
        ${dark ? "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800/80" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50/80"} 
        ${inRange && !isStartCell ? (dark ? "bg-indigo-900/30" : "bg-indigo-50/70") : ""}
        ${isStartCell ? "ring-[2px] ring-indigo-500 z-20 shadow-[0_4px_12px_rgba(99,102,241,0.15)] rounded-sm" : ""} 
        ${inRange ? "border-indigo-300 dark:border-indigo-500/50" : ""}
        ${isImportant && !inRange ? (dark ? "bg-rose-900/10 text-rose-300" : "bg-rose-50/50 text-rose-600") : ""}
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
  const[files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.get('/datasheet/spreadsheets/')
         .then(res => setFiles(res.data ||[]))
         .catch(err => console.error("Failed to load files", err))
         .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md w-full max-w-lg rounded-2xl shadow-2xl border border-white/20 dark:border-slate-800/50 overflow-hidden flex flex-col max-h-[80vh] m-4 relative">
        <div className="p-5 border-b border-indigo-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm">
          <h2 className="font-bold text-lg flex items-center gap-2"><ListIcon size={22}/> File Manager</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
           <button onClick={onCreate} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20 rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] active:scale-[0.99] font-semibold">
             <FilePlus size={20}/> Create New Spreadsheet
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
           {loading ? <div className="text-center p-6 text-slate-500 dark:text-slate-400 font-medium">Loading files...</div> : 
             files.map(file => (
               <div key={file.id} className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${currentId === file.id ? "border-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/30 shadow-sm" : "border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 hover:shadow-sm"}`}>
                 <div onClick={() => loadFile(file.id)} className="flex-1 cursor-pointer">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{file.title || "Untitled"}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{new Date(file.updated_at).toLocaleDateString()}</div>
                 </div>
                 <button onClick={() => deleteFile(file.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                    <Trash2 size={18}/>
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
  const[saving, setSaving] = useState(false);
  const [dark, setDark] = useState(false);
  
  // Selection & UI
  const [selection, setSelection] = useState({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
  const [isDragging, setIsDragging] = useState(false);
  const[showFileMenu, setShowFileMenu] = useState(false);
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

  /* ---------------- FORCE DESKTOP MODE ON MOBILE ---------------- */
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    let originalContent = '';
    
    if (viewport) {
      originalContent = viewport.getAttribute('content');
      // ডেস্কটপের মতো দেখাতে উইডথ ১০২৪ পিক্সেল ফিক্সড করে দেওয়া হলো
      viewport.setAttribute('content', 'width=1024, user-scalable=yes'); 
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=1024, user-scalable=yes';
      document.head.appendChild(meta);
    }

    return () => {
      // কম্পোনেন্ট আনমাউন্ট হলে আগের ভিউপোর্ট ফিরিয়ে আনবে
      if (viewport && originalContent) {
        viewport.setAttribute('content', originalContent);
      }
    };
  },[]);

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
  },[]);

  useEffect(() => {
    if (initialSheetId) {
        fetchSheet(initialSheetId);
    } else {
        setLoading(false);
    }
  },[initialSheetId, fetchSheet]);

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
  },[]);

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
    const newState = { ...sheet, data: { ...sheet.data,[key]: val } };
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
  },[]);

  const handleMouseEnter = useCallback((row, col) => {
    if (isDragging) {
      setSelection(prev => ({ ...prev, end: { row, col } }));
    }
  }, [isDragging]);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  },[]);

  /* ---------------- IMPORT / EXPORT ---------------- */
  const pushImportedData = (jsonData) => {
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
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
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
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      // ---- Excel / CSV ----
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        pushImportedData(jsonData);
        e.target.value = null;
      };
      reader.readAsBinaryString(file);

    } else if (ext === 'pdf') {
      // ---- PDF ----
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const allRows = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          // Group items into rows by approximate Y position
          const lineMap = {};
          content.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!lineMap[y]) lineMap[y] = [];
            lineMap[y].push({ x: item.transform[4], text: item.str.trim() });
          });
          const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
          sortedYs.forEach(y => {
            const row = lineMap[y].sort((a, b) => a.x - b.x).map(i => i.text).filter(Boolean);
            if (row.length) allRows.push(row);
          });
        }
        pushImportedData(allRows);
      } catch (err) {
        console.error('PDF parse error:', err);
        alert('Could not parse PDF. Please ensure it contains selectable text.');
      }
      e.target.value = null;

    } else if (ext === 'docx') {
      // ---- Word (.docx) ----
      try {
        const mammoth = (await import('mammoth')).default;
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;
        // Parse <table> elements from HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tables = doc.querySelectorAll('table');
        const allRows = [];
        if (tables.length > 0) {
          tables.forEach(table => {
            table.querySelectorAll('tr').forEach(tr => {
              const row = [];
              tr.querySelectorAll('td, th').forEach(cell => row.push(cell.innerText?.trim() || ''));
              if (row.some(c => c)) allRows.push(row);
            });
            allRows.push([]); // blank separator row between tables
          });
        } else {
          // No tables — fall back to paragraph-per-row
          doc.querySelectorAll('p').forEach(p => {
            const text = p.innerText?.trim();
            if (text) allRows.push([text]);
          });
        }
        pushImportedData(allRows);
      } catch (err) {
        console.error('Word parse error:', err);
        alert('Could not read .docx file.');
      }
      e.target.value = null;

    } else {
      alert('Unsupported file type. Please use .xlsx, .xls, .csv, .pdf or .docx');
      e.target.value = null;
    }
  };

  const exportCSV = () => {
    let csv = "";
    for (let r = 0; r < sheet.rows; r++) {
      let row =[];
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
      <div className={`relative z-40 h-16 sm:h-[72px] flex items-center justify-between px-4 sm:px-6 border-b transition-all duration-300 
        ${dark ? "border-slate-800 bg-slate-900/80 backdrop-blur-lg" : "border-slate-200 bg-white/80 backdrop-blur-lg"}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowFileMenu(true)} className={`p-2.5 rounded-xl transition-all hover:shadow-md ${dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-indigo-50 text-slate-600 hover:text-indigo-600"}`}>
             <Menu size={22} />
          </button>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 sm:p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/30">
            <FileSpreadsheet size={24} strokeWidth={1.5} />
          </div>
          <div className="flex flex-col justify-center">
            <input 
              value={sheet.title} 
              onChange={(e) => setSheet({...sheet, title: e.target.value})}
              className={`font-bold outline-none w-40 sm:w-64 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent text-lg sm:text-xl transition-colors rounded-md px-1 -ml-1 hover:bg-black/5 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/50 
                ${dark ? "text-slate-100 placeholder-slate-600" : "text-slate-800 placeholder-slate-400"}`}
              placeholder="Untitled spreadsheet"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setDark(!dark)} className={`p-2.5 rounded-full transition-all duration-300 ${dark ? "bg-slate-800 hover:bg-slate-700 text-yellow-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" : "bg-slate-100 hover:bg-slate-200 text-slate-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"}`}>
                {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={handleManualSave} disabled={saving} className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 ${dark ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/50" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/30"} disabled:opacity-70 disabled:cursor-not-allowed`}>
                {saving ? <div className="w-[18px] h-[18px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin"/> : <Save size={18} strokeWidth={2.5} />}
                <span className="hidden sm:inline">Save</span>
            </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className={`relative z-30 py-2.5 px-4 sm:px-6 flex items-center gap-4 sm:gap-6 border-b overflow-x-auto no-scrollbar whitespace-nowrap shadow-sm transition-colors ${dark ? "bg-slate-800/80 border-slate-700/80 backdrop-blur" : "bg-slate-50/80 border-slate-200/80 backdrop-blur"}`}>
        <div className="flex items-center gap-1 bg-white/50 dark:bg-slate-900/50 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <button onClick={undo} disabled={pointer <= 0} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all"><Undo2 size={18}/></button>
            <button onClick={redo} disabled={pointer >= history.length - 1} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all"><Redo2 size={18}/></button>
        </div>
        <div className="h-8 w-[1px] bg-slate-300 dark:bg-slate-600 shrink-0"></div>
        <div className="flex items-center gap-2">
            <button onClick={toggleBold} className={`p-2 rounded-xl transition-all ${sheet.formatting?.[`${selection.start.row}-${selection.start.col}`]?.bold ? "bg-indigo-100 text-indigo-700 shadow-inner dark:bg-indigo-900/50 dark:text-indigo-300" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                <Bold size={18}/>
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white shadow-sm dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                <Type size={16} className="text-slate-400"/>
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="bg-transparent text-sm font-medium outline-none cursor-pointer text-slate-700 dark:text-slate-200 w-24">
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Mono</option>
                </select>
            </div>
            <div className="flex items-center bg-white shadow-sm dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                <button onClick={() => setFontSize(s => Math.max(10, s-1))} className="w-8 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium transition-colors">-</button>
                <span className="w-8 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">{fontSize}</span>
                <button onClick={() => setFontSize(s => Math.min(30, s+1))} className="w-8 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium transition-colors">+</button>
            </div>
        </div>
        <div className="h-8 w-[1px] bg-slate-300 dark:bg-slate-600 shrink-0 hidden sm:block"></div>
        <div className="hidden sm:flex items-center gap-1.5 bg-white shadow-sm dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
             <button onClick={() => setZoom(z => Math.max(40, z - 10))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"><ZoomOut size={16}/></button>
             <span className="text-xs font-semibold w-11 text-center text-slate-600 dark:text-slate-300">{zoom}%</span>
             <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"><ZoomIn size={16}/></button>
        </div>
        <div className="h-8 w-[1px] bg-slate-300 dark:bg-slate-600 shrink-0"></div>
        <div className="flex items-center gap-2">
            <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600"><Plus size={16} /> <span className="text-sm">Row</span></button>
            <button onClick={addCol} className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600"><Plus size={16} /> <span className="text-sm">Col</span></button>
        </div>
        <div className="flex-1"></div>
        <div className="flex items-center gap-3">
            <button onClick={toggleImportant} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-300 text-sm font-semibold shadow-sm ${dark ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-yellow-400 hover:border-slate-600" : "bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600 hover:shadow-rose-100"}`}>
                <Star size={16} className={sheet.data[`${selection.start.row}-${selection.start.col}`]?.endsWith('*') ? "fill-rose-500 text-rose-500 transform scale-110 transition-transform" : "transition-transform"} /> <span className="hidden lg:inline">Important</span>
            </button>
            <div className="h-8 w-[1px] bg-slate-300 dark:bg-slate-600 shrink-0"></div>
            <input type="file" accept=".xlsx,.xls,.csv,.pdf,.docx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current.click()} className="p-2.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-slate-200 dark:border-slate-700 transition-all shadow-sm group relative" title="Import File">
              <Upload size={18} className="group-hover:-translate-y-0.5 transition-transform" />
            </button>
            <button onClick={exportCSV} className="p-2.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-slate-200 dark:border-slate-700 transition-all shadow-sm group relative" title="Export CSV">
              <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
            </button>
        </div>
      </div>

      {/* FORMULA BAR */}
      <div className={`relative z-20 py-2 px-4 sm:px-6 flex items-center gap-3 text-sm shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] ${dark ? "bg-slate-800/95" : "bg-white"}`}>
         <div className="w-12 h-9 flex items-center justify-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-inner tracking-wider">
            {getColumnLabel(selection.start.col)}{selection.start.row + 1}
         </div>
         <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 shrink-0"></div>
         <div className="flex flex-1 items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 transition-colors focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 shadow-inner">
           <div className="text-slate-400 font-mono font-bold mr-2 saturate-50 select-none">fx</div>
           <input 
              className={`w-full h-10 bg-transparent outline-none text-sm transition-all text-slate-700 dark:text-slate-200 placeholder-slate-400 font-medium`}
              value={sheet.data[`${selection.start.row}-${selection.start.col}`] || ""}
              onChange={(e) => updateCell(selection.start.row, selection.start.col, e.target.value)}
              onBlur={() => pushToHistory(sheet)}
              placeholder="Type value or formula (Press Ctrl+Enter to fill range)..."
           />
         </div>
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
                            <Grid ref={gridRef} className="outline-none" columnCount={sheet.cols} columnWidth={scaledCellWidth} height={height - COL_HEADER_HEIGHT} rowCount={sheet.rows} rowHeight={scaledCellHeight} width={width - ROW_HEADER_WIDTH} itemData={{ sheet, selection, handleMouseDown, handleMouseEnter, updateCell, dark, zoom, fontSize, fontFamily }} onScroll={onGridScroll}>
                                {Cell}
                            </Grid>
                        </div>
                    );
                }}
            </AutoSizer>
        </div>
      </div>

      {/* FOOTER */}
      <div className={`h-8 border-t flex items-center justify-between px-4 sm:px-6 text-[11px] font-bold uppercase select-none tracking-wider z-20 ${dark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-500 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]"}`}>
         <div className="flex gap-6 items-center">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>{sheet.rows} Rows x {sheet.cols} Cols</span>
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>Selection: {getColumnLabel(selection.start.col)}{selection.start.row + 1}</span>
         </div>
         <div className="hidden sm:flex gap-2.5 items-center bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${saving ? "bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"}`}></span>
            <span className={saving ? "text-yellow-600 dark:text-yellow-400" : "text-emerald-600 dark:text-emerald-400"}>{saving ? "Saving Changes..." : "Auto Saved"}</span>
         </div>
      </div>
    </div>
  );
}