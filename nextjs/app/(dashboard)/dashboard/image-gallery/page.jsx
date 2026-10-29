"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CheckSquare,
  Clock,
  Cpu,
  ExternalLink,
  Eye,
  FileImage,
  Filter,
  Grid,
  ImagePlus,
  Info,
  Columns,
  Link2,
  List,
  Loader2,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Unlink,
  UploadCloud,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(Number(bytes))) return "—";
  const kb = Number(bytes) / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatVariantLabel(variant) {
  if (!variant) return "General Product Image";
  const attrs = Object.entries(variant.attributes || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return attrs || variant.sku || `Variant #${variant.id}`;
}

// --- Overview / Profit Style StatCard for Image Gallery ---
function GalleryStatCard({ title, value, icon, color, subValue, active, onClick }) {
  const colorPalettes = {
    blue: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.16)", glow: "#3b82f6" },
    purple: { color: "#a855f7", bg: "rgba(168, 85, 247, 0.08)", border: "rgba(168, 85, 247, 0.16)", glow: "#a855f7" },
    orange: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.16)", glow: "#f59e0b" },
    red: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.16)", glow: "#ef4444" },
    green: { color: "#10b981", bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.16)", glow: "#10b981" },
    indigo: { color: "#6366f1", bg: "rgba(99, 102, 241, 0.08)", border: "rgba(99, 102, 241, 0.16)", glow: "#6366f1" },
  };

  const palette = colorPalettes[color] || colorPalettes.indigo;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-1.5 sm:p-2 rounded-[1.75rem] sm:rounded-[2rem] w-full text-left transition-all duration-300 hover:-translate-y-1 group/card focus:outline-none ${
        active ? "scale-[1.02]" : ""
      }`}
      style={{
        background: `linear-gradient(145deg, ${palette.bg}, #ffffff)`,
        boxShadow: active
          ? `0 20px 40px -12px ${palette.glow}40, 0 0 0 2px ${palette.color}`
          : `0 18px 36px -15px ${palette.glow}25, 0 0 0 1px ${palette.border}`,
      }}
    >
      <div className="relative bg-white/95 backdrop-blur-2xl h-full rounded-[1.5rem] sm:rounded-[1.75rem] p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 border border-white shadow-xs transition-all duration-300 group-hover/card:bg-white group-hover/card:shadow-xl overflow-hidden">
        {/* Glow Orb in corner */}
        <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[1.75rem] overflow-hidden pointer-events-none">
          <div
            className="absolute -top-7 -right-7 w-20 h-20 rounded-full opacity-20 blur-xl transition-opacity duration-500 group-hover/card:opacity-45"
            style={{ background: palette.color }}
          />
        </div>

        {/* 3D Icon Box */}
        <div className="flex items-center justify-between relative z-10">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center text-base sm:text-lg shrink-0 transition-transform duration-500 group-hover/card:scale-105"
            style={{
              background: `linear-gradient(135deg, ${palette.bg}, #ffffff)`,
              border: `1px solid ${palette.border}`,
              boxShadow: `inset 0 3px 6px rgba(255,255,255,0.8), 0 6px 14px ${palette.glow}20`,
              color: palette.color,
            }}
          >
            {icon}
          </div>
          {active && (
            <span
              className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs"
              style={{ background: palette.bg, color: palette.color }}
            >
              Active
            </span>
          )}
        </div>

        {/* Text Details */}
        <div className="relative z-10 min-w-0">
          <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-0.5 text-slate-500 truncate">
            {title}
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-tight">
            {value}
          </p>
          {subValue && (
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center">
              <span className="text-[10px] font-bold text-slate-400 truncate">
                {subValue}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function ImageGalleryPageContent() {
  const { user: authUser } = useAuth();
  const isStaff = Boolean(authUser?.is_staff || authUser?.is_superuser);
  const router = useRouter();
  const searchParams = useSearchParams();
  const productParam = searchParams?.get("product") || "";

  const [assets, setAssets] = useState([]);
  const [products, setProducts] = useState([]);
  const [embedSummary, setEmbedSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Filters & view state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | ready | pending | processing | failed | linked | unlinked
  const [productFilter, setProductFilter] = useState(productParam || "all");
  const [view, setView] = useState("grid"); // grid | masonry | list
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeAssetId, setActiveAssetId] = useState(null);

  // Linking state
  const [linkModalAsset, setLinkModalAsset] = useState(null);
  const [targetProductId, setTargetProductId] = useState(productParam || "");
  const [targetVariantId, setTargetVariantId] = useState("");
  const [busy, setBusy] = useState(false);

  // Embedding state
  const [embeddingBusy, setEmbeddingBusy] = useState(false);
  const [showErrorLogs, setShowErrorLogs] = useState(false);

  // Edit alt/caption state
  const [editDraft, setEditDraft] = useState({ filename: "", alt_text: "", image_caption: "" });
  const [savingDetails, setSavingDetails] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [assetsRes, productsRes, embedRes] = await Promise.all([
        api.get("/datasheet/product-image-library/"),
        api.get("/datasheet/products/"),
        api.get("/datasheet/product-image-library/embed/"),
      ]);
      const assetList = assetsRes.data || [];
      setAssets(assetList);
      setProducts(productsRes.data || []);
      setEmbedSummary(embedRes.data || null);
      if (!activeAssetId && assetList.length > 0) {
        setActiveAssetId(assetList[0].id);
      }
    } catch {
      toast.error("Gallery could not be loaded");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (productParam) {
      setProductFilter(productParam);
      setTargetProductId(productParam);
    }
  }, [productParam]);

  const activeAsset = useMemo(
    () => assets.find((a) => a.id === activeAssetId) || null,
    [assets, activeAssetId]
  );

  useEffect(() => {
    if (activeAsset) {
      setEditDraft({
        filename: activeAsset.filename || "",
        alt_text: activeAsset.alt_text || "",
        image_caption: activeAsset.image_caption || "",
      });
    }
  }, [activeAsset]);

  // Computed embedding counts
  const stats = useMemo(() => {
    const counts = {
      total: assets.length,
      pending: assets.filter((a) => a.processing_status === "pending").length,
      processing: assets.filter((a) => a.processing_status === "processing").length,
      ready: assets.filter((a) => a.processing_status === "ready").length,
      failed: assets.filter((a) => a.processing_status === "failed").length,
      linked: assets.filter((a) => (a.links || []).length > 0).length,
      unlinked: assets.filter((a) => (a.links || []).length === 0).length,
    };
    const progressPercent = counts.total > 0 ? Math.round((counts.ready / counts.total) * 100) : 0;
    return { ...counts, progressPercent };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const links = asset.links || [];
      const linkedNames = links.map((l) => `${l.product_name || ""} ${l.variant_label || ""}`).join(" ");
      const searchable = `${asset.filename || ""} ${asset.alt_text || ""} ${asset.image_caption || ""} ${linkedNames}`.toLowerCase();
      const matchesSearch = !q || searchable.includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "ready" && asset.processing_status === "ready") ||
        (statusFilter === "pending" && asset.processing_status === "pending") ||
        (statusFilter === "processing" && asset.processing_status === "processing") ||
        (statusFilter === "failed" && asset.processing_status === "failed") ||
        (statusFilter === "linked" && links.length > 0) ||
        (statusFilter === "unlinked" && links.length === 0);

      const matchesProduct =
        productFilter === "all" ||
        links.some((l) => String(l.product_id) === String(productFilter));

      return matchesSearch && matchesStatus && matchesProduct;
    });
  }, [assets, search, statusFilter, productFilter]);

  const targetProduct = useMemo(
    () => products.find((p) => String(p.id) === String(targetProductId)) || null,
    [products, targetProductId]
  );

  // Drag & Drop handlers
  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const dropped = Array.from(event.dataTransfer.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (dropped.length) {
      setPendingFiles((curr) => [...curr, ...dropped]);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!pendingFiles.length) return;
    setUploading(true);
    setUploadProgress(10);
    const formData = new FormData();
    pendingFiles.forEach((file) => formData.append("images", file));
    try {
      const response = await api.post("/datasheet/product-image-library/", formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        },
      });
      const uploadedAssets = response.data || [];
      // If filtered to a specific product, optionally auto-link uploaded images
      if (productParam && uploadedAssets.length > 0) {
        await Promise.all(
          uploadedAssets.map((asset) =>
            api.post(`/datasheet/product-image-library/${asset.id}/link/`, {
              product_id: Number(productParam),
              variant_id: targetVariantId ? Number(targetVariantId) : null,
            })
          )
        );
        toast.success(`${uploadedAssets.length} image(s) uploaded & linked to product`);
      } else {
        toast.success(`${uploadedAssets.length} image(s) uploaded to gallery`);
      }
      setPendingFiles([]);
      setUploadProgress(100);
      await loadAll(true);
    } catch (error) {
      toast.error(error?.response?.data?.images || error?.response?.data?.detail || "Upload failed");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 300);
    }
  };

  // Embedding Queue Trigger (All pending/failed, Retry failed only, or Selected)
  const triggerEmbeddingQueue = async ({ onlyFailed = false, selectedOnly = false, assetIds = [] } = {}) => {
    const payload = {};
    if (assetIds.length) {
      payload.asset_ids = assetIds;
    } else if (selectedOnly) {
      if (!selectedIds.length) {
        toast.error("Select at least one image first");
        return;
      }
      payload.asset_ids = selectedIds;
    } else if (onlyFailed) {
      if (stats.failed === 0) {
        toast.success("No failed images to retry");
        return;
      }
      payload.only_failed = true;
    } else {
      if (stats.pending + stats.failed === 0) {
        toast.success(isStaff ? "All images are already embedded & ready" : "All images are already prepared");
        return;
      }
    }

    setEmbeddingBusy(true);
    try {
      const res = await api.post("/datasheet/product-image-library/embed/", payload);
      await loadAll(true);
      toast.success(
        `${res.data?.queued || 0} image(s) queued`
      );
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not prepare images");
    } finally {
      setEmbeddingBusy(false);
    }
  };

  // Reorder gallery assets
  const reorderAsset = async (assetId, direction) => {
    const idx = filteredAssets.findIndex((a) => a.id === assetId);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= filteredAssets.length) return;
    const copy = [...filteredAssets];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    const positions = Object.fromEntries(copy.map((item, pos) => [item.id, pos]));
    try {
      await api.post("/datasheet/product-image-library/reorder/", { positions });
      await loadAll(true);
      toast.success("Image order saved");
    } catch {
      toast.error("Could not reorder images");
    }
  };

  // Save editable metadata only. AI caption is generated by the embedding task.
  const saveAssetDetails = async (event) => {
    event.preventDefault();
    if (!activeAsset) return;
    setSavingDetails(true);
    try {
      await api.patch(`/datasheet/product-image-library/${activeAsset.id}/`, {
        filename: editDraft.filename,
        alt_text: editDraft.alt_text,
      });
      await loadAll(true);
      toast.success("Image details saved & synced");
    } catch {
      toast.error("Could not save image details");
    } finally {
      setSavingDetails(false);
    }
  };

  // Single link
  const handleSingleLink = async (event, assetToLink) => {
    event.preventDefault();
    const targetAsset = assetToLink || linkModalAsset || activeAsset;
    if (!targetAsset || !targetProductId) {
      toast.error("Choose a product to link");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/datasheet/product-image-library/${targetAsset.id}/link/`, {
        product_id: Number(targetProductId),
        variant_id: targetVariantId ? Number(targetVariantId) : null,
      });
      setLinkModalAsset(null);
      await loadAll(true);
      toast.success("Image linked to product");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Link failed");
    } finally {
      setBusy(false);
    }
  };

  // Unlink
  const handleUnlink = async (assetId, linkId) => {
    try {
      await api.delete(`/datasheet/product-image-library/${assetId}/links/${linkId}/`);
      await loadAll(true);
      toast.success("Link removed");
    } catch {
      toast.error("Could not remove link");
    }
  };

  // Bulk Link
  const handleBulkLink = async () => {
    if (!selectedIds.length || !targetProductId) {
      toast.error("Select images and choose a target product first");
      return;
    }
    setBusy(true);
    try {
      await Promise.all(
        selectedIds.map((assetId) =>
          api.post(`/datasheet/product-image-library/${assetId}/link/`, {
            product_id: Number(targetProductId),
            variant_id: targetVariantId ? Number(targetVariantId) : null,
          })
        )
      );
      setSelectedIds([]);
      await loadAll(true);
      toast.success(`${selectedIds.length} image(s) linked to product`);
    } catch {
      toast.error("Some images could not be linked");
    } finally {
      setBusy(false);
    }
  };

  // Bulk Unlink
  const handleBulkUnlink = async () => {
    const links = selectedIds.flatMap(
      (id) => (assets.find((a) => a.id === id)?.links || []).map((l) => ({ ...l, asset_id: id }))
    );
    if (!links.length) {
      toast.error("Selected images have no active product links");
      return;
    }
    setBusy(true);
    try {
      await Promise.all(
        links.map((l) =>
          api.delete(`/datasheet/product-image-library/${l.asset_id}/links/${l.id}/`)
        )
      );
      setSelectedIds([]);
      await loadAll(true);
      toast.success("Removed all links from selected images");
    } catch {
      toast.error("Some links could not be removed");
    } finally {
      setBusy(false);
    }
  };

  // Single Delete
  const deleteAssetNow = async (id) => {
    setConfirmBusy(true);
    try {
      await api.delete(`/datasheet/product-image-library/${id}/`);
      if (activeAssetId === id) setActiveAssetId(null);
      setSelectedIds((curr) => curr.filter((item) => item !== id));
      await loadAll(true);
      toast.success("Image deleted");
    } catch {
      toast.error("Could not delete image");
    } finally {
      setConfirmBusy(false);
      setConfirmDialog(null);
    }
  };

  const handleDeleteAsset = (id) => {
    setConfirmDialog({ type: "single", id });
  };

  // Bulk Delete
  const deleteAssetsNow = async (ids) => {
    setConfirmBusy(true);
    try {
      await Promise.all(ids.map((id) => api.delete(`/datasheet/product-image-library/${id}/`)));
      if (ids.includes(activeAssetId)) setActiveAssetId(null);
      setSelectedIds([]);
      await loadAll(true);
      toast.success("Selected images deleted");
    } catch {
      toast.error("Some images could not be deleted");
    } finally {
      setConfirmBusy(false);
      setConfirmDialog(null);
    }
  };

  const handleBulkDelete = () => {
    if (!selectedIds.length) return;
    setConfirmDialog({ type: "bulk", ids: [...selectedIds] });
  };

  const confirmDelete = () => {
    if (!confirmDialog) return;
    if (confirmDialog.type === "single") return deleteAssetNow(confirmDialog.id);
    return deleteAssetsNow(confirmDialog.ids);
  };

  const toggleSelect = (id) => {
    setSelectedIds((curr) =>
      curr.includes(id) ? curr.filter((item) => item !== id) : [...curr, id]
    );
  };

  const failedItems = useMemo(
    () => assets.filter((a) => a.processing_status === "failed"),
    [assets]
  );

  return (
    <main className="min-h-screen bg-slate-50 p-2 sm:p-4 lg:p-6">
      <div className="mx-auto w-full max-w-[1750px]">
        {/* Top Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight italic uppercase">
                Image Gallery
              </h1>
              <span className="rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 px-3 py-1 text-xs font-black text-indigo-700 shadow-xs">
                {assets.length} total assets
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isStaff
                ? "Reusable product & variant image library with rate-limit-safe Gemini vector indexing."
                : "Upload, organize, and connect your product images in one place."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.push("/dashboard/products")}
              className="rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
            >
              ← Back to Products
            </button>
            <button
              type="button"
              onClick={() => loadAll()}
              className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Section 7: Embedding Status, Progress, Rate-Limit Queue & Error Logs */}
        <section className="mb-6 rounded-[2rem] sm:rounded-[2.5rem] bg-white p-5 sm:p-7 shadow-xl border border-gray-100 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                <Cpu size={22} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {isStaff ? "AI Embedding & Queue Status" : "Image Preparation Status"}
                  </h2>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-3 py-0.5 text-[11px] font-bold text-emerald-700 shadow-xs">
                    {isStaff ? "Rate-Limit Safe Queue (3/batch · 12s stagger)" : "Automatic image preparation"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Last {isStaff ? "embedding completed" : "image preparation completed"}:{" "}
                  <b className="text-slate-700">
                    {embedSummary?.last_embedded_at
                      ? new Date(embedSummary.last_embedded_at).toLocaleString()
                      : (isStaff ? "No embeddings completed yet" : "No image preparation completed yet")}
                  </b>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {stats.failed > 0 && (
                <button
                  type="button"
                  disabled={embeddingBusy}
                  onClick={() => triggerEmbeddingQueue({ onlyFailed: true })}
                  className="flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xs disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  Retry Failed ({stats.failed})
                </button>
              )}
              {isStaff && stats.failed > 0 && (
                <button
                  type="button"
                  onClick={() => setShowErrorLogs((v) => !v)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
                >
                  {showErrorLogs ? "Hide Error Details" : "Admin Error Logs"}
                </button>
              )}
              <button
                type="button"
                disabled={embeddingBusy || stats.pending + stats.failed === 0}
                onClick={() => triggerEmbeddingQueue()}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Sparkles size={15} />
                {embeddingBusy
                  ? "Queueing..."
                  : isStaff
                  ? `Embed Pending (${stats.pending + stats.failed})`
                  : `Prepare Pending Images (${stats.pending + stats.failed})`}
              </button>
            </div>
          </div>

          {/* Overview Style StatCards Grid */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 relative z-10">
            <GalleryStatCard
              title="Preparing"
              value={stats.pending}
              icon={<Clock size={18} />}
              color="orange"
              subValue="In queue"
              active={statusFilter === "pending"}
              onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
            />
            <GalleryStatCard
              title="Processing"
              value={stats.processing}
              icon={<Cpu size={18} />}
              color="blue"
              subValue="Active worker"
              active={statusFilter === "processing"}
              onClick={() => setStatusFilter(statusFilter === "processing" ? "all" : "processing")}
            />
            <GalleryStatCard
              title="Ready"
              value={stats.ready}
              icon={<CheckCircle2 size={18} />}
              color="green"
              subValue={`${stats.progressPercent}% of total`}
              active={statusFilter === "ready"}
              onClick={() => setStatusFilter(statusFilter === "ready" ? "all" : "ready")}
            />
            <GalleryStatCard
              title="Linked"
              value={stats.linked}
              icon={<Link2 size={18} />}
              color="purple"
              subValue="Assigned to product"
              active={statusFilter === "linked"}
              onClick={() => setStatusFilter(statusFilter === "linked" ? "all" : "linked")}
            />
            <GalleryStatCard
              title="Unlinked"
              value={stats.unlinked}
              icon={<Unlink size={18} />}
              color="indigo"
              subValue="Ready to link"
              active={statusFilter === "unlinked"}
              onClick={() => setStatusFilter(statusFilter === "unlinked" ? "all" : "unlinked")}
            />
            <GalleryStatCard
              title="Failed"
              value={stats.failed}
              icon={<AlertCircle size={18} />}
              color="red"
              subValue={stats.failed > 0 ? "Requires retry" : "No errors"}
              active={statusFilter === "failed"}
              onClick={() => setStatusFilter(statusFilter === "failed" ? "all" : "failed")}
            />
          </div>

          {/* Progress bar */}
          <div className="mt-5 rounded-2xl bg-slate-50/80 border border-slate-100 p-4 relative z-10">
            <div className="mb-2 flex justify-between items-center text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600" />
                {isStaff ? "Bulk Embedding Readiness" : "Image Preparation Progress"}
              </span>
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-black">
                {stats.ready} / {stats.total} Ready ({stats.progressPercent}%)
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm transition-all duration-500"
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>
          </div>

          {/* Admin Error Details Panel */}
          {isStaff && showErrorLogs && failedItems.length > 0 && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4 text-xs relative z-10">
              <b className="text-rose-800">Failed Image Indexing Logs (Admin Diagnostic):</b>
              <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                {failedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2 text-rose-700 shadow-xs border border-rose-100"
                  >
                    <span className="font-semibold">
                      #{item.id} — {item.filename || "Untitled"}
                    </span>
                    <span className="font-mono text-[11px]">
                      {item.processing_error || "Unknown indexing error"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Drag-and-Drop Upload Area with Progress Bar */}
        <form
          onSubmit={handleUpload}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`mb-6 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-dashed p-6 sm:p-8 transition-all duration-300 shadow-xl ${
            dragActive
              ? "border-indigo-500 bg-indigo-50/70 scale-[1.01]"
              : "border-slate-200/90 bg-gradient-to-br from-indigo-50/30 via-white to-purple-50/20 hover:border-indigo-300"
          }`}
        >
          <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
            <label className="flex flex-1 cursor-pointer items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0 hover:scale-105 transition-transform">
                <UploadCloud size={28} />
              </div>
              <div>
                <p className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  Drag & drop product images here, or click to browse
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports PNG, JPG, WEBP up to 10 MB each.{" "}
                  {productParam
                    ? `Uploaded images will automatically link to Product #${productParam}.`
                    : "Upload once and reuse across multiple Products or Variants."}
                </p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
                className="hidden"
              />
            </label>

            {pendingFiles.length > 0 && (
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700 border border-indigo-200">
                  {pendingFiles.length} file(s) staged
                </span>
                <button
                  type="button"
                  onClick={() => setPendingFiles([])}
                  className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {uploading ? `Uploading (${uploadProgress}%)` : "Start Upload"}
                </button>
              </div>
            )}
          </div>

          {uploading && (
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {pendingFiles.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:grid-cols-8">
              {pendingFiles.map((file, idx) => (
                <div
                  key={file.name + idx}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs group"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-20 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFiles((curr) => curr.filter((_, i) => i !== idx))
                    }
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-rose-600 transition"
                  >
                    <X size={11} />
                  </button>
                  <p className="truncate px-2 py-1 text-[10px] font-bold text-slate-700 bg-white">
                    {file.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Bulk Action Toolbar */}
        {selectedIds.length > 0 && (
          <div className="sticky top-2 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-indigo-200/40 bg-indigo-950/95 backdrop-blur-xl p-4 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1.5 text-xs font-black shadow-md">
                {selectedIds.length} Selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs font-bold text-indigo-200 hover:text-white transition"
              >
                Clear selection
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={targetProductId}
                onChange={(e) => {
                  setTargetProductId(e.target.value);
                  setTargetVariantId("");
                }}
                className="rounded-xl border border-indigo-700 bg-indigo-900/80 px-3 py-2 text-xs font-semibold text-white outline-none"
              >
                <option value="">Choose Product to Link...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.base_sku || "No SKU"})
                  </option>
                ))}
              </select>

              <select
                value={targetVariantId}
                onChange={(e) => setTargetVariantId(e.target.value)}
                disabled={!targetProductId}
                className="rounded-xl border border-indigo-700 bg-indigo-900/80 px-3 py-2 text-xs font-semibold text-white outline-none disabled:opacity-50"
              >
                <option value="">General Product Image</option>
                {(targetProduct?.variants || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {formatVariantLabel(v)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={busy || !targetProductId}
                onClick={handleBulkLink}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-400 transition disabled:opacity-50"
              >
                <Link2 size={13} /> Bulk Link
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleBulkUnlink}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-700 bg-indigo-900 px-3.5 py-2 text-xs font-black text-indigo-100 hover:bg-indigo-800 transition"
              >
                <Unlink size={13} /> Bulk Unlink
              </button>

              <button
                type="button"
                disabled={embeddingBusy}
                onClick={() => triggerEmbeddingQueue({ selectedOnly: true })}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-500 shadow-md transition"
              >
                <Sparkles size={13} /> {isStaff ? "Bulk Embed" : "Prepare Selected Images"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-black text-white hover:bg-rose-500 shadow-md transition"
              >
                <Trash2 size={13} /> Bulk Delete
              </button>
            </div>
          </div>
        )}

        {/* Search, Filter & View Mode Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3.5 rounded-[2rem] bg-white p-4 sm:p-5 shadow-xl border border-gray-100">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search filename, alt text, AI caption, or linked product..."
                className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs sm:text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="hidden rounded-2xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 sm:block"
            >
              <option value="all">Filter: All Status ({assets.length})</option>
              <option value="ready">Ready ({stats.ready})</option>
              <option value="pending">Preparing ({stats.pending})</option>
              <option value="processing">Processing ({stats.processing})</option>
              <option value="failed">Failed ({stats.failed})</option>
              <option value="linked">Linked ({stats.linked})</option>
              <option value="unlinked">Unlinked ({stats.unlinked})</option>
            </select>

            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="hidden rounded-2xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 sm:block"
            >
              <option value="all">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 text-xs font-bold text-slate-700 sm:hidden"
            >
              <SlidersHorizontal size={14} /> Filters
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  selectedIds.length === filteredAssets.length
                    ? []
                    : filteredAssets.map((a) => a.id)
                )
              }
              className="rounded-2xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              {selectedIds.length === filteredAssets.length && filteredAssets.length > 0
                ? "Unselect All"
                : "Select All"}
            </button>

            {/* View Mode Toggle (Overview/Profit style) */}
            <div className="flex rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  view === "grid"
                    ? "bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-md scale-105"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Grid View"
              >
                <Grid size={14} /> Grid
              </button>
              <button
                type="button"
                onClick={() => setView("masonry")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  view === "masonry"
                    ? "bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-md scale-105"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Masonry View"
              >
                <Columns size={14} /> Masonry
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  view === "list"
                    ? "bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-md scale-105"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="List View"
              >
                <List size={14} /> List
              </button>
            </div>
          </div>
        </div>

        {/* Main Gallery Layout: Thumbnails + Right Image Details & Product Linking Panel */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          {/* Left: Gallery Items */}
          <section>
            {!loading && filteredAssets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-14 text-center">
                <FileImage className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 font-bold text-slate-700">No matching gallery images</p>
                <p className="mt-1 text-xs text-slate-400">
                  Upload images above or adjust your status/product filters.
                </p>
              </div>
            ) : (
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
                    : view === "masonry"
                    ? "columns-2 gap-4 space-y-4 sm:columns-3 xl:columns-4"
                    : "space-y-3"
                }
              >
                {filteredAssets.map((asset, idx) => {
                  const isSelected = selectedIds.includes(asset.id);
                  const isActive = activeAsset?.id === asset.id;
                  const links = asset.links || [];
                  return (
                    <article
                      key={asset.id}
                      onClick={() => setActiveAssetId(asset.id)}
                      className={`group cursor-pointer overflow-hidden rounded-[1.75rem] border bg-white transition-all duration-300 hover:-translate-y-1 ${
                        view === "masonry" ? "break-inside-avoid" : ""
                      } ${
                        view === "list" ? "flex items-center gap-4 p-3.5" : "flex flex-col justify-between"
                      } ${
                        isActive
                          ? "border-indigo-500 ring-4 ring-indigo-500/10 shadow-xl"
                          : "border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200"
                      }`}
                    >
                      <div
                        className={
                          view === "list"
                            ? "relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100"
                            : view === "masonry"
                            ? "relative overflow-hidden rounded-t-[1.75rem] bg-slate-100"
                            : "relative aspect-square overflow-hidden rounded-t-[1.75rem] bg-slate-100"
                        }
                      >
                        <img
                          src={asset.image}
                          alt={asset.alt_text || asset.filename || "Gallery image"}
                          className={
                            view === "masonry"
                              ? "w-full object-cover"
                              : "h-full w-full object-cover"
                          }
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(asset.id);
                          }}
                          className={`absolute left-2.5 top-2.5 flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-bold shadow-md backdrop-blur-md transition ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-white/90 text-slate-700 hover:bg-white"
                          }`}
                        >
                          {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                        </button>

                        <div
                          className="absolute right-2.5 top-2.5 flex gap-1.5 opacity-0 transition group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => reorderAsset(asset.id, -1)}
                            disabled={idx === 0}
                            className="rounded-xl bg-white/95 backdrop-blur-md p-1.5 text-slate-700 shadow-md hover:bg-white disabled:opacity-40 transition"
                            title="Move earlier"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => reorderAsset(asset.id, 1)}
                            disabled={idx === filteredAssets.length - 1}
                            className="rounded-xl bg-white/95 backdrop-blur-md p-1.5 text-slate-700 shadow-md hover:bg-white disabled:opacity-40 transition"
                            title="Move later"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAsset(asset.id)}
                            className="rounded-xl bg-white/95 backdrop-blur-md p-1.5 text-rose-600 shadow-md hover:bg-rose-50 transition"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <span
                          className={`absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-black capitalize shadow-md backdrop-blur-md ${
                            asset.processing_status === "ready"
                              ? "bg-emerald-600/90 text-white"
                              : asset.processing_status === "failed"
                              ? "bg-rose-600/90 text-white"
                              : "bg-amber-500/90 text-white"
                          }`}
                        >
                          {asset.processing_status === "pending"
                            ? "Preparing"
                            : asset.processing_status}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-black text-slate-800">
                            {asset.filename || `Asset #${asset.id}`}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                              links.length > 0
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {links.length > 0 ? `${links.length} linked` : "Unlinked"}
                          </span>
                        </div>

                        {asset.alt_text && (
                          <p className="mt-1 truncate text-[11px] text-slate-500">
                            Alt: {asset.alt_text}
                          </p>
                        )}

                        {links.length > 0 && (
                          <div className="mt-2.5 space-y-1">
                            {links.slice(0, 2).map((link) => (
                              <div
                                key={link.id}
                                className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600 border border-slate-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="truncate font-medium">
                                  {link.product_name}
                                  {link.variant_label ? ` (${link.variant_label})` : ""}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUnlink(asset.id, link.id)}
                                  className="ml-1 font-black text-rose-600 hover:underline"
                                >
                                  Unlink
                                </button>
                              </div>
                            ))}
                            {links.length > 2 && (
                              <p className="text-[10px] font-bold text-slate-400 pl-1">
                                +{links.length - 2} more product links
                              </p>
                            )}
                          </div>
                        )}

                        <div
                          className="mt-3 flex gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAssetId(asset.id);
                              setLinkModalAsset(asset);
                              setTargetProductId(productParam || "");
                              setTargetVariantId("");
                            }}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 py-2 text-[11px] font-black text-indigo-700 hover:from-indigo-100 hover:to-purple-100 transition-all shadow-xs"
                          >
                            <Link2 size={13} /> Link Product
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right: Large Preview & Image Details Panel + Product/Variant Link Manager */}
          <aside className="h-fit rounded-[2rem] sm:rounded-[2.25rem] bg-white p-5 sm:p-6 shadow-xl border border-gray-100 lg:sticky lg:top-4 overflow-hidden">
            {activeAsset ? (
              <div>
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="font-black text-slate-800 text-sm sm:text-base tracking-tight">Image Details & Preview</h2>
                  <button
                    type="button"
                    onClick={() => handleDeleteAsset(activeAsset.id)}
                    className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 transition"
                    title="Delete image"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Large Preview */}
                <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-inner">
                  <img
                    src={activeAsset.image}
                    alt={activeAsset.alt_text || activeAsset.filename}
                    className="max-h-72 w-full object-contain bg-white"
                  />
                </div>

                {/* Metadata Grid: File Size, Dimensions, Upload Date, Embedding Status */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/20 p-4 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">File Size</span>
                    <p className="font-black text-slate-800 text-sm mt-0.5">
                      {formatBytes(activeAsset.file_size)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Dimensions</span>
                    <p className="font-black text-slate-800 text-sm mt-0.5">
                      {activeAsset.dimensions
                        ? `${activeAsset.dimensions.width} × ${activeAsset.dimensions.height} px`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Upload Date</span>
                    <p className="font-black text-slate-800 text-sm mt-0.5">
                      {activeAsset.created_at
                        ? new Date(activeAsset.created_at).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">{isStaff ? "Embedding Status" : "Image Preparation"}</span>
                    <p
                      className={`font-black capitalize text-sm mt-0.5 ${
                        activeAsset.processing_status === "ready"
                          ? "text-emerald-600"
                          : activeAsset.processing_status === "failed"
                          ? "text-rose-600"
                          : "text-amber-600"
                      }`}
                    >
                      {activeAsset.processing_status}
                    </p>
                  </div>
                </div>

                {activeAsset.processing_error && (
                  <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-700">
                    <b>Error:</b> {activeAsset.processing_error}
                  </div>
                )}

                {activeAsset.processing_status === "failed" && (
                  <button
                    type="button"
                    disabled={embeddingBusy}
                    onClick={() => triggerEmbeddingQueue({ assetIds: [activeAsset.id] })}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    <RefreshCw size={13} />
                    {embeddingBusy ? "Retrying..." : "Retry Image Preparation"}
                  </button>
                )}

                {/* Edit Filename, Alt Text & Caption */}
                <form onSubmit={saveAssetDetails} className="mt-5 space-y-3 text-xs">
                  <label className="block font-bold text-slate-700">
                    Filename
                    <input
                      value={editDraft.filename}
                      onChange={(e) =>
                        setEditDraft((curr) => ({ ...curr, filename: e.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </label>
                  <label className="block font-bold text-slate-700">
                    Alt Text
                    <input
                      value={editDraft.alt_text}
                      onChange={(e) =>
                        setEditDraft((curr) => ({ ...curr, alt_text: e.target.value }))
                      }
                      placeholder="Short visual description..."
                      className="mt-1 w-full rounded-2xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </label>
                  <label className="block font-bold text-slate-700">
                    <span className="flex items-center justify-between gap-2 mb-1">
                      <span>AI Image Caption <span className="font-normal text-slate-400">(read-only)</span></span>
                      <span className="rounded-full bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 text-[10px] font-black text-indigo-600">AI generated</span>
                    </span>
                    <textarea
                      rows={3}
                      value={editDraft.image_caption || ""}
                      readOnly
                      placeholder={isStaff ? "Caption will appear after embedding..." : "Caption will appear after image preparation..."}
                      className="mt-1 w-full cursor-not-allowed rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3 font-normal text-slate-700 outline-none"
                    />
                    <span className="mt-1 block text-[10px] font-medium text-slate-400">
                      This caption is generated automatically from the image and cannot be entered manually.
                    </span>
                  </label>
                  <button
                    type="submit"
                    disabled={savingDetails}
                    className="w-full rounded-2xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-slate-800 active:scale-[0.98] transition shadow-md disabled:opacity-50"
                  >
                    {savingDetails ? "Saving..." : "Save Filename & Alt Text"}
                  </button>
                </form>

                {/* Section 6: Product / Variant Linking Panel */}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Linked Products & Variants ({(activeAsset.links || []).length})
                  </h3>

                  <div className="mt-3 space-y-2">
                    {(activeAsset.links || []).map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-xs"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/products/${link.product_id}`)}
                            className="truncate font-black text-indigo-600 hover:underline"
                          >
                            {link.product_name}
                          </button>
                          <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                            {link.variant_label
                              ? `Variant: ${link.variant_label}`
                              : "General Product Image"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnlink(activeAsset.id, link.id)}
                          className="ml-2 rounded-xl border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-black text-rose-600 hover:bg-rose-50 transition shadow-xs"
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                    {!(activeAsset.links || []).length && (
                      <p className="rounded-2xl bg-slate-50/80 border border-slate-100 p-4 text-xs font-medium text-slate-400 text-center">
                        Not linked to any product yet.
                      </p>
                    )}
                  </div>

                  {/* Add New Link Form (Reuse image across multiple Products/Variants) */}
                  <form
                    onSubmit={(e) => handleSingleLink(e, activeAsset)}
                    className="mt-4 space-y-2.5 rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 p-4 text-xs shadow-sm"
                  >
                    <b className="block text-indigo-950 font-black">
                      Link / Reuse on Product or Variant
                    </b>
                    <select
                      required
                      value={targetProductId}
                      onChange={(e) => {
                        setTargetProductId(e.target.value);
                        setTargetVariantId("");
                      }}
                      className="w-full rounded-xl border border-slate-200/90 bg-white p-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
                    >
                      <option value="">Select Product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.base_sku || "No SKU"})
                        </option>
                      ))}
                    </select>
                    <select
                      value={targetVariantId}
                      onChange={(e) => setTargetVariantId(e.target.value)}
                      disabled={!targetProductId}
                      className="w-full rounded-xl border border-slate-200/90 bg-white p-2.5 text-xs font-semibold text-slate-700 outline-none disabled:opacity-50"
                    >
                      <option value="">General Product Image</option>
                      {(targetProduct?.variants || []).map((v) => (
                        <option key={v.id} value={v.id}>
                          {formatVariantLabel(v)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={busy || !targetProductId}
                      className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 font-black text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/35 active:scale-[0.98] transition disabled:opacity-50"
                    >
                      {busy ? "Linking..." : "Link Image"}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                <Info className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                Select any image from the gallery to view its dimensions, file size, preparation status, and manage product/variant links.
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Branded delete confirmation */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3.5 border-b border-slate-100 p-6">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-slate-900 text-base">Delete gallery image{confirmDialog.type === "bulk" ? "s" : ""}?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {confirmDialog.type === "bulk"
                    ? `${confirmDialog.ids.length} selected images and their product links will be removed.`
                    : "This image and its product links will be permanently removed from the gallery."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close delete dialog"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex justify-end gap-2.5 bg-slate-50/80 p-5">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmDialog(null)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={confirmDelete}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-rose-500/25 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
              >
                <Trash2 size={14} />
                {confirmBusy ? "Deleting..." : "Delete image"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Product Modal Dialog */}
      {linkModalAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setLinkModalAsset(null)}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                  <Link2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Link Image to Product</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[240px]">
                    {linkModalAsset.filename || "Selected Image"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkModalAsset(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
              <img
                src={linkModalAsset.image}
                alt="Preview"
                className="h-14 w-14 rounded-xl object-cover border border-slate-200 bg-white shadow-xs"
              />
              <div className="min-w-0 text-xs text-slate-600">
                <p className="font-black text-slate-800 truncate">{linkModalAsset.filename || "Image"}</p>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                  Current links: {(linkModalAsset.links || []).length} product(s)
                </p>
              </div>
            </div>

            <form onSubmit={(e) => handleSingleLink(e, linkModalAsset)} className="space-y-3.5 text-xs">
              <label className="block font-bold text-slate-700">
                Select Product *
                <select
                  required
                  value={targetProductId}
                  onChange={(e) => {
                    setTargetProductId(e.target.value);
                    setTargetVariantId("");
                  }}
                  className="mt-1 w-full rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition"
                >
                  <option value="">Choose a product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.base_sku ? `(${p.base_sku})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block font-bold text-slate-700">
                Select Variant (Optional)
                <select
                  value={targetVariantId}
                  onChange={(e) => setTargetVariantId(e.target.value)}
                  disabled={!targetProductId}
                  className="mt-1 w-full rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition disabled:opacity-50"
                >
                  <option value="">General Product Image (All variants)</option>
                  {(targetProduct?.variants || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {formatVariantLabel(v)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-5 flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setLinkModalAsset(null)}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !targetProductId}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98] transition disabled:opacity-50"
                >
                  <Link2 size={13} />
                  {busy ? "Linking..." : "Confirm Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 sm:hidden"
          onClick={() => setMobileFilterOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <b className="text-sm text-slate-900">Filter Gallery Images</b>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="rounded-lg p-1 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <label className="block font-semibold text-slate-700">
                Status / Link Filter
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                >
                  <option value="all">All Images</option>
                  <option value="ready">Ready</option>
                  <option value="pending">Preparing</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                  <option value="linked">Linked</option>
                  <option value="unlinked">Unlinked</option>
                </select>
              </label>
              <label className="block font-semibold text-slate-700">
                Linked Product
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                >
                  <option value="all">All Products</option>
                  {products.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ImageGalleryPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 p-6 text-sm text-slate-500">Loading image gallery...</main>}>
      <ImageGalleryPageContent />
    </Suspense>
  );
}
