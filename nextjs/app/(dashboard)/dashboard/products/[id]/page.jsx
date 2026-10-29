"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Box,
  CheckCircle2,
  Clock,
  Edit3,
  ImagePlus,
  Layers,
  Package,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  Upload,
  ImageOff,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";
import RichTextDisplay from "../../../../../components/RichTextDisplay";

function formatAttributes(attrs) {
  return Object.entries(attrs || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

function ProductImage({ src, alt, className = "", loading = "lazy" }) {
  const [failed, setFailed] = useState(!src);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return (
      <div className={`${className} flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-slate-100 p-4 text-center text-xs font-semibold text-slate-500`}>
        <span className="rounded-2xl bg-white p-3 text-slate-400 shadow-sm ring-1 ring-slate-200">
          <ImageOff size={22} />
        </span>
        <span>Image unavailable</span>
        <span className="text-[10px] font-normal text-slate-400">The file may have been moved or deleted</span>
      </div>
    );
  }

  const objectFit = className.includes("object-cover") ? "object-cover" : "object-contain";
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 text-xs font-semibold text-slate-400">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
          Loading image...
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className={`absolute inset-0 h-full w-full ${objectFit} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function ProductDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadVariantId, setUploadVariantId] = useState("");
  const [editingImage, setEditingImage] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState("archive");
  const [deleting, setDeleting] = useState(false);
  const [imageToRemove, setImageToRemove] = useState(null);
  const [removingImage, setRemovingImage] = useState(false);

  const load = async () => {
    try {
      const [response, history] = await Promise.all([
        api.get(`/datasheet/products/${id}/`),
        api.get(`/datasheet/products/${id}/activity/`),
      ]);
      setProduct(response.data);
      setActivity(history.data || []);
    } catch {
      toast.error("Product could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const gallery = [...(product?.gallery || [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  const activeImage = gallery[activeImageIndex] || gallery[0] || null;

  const reorder = async (image, direction) => {
    const index = gallery.findIndex((item) => item.id === image.id);
    const next = index + direction;
    if (next < 0 || next >= gallery.length) return;
    const copy = [...gallery];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    try {
      await api.post(`/datasheet/products/${id}/gallery/reorder/`, {
        positions: Object.fromEntries(copy.map((item, position) => [item.id, position])),
      });
      await load();
      setActiveImageIndex(next);
      toast.success("Gallery order updated");
    } catch {
      toast.error("Image order could not be saved");
    }
  };

  const setPrimaryImage = async (image) => {
    try {
      await api.patch(`/datasheet/products/${id}/gallery/${image.id}/edit/`, {
        is_primary: true,
      });
      await load();
      toast.success("Set as primary image");
    } catch {
      toast.error("Could not set primary image");
    }
  };

  const saveImageMetadata = async (event) => {
    event.preventDefault();
    if (!editingImage) return;
    const formData = new FormData(event.target);
    try {
      await api.patch(`/datasheet/products/${id}/gallery/${editingImage.id}/edit/`, {
        alt_text: formData.get("alt_text") || "",
        variant_id: formData.get("variant_id") ? Number(formData.get("variant_id")) : null,
      });
      setEditingImage(null);
      await load();
      toast.success("Image details updated");
    } catch {
      toast.error("Could not update image details");
    }
  };

  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("images", f));
      if (uploadVariantId) {
        formData.append("variant_id", uploadVariantId);
      }
      await api.post(`/datasheet/products/${id}/gallery/`, formData);
      event.target.value = "";
      await load();
      toast.success(`${files.length} image(s) uploaded`);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (image) => {
    setRemovingImage(true);
    try {
      if (image.source === "library" && image.asset_id && image.link_id) {
        await api.delete(
          `/datasheet/product-image-library/${image.asset_id}/links/${image.link_id}/`
        );
      } else {
        await api.delete(`/datasheet/products/${id}/gallery/${image.id}/`);
      }
      setActiveImageIndex(0);
      await load();
      toast.success("Image removed");
    } catch {
      toast.error("Image could not be removed");
    } finally {
      setRemovingImage(false);
      setImageToRemove(null);
    }
  };

  const handleDeleteProduct = async () => {
    setDeleting(true);
    try {
      if (deleteMode === "permanent") {
        await api.delete(`/datasheet/products/${id}/?permanent=true`);
        toast.success("Product permanently deleted");
        router.push("/dashboard/products");
      } else {
        await api.delete(`/datasheet/products/${id}/`);
        toast.success("Product archived & removed from active search");
        router.push("/dashboard/products");
      }
    } catch {
      toast.error("Delete action failed");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-xs">
          Loading product details...
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 text-center shadow-xs">
          <p className="font-bold text-slate-800">Product not found.</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/products")}
            className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
          >
            Back to Products
          </button>
        </div>
      </main>
    );
  }

  const variants = product.variants || [];
  const effectiveStock = variants.length
    ? variants.reduce((sum, v) => sum + Number(v.stock || 0), 0)
    : Number(product.initial_stock || 0);
  const threshold = Number(product.stock_alert_threshold ?? 5);

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Top Action Bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <button
            type="button"
            onClick={() => router.push("/dashboard/products")}
            className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-indigo-600"
          >
            <ArrowLeft size={16} /> Back to Products
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/products?edit=${id}`)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
            >
              <Edit3 size={14} /> Edit Product
            </button>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/image-gallery?product=${id}`)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ImagePlus size={14} /> Link from Gallery
            </button>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100"
            >
              <Trash2 size={14} /> Delete / Archive
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.15fr]">
          {/* Left Column: Large Gallery Preview & Image Management */}
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-black text-slate-900">Product Gallery</h2>
                  <p className="text-xs text-slate-500">
                    {gallery.length} image(s) · Click thumbnail to preview or manage
                  </p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600">
                  {gallery.filter((g) => g.processing_status === "ready").length}/{gallery.length}{" "}
                  AI Ready
                </span>
              </div>

              {/* Main Large Image Preview */}
              {activeImage ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/5">
                  <ProductImage
                    src={activeImage.image}
                    alt={activeImage.alt_text || product.name}
                    className="aspect-square max-h-[440px] w-full object-contain bg-white"
                    loading="eager"
                  />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    {activeImage.is_primary && (
                      <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                        Primary Image
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize shadow ${activeImage.processing_status === "ready"
                          ? "bg-emerald-600 text-white"
                          : activeImage.processing_status === "failed"
                            ? "bg-rose-600 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                    >
                      {activeImage.processing_status}
                    </span>
                    {activeImage.variant_id && (
                      <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white">
                        Variant #{activeImage.variant_id}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 p-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800">
                        {activeImage.alt_text || "No alt text set"}
                      </p>
                      {activeImage.image_caption && (
                        <p className="truncate text-[11px] text-slate-500">
                          AI Caption: {activeImage.image_caption}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(activeImage)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                      >
                        Set Primary
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingImage(activeImage)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        Assign / Alt
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageToRemove(activeImage)}
                        className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50"
                        title="Delete image"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                  <Package size={36} className="text-slate-300" />
                  <p className="mt-2 text-sm font-bold text-slate-600">No gallery images yet</p>
                  <p className="text-xs text-slate-400">
                    Upload images below or link reusable assets from Image Gallery.
                  </p>
                </div>
              )}

              {/* Thumbnail Strip with Reorder Controls */}
              {gallery.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                  {gallery.map((image, idx) => (
                    <div
                      key={image.id}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition ${activeImage?.id === image.id
                          ? "border-indigo-600 ring-2 ring-indigo-100"
                          : "border-slate-200 opacity-85 hover:opacity-100"
                        }`}
                    >
                      <ProductImage
                        src={image.image}
                        alt={image.alt_text || product.name}
                        className="aspect-square w-full object-cover"
                      />
                      <div
                        className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => reorder(image, -1)}
                          disabled={idx === 0}
                          className="rounded bg-white/90 p-1 text-slate-700 shadow disabled:opacity-40"
                          title="Move left"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => reorder(image, 1)}
                          disabled={idx === gallery.length - 1}
                          className="rounded bg-white/90 p-1 text-slate-700 shadow disabled:opacity-40"
                          title="Move right"
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>
                      {image.is_primary && (
                        <span className="absolute bottom-1 left-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Direct Image Upload Panel */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs font-bold text-slate-700">Add Images to this Product</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select
                    value={uploadVariantId}
                    onChange={(e) => setUploadVariantId(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">General Product Image</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {formatAttributes(v.attributes) || v.sku || `Variant #${v.id}`}
                      </option>
                    ))}
                  </select>
                  <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                    <Upload size={14} />
                    {uploading ? "Uploading..." : "Upload Images"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={uploading}
                      onChange={uploadImages}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Product Info, Pricing, Variants, Warranty, Activity Log */}
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
                      {product.category || "Uncategorized"}
                    </span>
                    {product.is_archived && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                        Archived
                      </span>
                    )}
                  </div>
                  <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
                    {product.name}
                  </h1>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    Base SKU: <b className="text-slate-800">{product.base_sku || "Not set"}</b>
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${product.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-600"
                    }`}
                >
                  {product.status}
                </span>
              </div>

              {/* Price & Stock Cards */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <small className="text-xs font-semibold text-slate-400">Base Price</small>
                  <p className="mt-1 text-lg font-black text-slate-900">৳{product.base_price}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <small className="text-xs font-semibold text-slate-400">Sale Price</small>
                  <p className="mt-1 text-lg font-black text-indigo-600">
                    {product.sale_price ? `৳${product.sale_price}` : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <small className="text-xs font-semibold text-slate-400">Total Stock</small>
                  <p
                    className={`mt-1 text-lg font-black ${effectiveStock <= 0
                        ? "text-rose-600"
                        : effectiveStock <= threshold
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                  >
                    {effectiveStock} units
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <small className="text-xs font-semibold text-slate-400">Variants</small>
                  <p className="mt-1 text-lg font-black text-slate-900">{variants.length}</p>
                </div>
              </div>

              {/* Description & Specifications */}
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Product Description
                </h3>
                <div className="mt-1.5 text-sm text-slate-700">
                  <RichTextDisplay content={product.description} />
                </div>
              </div>

              {/* Attributes & Physical Specs */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
                  <b className="text-slate-700">Attributes</b>
                  <p className="mt-1 text-slate-600">
                    {formatAttributes(product.attributes) || "No custom attributes"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
                  <b className="text-slate-700">Weight & Dimensions</b>
                  <p className="mt-1 text-slate-600">
                    Weight: {product.weight_kg ? `${product.weight_kg} kg` : "—"} · Dimensions:{" "}
                    {[
                      product.dimension_length_cm,
                      product.dimension_width_cm,
                      product.dimension_height_cm,
                    ]
                      .filter(Boolean)
                      .join(" × ") || "—"}
                  </p>
                </div>
              </div>

              {/* Warranty Card */}
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-indigo-600" />
                <div>
                  <b className="text-xs font-bold uppercase tracking-wide text-indigo-900">
                    Warranty Information
                  </b>
                  <p className="mt-0.5 text-xs text-slate-700">
                    {product.warranty_information || "Not specified"}
                  </p>
                </div>
              </div>

              {/* Variant Table */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 font-black text-slate-900">
                    <Layers size={16} className="text-indigo-600" />
                    Product Variants ({variants.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/products?edit=${id}&section=variants`)}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Manage Variants →
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 uppercase text-slate-500">
                      <tr>
                        <th className="p-3">Attributes</th>
                        <th className="p-3">Variant SKU</th>
                        <th className="p-3">Price</th>
                        <th className="p-3">Stock</th>
                        <th className="p-3">Images</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {variants.map((variant) => {
                        const variantImagesCount = gallery.filter(
                          (g) => g.variant_id === variant.id
                        ).length;
                        return (
                          <tr key={variant.id}>
                            <td className="p-3 font-semibold text-slate-800">
                              {formatAttributes(variant.attributes) || "Standard"}
                            </td>
                            <td className="p-3 font-mono text-slate-600">{variant.sku}</td>
                            <td className="p-3 font-bold text-slate-900">
                              ৳{variant.price || product.sale_price || product.base_price}
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-full px-2 py-0.5 font-bold ${Number(variant.stock) <= 0
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-emerald-100 text-emerald-700"
                                  }`}
                              >
                                {variant.stock}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500">{variantImagesCount} linked</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!variants.length && (
                    <p className="p-5 text-center text-xs text-slate-400">
                      No variants configured — using base product price & stock.
                    </p>
                  )}
                </div>
              </div>

              {/* Activity / History Log */}
              <div className="mt-6">
                <h2 className="flex items-center gap-1.5 font-black text-slate-900">
                  <Clock size={16} className="text-indigo-600" />
                  Activity & Audit Log
                </h2>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {activity.length ? (
                    activity.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-2xs"
                      >
                        <div>
                          <span className="font-bold capitalize text-slate-800">
                            {String(item.action).replaceAll("_", " ")}
                          </span>
                          {item.details && Object.keys(item.details).length > 0 && (
                            <span className="ml-2 text-slate-500">
                              ({Object.entries(item.details)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(", ")})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No activity recorded yet.</p>
                  )}
                </div>
              </div>

              <p className="mt-5 text-xs text-slate-400">
                Created: {product.created_at ? new Date(product.created_at).toLocaleString() : "—"}{" "}
                · Last updated:{" "}
                {product.updated_at ? new Date(product.updated_at).toLocaleString() : "—"}
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Image removal confirmation modal */}
      {imageToRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 border-b border-slate-100 p-5">
              <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
                <Trash2 size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-slate-900">Remove image?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  This image will be removed from <b className="text-slate-700">{product.name}</b>.
                  {imageToRemove.source === "library"
                    ? " The shared gallery asset will remain available for other products."
                    : " The uploaded gallery image will be removed from this product."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImageToRemove(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close remove image dialog"
              >
                <X size={17} />
              </button>
            </div>
            <div className="flex justify-end gap-2 bg-slate-50/80 p-4">
              <button
                type="button"
                onClick={() => setImageToRemove(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Keep image
              </button>
              <button
                type="button"
                disabled={removingImage}
                onClick={() => removeImage(imageToRemove)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={14} />
                {removingImage ? "Removing..." : "Remove image"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Image Assignment & Alt Text Modal */}
      {editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={saveImageMetadata}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <b className="text-sm text-slate-900">Edit Image Assignment & Alt Text</b>
              <button
                type="button"
                onClick={() => setEditingImage(null)}
                className="rounded-lg p-1 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-700">
              Alt Text
              <input
                name="alt_text"
                defaultValue={editingImage.alt_text || ""}
                placeholder="Describe this product image"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Belongs To (Product or Variant)
              <select
                name="variant_id"
                defaultValue={editingImage.variant_id || ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
              >
                <option value="">General Product Image</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {formatAttributes(v.attributes) || v.sku || `Variant #${v.id}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingImage(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="rounded-xl bg-rose-100 p-2">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="font-black text-slate-900">Delete / Archive Product</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-lg p-1 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <p>
                Product: <b>{product.name}</b>
              </p>
              <p className="mt-1">
                Variants: <b>{variants.length}</b> · Gallery Images: <b>{gallery.length}</b>
              </p>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3">
                <input
                  type="radio"
                  checked={deleteMode === "archive"}
                  onChange={() => setDeleteMode("archive")}
                  className="mt-0.5"
                />
                <div>
                  <b className="text-slate-900">Soft Delete / Archive</b>
                  <p className="text-slate-500">
                    Removes from active catalog & invalidates search index/cache while keeping audit history.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
                <input
                  type="radio"
                  checked={deleteMode === "permanent"}
                  onChange={() => setDeleteMode("permanent")}
                  className="mt-0.5"
                />
                <div>
                  <b className="text-rose-700">Delete product and related data permanently</b>
                  <p className="text-rose-600/80">
                    Permanently deletes product, variants, gallery images and search vectors.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteProduct}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
              >
                {deleting
                  ? "Processing..."
                  : deleteMode === "permanent"
                    ? "Delete Permanently"
                    : "Archive Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
