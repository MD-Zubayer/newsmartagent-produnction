"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Tag,
  Plus,
  X,
  Sparkles,
  SlidersHorizontal,
  Edit3,
  Check,
  ClipboardPaste,
  Cpu,
  Shirt,
  Info,
} from "lucide-react";
import { parseAttributesText, formatAttributesObject } from "@/app/(dashboard)/dashboard/products/page";

const ELECTRONICS_PRESETS = [
  { key: "Capacity", val: "20000mAh / 74Wh" },
  { key: "Max Output", val: "100W USB-C PD" },
  { key: "Ports", val: "2x Type-C, 2x USB-A" },
  { key: "Display", val: "Digital Status Screen" },
  { key: "Compatibility", val: "MacBook, Laptops, iPad, Smartphones" },
  { key: "Fast Charging", val: "QC 4.0 / PD 3.0" },
  { key: "Warranty", val: "1 Year Official Replacement" },
];

const FASHION_PRESETS = [
  { key: "Fabric", val: "100% Cotton" },
  { key: "Fit", val: "Regular Fit" },
  { key: "Pattern", val: "Solid" },
  { key: "Origin", val: "Bangladesh" },
  { key: "Care", val: "Machine Wash" },
  { key: "Gender", val: "Men" },
];

export default function GeneralAttributesEditor({
  value = "",
  onChange,
  className = "",
}) {
  const [smartInput, setSmartInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [valInput, setValInput] = useState("");
  const [isRawMode, setIsRawMode] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState("");
  const [presetCategory, setPresetCategory] = useState("electronics"); // 'electronics' | 'fashion'
  const smartInputRef = useRef(null);

  // Parse current attributes into an object
  const parsedAttributes = useMemo(() => {
    return parseAttributesText(value);
  }, [value]);

  const attributeEntries = useMemo(() => {
    return Object.entries(parsedAttributes);
  }, [parsedAttributes]);

  // Bulk import multiple parsed attributes
  const importParsedBlock = (textToParse) => {
    const parsed = parseAttributesText(textToParse);
    if (!parsed || Object.keys(parsed).length === 0) return 0;

    const updated = { ...parsedAttributes, ...parsed };
    onChange?.(formatAttributesObject(updated, "\n"));
    return Object.keys(parsed).length;
  };

  // Add or update a single attribute or formatted line (e.g., "Capacity: 20000mAh")
  const handleSmartSubmit = () => {
    const raw = smartInput.trim();
    if (!raw) return;

    // Check if it's multiline or has colon
    if (raw.includes(":") || raw.includes("\n")) {
      const count = importParsedBlock(raw);
      if (count > 0) {
        setSmartInput("");
        return;
      }
    }

    // If typed without colon, check if keyInput/valInput are used
    if (keyInput.trim() && valInput.trim()) {
      const updated = { ...parsedAttributes, [keyInput.trim()]: valInput.trim() };
      onChange?.(formatAttributesObject(updated, "\n"));
      setKeyInput("");
      setValInput("");
      return;
    }

    // If single word or term without colon
    if (raw) {
      const colonIdx = raw.indexOf(":");
      if (colonIdx > 0) {
        const k = raw.slice(0, colonIdx).trim();
        const v = raw.slice(colonIdx + 1).trim();
        if (k && v) {
          const updated = { ...parsedAttributes, [k]: v };
          onChange?.(formatAttributesObject(updated, "\n"));
          setSmartInput("");
        }
      } else {
        // Assume key and prompt for value
        setKeyInput(raw);
        setSmartInput("");
      }
    }
  };

  // Direct paste handler in the smart input
  const handleSmartPaste = (e) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText && (pastedText.includes("\n") || pastedText.includes(":"))) {
      const parsed = parseAttributesText(pastedText);
      const keys = Object.keys(parsed);
      if (keys.length > 0) {
        e.preventDefault();
        const updated = { ...parsedAttributes, ...parsed };
        onChange?.(formatAttributesObject(updated, "\n"));
        setSmartInput("");
      }
    }
  };

  // Handle Enter keypress in smart input
  const handleSmartKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSmartSubmit();
    }
  };

  // Add single key-value
  const handleAddAttribute = (keyToAdd, valToAdd) => {
    const k = (keyToAdd || keyInput).trim();
    const v = (valToAdd || valInput).trim();
    if (!k || !v) return;

    const updated = { ...parsedAttributes, [k]: v };
    onChange?.(formatAttributesObject(updated, "\n"));
    setKeyInput("");
    setValInput("");
  };

  // Remove an attribute by key
  const handleRemoveAttribute = (keyToRemove) => {
    const updated = { ...parsedAttributes };
    delete updated[keyToRemove];
    onChange?.(formatAttributesObject(updated, "\n"));
  };

  // Bulk Paste Import
  const handleExecuteBulkPaste = () => {
    const count = importParsedBlock(bulkPasteText);
    if (count > 0) {
      setBulkPasteText("");
      setShowBulkPaste(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 transition-all shadow-xs ${className}`}>
      {/* Header with Title and Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <SlidersHorizontal size={15} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">
              General Attributes & Specifications ({attributeEntries.length})
            </h4>
            <p className="text-[11px] text-slate-400">
              Type or paste specifications (e.g. Capacity: 20000mAh) and press Enter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowBulkPaste((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              showBulkPaste
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ClipboardPaste size={12} />
            {showBulkPaste ? "Close Spec Sheet" : "Paste Specs Block"}
          </button>

          <button
            type="button"
            onClick={() => setIsRawMode((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Edit3 size={11} />
            {isRawMode ? "Visual Chips" : "Raw Text"}
          </button>
        </div>
      </div>

      {/* Bulk Paste Specification Block Area */}
      {showBulkPaste && (
        <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5 animate-in fade-in">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
              <ClipboardPaste size={14} className="text-indigo-600" />
              <span>Paste Multi-line Specifications:</span>
            </div>
            <span className="text-[10px] text-indigo-600 font-medium">Format: Key: Value per line</span>
          </div>
          <textarea
            value={bulkPasteText}
            onChange={(e) => setBulkPasteText(e.target.value)}
            rows={5}
            placeholder={`Capacity: 20000mAh / 74Wh\nMax Output: 100W USB-C PD\nPorts: 2x Type-C, 2x USB-A\nDisplay: Digital Status Screen\nCompatibility: MacBook, Laptops, iPad, Smartphones`}
            className="w-full rounded-xl border border-indigo-200 bg-white p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200 font-mono"
          />
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Detected:{" "}
              <b className="text-indigo-700">
                {Object.keys(parseAttributesText(bulkPasteText)).length} specifications
              </b>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBulkPasteText("")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkPaste}
                disabled={!bulkPasteText.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40"
              >
                Import Specifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Text Input Mode */}
      {isRawMode ? (
        <div className="mt-3">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Raw Specifications Text (Key: Value per line or comma-separated)
          </label>
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            rows={4}
            placeholder={`Capacity: 20000mAh / 74Wh\nMax Output: 100W USB-C PD\nPorts: 2x Type-C, 2x USB-A\nDisplay: Digital Status Screen\nCompatibility: MacBook, Laptops, iPad, Smartphones`}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 font-mono leading-relaxed"
          />
        </div>
      ) : (
        /* Visual Chips Mode */
        <div className="mt-3 space-y-3">
          {/* Active Attribute Chips */}
          {attributeEntries.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {attributeEntries.map(([k, v]) => (
                <div
                  key={k}
                  className="group inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/60 pl-3 pr-2 py-1.5 text-xs transition-all hover:border-indigo-200 shadow-2xs"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    {k}
                  </span>
                  <span className="h-3.5 w-px bg-indigo-200/80" />
                  <span className="font-bold text-slate-800 text-xs">
                    {v}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(k)}
                    className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-white hover:text-rose-600 transition-colors"
                    title={`Remove ${k}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center">
              <p className="text-xs font-medium text-slate-600">
                No general specifications added yet.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Type <code className="bg-slate-200/60 px-1 py-0.5 rounded text-indigo-700 font-mono font-bold">Capacity: 20000mAh / 74Wh</code> and press Enter, or click presets below.
              </p>
            </div>
          )}

          {/* Smart Universal Input: Single Box that Auto-detects "Key: Value" */}
          <div className="flex items-center gap-2 pt-1">
            <div className="relative flex-1">
              <input
                ref={smartInputRef}
                type="text"
                placeholder="Type or paste (e.g. Capacity: 20000mAh / 74Wh) and press Enter..."
                value={smartInput}
                onChange={(e) => setSmartInput(e.target.value)}
                onKeyDown={handleSmartKeyDown}
                onPaste={handleSmartPaste}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800"
              />
            </div>
            <button
              type="button"
              onClick={handleSmartSubmit}
              disabled={!smartInput.trim()}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-40"
            >
              <Plus size={14} /> Add (Enter)
            </button>
          </div>

          {/* Quick Presets Bar with Category Filter */}
          <div className="border-t border-slate-100 pt-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Sparkles size={12} className="text-amber-500" />
                <span>Quick Presets:</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPresetCategory("electronics")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    presetCategory === "electronics"
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Cpu size={10} /> Electronics & Tech
                </button>
                <button
                  type="button"
                  onClick={() => setPresetCategory("fashion")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    presetCategory === "fashion"
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Shirt size={10} /> Fashion & Apparel
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(presetCategory === "electronics" ? ELECTRONICS_PRESETS : FASHION_PRESETS).map(
                (preset) => {
                  const isAlreadyPresent = Boolean(parsedAttributes[preset.key]);
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        if (!isAlreadyPresent) {
                          handleAddAttribute(preset.key, preset.val);
                        } else {
                          setSmartInput(`${preset.key}: ${parsedAttributes[preset.key] || preset.val}`);
                          smartInputRef.current?.focus();
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all ${
                        isAlreadyPresent
                          ? "bg-slate-100 text-slate-600 border border-slate-200"
                          : "bg-indigo-50/70 text-indigo-700 border border-indigo-200/60 hover:bg-indigo-100"
                      }`}
                    >
                      <span>{preset.key}:</span>
                      <span className="font-bold">{preset.val}</span>
                      {isAlreadyPresent ? (
                        <Check size={10} className="text-emerald-600 ml-0.5" />
                      ) : (
                        <Plus size={10} className="text-indigo-500 ml-0.5" />
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
