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
  FileText 
} from "lucide-react";
import toast from "react-hot-toast";

export default function DocumentEditor() {
  const [docTitle, setDocTitle] = useState("Untitled Document");
  const [loading, setLoading] = useState(false);
  const editorRef = useRef(null);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    const textContent = editorRef.current.innerText || "";
    if (!textContent.trim()) {
      toast.error("Document is empty!");
      return;
    }

    setLoading(true);
    const savePromise = api.post("/embedding/document/", {
      doc_title: docTitle,
      text: textContent,
    });

    toast.promise(savePromise, {
      loading: "Saving and Embedding Document...",
      success: (res) => `Saved successfully! Generated ${res.data.chunks_saved} chunks.`,
      error: (err) => err.response?.data?.error || "Failed to save document.",
    });

    try {
      await savePromise;
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[#F3F2F1] text-gray-800 font-sans -m-4">
      {/* Top Ribbon (Microsoft Word Style) */}
      <div className="bg-[#2B579A] text-white px-4 py-2 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
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
            // Force plain text paste to keep vector clean OR allow basic formatting.
            // Allowed default for now.
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
