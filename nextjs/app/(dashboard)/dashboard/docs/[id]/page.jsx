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
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [downloadDropdown, setDownloadDropdown] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const docId = params?.id;

  useEffect(() => {
    if (docId) {
      loadDoc(docId);
    }
  }, [docId]);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const loadDoc = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/embedding/documents/${id}/`);
      setDocTitle(res.data.title);
      if (editorRef.current) {
          editorRef.current.innerText = res.data.full_content || ""; 
          updatePageCount();
      }
      toast.success("Document loaded");
    } catch (err) {
      toast.error("Failed to load document");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updatePageCount = () => {
    if (editorRef.current) {
      const height = editorRef.current.scrollHeight;
      const pages = Math.max(1, Math.ceil(height / 1123));
      setTotalPages(pages);
    }
  };

  const handleEditorScroll = () => {
    if (editorRef.current) {
        const scrollTop = editorRef.current.scrollTop;
        const page = Math.floor(scrollTop / 1123) + 1;
        setCurrentPage(page);
    }
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    const textContent = editorRef.current.innerText || "";
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
    setDocTitle(fileName);

    try {
      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (editorRef.current) {
          const currentContent = editorRef.current.innerText || "";
          editorRef.current.focus();
          document.execCommand('insertText', false, (currentContent.trim() ? "\n\n" : "") + result.value);
          
          if (!currentContent.trim() || docTitle === "Untitled Document") {
            setDocTitle(fileName);
          }
        }
        toast.success("Word file imported at cursor");
      } else if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(" ");
          fullText += pageText + "\n\n";
        }
        if (editorRef.current) {
          const currentContent = editorRef.current.innerText || "";
          editorRef.current.focus();
          document.execCommand('insertText', false, (currentContent.trim() ? "\n\n" : "") + fullText);
          if (!currentContent.trim() || docTitle === "Untitled Document") {
            setDocTitle(fileName);
          }
        }
        toast.success("PDF file imported at cursor");
      } else {
        toast.error("Unsupported file type. Please upload .docx or .pdf");
      }
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("Failed to process file");
    } finally {
      setLoading(false);
      e.target.value = ""; // Reset input
    }
  };

  const downloadAsPDF = () => {
    if (!editorRef.current) return;
    const doc = new jsPDF();
    const text = editorRef.current.innerText || "";
    const splitText = doc.splitTextToSize(text, 180);
    
    let y = 20;
    const margin = 10;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    for (let i = 0; i < splitText.length; i++) {
        if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
        }
        doc.text(splitText[i], margin, y);
        y += 7;
    }

    doc.save(`${docTitle}.pdf`);
    setDownloadDropdown(false);
  };

  const downloadAsWord = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || "";
    // Create a basic HTML structure for Word
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${docTitle}</title></head>
      <body style="font-family: Calibri, Arial, sans-serif;">
        ${text.split('\n').map(line => `<p>${line}</p>`).join('')}
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docTitle}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadDropdown(false);
  };

  const createNewDoc = () => {
  window.location.href = '/dashboard/docs?new=true';
};

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] md:min-h-[calc(100vh-80px)] bg-[#F3F2F1] text-gray-800 font-sans -m-4 relative text-xs md:text-base">
      <FileMenu 
   isOpen={showFileMenu} 
   onClose={() => setShowFileMenu(false)}
   onCreate={createNewDoc} // এটি নিশ্চিত করুন
   currentId={docId}
/>
      <div className="bg-[#2B579A] text-white px-4 py-2 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFileMenu(true)} className="p-1.5 hover:bg-white/20 rounded-md transition-colors mr-1">
             <Menu size={22} />
          </button>
          <div className="bg-white/20 p-1.5 rounded-md">
            <FileText size={20} />
          </div>
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="bg-transparent border-b border-transparent hover:border-white/50 focus:border-white outline-none text-sm md:text-lg font-medium px-1 placeholder-white/70 w-32 md:w-64 transition-colors text-white"
            placeholder="Document Title"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".docx,.pdf" 
            className="hidden" 
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            title="Upload Word or PDF"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">Upload</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setDownloadDropdown(!downloadDropdown)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              title="Download Document"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Download</span>
            </button>
            
            {downloadDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 animate-in fade-in slide-in-from-top-2">
                <button 
                  onClick={downloadAsPDF}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <FileDown size={16} className="text-red-500" />
                  Download as PDF
                </button>
                <button 
                  onClick={downloadAsWord}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <FileText size={16} className="text-blue-500" />
                  Download as Word
                </button>
              </div>
            )}
          </div>

          <span className="hidden sm:inline text-xs text-white/80 mr-4">AI Knowledge Base Document</span>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 bg-white text-[#2B579A] px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-gray-100 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-2 md:px-4 py-2 flex flex-wrap items-center gap-2 md:gap-4 shadow-sm z-0">
        <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
          <ToolbarButton icon={<Undo size={16} />} onClick={() => execCommand('undo')} title="Undo" />
          <ToolbarButton icon={<Redo size={16} />} onClick={() => execCommand('redo')} title="Redo" />
        </div>
        
        <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
          <select className="text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-[#2B579A] bg-white">
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
          </select>
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

      <div className="flex-1 bg-[#F3F2F1] p-2 md:p-8 flex flex-col items-center pb-20 overflow-y-auto" onScroll={handleEditorScroll}>
        <div 
  className="bg-white w-full max-w-[816px] min-h-[1123px] shadow-2xl border border-gray-300 p-12 text-gray-900 outline-none editor-canvas relative"
  style={{
    fontFamily: "Calibri, Arial, sans-serif", 
    fontSize: "16px", 
    lineHeight: "1.6",
    whiteSpace: "pre-wrap", 
    overflowWrap: "break-word",
    backgroundImage: "linear-gradient(to bottom, #ffffff 1123px, #E5E7EB 1123px, #E5E7EB 1163px, #ffffff 1163px)",
    backgroundSize: "100% 1163px",
    backgroundAttachment: "local"
  }}
  contentEditable
  suppressContentEditableWarning
  ref={editorRef}
  onInput={updatePageCount}
  onPaste={(e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }}
>
</div>
      </div>

      <div className="fixed bottom-4 right-4 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-gray-200 text-xs font-semibold text-gray-600 z-50">
        Page {currentPage} of {totalPages}
      </div>

      <style jsx global>{`
        .editor-canvas:empty:before {
          content: 'Start drafting your AI Knowledge Document here...';
          color: #9ca3af;
          white-space: pre-wrap;
          pointer-events: none;
          display: block;
        }
        .editor-canvas::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          pointer-events: none;
          background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 1123px, rgba(0,0,0,0.05) 1123px, rgba(0,0,0,0.05) 1124px, transparent 1124px, transparent 1163px);
          background-size: 100% 1163px;
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
