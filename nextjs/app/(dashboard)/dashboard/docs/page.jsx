// /home/md-zubayer/newsmartagent/production/nextjs/app/(dashboard)/dashboard/docs/page.jsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
const FileMenu = ({ isOpen, onClose, currentId }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.get('/embedding/documents/')
         .then(res => setFiles(res.data?.documents || []))
         .catch(err => console.error("Failed to load documents", err))
         .finally(() => setLoading(false));
    }
  }, [isOpen]);

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
           <button onClick={onCreateNew} className="w-full py-2.5 bg-[#2B579A] hover:bg-[#1f4278] text-white shadow-md rounded-xl flex items-center justify-center gap-2 transition-all font-semibold">
             <FilePlus size={20}/> Create New Document
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
           {loading ? <div className="text-center p-6 text-slate-500 font-medium">Loading documents...</div> : 
             files.map((doc, idx) => (
               <div key={doc.id} className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${currentId === doc.id.toString() ? "border-[#2B579A] bg-blue-50" : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"}`}>
                 <div onClick={() => loadFile(doc.id)} className="flex-1 cursor-pointer">
                    <div className="font-semibold text-slate-800 text-sm group-hover:text-[#2B579A] transition-colors">{idx + 1}. {doc.title || "Untitled"}</div>
                 </div>
                 <button onClick={() => deleteFile(doc.id, doc.title)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                    <Trash2 size={18}/>
                 </button>
               </div>
             ))
           }
           {!loading && files.length === 0 && (
             <div className="text-center p-6 text-slate-500 font-medium">No documents found.</div>
           )}
        </div>
      </div>
    </div>
  );
};

export default function DocumentMain() {
  const router = useRouter();
  const [docTitle, setDocTitle] = useState("Untitled Document");
  const [loading, setLoading] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [downloadDropdown, setDownloadDropdown] = useState(false);

  // --- AUTO REDIRECT TO FIRST DOC (UNLESS CREATING NEW) ---
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const isNew = params.get('new') === 'true';

  if (isNew) {
    // নতুন ডকুমেন্ট মোড: এখানে কোনো রিডাইরেক্ট হবে না
    setDocTitle("Untitled Document");
    if (editorRef.current) editorRef.current.innerHTML = "";
    return; // এখানেই কাজ শেষ, নিচের api.get আর রান হবে না
  }

  // যদি নতুন ফাইল ক্রিয়েট করার কমান্ড না থাকে, তবেই পুরনো ফাইলে রিডাইরেক্ট হবে
  api.get('/embedding/documents/')
     .then(res => {
       if (res.data?.documents?.length > 0) {
         router.push(`/dashboard/docs/${res.data.documents[0].id}`);
       }
     })
     .catch(err => console.error("Initial load failed", err));
}, []); // রাউটার বা অন্য কিছুর ওপর ডিপেন্ডেন্সি দেবেন না

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const createNewDoc = () => {
    setDocTitle("Untitled Document");
    if (editorRef.current) editorRef.current.innerHTML = "";
    setShowFileMenu(false);
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
      const res = await api.post("/embedding/documents/", {
        doc_title: docTitle,
        text: textContent,
      });
      toast.success("New document created!");
      router.push(`/dashboard/docs/${res.data.id}`);
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
          editorRef.current.innerText = result.value;
        }
        toast.success("Word file imported");
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
          editorRef.current.innerText = fullText;
        }
        toast.success("PDF file imported");
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
    doc.text(splitText, 10, 10);
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] md:min-h-[calc(100vh-80px)] bg-[#F3F2F1] text-gray-800 font-sans -m-4 relative text-xs md:text-base">
      <FileMenu 
   isOpen={showFileMenu} 
   onClose={() => setShowFileMenu(false)}
   onCreate={createNewDoc} // এটি নিশ্চিত করুন
   currentId={null}
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

          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 bg-white text-[#2B579A] px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-gray-100 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {loading ? "Saving..." : "Save to Smart Agent"}
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

      <div className="flex-1 bg-[#F3F2F1] p-2 md:p-8 flex justify-center pb-20">
        <div 
          className="bg-white w-full max-w-[816px] min-h-[300px] md:min-h-[500px] shadow-lg border border-gray-200 p-6 md:p-12 text-gray-900 outline-none editor-canvas"
          style={{boxShadow: "0 4px 12px 0 rgba(0,0,0,0.1)", fontFamily: "Calibri, Arial, sans-serif", fontSize: "15px", lineHeight: "1.6"}}
          contentEditable
          suppressContentEditableWarning
          ref={editorRef}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
        >
        </div>
      </div>

      <style jsx global>{`
        .editor-canvas:empty:before {
          content: 'Start drafting your AI Knowledge Document here...';
          color: #9ca3af;
          pointer-events: none;
          display: block;
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