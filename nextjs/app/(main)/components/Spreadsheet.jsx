"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { FixedSizeGrid as Grid, FixedSizeList as List, areEqual } from "react-window";
import { useRouter } from "next/navigation"; // URL চেঞ্জ করার জন্য
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import api from "@/lib/api";
import ImageManagementModal from "./ImageManagementModal";
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
  List as ListIcon,
  Globe,
  User,
  Image as ImageIcon
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

const refusalCaptionTriggers = [
  'unable to provide',
  'unable to analyze',
  'unable to',
  "can't analyze",
  'cannot analyze',
  'cannot provide',
  'cannot assist',
  'sorry',
  "i'm unable",
  "i'm sorry",
  'cannot help',
  'not able to',
];

const isCaptionRefusal = (value) => {
  if (!value || typeof value !== 'string') return false;
  const lowerValue = value.toLowerCase();
  return refusalCaptionTriggers.some((phrase) => lowerValue.includes(phrase));
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
  const { sheet, selection, handleMouseDown, handleMouseEnter, updateCell, dark, zoom, fontSize, fontFamily, rowImageInputRef, setUploadRowTarget, handleRowImageDelete, setSelectedRowForImageModal, setIsImageModalOpen, setHoveredRow, captionRetrying, retryCaptionForRow } = data;
  const cellKey = `${rowIndex}-${columnIndex}`;
  const rawValue = sheet?.data?.[cellKey] || "";
  const formatting = sheet?.formatting?.[cellKey] || {};

  const isStartCell = selection.start.row === rowIndex && selection.start.col === columnIndex;
  const inRange = isInRange(rowIndex, columnIndex, selection.start, selection.end);

  const isImportant = typeof rawValue === 'string' && rawValue.endsWith('*');
  const cleanValue = isImportant ? rawValue.slice(0, -1) : rawValue;
  const isImageCell = columnIndex === 0 && rowIndex > 0;
  const isImageUrl = typeof rawValue === 'string' && /^(https?:\/\/|\/)/.test(rawValue);
  const displayValue = isImageCell && isImageUrl ? '' : (isStartCell ? rawValue : evaluateFormula(cleanValue));
  const rowImageUrl = sheet?.data?.[`${rowIndex}-0`] || '';
  const isCaptionColumn = columnIndex === 1 && rowIndex > 0;
  const isCaptionError = isCaptionColumn && isCaptionRefusal(displayValue);
  const isRetrying = captionRetrying?.[rowIndex];
  const isMessageCard = rowIndex > 0 && !isStartCell && !isImageCell && typeof cleanValue === 'string' && cleanValue.trim().length > 0;

  return (
    <div
      style={{
        ...style,
        fontFamily: fontFamily,
        fontSize: `${fontSize * (zoom / 100)}px`,
        fontWeight: isImportant ? 'bold' : formatting.bold ? 'bold' : 'normal'
      }}
      className={`border-r border-b flex items-center transition-colors duration-100 px-1.5 relative group overflow-hidden
        ${dark ? "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800/80" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50/80"} 
        ${inRange && !isStartCell ? (dark ? "bg-indigo-900/30" : "bg-indigo-50/70") : ""}
        ${isStartCell ? "ring-2 ring-inset ring-indigo-500 z-20 shadow-[inset_0_0_8px_rgba(99,102,241,0.2)]" : ""} 
        ${inRange ? "border-indigo-300 dark:border-indigo-500/50" : ""}
        ${isImportant && !inRange ? (dark ? "bg-rose-900/10 text-rose-300" : "bg-rose-50/50 text-rose-600") : ""}
      `}
      onMouseDown={(e) => handleMouseDown(rowIndex, columnIndex, e)}
      onMouseEnter={() => { handleMouseEnter(rowIndex, columnIndex); try { setHoveredRow && setHoveredRow(rowIndex); } catch (err) {} }}
      onMouseLeave={() => { try { setHoveredRow && setHoveredRow(null); } catch (err) {} }}
    >
      {isImageCell ? (
        <div className="relative w-full h-full overflow-hidden rounded-sm">
          {isImageUrl ? (
            <img
              src={rawValue}
              alt="Row image"
              className="absolute inset-0 w-full h-full object-cover opacity-95"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-100 dark:bg-slate-900 text-slate-400 text-xs">
             
              <button
                onClick={(ev) => { ev.stopPropagation(); setUploadRowTarget(rowIndex); rowImageInputRef.current && rowImageInputRef.current.click(); }}
                title="Upload image from device"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 text-[10px] font-semibold"
              >
                <Upload size={12} /> Upload
              </button>
            </div>
          )}
          {isImageUrl && (
            <div className="absolute top-1 right-1 flex items-center gap-1">
              <button
                onClick={(ev) => { ev.stopPropagation(); setUploadRowTarget(rowIndex); rowImageInputRef.current && rowImageInputRef.current.click(); }}
                title="Upload image from device"
                className="bg-white/90 dark:bg-black/70 p-1 rounded-md shadow-sm"
              >
                <Upload size={14} />
              </button>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelectedRowForImageModal(rowIndex);
                  setIsImageModalOpen(true);
                }}
                title="Open image modal"
                className="bg-white/90 dark:bg-black/70 p-1 rounded-md shadow-sm text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/70"
              >
                <ImageIcon size={14} />
              </button>
            </div>
          )}
          <div className="absolute inset-0 bg-slate-950/20 dark:bg-slate-950/30" />
          <input
            className={`w-full h-full bg-transparent outline-none px-1 relative text-xs ${!isStartCell ? 'pointer-events-none' : 'cursor-text'}`}
            style={{ textAlign: 'left' }}
            value={displayValue}
            onChange={(e) => updateCell(rowIndex, columnIndex, e.target.value)}
            readOnly={!isStartCell}
          />
        </div>
      ) : isMessageCard ? (
        <div className="w-full h-full px-2 py-2">
          <div className={`h-full w-full rounded-2xl border p-2 text-left shadow-sm transition-all ${dark ? 'border-slate-700 bg-slate-900/90 text-slate-200 shadow-black/10' : 'border-slate-200 bg-slate-50 text-slate-800 shadow-slate-200/80'}`}>
            <p className="whitespace-pre-wrap text-sm leading-5 overflow-hidden" style={{ wordBreak: 'break-word' }}>{displayValue}</p>
          </div>
        </div>
      ) : (
        <input
          className={`w-full h-full bg-transparent outline-none px-1 ${!isStartCell ? 'pointer-events-none' : 'cursor-text'}`}
          style={{ textAlign: 'left' }}
          value={displayValue}
          onChange={(e) => updateCell(rowIndex, columnIndex, e.target.value)}
          readOnly={!isStartCell}
        />
      )}
      {isImportant && !inRange && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
      )}
      {isCaptionError && (
        <div className="absolute top-1 right-1 flex items-center gap-1">
          <span className="rounded-full bg-rose-50 text-rose-700 text-[10px] px-2 py-0.5 border border-rose-200">Warning</span>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              if (rowImageUrl) retryCaptionForRow(rowIndex);
            }}
            disabled={!rowImageUrl || isRetrying}
            className="inline-flex items-center justify-center rounded-full bg-white/90 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold hover:bg-rose-100 disabled:opacity-50"
          >
            {isRetrying ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
      {isImageCell && !rawValue && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-slate-400">Image URL</div>
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
    rows: 100, cols: 26, data: {}, formatting: {}, title: "Untitled", is_dark_mode: false,
    scope: 'global', agent: null, auto_image_search: false
  });

  const [agents, setAgents] = useState([]);
  const [imageInputMode, setImageInputMode] = useState('url');
  const [imageInputUrl, setImageInputUrl] = useState('');
  const [uploadRowTarget, setUploadRowTarget] = useState(null);
  const [captionRetrying, setCaptionRetrying] = useState({});
  
  // 🖼️ Image Management Modal State
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedRowForImageModal, setSelectedRowForImageModal] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const rowImageInputRef = useRef(null);
  
  // Auto Save Ref
  const sheetRef = useRef(sheet);
  useEffect(() => { sheetRef.current = sheet; }, [sheet]);



  /* ---------------- FETCH AGENTS ---------------- */
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await api.get('/AgentAI/agents/');
        // We expect res.data to be the list of agents (AgentAIListSerializer)
        setAgents(res.data || []);
      } catch (err) {
        console.error("Failed to fetch agents", err);
      }
    };
    fetchAgents();
  }, []);

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
          keepalive: true,
          credentials: 'include' // 🔥 সেশ ককি পাঠানোর জন্য এটি বাধ্যতামূলক
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

  const uploadImageFileToRow = async (file, rowIndex) => {
    if (!file || rowIndex == null) return { imageUrl: null, caption: null };
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('row_index', String(rowIndex));
      const res = await api.post(`/datasheet/spreadsheets/${sheetId}/row-image/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return {
        imageUrl: res?.data?.image_url || null,
        caption: res?.data?.image_caption || ''
      };
    } catch (err) {
      console.error('Row image upload failed', err);
      alert('Image upload failed');
      return { imageUrl: null, caption: null };
    }
  };

  const handleRowImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || uploadRowTarget == null) return;

    const { imageUrl, caption } = await uploadImageFileToRow(file, uploadRowTarget);
    if (imageUrl) {
      const imageKey = `${uploadRowTarget}-0`;
      const captionKey = `${uploadRowTarget}-1`;
      const updatedData = { 
        ...sheet.data, 
        [imageKey]: imageUrl,
        [captionKey]: caption || ''
      };
      pushToHistory({ ...sheet, data: updatedData });
      await api.put(`/datasheet/spreadsheets/${sheetId}/`, { ...sheet, data: updatedData, is_dark_mode: dark });
    }

    e.target.value = null;
    setUploadRowTarget(null);
  };

  const handleToolbarUploadClick = (rowIndex) => {
    setUploadRowTarget(rowIndex);
    if (rowImageInputRef.current) rowImageInputRef.current.click();
  };

  const handleImageDrop = async (event, rowIndex) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file || rowIndex == null) return;
    const { imageUrl, caption } = await uploadImageFileToRow(file, rowIndex);
    if (imageUrl) {
      const imageKey = `${rowIndex}-0`;
      const captionKey = `${rowIndex}-1`;
      const updatedData = { 
        ...sheet.data, 
        [imageKey]: imageUrl,
        [captionKey]: caption || ''
      };
      pushToHistory({ ...sheet, data: updatedData });
      await api.put(`/datasheet/spreadsheets/${sheetId}/`, { ...sheet, data: updatedData, is_dark_mode: dark });
    }
  };

  const handleApplyImageUrl = async () => {
    if (!imageInputUrl) return;
    const rowIndex = Math.max(1, selection.start.row);
    const key = `${rowIndex}-0`;
    const updatedData = { ...sheet.data, [key]: imageInputUrl };
    pushToHistory({ ...sheet, data: updatedData });
    setImageInputUrl('');
    try {
      const res = await api.put(`/datasheet/spreadsheets/${sheetId}/row-image/`, { row_index: rowIndex, image_url: imageInputUrl, refresh_caption: true });
      const caption = res?.data?.image_caption || '';
      if (caption) {
        const captionKey = `${rowIndex}-1`;
        const withCaption = { ...updatedData, [captionKey]: caption };
        pushToHistory({ ...sheet, data: withCaption });
        await api.put(`/datasheet/spreadsheets/${sheetId}/`, { ...sheet, data: withCaption, is_dark_mode: dark });
      } else {
        await api.put(`/datasheet/spreadsheets/${sheetId}/`, { ...sheet, data: updatedData, is_dark_mode: dark });
      }
    } catch (err) {
      console.error('Failed to persist image URL', err);
    }
  };

  const handleRowImageDelete = async (rowIndex) => {
    if (rowIndex == null) return;
    if (!confirm(`Delete image for row ${rowIndex}?`)) return;
    try {
      // Server endpoint supports removing the row image for a given row index
      await api.delete(`/datasheet/spreadsheets/${sheetId}/row-image/`, { data: { row_index: rowIndex } });

      // Remove the image cell locally and persist sheet
      const key = `${rowIndex}-0`;
      const updatedData = { ...sheet.data };
      delete updatedData[key];
      pushToHistory({ ...sheet, data: updatedData });
      await api.put(`/datasheet/spreadsheets/${sheetId}/`, { ...sheet, data: updatedData, is_dark_mode: dark });
      toast.success('Row image deleted');
    } catch (err) {
      console.error('Failed to delete row image', err);
      toast.error('Failed to delete image');
    }
  };

  const retryCaptionForRow = async (rowIndex) => {
    if (rowIndex == null || !sheetId) return;
    const imageKey = `${rowIndex}-0`;
    const captionKey = `${rowIndex}-1`;
    const imageUrl = sheet.data[imageKey];

    if (!imageUrl) {
      toast.error('No product image found in Column A to refresh caption.');
      return;
    }

    setCaptionRetrying((prev) => ({ ...prev, [rowIndex]: true }));

    try {
      const res = await api.put(`/datasheet/spreadsheets/${sheetId}/row-image/`, {
        row_index: rowIndex,
        image_url: imageUrl,
        refresh_caption: true,
      });
      const newCaption = res?.data?.image_caption || '';
      const updatedData = { ...sheet.data, [captionKey]: newCaption };
      pushToHistory({ ...sheet, data: updatedData });
      await api.put(`/datasheet/spreadsheets/${sheetId}/`, { ...sheet, data: updatedData, is_dark_mode: dark });
      toast.success('Caption retried successfully');
    } catch (err) {
      console.error('Caption retry failed', err);
      toast.error('Failed to retry caption.');
    } finally {
      setCaptionRetrying((prev) => ({ ...prev, [rowIndex]: false }));
    }
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
      // ---- PDF (text-based, supports Unicode including Bangla) ----
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // Use locally hosted worker — avoids CDN version mismatch issues
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          // Improves Bangla / complex script rendering by disabling font hinting issues
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        });
        const pdf = await loadingTask.promise;
        const allRows = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent({
            includeMarkedContent: false,
            disableNormalization: false,  // normalize Unicode (helps Bangla)
          });

          // Group text items into visual rows by Y-position (top of page first)
          const lineMap = {};
          content.items.forEach(item => {
            if (!item.str) return;
            const y = Math.round(item.transform[5]);
            if (!lineMap[y]) lineMap[y] = [];
            lineMap[y].push({ x: item.transform[4], text: item.str });
          });

          // Sort Y descending (top of page first), then X ascending (left to right)
          const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
          sortedYs.forEach(y => {
            const cells = lineMap[y]
              .sort((a, b) => a.x - b.x)
              .map(i => i.text.trim())
              .filter(Boolean);
            if (cells.length > 0) allRows.push(cells);
          });
        }

        if (allRows.length === 0) {
          alert('No text found in this PDF.\n\nPossible reasons:\n• The PDF is a scanned image (not text)\n• The PDF uses custom/encrypted fonts\n\nTry converting it to Excel or CSV first.');
        } else {
          pushImportedData(allRows);
        }
      } catch (err) {
        console.error('PDF parse error:', err);
        alert(`PDF parsing failed: ${err.message || err}\n\nMake sure the file is a valid, non-encrypted PDF.`);
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

  const selectedRowIndex = Math.max(1, selection.start.row);
  const selectedRowImageUrl = sheet.data[`${selectedRowIndex}-0`] || "";
  const selectedRowHasImage = typeof selectedRowImageUrl === 'string' && selectedRowImageUrl.trim() !== '';

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-slate-50">
      <div className="animate-pulse flex flex-col items-center gap-2">
        <FileSpreadsheet className="text-indigo-400" size={40} />
      </div>
    </div>
  );

  return (
    <div className={`h-full flex flex-col font-sans selection:bg-indigo-200 selection:text-indigo-900 
      ${dark ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      
      <FileMenu 
         isOpen={showFileMenu} 
         onClose={() => setShowFileMenu(false)}
         onCreate={createNewFile}
         loadFile={loadFile}
         deleteFile={deleteFile}
         currentId={sheetId}
      />

      <input ref={rowImageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleRowImageFileChange} />

      {/* TOP HEADER */}
      <div className={`relative z-40 h-16 sm:h-[72px] flex items-center justify-between px-3 sm:px-6 border-b transition-all duration-300 
        ${dark ? "border-slate-800 bg-slate-900/80 backdrop-blur-lg" : "border-slate-200 bg-white/80 backdrop-blur-lg"}`}>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button onClick={() => setShowFileMenu(true)} className={`p-2 rounded-xl transition-all hover:shadow-md ${dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-indigo-50 text-slate-600 hover:text-indigo-600"}`}>
             <Menu size={20} />
          </button>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30 shrink-0">
            <FileSpreadsheet size={20} strokeWidth={1.5} />
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <input 
              value={sheet.title} 
              onChange={(e) => setSheet({...sheet, title: e.target.value})}
              className={`font-bold outline-none w-28 sm:w-64 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent text-sm sm:text-xl transition-colors rounded-md px-1 -ml-1 hover:bg-black/5 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/50 
                ${dark ? "text-slate-100 placeholder-slate-600" : "text-slate-800 placeholder-slate-400"}`}
              placeholder="Untitled spreadsheet"
            />
          </div>

          <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden lg:block"></div>

          {/* SCOPE SELECTOR */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
             <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setSheet({...sheet, scope: 'global', agent: null})}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sheet.scope === 'global' ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
                >
                  <Globe size={14} /> Global
                </button>
                <button 
                  onClick={() => setSheet({...sheet, scope: 'agent_specific'})}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sheet.scope === 'agent_specific' ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
                >
                  <User size={14} /> Agent Specific
                </button>
             </div>

             {sheet.scope === 'agent_specific' && (
                <div className="flex items-center gap-2 px-2 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                  <select 
                     value={sheet.agent || ""} 
                     onChange={(e) => setSheet({...sheet, agent: e.target.value || null})}
                     className="bg-transparent text-xs font-black text-purple-600 dark:text-purple-400 outline-none cursor-pointer max-w-[120px] truncate"
                  >
                     <option value="" className="text-slate-400">Select Agent...</option>
                     {agents.map(a => (
                       <option key={a.id} value={a.id} className="text-slate-800 font-sans">{a.name}</option>
                     ))}
                  </select>
                </div>
             )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button onClick={() => setDark(!dark)} className={`p-2 sm:p-2.5 rounded-full transition-all duration-300 ${dark ? "bg-slate-800 hover:bg-slate-700 text-yellow-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" : "bg-slate-100 hover:bg-slate-200 text-slate-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"}`}>
                {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <label className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${dark ? "bg-slate-800 text-slate-200 border border-slate-700" : "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                <input
                  type="checkbox"
                  checked={sheet.auto_image_search || false}
                  onChange={(e) => setSheet({...sheet, auto_image_search: e.target.checked})}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Auto Image Search
            </label>
            <button onClick={handleManualSave} disabled={saving} className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 ${dark ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/50" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/30"} disabled:opacity-70 disabled:cursor-not-allowed`}>
                {saving ? <div className="w-4 h-4 border-[2.5px] border-white/30 border-t-white rounded-full animate-spin"/> : <Save size={16} strokeWidth={2.5} />}
                <span className="hidden sm:inline">Save</span>
            </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className={`relative z-30 py-1 sm:py-2 px-2 sm:px-4 md:px-6 flex items-center gap-1 sm:gap-2 md:gap-4 border-b overflow-x-auto no-scrollbar whitespace-nowrap shadow-sm transition-colors ${dark ? "bg-slate-800/80 border-slate-700/80 backdrop-blur" : "bg-slate-50/80 border-slate-200/80 backdrop-blur"}`}>
        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 bg-white/50 dark:bg-slate-900/50 p-0.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
            <button onClick={undo} disabled={pointer <= 0} className="p-1 sm:p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all"><Undo2 size={14}/></button>
            <button onClick={redo} disabled={pointer >= history.length - 1} className="p-1 sm:p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all"><Redo2 size={14}/></button>
        </div>

        {/* Format - Hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1">
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 shrink-0"></div>
            <button onClick={toggleBold} className={`p-1 sm:p-1.5 rounded-lg transition-all ${sheet.formatting?.[`${selection.start.row}-${selection.start.col}`]?.bold ? "bg-indigo-100 text-indigo-700 shadow-inner dark:bg-indigo-900/50 dark:text-indigo-300" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                <Bold size={14}/>
            </button>
        </div>

        {/* Font Size - Compact on mobile */}
        <div className="flex items-center bg-white shadow-sm dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shrink-0">
            <button onClick={() => setFontSize(s => Math.max(10, s-1))} className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 font-medium transition-colors text-xs">-</button>
            <span className="w-4 sm:w-6 text-center text-[9px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200">{fontSize}</span>
            <button onClick={() => setFontSize(s => Math.min(30, s+1))} className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 font-medium transition-colors text-xs">+</button>
        </div>

        {/* Row/Col - Hidden on small mobile */}
        <div className="hidden sm:flex items-center gap-0.5">
            <button onClick={addRow} className="flex items-center gap-0.5 px-1.5 sm:px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition-all text-xs"><Plus size={13} /></button>
            <button onClick={addCol} className="flex items-center gap-0.5 px-1.5 sm:px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition-all text-xs"><Plus size={13} /></button>
        </div>

        {/* Flex spacer */}
        <div className="flex-1"></div>

        {/* Image Input - Mobile optimized */}
        <div className="hidden md:flex items-center gap-2 bg-white dark:bg-slate-900/75 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
            <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Image</div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
                <button onClick={() => setImageInputMode('device')} className={`px-2 py-0.5 rounded-md text-xs font-semibold transition ${imageInputMode === 'device' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Device</button>
                <button onClick={() => setImageInputMode('url')} className={`px-2 py-0.5 rounded-md text-xs font-semibold transition ${imageInputMode === 'url' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>URL</button>
            </div>
            {imageInputMode === 'url' ? (
                <input value={imageInputUrl} onChange={(e) => setImageInputUrl(e.target.value)} placeholder="Image URL" className="w-32 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-100 outline-none" />
            ) : (
                <button onClick={() => handleToolbarUploadClick(selectedRowIndex)} className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">Upload</button>
            )}
        </div>

        {/* Zoom - Hidden on small screens */}
        <div className="hidden md:flex items-center gap-1 bg-white shadow-sm dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shrink-0">
             <button onClick={() => setZoom(z => Math.max(40, z - 10))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"><ZoomOut size={14}/></button>
             <span className="text-xs font-semibold w-8 text-center text-slate-600 dark:text-slate-300">{zoom}%</span>
             <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"><ZoomIn size={14}/></button>
        </div>

        {/* 🖼️ Image Management Button */}
        <button
          onClick={() => {
            const r = (typeof hoveredRow === 'number' && hoveredRow !== null) ? hoveredRow : selection.start.row;
            setSelectedRowForImageModal(r);
            setIsImageModalOpen(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 transition-all shadow-sm text-xs font-semibold"
          title="Manage row images"
        >
          <ImageIcon size={14} />
          <span className="hidden sm:inline">Images</span>
        </button>

        {/* Import/Export */}
        <div className="flex items-center gap-1 shrink-0">
            <input type="file" accept=".xlsx,.xls,.csv,.pdf,.docx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current.click()} className="p-1.5 sm:p-2 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-all shadow-sm" title="Import">
              <Upload size={14} />
            </button>
            <button onClick={exportCSV} className="p-1.5 sm:p-2 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-all shadow-sm" title="Export">
              <Download size={14} />
            </button>
        </div>
      </div>

      {/* FORMULA BAR - Mobile Optimized */}
      <div className={`relative z-20 py-1 sm:py-1.5 px-2 sm:px-4 flex items-center gap-1.5 sm:gap-2 text-sm shadow-[0_2px_4px_-1px_rgba(0,0,0,0.05)] transition-colors ${dark ? "bg-slate-800/95" : "bg-white"}`}>
         <div className="w-9 sm:w-11 h-7 sm:h-8 flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-[9px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-inner tracking-widest">
            {getColumnLabel(selection.start.col)}{selection.start.row + 1}
         </div>
         <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>
         <div className="flex flex-1 items-center min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 sm:px-3 py-1 transition-colors focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-400 dark:focus-within:border-indigo-500">
           <div className="hidden sm:block text-slate-400 font-mono font-bold mr-2 saturate-50 select-none text-xs">fx</div>
           <input 
              className="w-full bg-transparent outline-none text-xs sm:text-sm transition-all text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 font-medium min-w-0"
              value={sheet.data[`${selection.start.row}-${selection.start.col}`] || ""}
              onChange={(e) => updateCell(selection.start.row, selection.start.col, e.target.value)}
              onBlur={() => pushToHistory(sheet)}
              placeholder="Type value..."
           />
         </div>
      </div>

      {/* GRID */}
      <div className={`flex-1 w-full overflow-hidden relative flex ${dark ? "bg-slate-900" : "bg-white"}`}>
        <div className="flex-1 relative">
            <AutoSizer>
                {({ height, width }) => {
                    // Mobile-responsive cell sizing
                    const isMobile = width < 768;
                    const isSmallMobile = width < 480;
                    const responsiveRowHeaderWidth = isMobile ? 40 : 50;
                    // Adjust cell width based on available space to minimize scrolling on mobile
                    const responsiveCellWidth = isSmallMobile ? 100 : (isMobile ? 140 : CELL_WIDTH);
                    const responsiveCellHeight = isMobile ? 32 : CELL_HEIGHT;
                    
                    const scaledCellWidth = Math.floor(responsiveCellWidth * (zoom / 100));
                    const scaledCellHeight = Math.floor(responsiveCellHeight * (zoom / 100));
                    
                    return (
                        <div style={{ height, width, display: 'grid', gridTemplateColumns: `${responsiveRowHeaderWidth}px 1fr`, gridTemplateRows: `${COL_HEADER_HEIGHT}px 1fr` }}>
                            <div className={`border-r border-b z-30 ${dark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"}`} />
                            <div className="overflow-hidden">
                                <List ref={colHeaderRef} layout="horizontal" height={COL_HEADER_HEIGHT} itemCount={sheet.cols} itemSize={scaledCellWidth} width={width - responsiveRowHeaderWidth} className="no-scrollbar !overflow-hidden" itemData={{ dark, zoom, fontSize }}>
                                    {ColumnHeader}
                                </List>
                            </div>
                            <div className="overflow-hidden">
                                <List ref={rowHeaderRef} layout="vertical" height={height - COL_HEADER_HEIGHT} itemCount={sheet.rows} itemSize={scaledCellHeight} width={responsiveRowHeaderWidth} className="no-scrollbar !overflow-hidden" itemData={{ dark, zoom, fontSize }}>
                                    {RowHeader}
                                </List>
                            </div>
                                <Grid ref={gridRef} className="outline-none custom-scrollbar" columnCount={sheet.cols} columnWidth={scaledCellWidth} height={height - COL_HEADER_HEIGHT} rowCount={sheet.rows} rowHeight={scaledCellHeight} width={width - responsiveRowHeaderWidth} itemData={{ sheet, selection, handleMouseDown, handleMouseEnter, updateCell, dark, zoom, fontSize, fontFamily, rowImageInputRef, setUploadRowTarget, handleRowImageDelete, setSelectedRowForImageModal, setIsImageModalOpen, setHoveredRow, captionRetrying, retryCaptionForRow }} onScroll={onGridScroll}>
                                {Cell}
                            </Grid>
                        </div>
                    );
                }}
            </AutoSizer>
        </div>
      </div>

      {/* FOOTER - Mobile Optimized */}
      <div className={`h-7 sm:h-8 border-t flex items-center justify-between px-2 sm:px-6 text-[8px] sm:text-[11px] font-bold uppercase select-none tracking-wider z-20 ${dark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-500 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]"}`}>
         <div className="flex gap-2 sm:gap-6 items-center min-w-0 overflow-hidden">
            <span className="flex items-center gap-1 shrink-0"><div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div><span className="hidden sm:inline">{sheet.rows}×{sheet.cols}</span><span className="sm:hidden">{sheet.rows}R</span></span>
            <span className="hidden sm:flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>Selection: {getColumnLabel(selection.start.col)}{selection.start.row + 1}</span>
         </div>
         <div className="flex gap-1.5 sm:gap-2.5 items-center shrink-0 bg-slate-100 dark:bg-slate-800 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${saving ? "bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"}`}></span>
            <span className={`text-[7px] sm:text-xs ${saving ? "text-yellow-600 dark:text-yellow-400" : "text-emerald-600 dark:text-emerald-400"}`}><span className="hidden sm:inline">{saving ? "Saving..." : "Saved"}</span><span className="sm:hidden">{saving ? "..." : "✓"}</span></span>
         </div>
      </div>

      {/* 🖼️ Image Management Modal */}
      <ImageManagementModal
        sheetId={sheetId}
        rowIndex={selectedRowForImageModal}
        fallbackRowImageUrl={selectedRowForImageModal !== null ? sheet.data[`${selectedRowForImageModal}-0`] : null}
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onPrimaryImageChanged={async (primaryImage) => {
          // Update cell with primary image URL when changed from modal
          if (selectedRowForImageModal === null) return;
          const key = `${selectedRowForImageModal}-0`;
          const updatedData = { ...sheet.data };
          if (primaryImage) {
            updatedData[key] = primaryImage.url;
          } else {
            delete updatedData[key];
          }
          const newSheet = { ...sheet, data: updatedData };
          pushToHistory(newSheet);
          try {
            await api.put(`/datasheet/spreadsheets/${sheetId}/`, { ...newSheet, is_dark_mode: dark });
          } catch (err) {
            console.error('Failed to persist sheet image update', err);
          }
        }}
      />
    </div>
  );
}