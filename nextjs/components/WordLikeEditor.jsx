"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code,
  Undo2,
  Redo2,
  Eraser,
  Highlighter,
} from "lucide-react";

/**
 * WordLikeEditor
 * MS Word style WYSIWYG rich text editor for Product Descriptions.
 * Outputs clean, semantic HTML for web display while keeping the editing experience familiar.
 */
export default function WordLikeEditor({
  value = "",
  onChange,
  placeholder = "Write detailed product specifications, features, fabric, size guide, warranty...",
}) {
  const editorRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    ul: false,
    ol: false,
    h1: false,
    h2: false,
    h3: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
  });

  // Keep editor content in sync when value changes externally (e.g. initial load or form reset)
  useEffect(() => {
    if (!editorRef.current) return;
    const currentHTML = editorRef.current.innerHTML;
    const incoming = value || "";
    if (incoming !== currentHTML && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = incoming;
    }
  }, [value]);

  const updateActiveFormats = () => {
    if (typeof document === "undefined") return;
    try {
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
        h1: document.queryCommandValue("formatBlock") === "h1",
        h2: document.queryCommandValue("formatBlock") === "h2",
        h3: document.queryCommandValue("formatBlock") === "h3",
        justifyLeft: document.queryCommandState("justifyLeft"),
        justifyCenter: document.queryCommandState("justifyCenter"),
        justifyRight: document.queryCommandState("justifyRight"),
      });
    } catch {
      // queryCommandState may fail in unusual DOM edge cases
    }
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    // When editor is emptied, browser often leaves <br> or empty <p>
    if (html === "<p><br></p>" || html === "<br>" || html.trim() === "") {
      onChange?.("");
    } else {
      onChange?.(html);
    }
    updateActiveFormats();
  };

  const exec = (command, val = null) => {
    if (typeof document === "undefined" || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, val);
    handleInput();
  };

  const setHeading = (tag) => {
    if (typeof document === "undefined" || !editorRef.current) return;
    editorRef.current.focus();
    const current = document.queryCommandValue("formatBlock");
    if (current?.toLowerCase() === tag.toLowerCase()) {
      document.execCommand("formatBlock", false, "<p>");
    } else {
      document.execCommand("formatBlock", false, `<${tag}>`);
    }
    handleInput();
  };

  const clearFormatting = () => {
    if (typeof document === "undefined" || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand("removeFormat", false, null);
    document.execCommand("formatBlock", false, "<p>");
    handleInput();
  };

  return (
    <div
      className={`rounded-xl border transition-all ${isFocused
          ? "border-indigo-500 ring-2 ring-indigo-500/20"
          : "border-slate-200 bg-white"
        }`}
    >
      {/* MS Word style Ribbon / Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/90 p-1.5 text-slate-700">
        {/* History / Undo-Redo */}
        <div className="flex items-center">
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            onClick={() => exec("undo")}
            className="rounded p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y)"
            onClick={() => exec("redo")}
            className="rounded p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
          >
            <Redo2 size={14} />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Headings */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Heading 1"
            onClick={() => setHeading("h1")}
            className={`rounded px-2 py-1 text-xs font-bold transition-colors ${activeFormats.h1
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            H1
          </button>
          <button
            type="button"
            title="Heading 2"
            onClick={() => setHeading("h2")}
            className={`rounded px-2 py-1 text-xs font-bold transition-colors ${activeFormats.h2
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            H2
          </button>
          <button
            type="button"
            title="Heading 3"
            onClick={() => setHeading("h3")}
            className={`rounded px-2 py-1 text-xs font-bold transition-colors ${activeFormats.h3
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            H3
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Text Styling */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Bold (Ctrl+B)"
            onClick={() => exec("bold")}
            className={`rounded p-1.5 transition-colors ${activeFormats.bold
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            title="Italic (Ctrl+I)"
            onClick={() => exec("italic")}
            className={`rounded p-1.5 transition-colors ${activeFormats.italic
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            title="Underline (Ctrl+U)"
            onClick={() => exec("underline")}
            className={`rounded p-1.5 transition-colors ${activeFormats.underline
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            <Underline size={14} />
          </button>
          <button
            type="button"
            title="Strikethrough"
            onClick={() => exec("strikeThrough")}
            className={`rounded p-1.5 transition-colors ${activeFormats.strikeThrough
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            <Strikethrough size={14} />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Lists */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Bullet List (Unordered)"
            onClick={() => exec("insertUnorderedList")}
            className={`rounded p-1.5 transition-colors ${activeFormats.ul
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            <List size={14} />
          </button>
          <button
            type="button"
            title="Numbered List (Ordered)"
            onClick={() => exec("insertOrderedList")}
            className={`rounded p-1.5 transition-colors ${activeFormats.ol
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            <ListOrdered size={14} />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Alignments */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Align Left"
            onClick={() => exec("justifyLeft")}
            className={`rounded p-1.5 transition-colors ${activeFormats.justifyLeft
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            <AlignLeft size={14} />
          </button>
          <button
            type="button"
            title="Align Center"
            onClick={() => exec("justifyCenter")}
            className={`rounded p-1.5 transition-colors ${activeFormats.justifyCenter
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            <AlignCenter size={14} />
          </button>
          <button
            type="button"
            title="Align Right"
            onClick={() => exec("justifyRight")}
            className={`rounded p-1.5 transition-colors ${activeFormats.justifyRight
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-200 text-slate-700"
              }`}
          >
            <AlignRight size={14} />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Clear Format */}
        <button
          type="button"
          title="Clear Formatting"
          onClick={clearFormatting}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
        >
          <Eraser size={14} />
        </button>

        <span className="ml-auto text-[10px] font-medium text-slate-400 select-none hidden sm:inline">
          MS Word Editor
        </span>
      </div>

      {/* Editable Content Area */}
      <div className="relative">
        {(!value || value === "<p><br></p>" || value.trim() === "") && (
          <div
            onClick={() => editorRef.current?.focus()}
            className="pointer-events-none absolute left-3.5 top-3 select-none text-xs text-slate-400 font-normal leading-relaxed"
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => {
            setIsFocused(true);
            updateActiveFormats();
          }}
          onBlur={() => {
            setIsFocused(false);
            handleInput();
          }}
          onInput={handleInput}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          className="min-h-[140px] max-h-[420px] overflow-y-auto px-3.5 py-3 text-sm text-slate-800 outline-none leading-relaxed prose prose-sm max-w-none [&_h1]:text-lg [&_h1]:font-black [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_p]:my-1"
        />
      </div>
    </div>
  );
}
