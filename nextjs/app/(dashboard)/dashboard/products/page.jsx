"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  Filter,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  List,
  Lock,
  MoreVertical,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Star,
  TableProperties,
  Trash2,
  Unlock,
  Upload,
  X,
  Wallet,
  TrendingUp,
  TrendingDown,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  BarChart3,
  Tag,
  Truck,
  Gift,
  Clock,
  Calendar,
  Mic,
  Volume2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import CatalogHeaderNav from "../../../../components/CatalogHeaderNav";
import WordLikeEditor from "../../../../components/WordLikeEditor";
import RichTextDisplay from "../../../../components/RichTextDisplay";
import AdvancedCategoryPicker from "../../../../components/AdvancedCategoryPicker";
import GeneralAttributesEditor from "../../../../components/GeneralAttributesEditor";
import ProductFinancialDashboard from "../../../../components/ProductFinancialDashboard";
import FinancialTooltip from "../../../../components/FinancialTooltip";
import PromotionsManager from "../../../../components/PromotionsManager";
import OverviewStatCard from "../../../../components/OverviewStatCard";

const blankForm = {
  name: "",
  category: "",
  base_sku: "",
  initial_stock: "0",
  description: "",
  base_price: "",
  sale_price: "",
  cost_price: "",
  weight_kg: "",
  dimension_length_cm: "",
  dimension_width_cm: "",
  dimension_height_cm: "",
  status: "active",
  stock_alert_threshold: "5",
  attributes_text: "",
  warranty_information: "",
  voice_audio_file: null,
  voice_audio_file_url: "",
  variants: [],
};

const fieldGroups = [
  [
    ["name", "Product Name", true, "text", "e.g., Premium Cotton Panjabi"],
    ["category", "Category", false, "text", "e.g., Panjabi, Electronics"],
  ],
  [
    ["initial_stock", "Initial Stock", false, "number", "0"],
    ["base_price", "Base Price (৳)", true, "number", "0.00"],
    ["sale_price", "Sale Price (৳)", false, "number", "Optional discount price"],
    ["cost_price", "Cost Price (৳)", false, "number", "Purchase cost"],
  ],
  [
    ["weight_kg", "Weight (kg)", false, "number", "0.000"],
    ["dimension_length_cm", "Length (cm)", false, "number", "0.00"],
    ["dimension_width_cm", "Width (cm)", false, "number", "0.00"],
    ["dimension_height_cm", "Height (cm)", false, "number", "0.00"],
    ["stock_alert_threshold", "Low Stock Alert Threshold", false, "number", "5"],
  ],
];

const skuAliases = {
  "পাঞ্জাবি": "PNJ",
  "পাঞ্জাবী": "PNJ",
  panjabi: "PNJ",
  punjabi: "PNJ",
  mobile: "MOB",
  "মোবাইল": "MOB",
  shirt: "SHT",
  "শার্ট": "SHT",
  tshirt: "TSH",
  saree: "SRE",
  "শাড়ি": "SRE",
};

export function suggestBaseSku(name, category) {
  const replaceAliases = (value) =>
    Object.entries(skuAliases).reduce(
      (result, [source, target]) => result.replaceAll(source, target),
      String(value || "").toLowerCase()
    );
  const words = replaceAliases(name).match(/[a-z0-9]+/g) || [];
  const categoryToken = (replaceAliases(category).match(/[a-z0-9]+/g) || ["PRD"])[0]
    .slice(0, 3)
    .toUpperCase();
  if (!words.length) return "";
  const numericModel = [...words].reverse().find((word) => /\d/.test(word));
  let model =
    words.length > 1
      ? words.slice(1, 3).join("").slice(0, 6).toUpperCase()
      : words[0].slice(0, 6).toUpperCase();
  if (numericModel) {
    model = /^\d+$/.test(numericModel)
      ? (words[1] || words[0]).slice(0, 2).toUpperCase() + numericModel
      : numericModel.toUpperCase();
  }
  const candidate =
    words.length > 1
      ? words[0].slice(0, 3).toUpperCase() + "-" + model
      : categoryToken + "-" + model;
  return candidate.replace(/[^A-Z0-9-]/g, "").slice(0, 15);
}

export function suggestVariantSku(baseSku, attributesText) {
  const aliases = {
    black: "BLK",
    "কালো": "BLK",
    white: "WHT",
    "সাদা": "WHT",
    red: "RED",
    "লাল": "RED",
    blue: "BLU",
    "নীল": "BLU",
    green: "GRN",
    "সবুজ": "GRN",
  };
  const values = String(attributesText || "")
    .split(",")
    .map((entry) => (entry.includes(":") ? entry.split(":")[1]?.trim() : entry.trim()) || "")
    .filter(Boolean)
    .map((value) => {
      const normalized = aliases[value.toLowerCase()] || value;
      return normalized
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
    });
  return [baseSku, ...values].filter(Boolean).join("-").slice(0, 100);
}

export function getCategoryParts(categoryStr) {
  if (!categoryStr) return { leaf: "Uncategorized", parent: "", full: "" };
  const parts = String(categoryStr)
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return { leaf: categoryStr, parent: "", full: categoryStr };
  }
  return {
    leaf: parts[parts.length - 1],
    parent: parts.slice(0, -1).join(" › "),
    full: categoryStr,
  };
}

export function parseAttributesText(text) {
  if (!text) return {};
  if (typeof text === "object" && !Array.isArray(text)) return text;

  const raw = String(text).trim();
  if (!raw) return {};

  const result = {};

  // 1. Multiline text (e.g., pasted specification block)
  if (raw.includes("\n")) {
    const lines = raw.split(/\r?\n+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const val = trimmed.slice(colonIdx + 1).trim();
        if (key && val) {
          result[key] = val;
        }
      }
    }
    return result;
  }

  // 2. Semicolon or comma-separated pairs
  const regex = /([^:;,]+?)\s*:\s*([^;]+?)(?=(?:[,;]\s*[^:;,]+?:|$))/g;
  let match;
  let matchedAny = false;
  while ((match = regex.exec(raw)) !== null) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.endsWith(",")) val = val.slice(0, -1).trim();
    if (key && val) {
      result[key] = val;
      matchedAny = true;
    }
  }

  if (matchedAny) return result;

  // 3. Fallback single colon pair
  const colonIdx = raw.indexOf(":");
  if (colonIdx > 0) {
    const key = raw.slice(0, colonIdx).trim();
    const val = raw.slice(colonIdx + 1).trim();
    if (key && val) {
      result[key] = val;
    }
  }

  return result;
}

export function formatAttributesObject(attrs, separator = "\n") {
  if (!attrs || typeof attrs !== "object") return "";
  return Object.entries(attrs)
    .map(([key, value]) => `${key}: ${value}`)
    .join(separator);
}

export function getEffectiveStock(product) {
  const variants = product?.variants || [];
  if (variants.length > 0) {
    return variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
  }
  return Number(product?.initial_stock || 0);
}

export function getStockBadge(product) {
  const stock = getEffectiveStock(product);
  const threshold = Number(product?.stock_alert_threshold ?? 5);
  if (stock <= 0) {
    return {
      label: "Out of stock",
      display: "Out of stock",
      tone: "bg-rose-50 text-rose-700 border-rose-200/70",
      dot: "bg-rose-500",
      code: "out",
      stock,
    };
  }
  if (stock <= threshold) {
    return {
      label: "Low stock",
      display: `Low: ${stock} left`,
      tone: "bg-amber-50 text-amber-800 border-amber-200/70",
      dot: "bg-amber-500",
      code: "low",
      stock,
    };
  }
  return {
    label: "In stock",
    display: `${stock} in stock`,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    dot: "bg-emerald-500",
    code: "in",
    stock,
  };
}

function InputField({ definition, value, onChange, error }) {
  const [key, label, required, type, placeholder] = definition;
  if (key === "category") {
    return (
      <div className="block text-sm font-semibold text-slate-700">
        <span className="flex items-center justify-between mb-1.5">
          <span>
            {label}
            {required && <span className="text-rose-500"> *</span>}
          </span>
          {error && <span className="text-xs font-normal text-rose-600">{error}</span>}
        </span>
        <AdvancedCategoryPicker
          value={value}
          onChange={(cat) => onChange(key, cat)}
          error={error}
          placeholder={placeholder || "Select category or type to search..."}
        />
      </div>
    );
  }
  return (
    <label className="block text-sm font-semibold text-slate-700">
      <span className="flex items-center justify-between">
        <span>
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </span>
        {error && <span className="text-xs font-normal text-rose-600">{error}</span>}
      </span>
      <input
        required={required}
        type={type || "text"}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "any" : undefined}
        placeholder={placeholder || ""}
        value={value}
        onChange={(event) => onChange(key, event.target.value)}
        className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm font-normal outline-none transition ${error
          ? "border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
          : "border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          }`}
      />
    </label>
  );
}

function ProductsPageContent() {
  const { user } = useAuth();
  const canViewCostProfit =
    user?.team_context?.permissions?.tasks?.products_view_cost_profit !== false;
  const router = useRouter();
  const searchParams = useSearchParams();
  const editQueryId = searchParams?.get("edit");
  const tabQuery = searchParams?.get("tab");

  // Main 4-Way Switch: 'list' | 'add' | 'analytics' | 'promotions' | 'spreadsheet'
  const [activeTab, setActiveTab] = useState(
    editQueryId || tabQuery === "add"
      ? "add"
      : tabQuery === "analytics"
        ? "analytics"
        : tabQuery === "promotions"
          ? "promotions"
          : "list"
  );

  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [variantDraft, setVariantDraft] = useState({ attributes_text: "", sku: "", price: "", stock: "0" });
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [galleryVariantKey, setGalleryVariantKey] = useState("");
  const [galleryFileAssignments, setGalleryFileAssignments] = useState({}); // { [fileKey]: variantKey }
  const [activeVariantImageModal, setActiveVariantImageModal] = useState(null); // variantIndex or null
  const [variantModalTab, setVariantModalTab] = useState("gallery"); // 'gallery' | 'device' | 'product'
  const [variantLibrarySearch, setVariantLibrarySearch] = useState("");
  const [existingGallery, setExistingGallery] = useState([]);
  const [libraryAssets, setLibraryAssets] = useState([]);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [skuTouched, setSkuTouched] = useState(false);
  const [skuLocked, setSkuLocked] = useState(true);
  const [variantSkuTouched, setVariantSkuTouched] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // 1-Click Quick Offer Modal States
  const [promotions, setPromotions] = useState([]);
  const [offerModalProduct, setOfferModalProduct] = useState(null);
  const [offerType, setOfferType] = useState("percentage"); // "percentage" | "fixed" | "free_shipping" | "custom_price"
  const [offerPreset, setOfferPreset] = useState("10"); // "10", "15", "20", "30", "50_flat", "100_flat", "200_flat", "free_shipping", "custom"
  const [customSalePrice, setCustomSalePrice] = useState("");
  const [customDiscountVal, setCustomDiscountVal] = useState("10");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quickDuration, setQuickDuration] = useState("forever"); // "forever" | "24h" | "3d" | "7d" | "custom"
  const [showCountdown, setShowCountdown] = useState(true);
  const [bannerMessage, setBannerMessage] = useState("");
  const [isSavingOffer, setIsSavingOffer] = useState(false);

  // Helper to determine active offer for a product
  const getProductOffer = (prod) => {
    if (!prod) return null;
    const base = Number(prod.base_price || 0);
    const sale = Number(prod.sale_price || 0);
    const prodId = Number(prod.id);

    // 1. Check promotions table first (Free shipping, campaigns, etc.)
    const matched = promotions.find((p) => {
      if (!p.is_active) return false;
      const ids = [
        ...(Array.isArray(p.applicable_product_ids) ? p.applicable_product_ids : []),
        ...(Array.isArray(p.applicable_products) ? p.applicable_products : []),
      ].map((id) => Number(typeof id === "object" ? id.id : id));
      return ids.includes(prodId);
    });

    if (matched) {
      if (matched.is_free_shipping) {
        return {
          type: "free_shipping",
          label: sale > 0 && sale < base ? `ফ্রি ডেলিভারি + ৳${base - sale} ছাড়` : "ফ্রি ডেলিভারি",
          badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
          promo: matched,
          isFreeShipping: true,
        };
      }
      if (Number(matched.discount_percentage) > 0) {
        return {
          type: "percentage",
          label: `${matched.discount_percentage}% ছাড়`,
          badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
          promo: matched,
        };
      }
      if (Number(matched.discount_amount) > 0) {
        return {
          type: "fixed",
          label: `৳${parseInt(matched.discount_amount)} ছাড়`,
          badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
          promo: matched,
        };
      }
      return {
        type: "promo",
        label: matched.title || "ক্যাম্পেইন অফার",
        badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
        promo: matched,
      };
    }

    // 2. Direct Sale Discount if no standalone campaign
    if (sale > 0 && sale < base) {
      const diff = base - sale;
      const pct = Math.round((diff / base) * 100);
      return {
        type: "sale_discount",
        label: `${pct}% ছাড় (৳${diff})`,
        badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
        amount: diff,
        salePrice: sale,
      };
    }

    return null;
  };

  // Real-time financial metrics for the current product form
  const financialMetrics = useMemo(() => {
    const base = parseFloat(form.base_price) || 0;
    const sale = parseFloat(form.sale_price) || 0;
    const cost = parseFloat(form.cost_price) || 0;
    const stock = parseFloat(form.initial_stock) || 0;

    const effectivePrice = sale > 0 ? sale : base;
    const hasPrices = effectivePrice > 0;
    const discount = base > 0 && sale > 0 && base > sale ? base - sale : 0;
    const discountPercent = base > 0 && discount > 0 ? Number(((discount / base) * 100).toFixed(1)) : 0;

    const unitProfit = cost > 0 && hasPrices ? effectivePrice - cost : null;
    const marginPercent = unitProfit !== null && effectivePrice > 0 ? Number(((unitProfit / effectivePrice) * 100).toFixed(1)) : null;
    const markupPercent = unitProfit !== null && cost > 0 ? Number(((unitProfit / cost) * 100).toFixed(1)) : null;
    const isLoss = unitProfit !== null && unitProfit < 0;

    const totalStockCost = cost > 0 && stock > 0 ? cost * stock : 0;
    const totalPotentialRevenue = hasPrices && stock > 0 ? effectivePrice * stock : 0;
    const totalPotentialProfit = totalStockCost > 0 && totalPotentialRevenue > 0 ? totalPotentialRevenue - totalStockCost : 0;

    return {
      base,
      sale,
      cost,
      stock,
      effectivePrice,
      hasPrices,
      discount,
      discountPercent,
      unitProfit,
      marginPercent,
      markupPercent,
      isLoss,
      totalStockCost,
      totalPotentialRevenue,
      totalPotentialProfit,
    };
  }, [form.base_price, form.sale_price, form.cost_price, form.initial_stock]);

  // Overall catalog financial valuation summary
  const catalogFinancials = useMemo(() => {
    let lockedCapital = 0;
    let potentialTurnover = 0;
    let totalStockUnits = 0;
    let lossCount = 0;
    let totalMarginSum = 0;
    let marginCount = 0;

    products.forEach((p) => {
      if (p.is_archived) return;
      const stock = Number(p.initial_stock || 0);
      const base = Number(p.base_price || 0);
      const sale = Number(p.sale_price || 0);
      const cost = Number(p.cost_price || 0);
      const eff = sale > 0 ? sale : base;

      totalStockUnits += stock;
      if (cost > 0) {
        lockedCapital += cost * stock;
        if (eff > 0) {
          const profit = eff - cost;
          const margin = (profit / eff) * 100;
          totalMarginSum += margin;
          marginCount += 1;
          if (eff < cost) lossCount += 1;
        }
      }
      if (eff > 0) {
        potentialTurnover += eff * stock;
      }
    });

    const potentialProfit = potentialTurnover > lockedCapital ? potentialTurnover - lockedCapital : 0;
    const avgMargin = marginCount > 0 ? Number((totalMarginSum / marginCount).toFixed(1)) : 0;

    return {
      lockedCapital,
      potentialTurnover,
      potentialProfit,
      totalStockUnits,
      lossCount,
      avgMargin,
    };
  }, [products]);

  // Helper to collect all images associated with a specific variant
  const getVariantImages = (variant, index) => {
    const images = [];
    const targetKey = variant?.id ? `id:${variant.id}` : String(index);

    // 1. Existing gallery images (in edit mode)
    if (editingProduct && existingGallery.length > 0) {
      existingGallery.forEach((img) => {
        if (img.variant_id && (img.variant_id === variant?.id || String(img.variant_id) === String(variant?.id))) {
          images.push({
            type: "existing",
            id: img.id,
            url: img.image,
            is_primary: img.is_primary,
          });
        }
      });
    }

    // 2. Newly uploaded files in current form
    galleryFiles.forEach((file, fileIdx) => {
      const fileKey = `${file.name}_${fileIdx}`;
      const assignedKey = galleryFileAssignments[fileKey] ?? galleryVariantKey;
      if (assignedKey === targetKey) {
        images.push({
          type: "file",
          fileKey,
          file,
          url: URL.createObjectURL(file),
        });
      }
    });

    // 3. Selected library assets
    selectedLibraryIds.forEach((assetId) => {
      const assignedKey = selectedLibraryAssignments[assetId] ?? galleryVariantKey;
      if (assignedKey === targetKey) {
        const asset = libraryAssets.find((a) => a.id === assetId);
        if (asset) {
          images.push({
            type: "library",
            id: assetId,
            url: asset.image,
          });
        }
      }
    });

    return images;
  };

  // List filters & state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState("active");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("table");
  const [paginationMode, setPaginationMode] = useState("pages");
  const [page, setPage] = useState(1);
  const [infiniteLimit, setInfiniteLimit] = useState(12);
  const [dirty, setDirty] = useState(false);

  // Responsive & Modals/Drawers
  const [openMenuProductId, setOpenMenuProductId] = useState(null);
  const [mobileActionProduct, setMobileActionProduct] = useState(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [detailsDrawerProduct, setDetailsDrawerProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteMode, setDeleteMode] = useState("archive");
  const [deleting, setDeleting] = useState(false);
  const [variantManagerProduct, setVariantManagerProduct] = useState(null);

  const formRef = useRef(null);
  const loadedEditQueryIdRef = useRef(null);

  const loadImageLibrary = async () => {
    setLibraryLoading(true);
    try {
      const response = await api.get("/datasheet/product-image-library/");
      setLibraryAssets(response.data || []);
    } catch {
      toast.error("Image Gallery could not be loaded");
    } finally {
      setLibraryLoading(false);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get("/datasheet/products/?include_archived=true");
      setProducts(response.data || []);
    } catch (error) {
      console.error("Product load failed", error);
      toast.error(error?.response?.status === 401 ? "Please sign in again" : "Products could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  const loadPromotions = async () => {
    try {
      const res = await api.get("storefront/v1/merchant/promotions/");
      setPromotions(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silently ignore if not yet configured
    }
  };

  const applyQuickDuration = (duration) => {
    setQuickDuration(duration);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const toLocalISO = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setStartDate(toLocalISO(now));
    if (duration === "forever") {
      setHasExpiry(false);
      setEndDate("");
    } else if (duration === "24h") {
      setHasExpiry(true);
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setEndDate(toLocalISO(end));
    } else if (duration === "3d") {
      setHasExpiry(true);
      const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      setEndDate(toLocalISO(end));
    } else if (duration === "7d") {
      setHasExpiry(true);
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setEndDate(toLocalISO(end));
    } else {
      setHasExpiry(true);
    }
  };

  const handleOpenQuickOffer = (product) => {
    setOfferModalProduct(product);
    const base = Number(product.base_price || 0);
    const sale = Number(product.sale_price || 0);

    const pad = (n) => String(n).padStart(2, "0");
    const toLocalISO = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    // Find any existing campaign linked to this product (robust type coercion)
    const prodId = Number(product.id);
    const existingPromo = promotions.find((p) => {
      const ids = [
        ...(Array.isArray(p.applicable_product_ids) ? p.applicable_product_ids : []),
        ...(Array.isArray(p.applicable_products) ? p.applicable_products : []),
      ].map((id) => Number(typeof id === "object" ? id.id : id));
      return ids.includes(prodId);
    });

    if (existingPromo) {
      if (existingPromo.is_free_shipping) {
        setOfferType("free_shipping");
        setOfferPreset("free_shipping");
        setCustomDiscountVal("0");
        setCustomSalePrice(String(sale > 0 ? sale : base));
      } else if (Number(existingPromo.discount_percentage) > 0) {
        setOfferType("percentage");
        const pct = String(Math.round(Number(existingPromo.discount_percentage)));
        setOfferPreset(["10", "15", "20", "30"].includes(pct) ? pct : "custom");
        setCustomDiscountVal(pct);
        setCustomSalePrice(String(Math.round(base * (1 - Number(pct) / 100))));
      } else if (Number(existingPromo.discount_amount) > 0) {
        setOfferType("fixed");
        const amt = String(Math.round(Number(existingPromo.discount_amount)));
        setOfferPreset(["50_flat", "100_flat", "200_flat"].includes(`${amt}_flat`) ? `${amt}_flat` : "custom");
        setCustomDiscountVal(amt);
        setCustomSalePrice(String(Math.max(0, base - Number(amt))));
      }

      if (existingPromo.start_date) {
        setStartDate(toLocalISO(new Date(existingPromo.start_date)));
      } else {
        setStartDate(toLocalISO(new Date()));
      }

      if (existingPromo.end_date) {
        setHasExpiry(true);
        setEndDate(toLocalISO(new Date(existingPromo.end_date)));
        setQuickDuration("custom");
      } else {
        setHasExpiry(false);
        setEndDate("");
        setQuickDuration("forever");
      }

      setShowCountdown(existingPromo.show_countdown_timer !== false);
      setBannerMessage(existingPromo.banner_message || "");
    } else if (sale > 0 && sale < base) {
      const diff = base - sale;
      const pct = Math.round((diff / base) * 100);
      setOfferType("percentage");
      setOfferPreset(["10", "15", "20", "30"].includes(String(pct)) ? String(pct) : "custom");
      setCustomDiscountVal(String(pct));
      setCustomSalePrice(String(sale));
      setHasExpiry(false);
      setStartDate(toLocalISO(new Date()));
      setEndDate("");
      setQuickDuration("forever");
      setShowCountdown(true);
      setBannerMessage(`⚡ ধামাকা অফার: ${product.name} এ ${pct}% বিশেষ ছাড়!`);
    } else {
      // Default: 10% Off
      setOfferType("percentage");
      setOfferPreset("10");
      setCustomDiscountVal("10");
      setCustomSalePrice(String(Math.round(base * 0.9)));
      setHasExpiry(false);
      setStartDate(toLocalISO(new Date()));
      setEndDate("");
      setQuickDuration("forever");
      setShowCountdown(true);
      setBannerMessage(`⚡ ধামাকা অফার: ${product.name} এ ১০% বিশেষ ছাড়!`);
    }
  };

  const handleApplyQuickOffer = async () => {
    if (!offerModalProduct) return;
    setIsSavingOffer(true);
    const base = Number(offerModalProduct.base_price || 0);
    const prodId = Number(offerModalProduct.id);
    let targetSalePrice = null;

    let promoData = {
      applicable_product_ids: [prodId],
      is_active: true,
      banner_message: bannerMessage || `⚡ ধামাকা অফার: ${offerModalProduct.name} এ বিশেষ ছাড়!`,
      show_countdown_timer: showCountdown,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: hasExpiry && endDate ? new Date(endDate).toISOString() : null,
    };

    if (offerType === "free_shipping") {
      promoData.title = `${offerModalProduct.name} - ফ্রি ডেলিভারি অফার`;
      promoData.promotion_type = "free_shipping";
      promoData.is_free_shipping = true;
      promoData.min_order_amount = 0;
      targetSalePrice = offerModalProduct.sale_price ? Number(offerModalProduct.sale_price) : null;
    } else if (offerType === "percentage") {
      const pct = parseFloat(customDiscountVal) || 10;
      targetSalePrice = Math.round(base * (1 - pct / 100));
      promoData.title = `${offerModalProduct.name} - ${pct}% ছাড়`;
      promoData.promotion_type = "percentage_discount";
      promoData.discount_percentage = pct;
    } else if (offerType === "fixed") {
      const amt = parseFloat(customDiscountVal) || 100;
      targetSalePrice = Math.max(0, base - amt);
      promoData.title = `${offerModalProduct.name} - ৳${amt} ছাড়`;
      promoData.promotion_type = "fixed_discount";
      promoData.discount_amount = amt;
    } else if (offerType === "custom_price") {
      targetSalePrice = parseFloat(customSalePrice) || null;
      if (targetSalePrice !== null && targetSalePrice < base) {
        const diff = base - targetSalePrice;
        const pct = Math.round((diff / base) * 100);
        promoData.title = `${offerModalProduct.name} - ৳${targetSalePrice} বিশেষ অফার`;
        promoData.promotion_type = "fixed_discount";
        promoData.discount_amount = diff;
      }
    }

    try {
      // 1. Update Product model sale_price
      await api.put(`/datasheet/products/${prodId}/`, {
        sale_price: targetSalePrice,
      });

      // 2. Check if a promotion already exists for this product to update or create
      const existingPromo = promotions.find((p) => {
        const ids = [
          ...(Array.isArray(p.applicable_product_ids) ? p.applicable_product_ids : []),
          ...(Array.isArray(p.applicable_products) ? p.applicable_products : []),
        ].map((id) => Number(typeof id === "object" ? id.id : id));
        return ids.includes(prodId);
      });

      if (existingPromo) {
        await api.put("storefront/v1/merchant/promotions/", {
          id: existingPromo.id,
          ...promoData,
        });
      } else {
        await api.post("storefront/v1/merchant/promotions/", promoData);
      }

      toast.success(
        offerType === "free_shipping"
          ? "ফ্রি ডেলিভারি অফার সফলভাবে কার্যকর করা হয়েছে!"
          : "অফার সফলভাবে সংরক্ষণ ও কার্যকর করা হয়েছে!"
      );
      setOfferModalProduct(null);
      await loadProducts();
      await loadPromotions();
    } catch (err) {
      console.error("Failed to apply offer:", err);
      const msg = err?.response?.data
        ? typeof err.response.data === "object"
          ? JSON.stringify(err.response.data)
          : String(err.response.data)
        : err?.message || "অফার সেভ করতে সমস্যা হয়েছে।";
      toast.error(`অফার সেভ করা যায়নি: ${msg}`);
    } finally {
      setIsSavingOffer(false);
    }
  };

  const handleRemoveQuickOffer = async (product) => {
    const p = product || offerModalProduct;
    if (!p) return;
    setIsSavingOffer(true);
    const prodId = Number(p.id);
    try {
      await api.put(`/datasheet/products/${prodId}/`, {
        sale_price: null,
      });

      const matched = promotions.filter((promo) => {
        const ids = [
          ...(Array.isArray(promo.applicable_product_ids) ? promo.applicable_product_ids : []),
          ...(Array.isArray(promo.applicable_products) ? promo.applicable_products : []),
        ].map((id) => Number(typeof id === "object" ? id.id : id));
        return ids.includes(prodId);
      });

      for (const m of matched) {
        await api.delete(`storefront/v1/merchant/promotions/?id=${m.id}`);
      }

      toast.success("অফারটি সফলভাবে বাতিল ও রিমুভ করা হয়েছে।");
      setOfferModalProduct(null);
      await loadProducts();
      await loadPromotions();
    } catch (err) {
      console.error("Failed to remove offer:", err);
      toast.error("অফার বাতিল করতে সমস্যা হয়েছে।");
    } finally {
      setIsSavingOffer(false);
    }
  };

  useEffect(() => {
    loadProducts();
    loadImageLibrary();
    loadPromotions();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!editQueryId || !products.length) return;
    if (loadedEditQueryIdRef.current === String(editQueryId)) return;
    const found = products.find((item) => String(item.id) === String(editQueryId));
    if (found && editingProduct?.id !== found.id) {
      loadedEditQueryIdRef.current = String(editQueryId);
      beginEdit(found);
    }
  }, [editQueryId, products]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        if (archiveFilter === "active" && product.is_archived) return false;
        if (archiveFilter === "archived" && !product.is_archived) return false;

        const needle = search.trim().toLowerCase();
        const matchesSearch =
          !needle ||
          [
            product.name,
            product.category,
            product.base_sku,
            ...(product.variants || []).map((v) => v.sku),
          ].some((value) => String(value || "").toLowerCase().includes(needle));

        const badge = getStockBadge(product);
        const matchesStock =
          stockFilter === "all" ||
          (stockFilter === "in" && badge.code === "in") ||
          (stockFilter === "low" && badge.code === "low") ||
          (stockFilter === "out" && badge.code === "out");

        const matchesStatus = statusFilter === "all" || product.status === statusFilter;
        const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;

        return matchesSearch && matchesStatus && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        if (sort === "name") return String(a.name).localeCompare(String(b.name));
        if (sort === "price_asc") {
          return Number(a.sale_price || a.base_price || 0) - Number(b.sale_price || b.base_price || 0);
        }
        if (sort === "price") {
          return Number(b.sale_price || b.base_price || 0) - Number(a.sale_price || a.base_price || 0);
        }
        if (sort === "stock") {
          return getEffectiveStock(b) - getEffectiveStock(a);
        }
        return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
      });
  }, [products, archiveFilter, search, stockFilter, statusFilter, categoryFilter, sort]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts =
    paginationMode === "infinite"
      ? filteredProducts.slice(0, infiniteLimit)
      : filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  const populateFormFromProduct = (product) => {
    setForm({
      ...blankForm,
      ...product,
      initial_stock: String(product.initial_stock ?? "0"),
      base_price: String(product.base_price ?? ""),
      sale_price: product.sale_price == null ? "" : String(product.sale_price),
      cost_price: product.cost_price == null ? "" : String(product.cost_price),
      weight_kg: product.weight_kg == null ? "" : String(product.weight_kg),
      dimension_length_cm: product.dimension_length_cm == null ? "" : String(product.dimension_length_cm),
      dimension_width_cm: product.dimension_width_cm == null ? "" : String(product.dimension_width_cm),
      dimension_height_cm: product.dimension_height_cm == null ? "" : String(product.dimension_height_cm),
      stock_alert_threshold: String(product.stock_alert_threshold ?? "5"),
      attributes_text: formatAttributesObject(product.attributes),
      voice_audio_file: null,
      voice_audio_file_url: product.voice_audio_file || "",
      variants: (product.variants || []).map((variant) => ({
        ...variant,
        attributes_text: formatAttributesObject(variant.attributes),
        price: variant.price == null ? "" : String(variant.price),
        stock: String(variant.stock ?? "0"),
      })),
    });
    setExistingGallery(
      [...(product.gallery || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    );
  };

  const beginEdit = (product) => {
    if (dirty && editingProduct?.id !== product.id) {
      if (!window.confirm("You have unsaved changes. Discard them and edit this product?")) {
        return;
      }
    }
    loadedEditQueryIdRef.current = String(product.id);
    setEditingProduct(product);
    populateFormFromProduct(product);
    setSkuTouched(true);
    setSkuLocked(true);
    setValidationErrors({});
    setDirty(false);
    setOpenMenuProductId(null);
    setMobileActionProduct(null);
    setActiveTab("add");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetFormToBlank = () => {
    loadedEditQueryIdRef.current = null;
    setEditingProduct(null);
    setForm(blankForm);
    setExistingGallery([]);
    setGalleryFiles([]);
    setGalleryVariantKey("");
    setGalleryFileAssignments({});
    setSelectedLibraryAssignments({});
    setActiveVariantImageModal(null);
    setSelectedLibraryIds([]);
    setSkuTouched(false);
    setSkuLocked(true);
    setVariantSkuTouched(false);
    setEditingVariantIndex(null);
    setVariantDraft({ attributes_text: "", sku: "", price: "", stock: "0" });
    setValidationErrors({});
    setDirty(false);
  };

  const cancelEdit = () => {
    if (dirty && !window.confirm("Discard unsaved product changes?")) return;
    loadedEditQueryIdRef.current = null;
    resetFormToBlank();
    setActiveTab("list");
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", "/dashboard/products");
    }
    router.replace("/dashboard/products");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenAddProduct = () => {
    if (activeTab === "add" && !editingProduct) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (dirty && !window.confirm("You have unsaved changes. Discard and create a new product?")) {
      return;
    }
    loadedEditQueryIdRef.current = null;
    resetFormToBlank();
    setActiveTab("add");
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", "/dashboard/products?tab=add");
    }
    router.replace("/dashboard/products?tab=add");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicateProduct = async (product) => {
    setOpenMenuProductId(null);
    setMobileActionProduct(null);
    try {
      const { id, created_at, updated_at, gallery, variants, is_archived, ...copy } = product;
      await api.post("/datasheet/products/", {
        ...copy,
        name: product.name + " (Copy)",
        base_sku: "",
        variants: (variants || []).map(({ id: variantId, sku, ...variant }) => ({
          ...variant,
          sku: "",
        })),
      });
      await loadProducts();
      toast.success("Product duplicated");
    } catch {
      toast.error("Product could not be duplicated");
    }
  };

  const confirmSafeDelete = (product) => {
    setOpenMenuProductId(null);
    setMobileActionProduct(null);
    setDeleteTarget(product);
    setDeleteMode(product.is_archived ? "permanent" : "archive");
  };

  const executeSafeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteMode === "permanent") {
        await api.delete(`/datasheet/products/${deleteTarget.id}/?permanent=true`);
        toast.success(`"${deleteTarget.name}" permanently deleted`);
      } else {
        await api.delete(`/datasheet/products/${deleteTarget.id}/`);
        toast.success(`"${deleteTarget.name}" archived`);
      }
      if (editingProduct?.id === deleteTarget.id) {
        resetFormToBlank();
        setActiveTab("list");
      }
      if (detailsDrawerProduct?.id === deleteTarget.id) {
        setDetailsDrawerProduct(null);
      }
      setDeleteTarget(null);
      await loadProducts();
    } catch {
      toast.error("Action could not be completed");
    } finally {
      setDeleting(false);
    }
  };

  const restoreArchivedProduct = async (product) => {
    try {
      await api.post(`/datasheet/products/${product.id}/archive/`, { archived: false });
      toast.success(`"${product.name}" restored to active catalog`);
      await loadProducts();
    } catch {
      toast.error("Could not restore product");
    }
  };

  const toggleProductStatus = async (product) => {
    const nextStatus = product.status === "active" ? "inactive" : "active";
    try {
      await api.put(`/datasheet/products/${product.id}/`, { status: nextStatus });
      toast.success(`Product marked ${nextStatus}`);
      await loadProducts();
    } catch {
      toast.error("Could not update product status");
    }
  };

  const deleteExistingGalleryImage = async (productId, imageId) => {
    try {
      await api.delete(`/datasheet/products/${productId}/gallery/${imageId}/`);
      setExistingGallery((curr) => curr.filter((img) => img.id !== imageId));
      await loadProducts();
      toast.success("Image removed");
    } catch {
      toast.error("Image could not be removed");
    }
  };

  const updateExistingGalleryImageVariant = async (productId, imageId, variantId) => {
    try {
      const res = await api.patch(`/datasheet/products/${productId}/gallery/${imageId}/edit/`, {
        variant_id: variantId ? Number(variantId) : null,
      });
      setExistingGallery((curr) =>
        curr.map((img) => (img.id === imageId ? { ...img, variant_id: res.data.variant_id } : img))
      );
      await loadProducts();
      toast.success("Image assignment updated");
    } catch {
      toast.error("Could not update image assignment");
    }
  };

  const setPrimaryExistingGalleryImage = async (productId, imageId) => {
    try {
      await api.patch(`/datasheet/products/${productId}/gallery/${imageId}/edit/`, {
        is_primary: true,
      });
      setExistingGallery((curr) =>
        curr.map((img) => ({ ...img, is_primary: img.id === imageId }))
      );
      await loadProducts();
      toast.success("Primary image updated");
    } catch {
      toast.error("Could not set primary image");
    }
  };

  const reorderExistingGallery = async (productId, index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= existingGallery.length) return;
    const copy = [...existingGallery];
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
    setExistingGallery(copy);
    try {
      const positions = Object.fromEntries(copy.map((item, idx) => [item.id, idx]));
      await api.post(`/datasheet/products/${productId}/gallery/reorder/`, { positions });
      await loadProducts();
    } catch {
      toast.error("Could not save image order");
    }
  };

  const setValue = (key, value) => {
    setDirty(true);
    setValidationErrors((prev) => ({ ...prev, [key]: undefined }));
    if (key === "base_sku") setSkuTouched(true);
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (!skuTouched && !editingProduct && (key === "name" || key === "category")) {
        next.base_sku = suggestBaseSku(
          key === "name" ? value : next.name,
          key === "category" ? value : next.category
        );
      }
      return next;
    });
  };

  const setVariantDraftValue = (key, value) => {
    setDirty(true);
    if (key === "sku") setVariantSkuTouched(true);
    setVariantDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "attributes_text" && !variantSkuTouched) {
        next.sku = suggestVariantSku(
          form.base_sku || suggestBaseSku(form.name, form.category),
          value
        );
      }
      return next;
    });
  };

  const addOrUpdateVariant = () => {
    const baseSku = form.base_sku || suggestBaseSku(form.name, form.category);
    const suggestedVariantSku = suggestVariantSku(baseSku, variantDraft.attributes_text);
    const variantSku = (variantDraft.sku || "").trim().toUpperCase() || suggestedVariantSku;
    if (!variantDraft.attributes_text.trim() && !variantSku) {
      toast.error("Add variant attributes (e.g., Size: L, Color: Black) or a SKU first");
      return;
    }
    const attributes = parseAttributesText(variantDraft.attributes_text);
    if (variantDraft.attributes_text.trim() && Object.keys(attributes).length === 0) {
      toast.error("Use format 'Key: Value, Key2: Value2' (e.g. Size: L, Color: Black)");
      return;
    }
    const duplicateInForm = form.variants.some(
      (v, idx) => idx !== editingVariantIndex && v.sku && v.sku.toUpperCase() === variantSku
    );
    if (duplicateInForm) {
      toast.error(`Variant SKU "${variantSku}" is already used in this product`);
      return;
    }

    setDirty(true);
    const newEntry = {
      ...(editingVariantIndex !== null && form.variants[editingVariantIndex]?.id
        ? { id: form.variants[editingVariantIndex].id }
        : {}),
      attributes,
      attributes_text: formatAttributesObject(attributes),
      sku: variantSku,
      price: variantDraft.price === "" ? null : variantDraft.price,
      stock: variantDraft.stock || "0",
    };

    setForm((current) => {
      if (editingVariantIndex !== null) {
        const updated = [...current.variants];
        updated[editingVariantIndex] = newEntry;
        return { ...current, variants: updated };
      }
      return { ...current, variants: [...current.variants, newEntry] };
    });

    setVariantDraft({ attributes_text: "", sku: "", price: "", stock: "0" });
    setEditingVariantIndex(null);
    setVariantSkuTouched(false);
  };

  const editVariantRow = (index) => {
    const v = form.variants[index];
    if (!v) return;
    setEditingVariantIndex(index);
    setVariantDraft({
      attributes_text: v.attributes_text || formatAttributesObject(v.attributes),
      sku: v.sku || "",
      price: v.price == null ? "" : String(v.price),
      stock: String(v.stock ?? "0"),
    });
    setVariantSkuTouched(true);
  };

  const updateInlineVariantField = (index, field, value) => {
    setDirty(true);
    setForm((current) => {
      const nextVariants = [...current.variants];
      const item = { ...nextVariants[index], [field]: value };
      if (field === "attributes_text") {
        item.attributes = parseAttributesText(value);
      }
      nextVariants[index] = item;
      return { ...current, variants: nextVariants };
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) {
      errors.name = "Product name is required";
    }
    const basePrice = Number(form.base_price);
    if (String(form.base_price).trim() === "" || Number.isNaN(basePrice) || basePrice < 0) {
      errors.base_price = "Valid base price is required";
    }
    if (form.sale_price !== "" && form.sale_price != null) {
      const salePrice = Number(form.sale_price);
      if (Number.isNaN(salePrice) || salePrice < 0) {
        errors.sale_price = "Invalid sale price";
      } else if (!Number.isNaN(basePrice) && salePrice > basePrice) {
        errors.sale_price = "Sale price should not exceed base price";
      }
    }
    if (form.initial_stock !== "" && Number(form.initial_stock) < 0) {
      errors.initial_stock = "Stock cannot be negative";
    }
    const seenSkus = new Set();
    for (const v of form.variants) {
      if (v.sku) {
        const norm = v.sku.trim().toUpperCase();
        if (seenSkus.has(norm)) {
          errors.variants = `Duplicate variant SKU: ${norm}`;
          break;
        }
        seenSkus.add(norm);
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix validation errors before saving");
      return;
    }
    setSaving(true);
    try {
      const cleanNumber = (val) => (val === "" || val == null ? null : val);
      const payload = {
        name: form.name.trim(),
        category: (form.category || "").trim(),
        base_sku: (form.base_sku || "").trim(),
        initial_stock: form.initial_stock === "" ? "0" : form.initial_stock,
        description: form.description || "",
        base_price: form.base_price,
        sale_price: cleanNumber(form.sale_price),
        cost_price: cleanNumber(form.cost_price),
        weight_kg: cleanNumber(form.weight_kg),
        dimension_length_cm: cleanNumber(form.dimension_length_cm),
        dimension_width_cm: cleanNumber(form.dimension_width_cm),
        dimension_height_cm: cleanNumber(form.dimension_height_cm),
        status: form.status,
        stock_alert_threshold: form.stock_alert_threshold === "" ? "0" : form.stock_alert_threshold,
        warranty_information: form.warranty_information || "",
        attributes: form.attributes_text ? parseAttributesText(form.attributes_text) : {},
        variants: form.variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          attributes: v.attributes_text ? parseAttributesText(v.attributes_text) : v.attributes || {},
          sku: (v.sku || "").trim(),
          price: cleanNumber(v.price),
          stock: v.stock === "" || v.stock == null ? "0" : v.stock,
        })),
      };

      const response = editingProduct
        ? await api.put(`/datasheet/products/${editingProduct.id}/`, payload)
        : await api.post("/datasheet/products/", payload);

      // Upload custom voice audio file if provided
      if (form.voice_audio_file && response.data?.id) {
        const voiceFormData = new FormData();
        voiceFormData.append("voice_audio_file", form.voice_audio_file);
        await api.patch(`/datasheet/products/${response.data.id}/`, voiceFormData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else if (form.remove_voice_audio && response.data?.id) {
        await api.patch(`/datasheet/products/${response.data.id}/`, { voice_audio_file: null });
      }

      // Upload gallery files grouped by each variant
      if (galleryFiles.length > 0 && response.data?.id) {
        const fileGroups = new Map(); // targetVariantId -> File[]
        galleryFiles.forEach((file, idx) => {
          const fileKey = `${file.name}_${idx}`;
          const assignment = galleryFileAssignments[fileKey] ?? galleryVariantKey ?? "";
          let targetVariantId = null;
          if (String(assignment).startsWith("id:")) {
            targetVariantId = String(assignment).slice(3);
          } else if (assignment !== "") {
            const matchedVariant = response.data?.variants?.[Number(assignment)];
            if (matchedVariant?.id) {
              targetVariantId = String(matchedVariant.id);
            }
          }
          if (!fileGroups.has(targetVariantId)) {
            fileGroups.set(targetVariantId, []);
          }
          fileGroups.get(targetVariantId).push(file);
        });

        for (const [vId, files] of fileGroups.entries()) {
          const formData = new FormData();
          files.forEach((file) => formData.append("images", file));
          if (vId) {
            formData.append("variant_id", vId);
          }
          await api.post(`/datasheet/products/${response.data.id}/gallery/`, formData);
        }
      }

      // Link library assets with assigned variant
      if (selectedLibraryIds.length > 0 && response.data?.id) {
        await Promise.all(
          selectedLibraryIds.map((assetId) => {
            const assignment = selectedLibraryAssignments[assetId] ?? galleryVariantKey ?? "";
            let linkedVariantId = null;
            if (String(assignment).startsWith("id:")) {
              linkedVariantId = Number(String(assignment).slice(3));
            } else if (assignment !== "") {
              linkedVariantId = response.data?.variants?.[Number(assignment)]?.id || null;
            }
            return api.post(`/datasheet/product-image-library/${assetId}/link/`, {
              product_id: response.data.id,
              variant_id: linkedVariantId,
            });
          })
        );
      }

      loadedEditQueryIdRef.current = null;
      resetFormToBlank();
      setActiveTab("list");
      if (typeof window !== "undefined" && window.location.search) {
        window.history.replaceState({}, "", "/dashboard/products");
      }
      router.replace("/dashboard/products");
      window.scrollTo({ top: 0, behavior: "smooth" });
      await loadProducts();
      toast.success(editingProduct ? "Product updated successfully" : "Product created successfully");
    } catch (error) {
      console.error("Product save failed", error);
      const extractErrorMessage = (errData) => {
        if (!errData) return "Product could not be saved";
        if (typeof errData === "string") return errData;
        if (Array.isArray(errData)) {
          return errData.map(extractErrorMessage).filter(Boolean).join(", ");
        }
        if (typeof errData === "object") {
          const messages = [];
          for (const [key, value] of Object.entries(errData)) {
            const valStr = extractErrorMessage(value);
            if (valStr) {
              messages.push(key === "detail" || key === "non_field_errors" ? valStr : `${key}: ${valStr}`);
            }
          }
          return messages.join(" | ") || "Product could not be saved";
        }
        return String(errData);
      };
      const errorMsg = extractErrorMessage(error?.response?.data);
      toast.error(errorMsg || "Product could not be saved");
    } finally {
      setSaving(false);
    }
  };

  const handleTabChange = (tab) => {
    if (tab === "spreadsheet") {
      if (user?.sheet_id) {
        router.push(`/dashboard/sheet/${user.sheet_id}`);
      } else {
        toast.error("Spreadsheet is not available yet");
      }
      return;
    }
    if (tab === "add") {
      handleOpenAddProduct();
      return;
    }
    if (tab === "list") {
      cancelEdit();
      return;
    }
    if (activeTab === "add" && tab !== "add" && dirty) {
      if (!window.confirm("You have unsaved changes. Discard and proceed?")) {
        return;
      }
      resetFormToBlank();
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 p-2 sm:p-4 lg:p-6">
      <div className="mx-auto w-full max-w-[1750px]">

        {/* ChatGPT-style Segmented Nav */}
        <CatalogHeaderNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          sheetId={user?.sheet_id}
          productCount={products.filter((p) => !p.is_archived).length}
          isEditing={Boolean(editingProduct)}
          editingName={editingProduct?.name || ""}
        />

        {/* ========================================================
            TAB 1: ADD / EDIT PRODUCT FORM
           ======================================================== */}
        {activeTab === "add" && (
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-l-8 border-indigo-600 pl-4 sm:pl-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight italic uppercase">
                    {editingProduct ? `Edit Product #${editingProduct.id}` : "Create New Product"}
                  </h1>
                  {dirty && (
                    <span className="rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-black text-rose-700 shadow-xs animate-pulse">
                      Unsaved changes
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-1">
                  Add standard catalog data for reliable AI customer search, live stock & automated sales.
                </p>
              </div>
            </div>

            <form
              ref={formRef}
              onSubmit={saveProduct}
              className="rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-xl sm:p-10"
            >
              <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight">
                    {editingProduct ? "Product Specifications" : "Basic Information"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Fill in the fields below to update your inventory catalog
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel / View List
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? "Saving..." : editingProduct ? "Update Product" : "Save Product"}
                  </button>
                </div>
              </div>

              {/* Field Groups */}
              {fieldGroups.map((group, index) => (
                <div key={index} className="mb-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {group
                      .filter((def) => canViewCostProfit || def[0] !== "cost_price")
                      .map((definition) => (
                        <InputField
                          key={definition[0]}
                          definition={definition}
                          value={form[definition[0]]}
                          onChange={setValue}
                          error={validationErrors[definition[0]]}
                        />
                      ))}
                  </div>

                  {/* Real-time Financial Margin & Unit Profit Intelligence Card */}
                  {canViewCostProfit && index === 1 && (financialMetrics.hasPrices || financialMetrics.cost > 0) && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet size={15} className="text-slate-600" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            Unit Economics & Profit Breakdown
                          </span>
                        </div>
                        {financialMetrics.discountPercent > 0 && (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                            {financialMetrics.discountPercent}% Discount Applied
                          </span>
                        )}
                      </div>

                      <div className="p-4">
                        {financialMetrics.isLoss && (
                          <div className="mb-3.5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                            <div>
                              <p className="font-bold">Selling Price is Below Cost Price</p>
                              <p className="mt-0.5 text-rose-700">
                                Effective selling price (৳{financialMetrics.effectivePrice.toFixed(2)}) is lower than purchase cost (৳{financialMetrics.cost.toFixed(2)}). You will incur a loss of ৳{Math.abs(financialMetrics.unitProfit).toFixed(2)} per unit.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                            <span className="text-[11px] font-semibold text-slate-500">
                              <FinancialTooltip termKey="effective_price">Effective Selling Price</FinancialTooltip>
                            </span>
                            <p className="mt-1 text-base font-black text-slate-900">
                              ৳{financialMetrics.effectivePrice.toFixed(2)}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {financialMetrics.sale > 0 ? "From Sale Price" : "From Base Price"}
                            </span>
                          </div>

                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                            <span className="text-[11px] font-semibold text-slate-500">
                              <FinancialTooltip termKey="unit_profit">Unit Profit</FinancialTooltip>
                            </span>
                            <p className={`mt-1 text-base font-black ${financialMetrics.unitProfit === null
                              ? "text-slate-400"
                              : financialMetrics.isLoss
                                ? "text-rose-600"
                                : "text-emerald-600"
                              }`}>
                              {financialMetrics.unitProfit !== null
                                ? `${financialMetrics.unitProfit >= 0 ? "+" : ""}৳${financialMetrics.unitProfit.toFixed(2)}`
                                : "—"}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {financialMetrics.marginPercent !== null ? (
                                <FinancialTooltip termKey="gross_margin">
                                  {financialMetrics.marginPercent}% Gross Margin
                                </FinancialTooltip>
                              ) : (
                                "Set cost price to view"
                              )}
                            </span>
                          </div>

                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                            <span className="text-[11px] font-semibold text-slate-500">
                              <FinancialTooltip termKey="markup">Markup on Cost</FinancialTooltip>
                            </span>
                            <p className="mt-1 text-base font-black text-slate-800">
                              {financialMetrics.markupPercent !== null
                                ? `${financialMetrics.markupPercent}%`
                                : "—"}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              Return on inventory
                            </span>
                          </div>

                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                            <span className="text-[11px] font-semibold text-slate-500">
                              <FinancialTooltip termKey="locked_capital">Stock Capital Locked</FinancialTooltip>
                            </span>
                            <p className="mt-1 text-base font-black text-slate-800">
                              {financialMetrics.totalStockCost > 0
                                ? `৳${financialMetrics.totalStockCost.toLocaleString()}`
                                : "—"}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {financialMetrics.totalPotentialProfit > 0 ? (
                                <FinancialTooltip termKey="potential_profit">
                                  Exp. Profit: ৳{financialMetrics.totalPotentialProfit.toLocaleString()}
                                </FinancialTooltip>
                              ) : (
                                `${financialMetrics.stock} units in stock`
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Base SKU with Lock / Warning */}
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Base SKU{" "}
                    <span className="font-normal text-slate-400">
                      {editingProduct
                        ? skuLocked
                          ? "(Locked to protect existing order & variant references)"
                          : "(Unlocked — modifying Base SKU affects catalog references)"
                        : skuTouched
                          ? "(Custom SKU)"
                          : "(Auto-suggested from Product Name)"}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    {!editingProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          const suggested = suggestBaseSku(form.name, form.category);
                          setForm((curr) => ({ ...curr, base_sku: suggested }));
                          setSkuTouched(false);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        Auto-suggest SKU
                      </button>
                    )}
                    {editingProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            skuLocked &&
                            !window.confirm(
                              "Warning: Changing the Base SKU of an existing product may affect SKU lookups. Unlock to edit?"
                            )
                          ) {
                            return;
                          }
                          setSkuLocked((prev) => !prev);
                        }}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${skuLocked
                          ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          : "bg-amber-100 text-amber-800"
                          }`}
                      >
                        {skuLocked ? <Lock size={12} /> : <Unlock size={12} />}
                        {skuLocked ? "Unlock SKU" : "Unlocked"}
                      </button>
                    )}
                  </div>
                </div>
                <input
                  value={form.base_sku}
                  readOnly={Boolean(editingProduct && skuLocked)}
                  onChange={(event) => setValue("base_sku", event.target.value)}
                  placeholder="e.g., PNJ-COT01 (auto-generated)"
                  className={`mt-2 w-full rounded-xl border px-3.5 py-2.5 font-mono text-sm uppercase outline-none transition ${editingProduct && skuLocked
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                    : "border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    }`}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => setValue("status", event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active (Visible to AI Customer Search)</option>
                    <option value="inactive">Inactive (Hidden from AI)</option>
                  </select>
                </label>
              </div>

              {/* General Attributes Visual Chips Manager */}
              <div className="mt-4">
                <GeneralAttributesEditor
                  value={form.attributes_text}
                  onChange={(val) => setValue("attributes_text", val)}
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Description <span className="font-normal text-xs text-slate-400">(MS Word Style Editor)</span>
                </label>
                <WordLikeEditor
                  value={form.description}
                  onChange={(val) => setValue("description", val)}
                  placeholder="Detailed product specifications, fabric, features, warranty..."
                />
              </div>

              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Warranty Information
                <textarea
                  value={form.warranty_information}
                  onChange={(event) => setValue("warranty_information", event.target.value)}
                  rows={2}
                  placeholder="e.g., 7 days replacement warranty / No warranty"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal outline-none focus:border-indigo-500"
                />
              </label>

              {/* Call Confirmation Audio for this Product */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h4 className="text-xs font-black text-slate-800">কল কনফার্মেশন অডিও (Product Voice Audio)</h4>
                      <p className="text-[11px] text-slate-500">গ্রাহক এই পণ্যটি অর্ডার করলে এই কাস্টম অডিওটি বাজবে (MP3 / WAV)।</p>
                    </div>
                  </div>
                  {(form.voice_audio_file || form.voice_audio_file_url) && (
                    <button
                      type="button"
                      onClick={() => setForm(curr => ({ ...curr, voice_audio_file: null, voice_audio_file_url: "", remove_voice_audio: true }))}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      অডিও মুছুন
                    </button>
                  )}
                </div>

                {form.voice_audio_file ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                    <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{form.voice_audio_file.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal ml-auto">(সংরক্ষণ করলে আপলোড হবে)</span>
                  </div>
                ) : form.voice_audio_file_url ? (
                  <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200">
                    <audio controls className="h-7 max-w-xs" src={form.voice_audio_file_url}>
                      Your browser does not support audio playback.
                    </audio>
                    <label className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer ml-auto">
                      <span>পরিবর্তন</span>
                      <input
                        type="file"
                        accept="audio/mp3,audio/wav,audio/mpeg,audio/ogg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setForm(curr => ({ ...curr, voice_audio_file: file, remove_voice_audio: false }));
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 hover:border-indigo-400 rounded-lg cursor-pointer bg-white hover:bg-indigo-50/20 transition-all">
                    <Volume2 className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">কাস্টম ভয়েস ফাইল নির্বাচন করুন (ঐচ্ছিক)</span>
                    <input
                      type="file"
                      accept="audio/mp3,audio/wav,audio/mpeg,audio/ogg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setForm(curr => ({ ...curr, voice_audio_file: file, remove_voice_audio: false }));
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Variants Manager */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-black text-slate-800">
                      <Layers size={16} className="text-indigo-600" />
                      Product Variants ({form.variants.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Add size/color variants with individual price & stock.
                    </p>
                  </div>
                  {validationErrors.variants && (
                    <span className="text-xs font-bold text-rose-600">{validationErrors.variants}</span>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    placeholder="Size: L, Color: Black"
                    value={variantDraft.attributes_text}
                    onChange={(event) => setVariantDraftValue("attributes_text", event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-1">
                    <input
                      placeholder="Variant SKU (auto)"
                      value={variantDraft.sku}
                      onChange={(event) => setVariantDraftValue("sku", event.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs uppercase outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      title="Suggest Variant SKU"
                      onClick={() => {
                        const suggested = suggestVariantSku(
                          form.base_sku || suggestBaseSku(form.name, form.category),
                          variantDraft.attributes_text
                        );
                        setVariantDraft((curr) => ({ ...curr, sku: suggested }));
                        setVariantSkuTouched(false);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50"
                    >
                      Auto
                    </button>
                  </div>
                  <input
                    placeholder="Price (optional)"
                    type="number"
                    min="0"
                    step="any"
                    value={variantDraft.price}
                    onChange={(event) => setVariantDraft({ ...variantDraft, price: event.target.value })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-1.5">
                    <input
                      placeholder="Stock"
                      type="number"
                      min="0"
                      step="any"
                      value={variantDraft.stock}
                      onChange={(event) => setVariantDraft({ ...variantDraft, stock: event.target.value })}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={addOrUpdateVariant}
                      className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                    >
                      <Plus size={14} />
                      {editingVariantIndex !== null ? "Update" : "Add"}
                    </button>
                  </div>
                </div>

                {form.variants.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {form.variants.map((variant, index) => {
                      const vImgs = getVariantImages(variant, index);
                      const primaryImg = vImgs[0]?.url;
                      return (
                        <div
                          key={variant.id || index}
                          className="grid gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 text-xs sm:grid-cols-[auto_1.3fr_1.1fr_0.8fr_0.8fr_auto] sm:items-center"
                        >
                          {/* Variant Image Avatar Button */}
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => {
                                setVariantModalTab("gallery");
                                setActiveVariantImageModal(index);
                                loadImageLibrary();
                              }}
                              className="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100"
                              title="Set or change image for this variant"
                            >
                              {primaryImg ? (
                                <>
                                  <img src={primaryImg} alt="" className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera size={13} className="text-white" />
                                  </div>
                                  {vImgs.length > 1 && (
                                    <span className="absolute bottom-0 right-0 rounded-tl-md bg-indigo-600 px-1 py-0.2 text-[8px] font-bold text-white leading-none">
                                      {vImgs.length}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-indigo-600">
                                  <Camera size={14} />
                                  <span className="text-[8px] font-bold leading-none mt-0.5">+Img</span>
                                </div>
                              )}
                            </button>
                          </div>

                          <input
                            value={
                              variant.attributes_text !== undefined
                                ? variant.attributes_text
                                : formatAttributesObject(variant.attributes)
                            }
                            onChange={(e) => updateInlineVariantField(index, "attributes_text", e.target.value)}
                            placeholder="Size: M, Color: Black"
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                          />
                          <input
                            value={variant.sku || ""}
                            onChange={(e) => updateInlineVariantField(index, "sku", e.target.value.toUpperCase())}
                            placeholder="Variant SKU"
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs uppercase"
                          />
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={variant.price ?? ""}
                            onChange={(e) => updateInlineVariantField(index, "price", e.target.value)}
                            placeholder={`৳${form.sale_price || form.base_price || "Base"}`}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={variant.stock ?? "0"}
                            onChange={(e) => updateInlineVariantField(index, "stock", e.target.value)}
                            placeholder="Stock"
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold"
                          />
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => editVariantRow(index)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
                            >
                              Draft
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDirty(true);
                                setForm((curr) => ({
                                  ...curr,
                                  variants: curr.variants.filter((_, i) => i !== index),
                                }));
                              }}
                              className="rounded-lg border border-rose-100 p-1.5 text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Product Gallery Images */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-black text-slate-800">
                      <ImageIcon size={16} className="text-indigo-600" />
                      Product & Variant Images
                    </h2>
                    <p className="text-xs text-slate-500">
                      Upload images directly for this product or select which variant they represent.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        editingProduct
                          ? `/dashboard/image-gallery?product=${editingProduct.id}`
                          : "/dashboard/image-gallery"
                      )
                    }
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Open Image Gallery →
                  </button>
                </div>

                <div className="mb-4 rounded-xl border border-indigo-100 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Use from Image Gallery</p>
                      <p className="text-[11px] text-slate-500">Select reusable images and link them to this product after saving.</p>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">{selectedLibraryIds.length} selected</span>
                  </div>
                  <input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search gallery filename, alt text or caption..." className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500" />
                  <div className="mt-3 grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
                    {libraryLoading ? <p className="col-span-full py-5 text-center text-xs text-slate-400">Loading gallery images...</p> : libraryAssets.filter((asset) => {
                      const query = librarySearch.trim().toLowerCase();
                      return !query || [asset.filename, asset.alt_text, asset.image_caption].join(" ").toLowerCase().includes(query);
                    }).map((asset) => {
                      const selected = selectedLibraryIds.includes(asset.id);
                      return <button key={asset.id} type="button" onClick={() => { setDirty(true); setSelectedLibraryIds((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id]); }} className={"relative overflow-hidden rounded-lg border-2 text-left " + (selected ? "border-indigo-600 ring-2 ring-indigo-100" : "border-slate-200")}><img src={asset.image} alt={asset.alt_text || asset.filename || "Gallery image"} className="h-16 w-full object-cover" /><span className={"absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold " + (selected ? "bg-indigo-600 text-white" : "bg-white/90 text-slate-600")}>{selected ? "Selected" : "Select"}</span><span className="block truncate px-1.5 py-1 text-[10px] text-slate-500">{asset.filename || ("Image #" + asset.id)}</span></button>;
                    })}
                    {!libraryLoading && libraryAssets.length === 0 && <p className="col-span-full py-5 text-center text-xs text-slate-400">No Image Gallery images available.</p>}
                  </div>
                  {selectedLibraryIds.length > 0 && <p className="mt-2 text-[11px] font-semibold text-indigo-700">These images will be linked as {galleryVariantKey === "" ? "General Product Images" : "Variant Images"} when you save.</p>}
                </div>

                {/* Existing Images when Editing */}
                {editingProduct && existingGallery.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Attached Images ({existingGallery.length})
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {existingGallery.map((img, idx) => (
                        <div
                          key={img.id}
                          className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
                        >
                          <div className="relative aspect-square bg-slate-100">
                            <img src={img.image} alt={img.alt_text || ""} className="h-full w-full object-cover" />
                            {img.is_primary && (
                              <span className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                Primary
                              </span>
                            )}
                            <div className="absolute right-1.5 top-1.5 flex gap-1">
                              <button
                                type="button"
                                onClick={() => reorderExistingGallery(editingProduct.id, idx, -1)}
                                disabled={idx === 0}
                                className="rounded bg-white/90 p-1 text-slate-700 shadow disabled:opacity-40"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => reorderExistingGallery(editingProduct.id, idx, 1)}
                                disabled={idx === existingGallery.length - 1}
                                className="rounded bg-white/90 p-1 text-slate-700 shadow disabled:opacity-40"
                              >
                                <ArrowDown size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrimaryExistingGalleryImage(editingProduct.id, img.id)}
                                className={`rounded p-1 shadow ${img.is_primary ? "bg-amber-400 text-white" : "bg-white/90 text-slate-600"
                                  }`}
                              >
                                <Star size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteExistingGalleryImage(editingProduct.id, img.id)}
                                className="rounded bg-white/90 p-1 text-rose-600 shadow"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="p-2">
                            <select
                              value={img.variant_id || ""}
                              onChange={(e) =>
                                updateExistingGalleryImageVariant(editingProduct.id, img.id, e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                            >
                              <option value="">General Product Image</option>
                              {(editingProduct.variants || []).map((v) => (
                                <option key={v.id} value={v.id}>
                                  {formatAttributesObject(v.attributes) || v.sku || `Variant #${v.id}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Upload New Images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        const newFiles = Array.from(event.target.files || []);
                        if (!newFiles.length) return;
                        setDirty(true);
                        setGalleryFiles((curr) => {
                          const updated = [...curr, ...newFiles];
                          setGalleryFileAssignments((prev) => {
                            const next = { ...prev };
                            updated.forEach((file, idx) => {
                              const key = `${file.name}_${idx}`;
                              if (next[key] === undefined) {
                                next[key] = galleryVariantKey;
                              }
                            });
                            return next;
                          });
                          return updated;
                        });
                      }}
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-indigo-700"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Default Assignment For New Uploads
                    <select
                      value={galleryVariantKey}
                      onChange={(event) => {
                        const newKey = event.target.value;
                        setGalleryVariantKey(newKey);
                      }}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                    >
                      <option value="">General Product Image (All Variants)</option>
                      {form.variants.map((variant, index) => (
                        <option
                          key={variant.id || index}
                          value={variant.id ? `id:${variant.id}` : String(index)}
                        >
                          {variant.attributes_text ||
                            formatAttributesObject(variant.attributes) ||
                            variant.sku ||
                            `Variant ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {galleryFiles.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Uploaded New Images ({galleryFiles.length})
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Select which variant each image belongs to:
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {galleryFiles.map((file, idx) => {
                        const fileKey = `${file.name}_${idx}`;
                        const assignedKey = galleryFileAssignments[fileKey] ?? galleryVariantKey ?? "";
                        return (
                          <div
                            key={fileKey}
                            className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
                          >
                            <div className="relative aspect-square bg-slate-100">
                              <img
                                src={URL.createObjectURL(file)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setGalleryFiles((curr) => curr.filter((_, i) => i !== idx));
                                  setGalleryFileAssignments((curr) => {
                                    const next = { ...curr };
                                    delete next[fileKey];
                                    return next;
                                  });
                                }}
                                className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-rose-500 shadow hover:bg-rose-50"
                                title="Remove image"
                              >
                                <X size={12} />
                              </button>
                            </div>
                            <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Variant:
                              </label>
                              <select
                                value={assignedKey}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGalleryFileAssignments((curr) => ({
                                    ...curr,
                                    [fileKey]: val,
                                  }));
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-500 truncate"
                              >
                                <option value="">General (All)</option>
                                {form.variants.map((v, vIdx) => (
                                  <option
                                    key={v.id || vIdx}
                                    value={v.id ? `id:${v.id}` : String(vIdx)}
                                  >
                                    {v.attributes_text ||
                                      formatAttributesObject(v.attributes) ||
                                      v.sku ||
                                      `Variant ${vIdx + 1}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Submit Bar */}
              <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? "Saving..." : editingProduct ? "Update Product" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================
            TAB 2: PRODUCTS LIST (TABLE & CARD VIEW)
           ======================================================== */}
        {activeTab === "list" && (
          <div className="space-y-6 sm:space-y-8">
            {/* Header & Controls (Overview-style) */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-l-8 border-indigo-600 pl-4 sm:pl-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight italic uppercase">
                    Products Catalog
                  </h1>
                  <span className="rounded-full bg-indigo-50 border border-indigo-200/60 px-3 py-1 text-xs font-black text-indigo-700 shadow-xs">
                    {filteredProducts.length} items
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-1">
                  Real-time stock tracking, inventory valuation, and multi-variant catalog control
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleOpenAddProduct}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Plus size={16} /> Add Product
                </button>

                {/* Table / Card Toggle */}
                <div className="flex rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm shrink-0">
                  <button
                    type="button"
                    onClick={() => setView("table")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${view === "table"
                      ? "bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-md scale-105"
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    <List size={14} />
                    <span className="hidden sm:inline">Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("card")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${view === "card"
                      ? "bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-md scale-105"
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    <LayoutGrid size={14} />
                    <span className="hidden sm:inline">Cards</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Financial Valuation Summary Bar (OverviewStatCard 4-column Grid) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              <OverviewStatCard
                title="Capital Locked"
                termKey="locked_capital"
                align="left"
                value={`৳${catalogFinancials.lockedCapital.toLocaleString()}`}
                icon={<Wallet size={20} />}
                color="blue"
                subValue={`${catalogFinancials.totalStockUnits} units in inventory`}
              />
              <OverviewStatCard
                title="Potential Turnover"
                termKey="potential_turnover"
                align="left"
                value={`৳${catalogFinancials.potentialTurnover.toLocaleString()}`}
                icon={<DollarSign size={20} />}
                color="purple"
                subValue="Based on effective prices"
              />
              <OverviewStatCard
                title="Expected Profit"
                termKey="potential_profit"
                align="right"
                value={`+৳${catalogFinancials.potentialProfit.toLocaleString()}`}
                icon={<TrendingUp size={20} />}
                color="green"
                subValue={`Expected net return on stock`}
              />
              <OverviewStatCard
                title="Catalog Margin Health"
                termKey="gross_margin"
                align="right"
                value={
                  catalogFinancials.lossCount > 0
                    ? `${catalogFinancials.lossCount} below cost!`
                    : `${catalogFinancials.avgMargin}% Avg Margin`
                }
                icon={<Percent size={20} />}
                color={
                  catalogFinancials.lossCount > 0
                    ? "red"
                    : catalogFinancials.avgMargin >= 30
                      ? "emerald"
                      : "orange"
                }
                subValue={
                  catalogFinancials.lossCount > 0
                    ? "Review pricing immediately"
                    : "100% catalog profitable"
                }
              />
            </div>

            {/* Filter Toolbar (Overview Page Filter Container) */}
            <div className="bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
                    <Filter size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-tight italic">
                      Catalog Search & Filter Controls
                    </h3>
                    <p className="text-[10px] sm:text-xs font-semibold text-slate-400">
                      Instantly filter by SKU, category hierarchy, stock thresholds, and status
                    </p>
                  </div>
                </div>

                {/* Quick Presets / Stock Filter Pills */}
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 self-start sm:self-auto overflow-x-auto max-w-full">
                  {[
                    { id: "all", label: "All Items" },
                    { id: "in", label: "In Stock" },
                    { id: "low", label: "Low Stock" },
                    { id: "out", label: "Out of Stock" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setStockFilter(s.id);
                        setPage(1);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 ${stockFilter === s.id
                        ? "bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-md scale-105"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input & Dropdown Grid */}
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative sm:col-span-2">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search name, category, SKU..."
                    className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/60 py-2.5 pl-10 pr-3 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-slate-200/90 bg-slate-50/60 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => {
                    const parts = getCategoryParts(cat);
                    const label = parts.parent ? `${parts.leaf} (${parts.parent})` : cat;
                    return (
                      <option key={cat} value={cat}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-slate-200/90 bg-slate-50/60 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <div className="flex gap-2">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200/90 bg-slate-50/60 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="newest">Sort: Newest</option>
                    <option value="price">Price (High → Low)</option>
                    <option value="price_asc">Price (Low → High)</option>
                    <option value="stock">Stock</option>
                    <option value="name">Name</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setArchiveFilter((curr) => (curr === "active" ? "archived" : "active"))
                    }
                    title="Toggle Archived View"
                    className={`rounded-2xl border px-3 py-2 text-xs font-black transition-all ${archiveFilter === "archived"
                      ? "border-amber-300 bg-amber-50 text-amber-800 shadow-sm"
                      : "border-slate-200/90 bg-slate-50/60 text-slate-500 hover:bg-slate-100"
                      }`}
                  >
                    <Archive size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* View 1: Table View */}
            {view === "table" ? (
              <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] lg:min-w-0 text-left text-xs sm:text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-3 sm:px-4 sm:py-3.5">Product & Thumbnail</th>
                        <th className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">Category & SKU</th>
                        <th className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">
                          <FinancialTooltip termKey="effective_price">Price & Profit</FinancialTooltip>
                        </th>
                        <th className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">Offer / Promo</th>
                        <th className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">Stock</th>
                        <th className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">Variants</th>
                        <th className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">Status</th>
                        <th className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">Updated</th>
                        <th className="px-3 py-3 sm:px-4 sm:py-3.5 text-right whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleProducts.map((product) => {
                        const badge = getStockBadge(product);
                        const primaryImage =
                          product.gallery?.find((g) => g.is_primary)?.image ||
                          product.gallery?.[0]?.image;
                        return (
                          <tr key={product.id} className="group transition hover:bg-slate-50/80">
                            <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                              <div className="flex items-center gap-3">
                                {/* 🖼️ Product Image Thumbnail */}
                                <button
                                  type="button"
                                  onClick={() => router.push(`/dashboard/products/${product.id}`)}
                                  className="relative h-11 w-11 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                                >
                                  {primaryImage ? (
                                    <img
                                      src={primaryImage}
                                      alt={product.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Package size={20} className="m-auto mt-3 text-slate-400" />
                                  )}
                                  {(product.gallery?.length || 0) > 1 && (
                                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                                      +{product.gallery.length - 1}
                                    </span>
                                  )}
                                </button>
                                <div className="min-w-0 max-w-[180px] sm:max-w-[220px] 2xl:max-w-xs">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/dashboard/products/${product.id}`)}
                                    className="block truncate font-bold text-slate-900 hover:text-indigo-600 text-left"
                                    title={product.name}
                                  >
                                    {product.name}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDetailsDrawerProduct(product)}
                                    className="text-[11px] font-medium text-slate-400 hover:text-indigo-600"
                                  >
                                    Quick preview
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">
                              <span
                                className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 truncate max-w-[140px] xl:max-w-[170px] cursor-help hover:bg-slate-200 transition-colors"
                                title={product.category || "Uncategorized"}
                              >
                                {getCategoryParts(product.category).leaf}
                              </span>
                              <div className="mt-1 font-mono text-xs text-slate-500 truncate max-w-[120px]">
                                {product.base_sku || "No SKU"}
                              </div>
                            </td>
                            <td className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">
                              {product.sale_price ? (
                                <div>
                                  <span className="font-black text-slate-900">
                                    ৳{product.sale_price}
                                  </span>
                                  <span className="ml-1.5 text-xs text-slate-400 line-through">
                                    ৳{product.base_price}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-bold text-slate-800">
                                  ৳{product.base_price}
                                </span>
                              )}
                              {Number(product.cost_price) > 0 ? (
                                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                                  <span className="text-slate-400">Cost: ৳{product.cost_price}</span>
                                  {(() => {
                                    const eff = Number(product.sale_price || product.base_price || 0);
                                    const cost = Number(product.cost_price || 0);
                                    const profit = eff - cost;
                                    const margin = eff > 0 ? ((profit / eff) * 100).toFixed(0) : 0;
                                    const isLoss = profit < 0;
                                    return (
                                      <span
                                        className={`inline-flex items-center font-bold ${isLoss ? "text-rose-600" : "text-emerald-700"
                                          }`}
                                      >
                                        {isLoss ? `Loss: ৳${Math.abs(profit)}` : `+৳${profit} (${margin}%)`}
                                      </span>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <div className="mt-0.5 text-[10px] text-slate-400">Cost not set</div>
                              )}
                            </td>
                            <td className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">
                              {(() => {
                                const offer = getProductOffer(product);
                                if (offer) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenQuickOffer(product)}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold transition-all hover:scale-105 shadow-xs ${offer.badgeColor}`}
                                      title="অফার এডিট ও পরিবর্তন করতে ক্লিক করুন"
                                    >
                                      <Tag size={10} className="shrink-0" />
                                      <span>{offer.label}</span>
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuickOffer(product)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700 transition shadow-xs"
                                    title="এই পণ্যে দ্রুত অফার যুক্ত করুন"
                                  >
                                    <Tag size={11} className="text-indigo-600 shrink-0" />
                                    <span>+ অফার দিন</span>
                                  </button>
                                );
                              })()}
                            </td>
                            <td className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.tone}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
                                <span>{badge.display}</span>
                              </span>
                            </td>
                            <td className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setVariantManagerProduct(product)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
                              >
                                <Layers size={12} />
                                {product.variants?.length || 0} variants
                              </button>
                            </td>
                            <td className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap">
                              {product.is_archived ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                                  Archived
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleProductStatus(product)}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize transition ${product.status === "active"
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                    }`}
                                >
                                  {product.status}
                                </button>
                              )}
                            </td>
                            <td className="px-2.5 py-3 sm:px-3 sm:py-3.5 whitespace-nowrap text-xs text-slate-500">
                              {product.updated_at
                                ? new Date(product.updated_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                                : "—"}
                            </td>
                            <td className="px-3 py-3 sm:px-4 sm:py-3.5 text-right whitespace-nowrap">
                              <div className="relative inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => beginEdit(product)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => router.push(`/dashboard/products/${product.id}`)}
                                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                                  title="View Details"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenMenuProductId(
                                      openMenuProductId === product.id ? null : product.id
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                                >
                                  <MoreVertical size={14} />
                                </button>

                                {openMenuProductId === product.id && (
                                  <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuProductId(null);
                                        setDetailsDrawerProduct(product);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      <Eye size={14} /> Quick Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuProductId(null);
                                        router.push(`/dashboard/products/${product.id}`);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      <Eye size={14} /> View Details Page
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => beginEdit(product)}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      <Edit3 size={14} /> Edit Product
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuProductId(null);
                                        setVariantManagerProduct(product);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      <Layers size={12} /> Manage Variants
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuProductId(null);
                                        router.push(`/dashboard/image-gallery?product=${product.id}`);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      <ImageIcon size={14} /> Manage Images
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => duplicateProduct(product)}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      <Copy size={14} /> Duplicate
                                    </button>
                                    {product.is_archived && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuProductId(null);
                                          restoreArchivedProduct(product);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                      >
                                        <RotateCcw size={14} /> Restore
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => confirmSafeDelete(product)}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                    >
                                      <Trash2 size={14} /> Delete / Archive
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* View 2: Cards View */
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleProducts.map((product) => {
                  const badge = getStockBadge(product);
                  const primaryImage =
                    product.gallery?.find((g) => g.is_primary)?.image ||
                    product.gallery?.[0]?.image;
                  return (
                    <div
                      key={product.id}
                      className="flex flex-col justify-between rounded-[1.75rem] border border-gray-100 bg-white p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                      <div>
                        {/* Top row: Thumbnail & Primary Info */}
                        <div className="flex gap-3">
                          {/* 🖼️ Card Thumbnail */}
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/products/${product.id}`)}
                            className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-100 hover:opacity-90 transition-opacity"
                          >
                            {primaryImage ? (
                              <img
                                src={primaryImage}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package size={22} className="m-auto mt-5 text-slate-400" />
                            )}
                            {(product.gallery?.length || 0) > 1 && (
                              <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1 py-0.2 text-[9px] font-bold text-white leading-none">
                                +{product.gallery.length - 1}
                              </span>
                            )}
                          </button>

                          {/* Info Column */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <button
                                type="button"
                                onClick={() => router.push(`/dashboard/products/${product.id}`)}
                                className="line-clamp-2 text-left font-extrabold text-sm text-slate-900 hover:text-indigo-600 transition-colors leading-snug"
                                title={product.name}
                              >
                                {product.name}
                              </button>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${product.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}
                              >
                                {product.status}
                              </span>
                            </div>

                            <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-slate-500">
                              <span
                                className="font-semibold text-slate-700 truncate"
                                title={product.category || "Uncategorized"}
                              >
                                {getCategoryParts(product.category).leaf}
                              </span>
                              <span>·</span>
                              <span className="font-mono text-slate-400 truncate">{product.base_sku || "No SKU"}</span>
                            </p>

                            {/* Price & Stock */}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {product.sale_price ? (
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-sm font-black text-indigo-600">
                                    ৳{product.sale_price}
                                  </span>
                                  <span className="text-xs text-slate-400 line-through">
                                    ৳{product.base_price}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm font-black text-slate-900">
                                  ৳{product.base_price}
                                </span>
                              )}

                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.tone}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
                                <span>{badge.display}</span>
                              </span>

                              {/* 1-Click Offer Badge or Action */}
                              {(() => {
                                const offer = getProductOffer(product);
                                if (offer) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenQuickOffer(product)}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${offer.badgeColor} hover:opacity-90`}
                                    >
                                      <Tag size={9} />
                                      {offer.label}
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuickOffer(product)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 transition"
                                  >
                                    <Tag size={9} />
                                    + অফার
                                  </button>
                                );
                              })()}
                            </div>

                            {/* Profit/Cost row if configured */}
                            {Number(product.cost_price) > 0 && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                                <span className="text-slate-400">Cost: ৳{product.cost_price}</span>
                                {(() => {
                                  const eff = Number(product.sale_price || product.base_price || 0);
                                  const cost = Number(product.cost_price || 0);
                                  const profit = eff - cost;
                                  const margin = eff > 0 ? ((profit / eff) * 100).toFixed(0) : 0;
                                  const isLoss = profit < 0;
                                  return (
                                    <span
                                      className={`font-bold ${isLoss ? "text-rose-600" : "text-emerald-700"
                                        }`}
                                    >
                                      {isLoss ? `Loss: ৳${Math.abs(profit)}` : `+৳${profit} (${margin}%)`}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Meta summary chips */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                          <button
                            type="button"
                            onClick={() => setVariantManagerProduct(product)}
                            className="font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1"
                          >
                            <Layers size={11} className="text-indigo-600" />
                            {product.variants?.length || 0} variants
                          </button>
                          <span>{product.gallery?.length || 0} images</span>
                          <span>
                            {product.updated_at
                              ? new Date(product.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                              : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons (Clean & Responsive) */}
                      <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
                        <button
                          type="button"
                          onClick={() => beginEdit(product)}
                          className="flex-1 rounded-xl bg-indigo-600 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition text-center"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsDrawerProduct(product)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Preview
                        </button>
                        {!getProductOffer(product) && (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickOffer(product)}
                            className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1"
                            title="১-ক্লিক অফার যুক্ত করুন"
                          >
                            <Tag size={12} />
                            <span>অফার</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setVariantManagerProduct(product)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition"
                          title="Manage Variants"
                        >
                          <Layers size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileActionProduct(product)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 transition"
                          title="More options"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !visibleProducts.length && (
              <div className="my-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <Package className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-2 font-bold text-slate-700">No matching products found</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try adjusting filters or click "Add Product" above to create one.
                </p>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <span>
                Showing {(page - 1) * pageSize + (visibleProducts.length ? 1 : 0)}–
                {(page - 1) * pageSize + visibleProducts.length} of {filteredProducts.length}{" "}
                products
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((value) => value + 1)}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: PROFIT & FINANCIAL ANALYTICS DASHBOARD
           ======================================================== */}
        {activeTab === "analytics" && (
          <ProductFinancialDashboard />
        )}

        {/* ========================================================
                      TAB 4: OFFERS & PROMOTIONS ENGINE
                     ======================================================== */}
        {activeTab === "promotions" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 animate-fadeIn">
            <PromotionsManager onBackToProducts={() => handleTabChange("list")} />
          </div>
        )}
      </div>

      {/* Safe Delete Confirmation Modal */}
      {
        deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <div className="rounded-xl bg-rose-100 p-2.5">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Delete Product Confirmation
                    </h3>
                    <p className="text-xs text-slate-500">{deleteTarget.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
                <div className="flex justify-between py-1">
                  <span>Product Name:</span>
                  <b className="text-slate-900">{deleteTarget.name}</b>
                </div>
                <div className="flex justify-between py-1">
                  <span>Base SKU:</span>
                  <span className="font-mono">{deleteTarget.base_sku || "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Variants Attached:</span>
                  <b>{deleteTarget.variants?.length || 0} variants</b>
                </div>
                <div className="flex justify-between py-1">
                  <span>Gallery Images:</span>
                  <b>{deleteTarget.gallery?.length || 0} images</b>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-xs">
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === "archive"}
                    onChange={() => setDeleteMode("archive")}
                    className="mt-0.5"
                  />
                  <div>
                    <b className="text-slate-900">Soft Delete / Archive (Recommended)</b>
                    <p className="text-slate-500">
                      Removes from active catalog & invalidates search cache while keeping audit history.
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/40 p-3 text-xs">
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === "permanent"}
                    onChange={() => setDeleteMode("permanent")}
                    className="mt-0.5"
                  />
                  <div>
                    <b className="text-rose-700">Delete permanently</b>
                    <p className="text-rose-600/80">
                      Permanently deletes product, variants, and gallery links.
                    </p>
                  </div>
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={executeSafeDelete}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
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
        )
      }

      {/* Variant Image Selector Modal */}
      {
        activeVariantImageModal !== null && form.variants[activeVariantImageModal] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Camera size={18} className="text-indigo-600" />
                    Variant Image:{" "}
                    <span className="text-indigo-600 font-extrabold">
                      {form.variants[activeVariantImageModal].attributes_text ||
                        formatAttributesObject(form.variants[activeVariantImageModal].attributes, ", ") ||
                        form.variants[activeVariantImageModal].sku ||
                        `Variant #${activeVariantImageModal + 1}`}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select from Image Gallery or upload from device for this variant.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveVariantImageModal(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Source Navigation Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setVariantModalTab("gallery")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${variantModalTab === "gallery"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:bg-slate-200/60"
                    }`}
                >
                  <ImageIcon size={14} className={variantModalTab === "gallery" ? "text-indigo-600" : "text-slate-400"} />
                  <span>Image Gallery ({libraryAssets.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVariantModalTab("device")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${variantModalTab === "device"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:bg-slate-200/60"
                    }`}
                >
                  <Upload size={14} className={variantModalTab === "device" ? "text-indigo-600" : "text-slate-400"} />
                  <span>Upload from Device</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVariantModalTab("product")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${variantModalTab === "product"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:bg-slate-200/60"
                    }`}
                >
                  <Package size={14} className={variantModalTab === "product" ? "text-indigo-600" : "text-slate-400"} />
                  <span>Product Photos ({galleryFiles.length + existingGallery.length})</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* 1. Currently Assigned Images for this Variant (Always visible if any) */}
                {getVariantImages(form.variants[activeVariantImageModal], activeVariantImageModal).length > 0 && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-indigo-600" />
                        Currently Assigned to this Variant ({getVariantImages(form.variants[activeVariantImageModal], activeVariantImageModal).length}):
                      </h4>
                    </div>
                    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
                      {getVariantImages(form.variants[activeVariantImageModal], activeVariantImageModal).map((img, idx) => (
                        <div key={idx} className="relative aspect-square overflow-hidden rounded-xl border-2 border-indigo-600 shadow-xs group bg-white">
                          <img src={img.url} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setDirty(true);
                              if (img.type === "existing") {
                                updateExistingGalleryImageVariant(editingProduct.id, img.id, "");
                              } else if (img.type === "file") {
                                setGalleryFileAssignments((curr) => ({ ...curr, [img.fileKey]: "" }));
                              } else if (img.type === "library") {
                                setSelectedLibraryAssignments((curr) => {
                                  const next = { ...curr };
                                  delete next[img.id];
                                  return next;
                                });
                                setSelectedLibraryIds((curr) => curr.filter((id) => id !== img.id));
                              }
                            }}
                            className="absolute right-1 top-1 rounded-full bg-rose-600 p-1 text-white shadow hover:bg-rose-700 transition-transform group-hover:scale-110"
                            title="Remove from this variant"
                          >
                            <X size={11} />
                          </button>
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white leading-none">
                            Active
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 1: Image Gallery Selection */}
                {variantModalTab === "gallery" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search Image Gallery filename, caption, alt text..."
                          value={variantLibrarySearch}
                          onChange={(e) => setVariantLibrarySearch(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                        />
                        {variantLibrarySearch && (
                          <button
                            type="button"
                            onClick={() => setVariantLibrarySearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={loadImageLibrary}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 shrink-0"
                        title="Reload gallery images"
                      >
                        <RefreshCw size={13} className={libraryLoading ? "animate-spin text-indigo-600" : ""} />
                        <span>Refresh</span>
                      </button>
                    </div>

                    {libraryLoading ? (
                      <div className="py-12 text-center text-xs text-slate-400">Loading Image Gallery...</div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 max-h-72 overflow-y-auto p-1">
                        {libraryAssets
                          .filter((asset) => {
                            const q = variantLibrarySearch.trim().toLowerCase();
                            if (!q) return true;
                            return [asset.filename, asset.alt_text, asset.image_caption]
                              .filter(Boolean)
                              .join(" ")
                              .toLowerCase()
                              .includes(q);
                          })
                          .map((asset) => {
                            const targetVariant = form.variants[activeVariantImageModal];
                            const targetKey = targetVariant.id ? `id:${targetVariant.id}` : String(activeVariantImageModal);
                            const existingLink = editingProduct && targetVariant.id
                              ? asset.links?.find((l) => l.product_id === editingProduct.id && l.variant_id === targetVariant.id)
                              : null;
                            const isAssigned =
                              (selectedLibraryIds.includes(asset.id) &&
                                (selectedLibraryAssignments[asset.id] ?? galleryVariantKey) === targetKey) ||
                              Boolean(existingLink);

                            return (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={async () => {
                                  setDirty(true);
                                  if (isAssigned) {
                                    if (existingLink) {
                                      try {
                                        await api.delete(`/datasheet/product-image-library/${asset.id}/links/${existingLink.id}/`);
                                        await loadImageLibrary();
                                        await loadProducts();
                                        toast.success("Image removed from variant");
                                      } catch {
                                        toast.error("Failed to unlink image");
                                      }
                                    }
                                    setSelectedLibraryAssignments((curr) => {
                                      const next = { ...curr };
                                      delete next[asset.id];
                                      return next;
                                    });
                                    setSelectedLibraryIds((curr) => curr.filter((id) => id !== asset.id));
                                  } else {
                                    setSelectedLibraryIds((curr) => (curr.includes(asset.id) ? curr : [...curr, asset.id]));
                                    setSelectedLibraryAssignments((curr) => ({
                                      ...curr,
                                      [asset.id]: targetKey,
                                    }));
                                  }
                                }}
                                className={`group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all ${isAssigned
                                  ? "border-indigo-600 ring-2 ring-indigo-200 shadow-sm"
                                  : "border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100"
                                  }`}
                              >
                                <div className="relative aspect-square w-full bg-slate-100">
                                  <img src={asset.image} alt="" className="h-full w-full object-cover" />
                                  <span
                                    className={`absolute bottom-1.5 left-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-center truncate ${isAssigned ? "bg-indigo-600 text-white shadow-xs" : "bg-black/60 text-white"
                                      }`}
                                  >
                                    {isAssigned ? "✓ Selected" : "Click to Select"}
                                  </span>
                                </div>
                                <span className="block truncate px-2 py-1 text-[10px] font-medium text-slate-600 bg-white">
                                  {asset.filename || `Asset #${asset.id}`}
                                </span>
                              </button>
                            );
                          })}
                        {libraryAssets.length === 0 && (
                          <div className="col-span-full py-8 text-center text-xs text-slate-500">
                            <p>No images in Image Gallery yet.</p>
                            <button
                              type="button"
                              onClick={() => router.push("/dashboard/image-gallery")}
                              className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
                            >
                              Open Image Gallery to upload reusable images →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: Device Upload */}
                {variantModalTab === "device" && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 mb-3">
                      <Upload size={22} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mb-1">Upload Photo from Device</h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto mb-4">
                      Upload images directly from your computer or phone for this specific variant.
                    </p>
                    <label className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 cursor-pointer transition-colors">
                      <Camera size={14} />
                      <span>Choose Image(s)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          setDirty(true);
                          const targetVariant = form.variants[activeVariantImageModal];
                          const targetKey = targetVariant.id ? `id:${targetVariant.id}` : String(activeVariantImageModal);

                          setGalleryFiles((curr) => {
                            const updated = [...curr, ...files];
                            setGalleryFileAssignments((prev) => {
                              const next = { ...prev };
                              files.forEach((file, fIdx) => {
                                const key = `${file.name}_${curr.length + fIdx}`;
                                next[key] = targetKey;
                              });
                              return next;
                            });
                            return updated;
                          });
                          toast.success(`${files.length} image(s) uploaded and assigned to this variant`);
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* TAB 3: Product Photos */}
                {variantModalTab === "product" && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Click any product photo to assign/unassign to this variant:
                    </h4>
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 max-h-72 overflow-y-auto p-1">
                      {galleryFiles.map((file, fIdx) => {
                        const fileKey = `${file.name}_${fIdx}`;
                        const targetVariant = form.variants[activeVariantImageModal];
                        const targetKey = targetVariant.id ? `id:${targetVariant.id}` : String(activeVariantImageModal);
                        const isAssigned = (galleryFileAssignments[fileKey] ?? galleryVariantKey) === targetKey;
                        return (
                          <button
                            key={fileKey}
                            type="button"
                            onClick={() => {
                              setDirty(true);
                              setGalleryFileAssignments((curr) => ({
                                ...curr,
                                [fileKey]: isAssigned ? "" : targetKey,
                              }));
                            }}
                            className={`relative aspect-square overflow-hidden rounded-xl border-2 text-left transition-all ${isAssigned ? "border-indigo-600 ring-2 ring-indigo-200" : "border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100"
                              }`}
                          >
                            <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                            <span className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${isAssigned ? "bg-indigo-600 text-white" : "bg-black/60 text-white"
                              }`}>
                              {isAssigned ? "✓ Selected" : "Click to assign"}
                            </span>
                          </button>
                        );
                      })}

                      {editingProduct && existingGallery.map((img) => {
                        const targetVariant = form.variants[activeVariantImageModal];
                        const isAssigned = img.variant_id && (img.variant_id === targetVariant.id || String(img.variant_id) === String(targetVariant.id));
                        return (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => {
                              setDirty(true);
                              updateExistingGalleryImageVariant(
                                editingProduct.id,
                                img.id,
                                isAssigned ? "" : String(targetVariant.id)
                              );
                            }}
                            className={`relative aspect-square overflow-hidden rounded-xl border-2 text-left transition-all ${isAssigned ? "border-indigo-600 ring-2 ring-indigo-200" : "border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100"
                              }`}
                          >
                            <img src={img.image} alt="" className="h-full w-full object-cover" />
                            <span className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${isAssigned ? "bg-indigo-600 text-white" : "bg-black/60 text-white"
                              }`}>
                              {isAssigned ? "✓ Selected" : "Click to assign"}
                            </span>
                          </button>
                        );
                      })}

                      {galleryFiles.length === 0 && (!editingProduct || existingGallery.length === 0) && (
                        <p className="col-span-full py-8 text-center text-xs text-slate-400">
                          No general product photos uploaded yet. Use the Image Gallery or Device Upload tab.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end border-t border-slate-100 px-6 py-3 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setActiveVariantImageModal(null)}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Quick Manage Variants Modal */}
      {
        variantManagerProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Variants — {variantManagerProduct.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Base SKU: {variantManagerProduct.base_sku || "—"} · Base Price: ৳
                    {variantManagerProduct.sale_price || variantManagerProduct.base_price}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVariantManagerProduct(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 uppercase text-slate-500">
                    <tr>
                      <th className="p-3 w-16">Image</th>
                      <th className="p-3">Attributes</th>
                      <th className="p-3">Variant SKU</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Stock</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(variantManagerProduct.variants || []).map((v, vIdx) => {
                      const variantImg =
                        variantManagerProduct.gallery?.find((g) => g.variant_id === v.id)?.image ||
                        v.image_url;
                      return (
                        <tr key={v.id || vIdx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => {
                                const prod = variantManagerProduct;
                                setVariantManagerProduct(null);
                                beginEdit(prod);
                                setVariantModalTab("gallery");
                                setActiveVariantImageModal(vIdx);
                                loadImageLibrary();
                              }}
                              className="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100"
                              title={variantImg ? "Click to change variant image" : "Click to add variant image"}
                            >
                              {variantImg ? (
                                <>
                                  <img
                                    src={variantImg}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera size={13} className="text-white" />
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-indigo-600">
                                  <Camera size={14} />
                                  <span className="text-[8px] font-bold leading-none mt-0.5">+Img</span>
                                </div>
                              )}
                            </button>
                          </td>
                          <td className="p-3 font-semibold text-slate-800">
                            {formatAttributesObject(v.attributes) || "Default"}
                          </td>
                          <td className="p-3 font-mono text-slate-500">{v.sku || "—"}</td>
                          <td className="p-3">
                            ৳{v.price || variantManagerProduct.sale_price || variantManagerProduct.base_price}
                          </td>
                          <td className="p-3 font-bold">{v.stock}</td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const prod = variantManagerProduct;
                                setVariantManagerProduct(null);
                                beginEdit(prod);
                                setVariantModalTab("gallery");
                                setActiveVariantImageModal(vIdx);
                                loadImageLibrary();
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-2xs"
                            >
                              <Camera size={12} className="text-indigo-600" />
                              <span>{variantImg ? "Change Image" : "Add Image"}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!(variantManagerProduct.variants || []).length && (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No variants configured for this product.
                  </p>
                )}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVariantManagerProduct(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prod = variantManagerProduct;
                    setVariantManagerProduct(null);
                    beginEdit(prod);
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
                >
                  Edit / Add Variants
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Desktop Quick Details Drawer */}
      {
        detailsDrawerProduct && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs transition-all"
            onClick={() => setDetailsDrawerProduct(null)}
          >
            <div
              className="flex h-full w-full max-w-md flex-col justify-between overflow-y-auto bg-white p-6 shadow-2xl animate-in slide-in-from-right"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <span
                      className="text-xs font-bold uppercase tracking-wider text-indigo-600 block"
                      title={detailsDrawerProduct.category || "Uncategorized"}
                    >
                      {getCategoryParts(detailsDrawerProduct.category).leaf}
                    </span>
                    {getCategoryParts(detailsDrawerProduct.category).parent && (
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {detailsDrawerProduct.category}
                      </span>
                    )}
                    <h3 className="text-xl font-black text-slate-900">
                      {detailsDrawerProduct.name}
                    </h3>
                    <p className="font-mono text-xs text-slate-500">
                      SKU: {detailsDrawerProduct.base_sku || "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsDrawerProduct(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                {detailsDrawerProduct.gallery?.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {detailsDrawerProduct.gallery.map((img) => (
                      <img
                        key={img.id}
                        src={img.image}
                        alt=""
                        className="aspect-square w-full rounded-xl border border-slate-200 object-cover"
                      />
                    ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="text-slate-400">Base Price</span>
                    <p className="mt-0.5 text-base font-black text-slate-900">
                      ৳{detailsDrawerProduct.base_price}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="text-slate-400">Sale Price</span>
                    <p className="mt-0.5 text-base font-black text-indigo-600">
                      {detailsDrawerProduct.sale_price
                        ? `৳${detailsDrawerProduct.sale_price}`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="text-slate-400">Effective Stock</span>
                    <p className="mt-0.5 text-base font-black text-slate-900">
                      {getEffectiveStock(detailsDrawerProduct)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="text-slate-400">Variants</span>
                    <p className="mt-0.5 text-base font-black text-slate-900">
                      {detailsDrawerProduct.variants?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="mt-4 text-xs text-slate-600">
                  <b className="text-slate-900">Description:</b>
                  <div className="mt-1">
                    <RichTextDisplay content={detailsDrawerProduct.description} />
                  </div>
                </div>

                <div className="mt-4 text-xs text-slate-600">
                  <b className="text-slate-900">Warranty:</b>
                  <p className="mt-1">
                    {detailsDrawerProduct.warranty_information || "Not specified."}
                  </p>
                </div>

                {/* General Attributes in Details Drawer */}
                {detailsDrawerProduct.attributes && Object.keys(detailsDrawerProduct.attributes).length > 0 && (
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      General Attributes
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(detailsDrawerProduct.attributes).map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-2.5 py-1 text-xs shadow-2xs"
                        >
                          <span className="text-[10px] font-bold uppercase text-indigo-600">{k}</span>
                          <span className="text-slate-300">|</span>
                          <span className="font-semibold text-slate-800">{v}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    const id = detailsDrawerProduct.id;
                    setDetailsDrawerProduct(null);
                    router.push(`/dashboard/products/${id}`);
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white"
                >
                  Open Full Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prod = detailsDrawerProduct;
                    setDetailsDrawerProduct(null);
                    beginEdit(prod);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsDrawerProduct(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Mobile Bottom Action Sheet */}
      {
        mobileActionProduct && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center"
            onClick={() => setMobileActionProduct(null)}
          >
            <div
              className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-sm sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <b className="truncate text-sm text-slate-900">{mobileActionProduct.name}</b>
                <button
                  type="button"
                  onClick={() => setMobileActionProduct(null)}
                  className="rounded-lg p-1 text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-1.5 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    const prod = mobileActionProduct;
                    setMobileActionProduct(null);
                    setDetailsDrawerProduct(prod);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={16} /> Quick Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = mobileActionProduct.id;
                    setMobileActionProduct(null);
                    router.push(`/dashboard/products/${id}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={16} /> View Details Page
                </button>
                <button
                  type="button"
                  onClick={() => beginEdit(mobileActionProduct)}
                  className="flex w-full items-center gap-3 rounded-xl p-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 size={16} /> Edit Product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prod = mobileActionProduct;
                    setMobileActionProduct(null);
                    setVariantManagerProduct(prod);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Layers size={16} /> Manage Variants
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = mobileActionProduct.id;
                    setMobileActionProduct(null);
                    router.push(`/dashboard/image-gallery?product=${id}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ImageIcon size={16} /> Manage Images
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prod = mobileActionProduct;
                    setMobileActionProduct(null);
                    handleOpenQuickOffer(prod);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 font-semibold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-50"
                >
                  <Tag size={16} /> অফার যুক্ত / পরিবর্তন করুন
                </button>
                <button
                  type="button"
                  onClick={() => duplicateProduct(mobileActionProduct)}
                  className="flex w-full items-center gap-3 rounded-xl p-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy size={16} /> Duplicate Product
                </button>
                <button
                  type="button"
                  onClick={() => confirmSafeDelete(mobileActionProduct)}
                  className="flex w-full items-center gap-3 rounded-xl p-3 font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={16} /> Delete / Archive
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 🏷️ 1-Click Complete Quick Offer & Promotion Management Modal */}
      {offerModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            {(() => {
              const activeOffer = getProductOffer(offerModalProduct);
              const base = Number(offerModalProduct.base_price || 0);
              const cost = Number(offerModalProduct.cost_price || 0);

              let targetPrice = base;
              if (offerType === "percentage") {
                const pct = parseFloat(customDiscountVal) || 0;
                targetPrice = Math.max(0, Math.round(base * (1 - pct / 100)));
              } else if (offerType === "fixed") {
                const amt = parseFloat(customDiscountVal) || 0;
                targetPrice = Math.max(0, base - amt);
              } else if (offerType === "custom_price") {
                targetPrice = parseFloat(customSalePrice) || base;
              } else if (offerType === "free_shipping") {
                targetPrice = offerModalProduct.sale_price ? Number(offerModalProduct.sale_price) : base;
              }

              const savings = Math.max(0, base - targetPrice);
              const savingsPct = base > 0 ? Math.round((savings / base) * 100) : 0;
              const unitProfit = targetPrice - cost;
              const margin = targetPrice > 0 ? Math.round((unitProfit / targetPrice) * 100) : 0;

              const modalProductImage =
                offerModalProduct.gallery?.find((g) => g.is_primary)?.image ||
                offerModalProduct.gallery?.[0]?.image ||
                (Array.isArray(offerModalProduct.gallery_images) && offerModalProduct.gallery_images[0]) ||
                offerModalProduct.image;

              return (
                <>
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      {modalProductImage ? (
                        <img
                          src={modalProductImage}
                          alt={offerModalProduct.name}
                          className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-2xs bg-slate-50"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                          <span>{activeOffer ? "অফার এডিট ও পরিবর্তন করুন" : "১-ক্লিক অফার যুক্ত করুন"}</span>
                          {activeOffer && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              সক্রিয় অফার
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-slate-500 truncate max-w-[280px]">
                          {offerModalProduct.name}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOfferModalProduct(null)}
                      className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 text-sm font-bold transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Active Offer Banner (if already active) */}
                  {activeOffer && (
                    <div className="mt-3.5 p-3 rounded-2xl bg-amber-50/90 border border-amber-200/80 flex items-center justify-between text-xs text-amber-900 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="font-bold block text-[11px]">বর্তমানে অফার চালু রয়েছে:</span>
                          <span className="font-black text-amber-700">{activeOffer.label}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuickOffer(offerModalProduct)}
                        className="px-2.5 py-1 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-[11px] font-bold transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>বাতিল করুন</span>
                      </button>
                    </div>
                  )}

                  {/* Offer Type Tabs */}
                  <div className="mt-4">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      অফারের ধরন নির্বাচন করুন:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
                      {[
                        { id: "percentage", label: "% ছাড়", icon: <Percent size={12} /> },
                        { id: "fixed", label: "৳ ফ্ল্যাট ছাড়", icon: <Tag size={12} /> },
                        { id: "free_shipping", label: "ফ্রি ডেলিভারি", icon: <Truck size={12} /> },
                        { id: "custom_price", label: "কাস্টম মূল্য", icon: <DollarSign size={12} /> },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setOfferType(t.id);
                            if (t.id === "percentage") {
                              setOfferPreset("10");
                              setCustomDiscountVal("10");
                            } else if (t.id === "fixed") {
                              setOfferPreset("100_flat");
                              setCustomDiscountVal("100");
                            } else if (t.id === "free_shipping") {
                              setOfferPreset("free_shipping");
                            } else if (t.id === "custom_price") {
                              setOfferPreset("custom");
                              setCustomSalePrice(String(Math.round(base * 0.9)));
                            }
                          }}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${offerType === t.id
                            ? "bg-white text-indigo-600 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          {t.icon}
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preset Values based on Type */}
                  <div className="mt-3.5 space-y-2.5">
                    {offerType === "percentage" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          শতকরা ছাড়ের হার নির্ধারণ করুন:
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {["10", "15", "20", "30"].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                setOfferPreset(pct);
                                setCustomDiscountVal(pct);
                              }}
                              className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all ${offerPreset === pct && customDiscountVal === pct
                                ? "bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs ring-1 ring-indigo-500"
                                : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                }`}
                            >
                              <div>{pct}% ছাড়</div>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ৳{Math.round(base * (1 - Number(pct) / 100))}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600 shrink-0">অথবা কাস্টম ছাড় %:</span>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={customDiscountVal}
                              onChange={(e) => {
                                setOfferPreset("custom");
                                setCustomDiscountVal(e.target.value);
                              }}
                              placeholder="যেমন: 25"
                              className="w-full text-xs px-3 py-1.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-slate-900 font-bold"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {offerType === "fixed" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          টাকার ছাড় সিলেক্ট করুন:
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: "50_flat", val: "50", label: "৳৫০" },
                            { id: "100_flat", val: "100", label: "৳১০০" },
                            { id: "150_flat", val: "150", label: "৳১৫০" },
                            { id: "200_flat", val: "200", label: "৳২০০" },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setOfferPreset(item.id);
                                setCustomDiscountVal(item.val);
                              }}
                              className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all ${offerPreset === item.id && customDiscountVal === item.val
                                ? "bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs ring-1 ring-indigo-500"
                                : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                }`}
                            >
                              <div>{item.label} ছাড়</div>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ৳{Math.max(0, base - Number(item.val))}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600 shrink-0">কাস্টম ছাড় (৳):</span>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="1"
                              value={customDiscountVal}
                              onChange={(e) => {
                                setOfferPreset("custom");
                                setCustomDiscountVal(e.target.value);
                              }}
                              placeholder="যেমন: 250"
                              className="w-full text-xs px-3 py-1.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-slate-900 font-bold"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {offerType === "free_shipping" && (
                      <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs">
                        <div className="flex items-center gap-2 font-black text-emerald-800 text-sm mb-1">
                          <Truck className="w-4 h-4 text-emerald-600" />
                          <span>ফ্রি ডেলিভারি অফার (Free Shipping)</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                          গ্রাহক যখন এই পণ্যটি কার্টে যোগ করবেন, চেকআউট এবং ডেলিভারি ইঞ্জিন স্বয়ংক্রিয়ভাবে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি করে দেবে।
                        </p>
                      </div>
                    )}

                    {offerType === "custom_price" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          সরাসরি অফার বিক্রয়মূল্য নির্ধারণ করুন (৳):
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={customSalePrice}
                            onChange={(e) => setCustomSalePrice(e.target.value)}
                            placeholder={`বেস প্রাইস ৳${base}-এর চেয়ে কম`}
                            className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-slate-900 font-black"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Start Date & End Date / Expiry Schedule */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>অফারের মেয়াদ ও সময়সূচি (Start - End)</span>
                      </label>
                      <span className="text-[10px] font-bold text-indigo-600">
                        {hasExpiry ? "নির্দিষ্ট মেয়াদ সক্রিয়" : "মেয়াদহীন"}
                      </span>
                    </div>

                    {/* Quick Duration Pills */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { id: "forever", label: "মেয়াদহীন" },
                        { id: "24h", label: "২৪ ঘণ্টা" },
                        { id: "3d", label: "৩ দিন" },
                        { id: "7d", label: "৭ দিন" },
                        { id: "custom", label: "কাস্টম" },
                      ].map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => applyQuickDuration(d.id)}
                          className={`py-1.5 px-1 text-center rounded-xl text-[10px] font-bold border transition-all ${quickDuration === d.id
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                            }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    {/* Datetime Pickers */}
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                          <Calendar size={11} className="text-slate-400" /> শুরুর সময় (Start):
                        </span>
                        <input
                          type="datetime-local"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            setQuickDuration("custom");
                          }}
                          className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                          <Clock size={11} className="text-slate-400" /> শেষের সময় (End / Expiry):
                        </span>
                        <input
                          type="datetime-local"
                          value={endDate}
                          disabled={!hasExpiry}
                          onChange={(e) => {
                            setEndDate(e.target.value);
                            setHasExpiry(true);
                            setQuickDuration("custom");
                          }}
                          placeholder={hasExpiry ? "" : "মেয়াদহীন"}
                          className={`w-full text-xs px-2.5 py-1.5 rounded-xl border text-slate-800 font-semibold focus:border-indigo-500 outline-none ${hasExpiry ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50 text-slate-400"
                            }`}
                        />
                      </div>
                    </div>

                    {/* Countdown Toggle */}
                    {hasExpiry && (
                      <label className="mt-2 flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={showCountdown}
                          onChange={(e) => setShowCountdown(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>স্টোরফ্রন্টে লাইভ কাউন্টডাউন টাইমার (Countdown Timer) প্রদর্শন করুন</span>
                      </label>
                    )}
                  </div>

                  {/* Banner Message Input */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Tag size={12} className="text-indigo-600" />
                      <span>প্রমোশনাল ব্যানার মেসেজ (Storefront & AI):</span>
                    </label>
                    <input
                      type="text"
                      value={bannerMessage}
                      onChange={(e) => setBannerMessage(e.target.value)}
                      placeholder={`⚡ ধামাকা অফার: ${offerModalProduct.name} এ বিশেষ ছাড়!`}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-slate-800 font-medium"
                    />
                  </div>

                  {/* Live Calculation Preview Card */}
                  <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-indigo-100/80 text-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                      লাইভ হিসাব ও মুনাফার পূর্বরূপ (Summary Preview)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                        <span className="block text-[9px] uppercase font-bold text-slate-400">মূল মূল্য</span>
                        <span className="font-black text-slate-900 text-sm">৳{base}</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-indigo-100 shadow-2xs">
                        <span className="block text-[9px] uppercase font-bold text-indigo-500">অফার মূল্য</span>
                        <span className="font-black text-indigo-600 text-sm">৳{targetPrice}</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs">
                        <span className="block text-[9px] uppercase font-bold text-emerald-500">কাস্টমার সাশ্রয়</span>
                        <span className="font-black text-emerald-600 text-sm">
                          ৳{savings} ({savingsPct}%)
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-purple-100 shadow-2xs">
                        <span className="block text-[9px] uppercase font-bold text-purple-500">একক লাভ (Profit)</span>
                        <span
                          className={`font-black text-sm ${unitProfit < 0 ? "text-rose-600" : "text-purple-700"
                            }`}
                        >
                          {cost > 0 ? `${unitProfit < 0 ? "Loss: " : "+"}৳${unitProfit}` : "Cost N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                    {activeOffer ? (
                      <button
                        type="button"
                        disabled={isSavingOffer}
                        onClick={() => handleRemoveQuickOffer(offerModalProduct)}
                        className="px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>অফার বাতিল করুন</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOfferModalProduct(null)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        বাতিল
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isSavingOffer}
                      onClick={handleApplyQuickOffer}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>{isSavingOffer ? "সংরক্ষণ হচ্ছে..." : activeOffer ? "অফার আপডেট করুন" : "অফার চালু করুন"}</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-6 text-sm text-slate-500">Loading products...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
