"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronRight, Check, X, Layers, Plus, Database, Sparkles, Loader2 } from "lucide-react";
import { FLAT_CATEGORIES, CATEGORY_TREE } from "@/app/lib/productCategories";
import api from "@/lib/api";

/**
 * Advanced Searchable Multi-Level Category Selector
 * Connects with PostgreSQL Database ProductCategory API (/datasheet/products/categories/)
 * Combines DB categories + standard retail taxonomy with instant search, suggestions, and custom creation.
 */
export default function AdvancedCategoryPicker({
  value = "",
  onChange,
  error = "",
  placeholder = "Select category or type to search...",
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("search"); // 'search' or 'browse'
  const [navPath, setNavPath] = useState([]); // for browse mode
  const [dbCategories, setDbCategories] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load database categories on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingDb(true);
    api
      .get("/datasheet/products/categories/")
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setDbCategories(list);
      })
      .catch((err) => {
        console.warn("Could not fetch categories from DB:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingDb(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced search for deep DB category suggestions
  useEffect(() => {
    const q = searchTerm.trim();
    if (!q || q.length < 2) return;

    const timer = setTimeout(() => {
      api
        .get(`/datasheet/products/categories/?search=${encodeURIComponent(q)}`)
        .then((res) => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setDbCategories((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              const newItems = res.data.filter((c) => !existingIds.has(c.id));
              return [...newItems, ...prev];
            });
          }
        })
        .catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Combine DB categories + static categories uniquely
  const allCategories = useMemo(() => {
    const seen = new Set();
    const list = [];

    // 1. DB Categories first
    dbCategories.forEach((cat) => {
      const path = (cat.full_path || cat.name || "").trim();
      if (path && !seen.has(path.toLowerCase())) {
        seen.add(path.toLowerCase());
        list.push({
          path,
          name: cat.name,
          isDb: true,
          isCustom: Boolean(cat.is_custom),
        });
      }
    });

    // 2. Static standard categories
    FLAT_CATEGORIES.forEach((catPath) => {
      const path = catPath.trim();
      if (path && !seen.has(path.toLowerCase())) {
        seen.add(path.toLowerCase());
        const parts = path.split(" > ");
        list.push({
          path,
          name: parts[parts.length - 1],
          isDb: false,
          isCustom: false,
        });
      }
    });

    return list;
  }, [dbCategories]);

  // Filtered categories based on search term
  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      return allCategories.slice(0, 50);
    }
    return allCategories
      .filter((cat) => cat.path.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.path.toLowerCase().startsWith(q) || a.name.toLowerCase().startsWith(q);
        const bStarts = b.path.toLowerCase().startsWith(q) || b.name.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        if (a.isCustom && !b.isCustom) return -1;
        if (!a.isCustom && b.isCustom) return 1;
        return 0;
      })
      .slice(0, 75);
  }, [searchTerm, allCategories]);

  const handleSelect = (categoryPath) => {
    onChange?.(categoryPath);
    setOpen(false);
    setSearchTerm("");
  };

  const handleCustomCategory = async () => {
    const term = searchTerm.trim();
    if (!term) return;

    setSavingCustom(true);
    try {
      const res = await api.post("/datasheet/products/categories/", {
        name: term,
        full_path: term,
      });
      if (res.data) {
        setDbCategories((prev) => [res.data, ...prev]);
      }
    } catch (err) {
      console.warn("Failed to persist custom category in DB:", err);
    } finally {
      setSavingCustom(false);
      onChange?.(term);
      setOpen(false);
      setSearchTerm("");
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.("");
    setSearchTerm("");
  };

  // Current level of children in browse mode
  const currentBrowseNodes = useMemo(() => {
    if (navPath.length === 0) return CATEGORY_TREE;
    return navPath[navPath.length - 1].children || [];
  }, [navPath]);

  // Parse category hierarchy for clean display without truncation
  const valueSegments = useMemo(() => {
    if (!value) return [];
    return value.split(" > ");
  }, [value]);

  const leafCategory = valueSegments.length > 0 ? valueSegments[valueSegments.length - 1] : "";
  const parentCategoryPath = valueSegments.length > 1 ? valueSegments.slice(0, -1).join(" › ") : "";

  return (
    <div className={`relative w-full ${open ? "z-30" : ""}`} ref={containerRef}>
      {/* Selected Box / Trigger */}
      <div
        onClick={() => {
          setOpen((prev) => !prev);
          setTimeout(() => searchInputRef.current?.focus(), 80);
        }}
        className={`flex min-h-[46px] cursor-pointer items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2 text-sm transition-all ${error
          ? "border-rose-300 ring-2 ring-rose-500/10"
          : open
            ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm"
            : "border-slate-200 hover:border-slate-300"
          }`}
      >
        <div className="flex flex-1 items-center min-w-0 pr-1">
          {value ? (
            <div className="flex flex-col min-w-0 w-full text-left">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-indigo-950 text-xs sm:text-sm">
                  {leafCategory}
                </span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 border border-indigo-200/60">
                  Subcategory
                </span>
              </div>
              {parentCategoryPath ? (
                <span
                  className="text-[11px] text-slate-400 font-medium truncate mt-0.5"
                  title={value}
                >
                  {parentCategoryPath}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-slate-400 font-normal text-xs sm:text-sm">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Clear selection"
            >
              <X size={14} />
            </button>
          )}
          <Search size={15} className="text-slate-400" />
        </div>
      </div>

      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full sm:min-w-[440px] max-w-[95vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95">
          {/* Header & Tabs */}
          <div className="border-b border-slate-100 bg-slate-50/90 p-2.5">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (activeTab !== "search") setActiveTab("search");
                }}
                placeholder="Search categories (e.g., Panjabi, Smartphone, T-Shirt, Audio)..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Toggle Modes & DB Status */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("search")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition-colors ${activeTab === "search"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  <Search size={11} /> Search ({filteredList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("browse")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition-colors ${activeTab === "browse"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  <Layers size={11} /> Browse Tree
                </button>
              </div>

              {searchTerm.trim() && (
                <button
                  type="button"
                  disabled={savingCustom}
                  onClick={handleCustomCategory}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingCustom ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Plus size={11} />
                  )}
                  Save &ldquo;{searchTerm.slice(0, 18)}&rdquo; to DB
                </button>
              )}
            </div>
          </div>

          {/* Tab 1: Search View (Flattened Path List) */}
          {activeTab === "search" && (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1.5">
              {filteredList.length > 0 ? (
                filteredList.map((catItem) => {
                  const categoryPath = catItem.path;
                  const isSelected = value === categoryPath;
                  const parts = categoryPath.split(" > ");
                  const leaf = parts[parts.length - 1];
                  const parentPath = parts.length > 1 ? parts.slice(0, -1).join(" › ") : "";

                  return (
                    <button
                      key={categoryPath}
                      type="button"
                      onClick={() => handleSelect(categoryPath)}
                      className={`group flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${isSelected
                        ? "bg-indigo-50/90 font-bold text-indigo-700 border border-indigo-200/60"
                        : "hover:bg-slate-50 text-slate-700"
                        }`}
                    >
                      <div className="flex flex-col flex-1 min-w-0 pr-1 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-xs sm:text-[13px] font-bold ${isSelected
                              ? "text-indigo-900"
                              : "text-slate-800 group-hover:text-indigo-600"
                              }`}
                          >
                            {leaf}
                          </span>
                          {isSelected && (
                            <span className="rounded bg-indigo-200/70 px-1.5 py-0.2 text-[9px] font-bold text-indigo-800">
                              Selected
                            </span>
                          )}
                        </div>
                        {parentPath && (
                          <span
                            className="text-[11px] text-slate-400 leading-tight mt-0.5 break-words line-clamp-1"
                            title={parentPath}
                          >
                            {parentPath}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {catItem.isCustom && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                            Custom
                          </span>
                        )}
                        {catItem.isDb && !catItem.isCustom && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                            DB
                          </span>
                        )}
                        {isSelected && <Check size={14} className="text-indigo-600" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-5 text-center">
                  <p className="text-xs text-slate-500">
                    No matching category found for &ldquo;{searchTerm}&rdquo;.
                  </p>
                  <button
                    type="button"
                    disabled={savingCustom}
                    onClick={handleCustomCategory}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                  >
                    {savingCustom ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plus size={13} />
                    )}
                    Add &ldquo;{searchTerm}&rdquo; as Custom Category in Database
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Hierarchy Tree Browser */}
          {activeTab === "browse" && (
            <div className="p-2.5">
              {/* Breadcrumb Bar */}
              <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-slate-100 pb-2 text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => setNavPath([])}
                  className="font-bold text-indigo-600 hover:underline"
                >
                  Root
                </button>
                {navPath.map((step, idx) => (
                  <React.Fragment key={step.name}>
                    <ChevronRight size={10} className="text-slate-300" />
                    <button
                      type="button"
                      onClick={() => setNavPath(navPath.slice(0, idx + 1))}
                      className={`hover:underline ${idx === navPath.length - 1 ? "font-bold text-slate-900" : "text-indigo-600"
                        }`}
                    >
                      {step.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Items in Current Level */}
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {currentBrowseNodes.map((node) => {
                  const isLeaf = typeof node === "string";
                  const name = isLeaf ? node : node.name;
                  const currentPath = [...navPath.map((p) => p.name), name].join(" > ");
                  const isSelected = value === currentPath;

                  return (
                    <div
                      key={name}
                      className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-colors ${isSelected
                        ? "bg-indigo-50 border border-indigo-200 font-bold text-indigo-700"
                        : "hover:bg-slate-50 text-slate-800"
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isLeaf) {
                            handleSelect(currentPath);
                          } else {
                            setNavPath([...navPath, node]);
                          }
                        }}
                        className="flex flex-1 items-center justify-between text-left pr-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className={isLeaf ? "font-bold text-slate-900 text-xs sm:text-[13px]" : "font-medium text-slate-700"}>
                            {name}
                          </span>
                          {isLeaf && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                              Final Subcategory
                            </span>
                          )}
                        </div>
                        {!isLeaf && <ChevronRight size={14} className="text-slate-400" />}
                      </button>

                      {/* If leaf, click directly selects. If intermediate, button to choose intermediate */}
                      {!isLeaf ? (
                        <button
                          type="button"
                          onClick={() => handleSelect(currentPath)}
                          className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                        >
                          Select Level
                        </button>
                      ) : (
                        isSelected && <Check size={14} className="text-indigo-600 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <Database size={11} className="text-indigo-500" />
              <span>{dbCategories.length} categories available in Database</span>
            </span>
            {value && (
              <span className="font-semibold text-indigo-600 truncate max-w-[200px]" title={value}>
                Selected: {leafCategory}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
