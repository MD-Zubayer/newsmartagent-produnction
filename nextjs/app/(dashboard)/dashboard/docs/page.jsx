"use client";

import React, { useState, useRef } from "react";
import api from "@/lib/api";
import { 
  Save, 
  Type, 
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
  List as ListIcon
} from "lucide-react";
import toast from "react-hot-toast";

/* ================= FILE MENU MODAL ================= */
const FileMenu = ({ isOpen, onClose, onCreate, loadFile, deleteFile, currentId }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.get('/embedding/documents/')
         .then(res => setFiles(res.data?.documents || []))
         .catch(err => console.error("Failed to load documents", err))
         .finally(() => setLoading(false));
    }
  }, [isOpen]);

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

        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
           {loading ? <div className="text-center p-6 text-slate-500 font-medium">Loading documents...</div> : 
             files.map((doc) => (
               <div key={doc.id} className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${currentId === doc.id ? "border-[#2B579A] bg-blue-50" : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"}`}>
                 <div onClick={() => loadFile(doc.id)} className="flex-1 cursor-pointer">
                    <div className="font-semibold text-slate-800 text-sm group-hover:text-[#2B579A] transition-colors">{doc.title || "Untitled"}</div>
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

export default function DocumentEditor() {
  const [docId, setDocId] = useState(null);
  const [docTitle, setDocTitle] = useState("Untitled Document");
  const [loading, setLoading] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const editorRef = useRef(null);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const createNewDoc = () => {
    setDocId(null);
    setDocTitle("Untitled Document");
    if (editorRef.current) editorRef.current.innerHTML = "";
    setShowFileMenu(false);
  };

  // --- UPDATED LOAD FUNCTION ---
  const loadDoc = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/embedding/documents/${id}/`);
      setDocId(res.data.id);
      setDocTitle(res.data.title);
      if (editorRef.current) {
          // প্লেইন টেক্সট হিসেবে কন্টেন্ট লোড করা
          editorRef.current.innerText = res.data.full_text; 
      }
      setShowFileMenu(false);
      toast.success("Document loaded successfully");
    } catch (err) {
      toast.error("Failed to load document content");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteDoc = async (id, title) => {
    if(!confirm(`Delete Document '${title}'? This will remove it from the AI's knowledge.`)) return;
    try {
        await api.delete(`/embedding/documents/${id}/`);
        toast.success(`Deleted ${title}`);
        if(docId === id) createNewDoc();
        setShowFileMenu(false);
    } catch(err) { 
        toast.error("Delete failed");
    }
  };

  // --- UPDATED SAVE FUNCTION ---
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
        // UPDATE existing document
        const res = await api.put(`/embedding/documents/${docId}/`, {
          doc_title: docTitle,
          text: textContent,
        });
        toast.success(`Saved and updated! Generated ${res.data.chunks_saved} chunks.`);
      } else {
        // CREATE new document
        const res = await api.post("/embedding/documents/", {
          doc_title: docTitle,
          text: textContent,
        });
        setDocId(res.data.id);
        toast.success(`New document created! Generated ${res.data.chunks_saved} chunks.`);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save document.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[#F3F2F1] text-gray-800 font-sans -m-4 relative">
      <FileMenu 
         isOpen={showFileMenu} 
         onClose={() => setShowFileMenu(false)}
         onCreate={createNewDoc}
         loadFile={loadDoc}
         deleteFile={deleteDoc}
         currentId={docId}
      />
      {/* Top Ribbon (Microsoft Word Style) */}
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
            className="bg-transparent border-b border-transparent hover:border-white/50 focus:border-white outline-none text-lg font-medium px-1 placeholder-white/70 w-64 transition-colors text-white"
            placeholder="Document Title"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/80 mr-4">AI Knowledge Base Document</span>
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

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 shadow-sm z-0">
        <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
          <ToolbarButton icon={<Undo size={16} />} onClick={() => execCommand('undo')} title="Undo" />
          <ToolbarButton icon={<Redo size={16} />} onClick={() => execCommand('redo')} title="Redo" />
        </div>
        
        <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
          <select 
            className="text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-[#2B579A] hover:border-gray-400 bg-white"
            onChange={(e) => execCommand('fontName', e.target.value)}
          >
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
          </select>
          <select 
            className="text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-[#2B579A] hover:border-gray-400 w-16 bg-white"
            onChange={(e) => execCommand('fontSize', e.target.value)}
          >
            <option value="3">12</option>
            <option value="4">14</option>
            <option value="5">18</option>
            <option value="6">24</option>
            <option value="7">36</option>
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

      {/* Editor Canvas (A4 Paper Representation) */}
      <div className="flex-1 overflow-auto bg-[#F3F2F1] p-8 flex justify-center">
        <div 
          className="bg-white w-full max-w-[816px] min-h-[1056px] shadow-lg border border-gray-200 p-12 text-gray-900 outline-none editor-canvas"
          style={{
            boxShadow: "0 4px 12px 0 rgba(0,0,0,0.1), 0 0 1px 0 rgba(0,0,0,0.1)",
            fontFamily: "Calibri, Arial, sans-serif",
            fontSize: "15px",
            lineHeight: "1.6"
          }}
          contentEditable
          suppressContentEditableWarning
          ref={editorRef}
          onPaste={(e) => {
            // প্লেইন টেক্সট পেস্ট নিশ্চিত করা (ভেক্টর এমবেডিংয়ের জন্য ভালো)
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
        >
          {/* Start typing... */}
        </div>
      </div>

      <style jsx global>{`
        .editor-canvas:empty:before {
          content: 'Start drafting your AI Knowledge Document here. This text will be chunked and stored in the vector database...';
          color: #9ca3af;
          pointer-events: none;
          display: block; /* For Firefox */
        }
        .editor-canvas ul {
          list-style-type: disc;
          padding-left: 24px;
          margin-bottom: 12px;
        }
        .editor-canvas div {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({ icon, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors focus:bg-gray-200 focus:outline-none"
    >
      {icon}
    </button>
  );
}