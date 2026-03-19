// /home/md-zubayer/newsmartagent/production/nextjs/app/(dashboard)/dashboard/docs/[id]/page.jsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { 
  Save, 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  List, 
  Undo, 
  Redo, 
  FileText,
  Menu,
  FilePlus,
  Trash2,
  X,
  List as ListIcon,
  Upload,
  Download,
  FileDown
} from "lucide-react";
import toast from "react-hot-toast";
import * as mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";
import { jsPDF } from "jspdf";

// Setup PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;


/* ================= FILE MENU MODAL ================= */
const FileMenu = ({ isOpen, onClose, onCreate, currentId }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef(null);
  const router = useRouter();

  const fetchFiles = async (reset = false) => {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    const newOffset = reset ? 0 : offset;
    try {
      const res = await api.get(`/embedding/documents/?limit=15&offset=${newOffset}`);
      const newFiles = res.data?.documents || [];
      if (reset) {
        setFiles(newFiles);
      } else {
        setFiles(prev => [...prev, ...newFiles]);
      }
      setOffset(newOffset + newFiles.length);
      setHasMore(res.data?.has_more || false);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles(true);
    }
  }, [isOpen]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      fetchFiles();
    }
  };

  const loadFile = (id) => {
    router.push(`/dashboard/docs/${id}`);
    onClose();
  };

  const onCreateNew = () => {
  window.location.href = '/dashboard/docs?new=true';
  onClose();
};

  const deleteFile = async (id, title) => {
    if(!confirm(`Delete Document '${title}'? This will remove it from the AI's knowledge.`)) return;
    try {
        await api.delete(`/embedding/documents/${id}/`);
        toast.success(`Deleted ${title}`);
        setFiles(prev => prev.filter(f => f.id !== id));
        if(currentId === id.toString()) router.push('/dashboard/docs');
    } catch(err) { 
        toast.error("Delete failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-md w-full max-w-lg rounded-2xl shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[80vh] m-4 relative">
        <div className="p-5 border-b flex justify-between items-center bg-[#2B579A] text-white shadow-sm">
          <h2 className="font-bold text-lg flex items-center gap-2"><ListIcon size={22}/> Document Manager</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-4 bg-slate-50/50 border-b border-slate-100">
           <button onClick={onCreate} className="w-full py-2.5 bg-[#2B579A] hover:bg-[#1f4278] text-white shadow-md rounded-xl flex items-center justify-center gap-2 transition-all font-semibold">
             <FilePlus size={20}/> Create New Document
           </button>
        </div>

        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar"
        >
           {files.map((doc, idx) => (
             <div key={doc.id} className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${currentId === doc.id.toString() ? "border-[#2B579A] bg-blue-50" : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"}`}>
               <div onClick={() => loadFile(doc.id)} className="flex-1 cursor-pointer">
                  <div className="font-semibold text-slate-800 text-sm group-hover:text-[#2B579A] transition-colors">{idx + 1}. {doc.title || "Untitled"}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{new Date(doc.created_at).toLocaleDateString()}</div>
               </div>
               <button onClick={() => deleteFile(doc.id, doc.title)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                  <Trash2 size={18}/>
               </button>
             </div>
           ))}
           {loading && <div className="text-center p-4 text-slate-500 font-medium animate-pulse text-sm">Loading more...</div>}
           {!loading && files.length === 0 && (
             <div className="text-center p-6 text-slate-500 font-medium">No documents found.</div>
           )}
        </div>
      </div>
    </div>
  );
};

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const [docTitle, setDocTitle] = useState("Untitled Document");
  const [loading, setLoading] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const fileInputRef = useRef(null);
  const [downloadDropdown, setDownloadDropdown] = useState(false);
  
  // Real multi-page state
  const [pages, setPages] = useState([""]);
  const docId = params?.id;
  const pageRefs = useRef([]);

  // Sync initial content to DOM refs when pages change (e.g. after upload or load)
  useEffect(() => {
    pages.forEach((content, idx) => {
      if (pageRefs.current[idx] && pageRefs.current[idx].innerText !== content) {
        pageRefs.current[idx].innerText = content;
      }
    });
  }, [pages]);

  useEffect(() => {
    if (docId) {
      loadDoc(docId);
    }
  }, [docId]);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
  };

  const loadDoc = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/embedding/documents/${id}/`);
      setDocTitle(res.data.title);
      const text = res.data.full_content || "";
      if (text) {
        const chunks = [];
        if (text.length > 0) {
          for (let i = 0; i < text.length; i += 3000) {
            chunks.push(text.substring(i, i + 3000));
          }
        } else {
          chunks.push("");
        }
        setPages(chunks);
      } else {
        setPages([""]);
      }
      toast.success("Document loaded");
    } catch (err) {
      toast.error("Failed to load document");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageInput = (index, e) => {
    // We DON'T update the state here to avoid re-render cursor jumps.
    // Instead, we just check for overflow to add a new page if needed.
    if (e.target.scrollHeight > 1150 && index === pages.length - 1) {
       setPages([...pages, ""]);
    }
  };

  const getFullContent = () => {
    return pageRefs.current.map(ref => ref?.innerText || "").join("\n\n");
  };

  const handleSave = async () => {
    const textContent = getFullContent();
    if (!textContent.trim()) {
      toast.error("Document is empty!");
      return;
    }

    setLoading(true);
    try {
      if (docId) {
        await api.put(`/embedding/documents/${docId}/`, {
          doc_title: docTitle,
          text: textContent,
        });
        toast.success("Saved and updated!");
      } else {
        const res = await api.post("/embedding/documents/", {
          doc_title: docTitle,
          text: textContent,
        });
        toast.success("New document created!");
        router.push(`/dashboard/docs/${res.data.id}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    
    try {
      let text = "";
      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(" ") + "\n\n";
        }
      }

      if (text) {
        const chunks = [];
        for (let i = 0; i < text.length; i += 3000) {
          chunks.push(text.substring(i, i + 3000));
        }
        setPages(chunks);
        setDocTitle(fileName);
        toast.success("File imported into pages");
      }
    } catch (error) {
      toast.error("Failed to process file");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const downloadAsPDF = () => {
    const doc = new jsPDF();
    const text = getFullContent();
    const splitText = doc.splitTextToSize(text, 180);
    let y = 20;
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(11);

    for (let i = 0; i < splitText.length; i++) {
        if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
        }
        doc.text(splitText[i], 10, y);
        y += 7;
    }
    doc.save(`${docTitle}.pdf`);
    setDownloadDropdown(false);
  };

  const downloadAsWord = () => {
    const text = getFullContent();
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${docTitle}</title></head>
      <body>${text.split('\n').map(line => `<p>${line}</p>`).join('')}</body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docTitle}.doc`;
    link.click();
    setDownloadDropdown(false);
  };

  const createNewDoc = () => {
    window.location.href = '/dashboard/docs?new=true';
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] md:min-h-[calc(100vh-80px)] bg-[#F3F2F1] text-gray-800 font-sans -m-4 relative text-xs md:text-base">
      <FileMenu isOpen={showFileMenu} onClose={() => setShowFileMenu(false)} onCreate={createNewDoc} currentId={docId} />
      
      {/* Header */}
      <div className="bg-[#2B579A] text-white px-4 py-2 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFileMenu(true)} className="p-1.5 hover:bg-white/20 rounded-md transition-colors mr-1">
             <Menu size={22} />
          </button>
          <div className="bg-white/20 p-1.5 rounded-md"><FileText size={20} /></div>
          <input
            type="text" value={docTitle} onChange={(e) => setDocTitle(e.target.value)}
            className="bg-transparent border-b border-transparent hover:border-white/50 focus:border-white outline-none text-sm md:text-lg font-medium px-1 placeholder-white/70 w-32 md:w-64 transition-colors text-white"
            placeholder="Document Title"
          />
        </div>
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx,.pdf" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
            <Upload size={16} /> <span className="hidden sm:inline">Upload</span>
          </button>
          
          <div className="relative">
            <button onClick={() => setDownloadDropdown(!downloadDropdown)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
              <Download size={16} /> <span className="hidden sm:inline">Download</span>
            </button>
            {downloadDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 animate-in fade-in slide-in-from-top-2">
                <button onClick={downloadAsPDF} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                  <FileDown size={16} className="text-red-500" /> Download as PDF
                </button>
                <button onClick={downloadAsWord} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" /> Download as Word
                </button>
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 bg-white text-[#2B579A] px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-gray-100 transition-colors shadow-sm disabled:opacity-70">
            <Save size={16} /> {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-2 md:px-4 py-2 flex flex-wrap items-center gap-2 md:gap-4 shadow-sm z-0">
        <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
          <ToolbarButton icon={<Undo size={16} />} onClick={() => execCommand('undo')} title="Undo" />
          <ToolbarButton icon={<Redo size={16} />} onClick={() => execCommand('redo')} title="Redo" />
        </div>
        <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
          <ToolbarButton icon={<Bold size={16} />} onClick={() => execCommand('bold')} title="Bold" />
          <ToolbarButton icon={<Italic size={16} />} onClick={() => execCommand('italic')} title="Italic" />
          <ToolbarButton icon={<Underline size={16} />} onClick={() => execCommand('underline')} title="Underline" />
        </div>
        <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
          <ToolbarButton icon={<AlignLeft size={16} />} onClick={() => execCommand('justifyLeft')} title="Align Left" />
          <ToolbarButton icon={<AlignCenter size={16} />} onClick={() => execCommand('justifyCenter')} title="Align Center" />
          <ToolbarButton icon={<AlignRight size={16} />} onClick={() => execCommand('justifyRight')} title="Align Right" />
        </div>
        <div className="flex items-center gap-1">
          <ToolbarButton icon={<List size={16} />} onClick={() => execCommand('insertUnorderedList')} title="Bullet List" />
        </div>
      </div>

      {/* Editor Pages */}
      <div className="flex-1 bg-[#F3F2F1] p-4 md:p-12 flex flex-col items-center gap-10 overflow-y-auto">
        {pages.map((_, idx) => (
          <div key={idx} className="relative group">
            <div 
              ref={el => pageRefs.current[idx] = el}
              className="bg-white w-[816px] min-h-[1056px] shadow-2xl border border-gray-300 p-[72px] text-gray-900 outline-none editor-page transition-all focus:border-[#2B579A]"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => handlePageInput(idx, e)}
              style={{
                fontFamily: "Calibri, Arial, sans-serif", 
                fontSize: "16px", 
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word"
              }}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain");
                document.execCommand("insertText", false, text);
              }}
            >
            </div>
            
            {/* Page Number */}
            <div className="absolute -bottom-8 left-0 right-0 text-center text-xs font-bold text-gray-500 bg-transparent py-2">
              - Page {idx + 1} -
            </div>

            {/* Remove Page Button (only if > 1 page) */}
            {pages.length > 1 && (
              <button 
                onClick={() => setPages(pages.filter((_, i) => i !== idx))}
                className="absolute -right-12 top-0 p-2 text-gray-400 hover:text-red-500 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove Page"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
        
        {/* Add Page Button */}
        <button 
          onClick={() => setPages([...pages, ""])}
          className="mb-10 px-6 py-2 bg-white text-[#2B579A] rounded-full shadow-md hover:bg-gray-50 font-semibold flex items-center gap-2 border border-gray-200 transition-all"
        >
          <FilePlus size={18} /> Add New Page
        </button>
      </div>

      <style jsx global>{`
        .editor-page:empty:before {
          content: 'Start typing here...';
          color: #9ca3af;
          pointer-events: none;
        }
        .editor-page:focus {
          box-shadow: 0 0 0 2px rgba(43, 87, 154, 0.2);
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({ icon, onClick, title }) {
  return (
    <button onClick={onClick} title={title} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors">
      {icon}
    </button>
  );
}
