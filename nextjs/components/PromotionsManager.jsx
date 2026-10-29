"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  Tag,
  Truck,
  Percent,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Gift,
  Check,
  Info,
  ArrowLeft,
  Edit2,
  Package,
  Layers,
} from "lucide-react";

import OverviewStatCard from "@/components/OverviewStatCard";

export default function PromotionsManager({ onBackToProducts }) {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    promotion_type: "free_shipping",
    coupon_code: "",
    min_order_amount: "",
    min_quantity: "1",
    discount_percentage: "",
    discount_amount: "",
    is_free_shipping: true,
    start_date: "",
    end_date: "",
    show_countdown_timer: true,
    banner_message: "",
    is_active: true,
  });

  const loadPromotions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("storefront/v1/merchant/promotions/");
      setPromotions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load promotions:", err);
      setError("অফার ও প্রমোশন তালিকা লোড করা সম্ভব হয়নি।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPromo(null);
    setFormData({
      title: "",
      promotion_type: "free_shipping",
      coupon_code: "",
      min_order_amount: "1000",
      min_quantity: "1",
      discount_percentage: "",
      discount_amount: "",
      is_free_shipping: true,
      start_date: "",
      end_date: "",
      show_countdown_timer: true,
      banner_message: "",
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEditPromo = (promo) => {
    setEditingPromo(promo);
    setFormData({
      title: promo.title || "",
      promotion_type: promo.promotion_type || "free_shipping",
      coupon_code: promo.coupon_code || "",
      min_order_amount: promo.min_order_amount ? String(promo.min_order_amount) : "",
      min_quantity: promo.min_quantity ? String(promo.min_quantity) : "1",
      discount_percentage: promo.discount_percentage ? String(promo.discount_percentage) : "",
      discount_amount: promo.discount_amount ? String(promo.discount_amount) : "",
      is_free_shipping: promo.is_free_shipping ?? false,
      start_date: promo.start_date ? promo.start_date.substring(0, 16) : "",
      end_date: promo.end_date ? promo.end_date.substring(0, 16) : "",
      show_countdown_timer: promo.show_countdown_timer ?? true,
      banner_message: promo.banner_message || "",
      is_active: promo.is_active ?? true,
    });
    setShowModal(true);
  };

  const handleToggleActive = async (promo) => {
    try {
      const nextActive = !promo.is_active;
      await api.put("storefront/v1/merchant/promotions/", {
        id: promo.id,
        is_active: nextActive,
      });
      setPromotions((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, is_active: nextActive } : p))
      );
      setSuccessMsg(nextActive ? "অফারটি সক্রিয় করা হয়েছে" : "অফারটি নিষ্ক্রিয় করা হয়েছে");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert("স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে।");
    }
  };

  const handleDelete = async (promoId) => {
    if (!confirm("আপনি কি নিশ্চিত এই অফারটি ডিলিট করতে চান?")) return;
    try {
      await api.delete(`storefront/v1/merchant/promotions/?id=${promoId}`);
      setPromotions((prev) => prev.filter((p) => p.id !== promoId));
      setSuccessMsg("অফারটি মুছে ফেলা হয়েছে");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert("অফার ডিলিট করা যায়নি।");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("অনুগ্রহ করে অফারের নাম লিখুন");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title,
        promotion_type: formData.promotion_type,
        coupon_code: formData.coupon_code.trim() ? formData.coupon_code.trim().toUpperCase() : null,
        min_order_amount: formData.min_order_amount ? parseFloat(formData.min_order_amount) : 0.0,
        min_quantity: parseInt(formData.min_quantity || "1", 10),
        discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : 0.0,
        discount_amount: formData.discount_amount ? parseFloat(formData.discount_amount) : 0.0,
        is_free_shipping: formData.is_free_shipping,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        show_countdown_timer: formData.show_countdown_timer,
        banner_message: formData.banner_message.trim(),
        is_active: formData.is_active,
      };

      if (editingPromo) {
        payload.id = editingPromo.id;
        await api.put("storefront/v1/merchant/promotions/", payload);
      } else {
        await api.post("storefront/v1/merchant/promotions/", payload);
      }

      setShowModal(false);
      setSuccessMsg(editingPromo ? "অফার সফলভাবে আপডেট হয়েছে!" : "নতুন অফার সফলভাবে তৈরি হয়েছে!");
      setTimeout(() => setSuccessMsg(null), 3000);
      loadPromotions();
    } catch (err) {
      console.error("Save promotion failed:", err);
      alert(err.response?.data?.detail || "অফার সেভ করতে সমস্যা হয়েছে।");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCount = promotions.filter((p) => p.is_active).length;
  const inactiveCount = promotions.filter((p) => !p.is_active).length;
  const freeShipCampaign = promotions.find(
    (p) => p.is_active && (p.is_free_shipping || p.promotion_type === "free_shipping")
  );

  const displayedPromotions = promotions.filter((p) => {
    if (statusFilter === "active") return p.is_active;
    if (statusFilter === "inactive") return !p.is_active;
    return true;
  });

  return (
    <div className="space-y-6 md:space-y-8 font-sans">
      {/* Top Header (Overview Style) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-l-8 border-indigo-600 pl-4 sm:pl-6">
        <div>
          {onBackToProducts && (
            <button
              type="button"
              onClick={onBackToProducts}
              className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>প্রোডাক্টস তালিকায় ফিরে যান (Back to Products)</span>
            </button>
          )}
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight italic uppercase flex items-center gap-2.5">
            <Tag className="w-7 h-7 text-indigo-600" />
            Offers & <span className="text-indigo-600">Promotions</span> Hub
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-400 mt-1">
            ফ্রি ডেলিভারি থ্রেশহোল্ড, কাউন্টডাউন ফ্ল্যাশ সেল এবং কুপন ডিসকাউন্ট ম্যানেজ করুন
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all select-none active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন অফার তৈরি করুন</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Overview Cards (Exact Overview Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <OverviewStatCard
          title="Active Campaigns"
          value={`${activeCount} টি`}
          icon={<Tag size={20} />}
          color="indigo"
          subValue={`সর্বমোট ক্যাম্পেইন: ${promotions.length} টি`}
        />
        <OverviewStatCard
          title="Free Shipping Rule"
          value={freeShipCampaign ? `৳${parseInt(freeShipCampaign.min_order_amount || 0)}` : "Inactive"}
          icon={<Truck size={20} />}
          color="green"
          subValue={freeShipCampaign ? "চেকআউট ও এআই চ্যাটে সক্রিয়" : "গ্রাহকদের আকৃষ্ট করতে সেট করুন"}
        />
        <OverviewStatCard
          title="Total Redemptions"
          value={`${promotions.reduce((acc, p) => acc + (p.times_used || 0), 0)} বার`}
          icon={<Gift size={20} />}
          color="orange"
          subValue="কুপন ও প্রচারণার মাধ্যমে সফল অর্ডার"
        />
      </div>

      {/* AI Integration Advisory Notice */}
      <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 border border-indigo-100 rounded-[2rem] p-5 md:p-6 shadow-sm flex items-start gap-3.5 text-xs text-slate-600">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0 shadow-sm">
          <Info className="w-5 h-5" />
        </div>
        <div>
          <strong className="font-black text-slate-900 text-sm block mb-1">
            স্মার্ট এআই এবং লাইভ চেকআউট সিঙ্ক (Smart AI & Checkout Sync)
          </strong>
          আপনার সক্রিয় অফারগুলো সরাসরি এআই চ্যাট অ্যাসিস্ট্যান্ট এবং চেকআউট সেশনে ইনজেক্ট করা হয়। গ্রাহকরা যখনই ডেলিভারি চার্জ বা ছাড় জানতে চান, এআই বিভ্রান্তি ছাড়া বাস্তবসম্মত তথ্য দেয় এবং থ্রেশহোল্ড পূরণ করতে বাড়তি পণ্য সাজেস্ট করে।
        </div>
      </div>

      {/* Promotions Table (Overview Style Container) */}
      <div className="bg-white border border-gray-100 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-2">
              <Tag size={18} className="text-indigo-600" />
              Promotion Campaigns Matrix (ক্যাম্পেইন তালিকা)
            </h2>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">
              লাইভ কুপন ও স্পেশাল সেলস অফারের বিস্তারিত তথ্য
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Tabs: All, Active, Inactive */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/60 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${statusFilter === "all"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <span>সব অফার</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${statusFilter === "all" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                  }`}>
                  {promotions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${statusFilter === "active"
                    ? "bg-white text-emerald-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>সক্রিয় ({activeCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("inactive")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${statusFilter === "inactive"
                    ? "bg-white text-slate-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>বন্ধ ({inactiveCount})</span>
              </button>
            </div>

            <button
              onClick={loadPromotions}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-xl border border-gray-200 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              রিফ্রেশ
            </button>
          </div>
        </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">অফার লোড হচ্ছে...</div>
          ) : displayedPromotions.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
              <Tag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {statusFilter === "active"
                ? "কোনো সক্রিয় অফার নেই"
                : statusFilter === "inactive"
                  ? "কোনো বন্ধ অফার নেই"
                  : "কোনো অফার পাওয়া যায়নি"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              ফ্রি ডেলিভারি বা নির্দিষ্ট ডিসকাউন্ট অফার তৈরি করে আপনার স্টোরের সেলস বৃদ্ধি করুন।
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              প্রথম অফার তৈরি করুন
            </button>
          </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3.5 px-4">অফার ও প্রোডাক্ট</th>
                  <th className="py-3.5 px-4">অফারের ধরন</th>
                  <th className="py-3.5 px-4">শর্ত / ন্যুনতম অর্ডার</th>
                  <th className="py-3.5 px-4">সুবিধা (Benefit)</th>
                  <th className="py-3.5 px-4">কাউন্টডাউন / মেয়াদ</th>
                  <th className="py-3.5 px-4 text-center">স্ট্যাটাস</th>
                  <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedPromotions.map((p) => {
                  const hasProducts = p.applicable_products_details && p.applicable_products_details.length > 0;
                  const firstProduct = hasProducts ? p.applicable_products_details[0] : null;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product Thumbnail & Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {hasProducts ? (
                            <div className="relative shrink-0">
                              {firstProduct.image ? (
                                <img
                                  src={firstProduct.image}
                                  alt={firstProduct.name}
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-50 shadow-2xs"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              {p.applicable_products_details.length > 1 && (
                                <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-2xs">
                                  +{p.applicable_products_details.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                              <Tag className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs sm:text-sm truncate max-w-[200px] sm:max-w-xs">
                              {p.title}
                            </div>
                            {hasProducts ? (
                              <div className="text-[11px] font-medium text-slate-500 truncate max-w-[200px] sm:max-w-xs flex items-center gap-1.5 mt-0.5">
                                <span className="truncate">{firstProduct.name}</span>
                                {firstProduct.base_price && (
                                  <span className="text-slate-400 shrink-0 font-bold">
                                    (৳{parseInt(firstProduct.base_price)})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mt-0.5">
                                সব প্রোডাক্টে প্রযোজ্য (Storewide)
                              </div>
                            )}
                            {p.banner_message && (
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px] sm:max-w-xs italic">
                                "{p.banner_message}"
                              </div>
                            )}
                            {p.coupon_code && (
                              <span className="inline-block mt-1 font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                কুপন: {p.coupon_code}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {p.promotion_type === "free_shipping" && "ফ্রি ডেলিভারি"}
                          {p.promotion_type === "percentage_discount" && "শতাংশ ছাড় (%)"}
                          {p.promotion_type === "fixed_discount" && "নির্দিষ্ট টাকা ছাড়"}
                          {p.promotion_type === "coupon_code" && "কুপন কোড"}
                          {p.promotion_type === "buy_x_get_y" && "ভলিউম টিয়ার"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {p.min_order_amount > 0 ? (
                          <span>ন্যূনতম ৳{parseInt(p.min_order_amount)}</span>
                        ) : (
                          <span className="text-slate-400">যেকোনো অর্ডারে</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {p.is_free_shipping && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Truck className="w-3 h-3" /> ফ্রি শিপিং
                          </span>
                        )}
                        {p.discount_percentage > 0 && (
                          <span className="text-indigo-600 font-semibold ml-1">
                            {p.discount_percentage}% ছাড়
                          </span>
                        )}
                        {p.discount_amount > 0 && (
                          <span className="text-indigo-600 font-semibold ml-1">
                            ৳{parseInt(p.discount_amount)} ছাড়
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {p.end_date ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(p.end_date).toLocaleDateString("bn-BD")}</span>
                            {p.show_countdown_timer && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-medium">
                                লাইভ টাইমার
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">স্থায়ী অফার</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(p)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${p.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                            }`}
                        >
                          {p.is_active ? <Check className="w-3 h-3" /> : null}
                          {p.is_active ? "সক্রিয়" : "বন্ধ"}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditPromo(p)}
                            title="অফার এডিট করুন"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            title="মুছে ফেলুন"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
          </div>

          {/* Create / Edit Promotion Modal */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo-600" />
                    নতুন অফার তৈরি করুন
                    <span>{editingPromo ? "অফার এডিট করুন" : "নতুন অফার তৈরি করুন"}</span>
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  {/* Campaign Title */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ক্যাম্পেইনের নাম *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="যেমন: ঈদ স্পেশাল ফ্রি ডেলিভারি"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900"
                    />
                  </div>

                  {/* Promotion Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        অফারের ধরন
                      </label>
                      <select
                        value={formData.promotion_type}
                        onChange={(e) => {
                          const t = e.target.value;
                          setFormData({
                            ...formData,
                            promotion_type: t,
                            is_free_shipping: t === "free_shipping",
                          });
                        }}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-slate-900 bg-white"
                      >
                        <option value="free_shipping">ফ্রি ডেলিভারি থ্রেশহোল্ড</option>
                        <option value="coupon_code">কুপন কোড</option>
                        <option value="percentage_discount">শতাংশ ছাড় (%)</option>
                        <option value="fixed_discount">নির্দিষ্ট টাকা ছাড় (৳)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ন্যূনতম অর্ডার মূল্য (৳)
                      </label>
                      <input
                        type="number"
                        value={formData.min_order_amount}
                        onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                        placeholder="যেমন: 1000"
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Conditional Coupon Code */}
                  {formData.promotion_type === "coupon_code" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        কুপন কোড (ইংরেজি বড় হাত)
                      </label>
                      <input
                        type="text"
                        value={formData.coupon_code}
                        onChange={(e) => setFormData({ ...formData, coupon_code: e.target.value.toUpperCase() })}
                        placeholder="যেমন: EID2026"
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none uppercase font-mono tracking-wider text-slate-900"
                      />
                    </div>
                  )}

                  {/* Benefits Selection */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="block text-xs font-bold text-slate-800">অফার বেনিফিট</span>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_free_shipping}
                        onChange={(e) => setFormData({ ...formData, is_free_shipping: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        ডেলিভারি সম্পূর্ণ ফ্রি প্রদান করুন
                      </span>
                    </label>

                    {formData.promotion_type !== "free_shipping" && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            শতকরা ছাড় (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formData.discount_percentage}
                            onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                            placeholder="যেমন: 10"
                            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            অথবা নির্দিষ্ট ছাড় (৳)
                          </label>
                          <input
                            type="number"
                            value={formData.discount_amount}
                            onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                            placeholder="যেমন: 100"
                            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Flash Sale Schedule */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        অফার শুরু (ঐচ্ছিক)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        অফার সমাপ্তি (ঐচ্ছিক)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_countdown_timer}
                      onChange={(e) => setFormData({ ...formData, show_countdown_timer: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700">
                      চেকআউটে লাইভ কাউন্টডাউন টাইমার দেখান
                    </span>
                  </label>

                  {/* Banner Message */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      হেডার ব্যানার মেসেজ (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={formData.banner_message}
                      onChange={(e) => setFormData({ ...formData, banner_message: e.target.value })}
                      placeholder="যেমন: ⚡ সীমিত সময়ের অফার: ৳১০০০ এর অর্ডারে ডেলিভারি ফ্রি!"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-slate-900"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSubmitting ? "সংরক্ষণ হচ্ছে..." : "অফার সেভ করুন"}
                      {isSubmitting ? "সংরক্ষণ হচ্ছে..." : editingPromo ? "অফার আপডেট করুন" : "অফার সেভ করুন"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
        );
}
