"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchStorefront } from '@/lib/api';
import { rememberSeller } from '@/lib/shop-brand';
import {
  Store,
  ShoppingCart,
  Plus,
  Minus,
  Loader2,
  Image as ImageIcon,
  Search,
  Filter,
  ShieldCheck,
  Package,
  X,
  CheckCircle,
  Eye,
  Info
} from 'lucide-react';

function publicImageUrl(value) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (typeof window === 'undefined') return value;
  return window.location.origin + (value.startsWith('/') ? value : '/' + value);
}

function getProductImage(product) {
  const raw = product?.gallery?.[0]?.image || product?.gallery_images?.[0];
  return raw ? publicImageUrl(raw) : '';
}

export default function ShopDirectPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantities, setQuantities] = useState({});
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [selectedMerchantId, setSelectedMerchantId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modalProduct, setModalProduct] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchStorefront('/shop/products/')
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : [];
        // Filter out products without any valid image as requested
        const validWithImage = list.filter((p) => {
          const img = getProductImage(p);
          return Boolean(img && img.trim().length > 0);
        });
        setProducts(validWithImage);

        validWithImage.forEach((p) => {
          if (p.seller && p.seller.session_code) {
            rememberSeller({
              merchant_id: p.seller.merchant_id,
              merchant_name: p.seller.merchant_name,
              merchant_shop_name: p.seller.merchant_shop_name,
              merchant_avatar: p.seller.merchant_avatar
            }, p.seller.session_code);
          }
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'পণ্য লোড করা যাচ্ছে না');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const sellers = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p.seller?.merchant_id && !map.has(p.seller.merchant_id)) {
        map.set(p.seller.merchant_id, p.seller);
      }
    });
    return Array.from(map.values());
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const activeSeller = useMemo(() => {
    if (selectedMerchantId !== 'all') {
      return sellers.find((s) => String(s.merchant_id) === String(selectedMerchantId)) || null;
    }
    if (sellers.length === 1) {
      return sellers[0];
    }
    return null;
  }, [sellers, selectedMerchantId]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedMerchantId !== 'all' && String(p.seller?.merchant_id) !== String(selectedMerchantId)) {
        return false;
      }
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesSeller = p.seller?.merchant_name?.toLowerCase().includes(q) || p.seller?.merchant_shop_name?.toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesSeller;
      }
      return true;
    });
  }, [products, selectedMerchantId, selectedCategory, searchQuery]);

  const selectedItems = useMemo(
    () => products
      .filter((p) => Number(quantities[p.id] || 0) > 0)
      .map((p) => ({
        product_id: p.id,
        quantity: Number(quantities[p.id]),
        merchant_id: p.seller?.merchant_id,
        session_code: p.seller?.session_code
      })),
    [products, quantities]
  );

  const changeQuantity = (productId, delta) => {
    setQuantities((current) => {
      const next = Math.max(0, Math.min(99, Number(current[productId] || 0) + delta));
      return { ...current, [productId]: next };
    });
  };

  const openCheckout = async () => {
    if (!selectedItems.length || isCreatingCheckout) return;
    setIsCreatingCheckout(true);
    setError('');

    try {
      const primaryItem = selectedItems[0];
      const payload = {
        session_code: primaryItem.session_code || '',
        merchant_id: primaryItem.merchant_id,
        items: selectedItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity }))
      };

      const result = await fetchStorefront('/shop/session/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push('/checkout/' + result.code);
    } catch (err) {
      setError(err.message || 'নতুন checkout তৈরি করা যায়নি');
      setIsCreatingCheckout(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-xs text-slate-400">শপ ও প্রোডাক্ট তালিকা লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn pb-24">
      {/* Compact Top Seller Profile & Header */}
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/30 p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {activeSeller?.merchant_avatar ? (
              <img
                src={activeSeller.merchant_avatar}
                alt=""
                className="w-9 h-9 rounded-xl object-cover bg-slate-800 border border-indigo-500/30 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0">
                {activeSeller?.merchant_shop_name?.charAt(0)?.toUpperCase() || <Store className="w-4 h-4 text-indigo-400" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white truncate">
                  {activeSeller?.merchant_shop_name || activeSeller?.merchant_name || 'SmartShop Catalog'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" /> ভেরিফাইড
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{products.length}টি পণ্য সরাসরি অর্ডারের জন্য প্রস্তুত</span>
                {activeSeller?.session_code && (
                  <span className="text-[10px] text-indigo-400/80 hidden sm:inline">#{activeSeller.session_code}</span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="পণ্য বা মডেল খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Compact Seller Switcher Chips */}
        {sellers.length > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-indigo-400" /> সেলার:
            </span>
            <button
              type="button"
              onClick={() => setSelectedMerchantId('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all ${selectedMerchantId === 'all'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
            >
              সব পণ্য ({products.length})
            </button>
            {sellers.map((seller) => (
              <button
                key={seller.merchant_id}
                type="button"
                onClick={() => setSelectedMerchantId(String(seller.merchant_id))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all ${String(selectedMerchantId) === String(seller.merchant_id)
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
              >
                {seller.merchant_avatar ? (
                  <img src={seller.merchant_avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : null}
                <span>{seller.merchant_shop_name || seller.merchant_name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Categories Chips */}
        {categories.length > 1 && (
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" /> ক্যাটাগরি:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium shrink-0 ${selectedCategory === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              সব
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium shrink-0 ${selectedCategory === cat ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Direct Products Grid */}
      {!filteredProducts.length ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-300">কোনো ছবিযুক্ত পণ্য খুঁজে পাওয়া যায়নি</p>
          <p className="mt-1 text-xs text-slate-500">অন্য ফিল্টার বা সার্চ দিয়ে চেষ্টা করুন।</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredProducts.map((product) => {
            const image = getProductImage(product);
            const price = product.sale_price ?? product.base_price ?? 0;
            const quantity = Number(quantities[product.id] || 0);
            const seller = product.seller;

            return (
              <div
                key={product.id}
                className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900/90 hover:border-indigo-500/40 transition-all duration-200 overflow-hidden flex flex-col shadow-sm"
              >
                {/* Product Image (clickable for details) */}
                <div
                  onClick={() => setModalProduct(product)}
                  className="aspect-square bg-slate-800/60 flex items-center justify-center overflow-hidden relative cursor-pointer"
                  title="বিস্তারিত দেখতে ক্লিক করুন"
                >
                  <img
                    src={image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {product.category && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-md text-[10px] font-semibold text-slate-300 border border-slate-800">
                      {product.category}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-900/90 text-white text-[11px] font-semibold flex items-center gap-1 shadow-lg border border-slate-700">
                      <Eye className="w-3 h-3 text-indigo-400" /> বিস্তারিত
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-3.5 flex-1 flex flex-col">
                  {/* Seller info with small profile photo */}
                  {seller && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5 min-w-0">
                      {seller.merchant_avatar ? (
                        <img
                          src={seller.merchant_avatar}
                          alt=""
                          className="w-4 h-4 rounded-full object-cover bg-slate-800 border border-indigo-500/40 shrink-0"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {seller.merchant_shop_name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                      )}
                      <span className="truncate text-slate-300 font-medium">
                        {seller.merchant_shop_name || seller.merchant_name}
                      </span>
                    </div>
                  )}

                  <h2
                    onClick={() => setModalProduct(product)}
                    className="text-xs sm:text-sm font-bold text-slate-100 line-clamp-2 leading-snug cursor-pointer hover:text-indigo-300 transition-colors"
                  >
                    {product.name}
                  </h2>

                  {product.description && (
                    <p
                      onClick={() => setModalProduct(product)}
                      className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed cursor-pointer"
                    >
                      {product.description.replace(/<[^>]*>?/gm, '')}
                    </p>
                  )}

                  {/* Price & Action */}
                  <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-xs sm:text-sm font-black text-indigo-300">
                        ৳{Number(price).toLocaleString('bn-BD')}
                      </span>
                      {product.sale_price && product.base_price && product.base_price > product.sale_price && (
                        <span className="block text-[10px] text-slate-500 line-through">
                          ৳{Number(product.base_price).toLocaleString('bn-BD')}
                        </span>
                      )}
                    </div>

                    {quantity > 0 ? (
                      <div className="flex items-center gap-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 p-1">
                        <button
                          type="button"
                          onClick={() => changeQuantity(product.id, -1)}
                          className="w-6 h-6 rounded-lg hover:bg-indigo-500/20 text-indigo-200 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-white">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(product.id, 1)}
                          className="w-6 h-6 rounded-lg hover:bg-indigo-500/20 text-indigo-200 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => changeQuantity(product.id, 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-sm shadow-indigo-600/30"
                      >
                        <Plus className="w-3.5 h-3.5" /> যোগ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Checkout Bar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-0 right-0 z-40 flex justify-center px-4 animate-slideUp">
          <button
            type="button"
            onClick={openCheckout}
            disabled={isCreatingCheckout}
            className="flex items-center justify-between gap-4 w-full max-w-md px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-60 text-white shadow-2xl shadow-emerald-950/50 border border-emerald-400/30 transition-all transform active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                {isCreatingCheckout ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <ShoppingCart className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="text-left">
                <p className="text-xs font-black leading-tight">
                  {selectedItems.reduce((acc, curr) => acc + curr.quantity, 0)}টি পণ্য নির্বাচিত
                </p>
                <p className="text-[10px] text-emerald-100">
                  অর্ডার করতে ট্যাপ করুন
                </p>
              </div>
            </div>
            <span className="text-xs font-black bg-white text-emerald-800 px-3 py-1.5 rounded-xl">
              অর্ডার করুন →
            </span>
          </button>
        </div>
      )}

      {/* Product Detail Modal */}
      {modalProduct && (() => {
        const modalImg = getProductImage(modalProduct);
        const modalPrice = modalProduct.sale_price ?? modalProduct.base_price ?? 0;
        const modalQty = Number(quantities[modalProduct.id] || 0);
        const seller = modalProduct.seller;

        return (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            {/* Click-outside backdrop */}
            <div className="absolute inset-0" onClick={() => setModalProduct(null)} />

            <div className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 z-10 overflow-hidden">
              {/* Modal Header & Close Button */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-slate-800/80 shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">পণ্যের বিবরণ</span>
                <button
                  type="button"
                  onClick={() => setModalProduct(null)}
                  className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Product Large Image */}
                <div className="aspect-video sm:aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
                  <img
                    src={modalImg}
                    alt={modalProduct.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Header & Seller */}
                <div>
                  {seller && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                      {seller.merchant_avatar ? (
                        <img
                          src={seller.merchant_avatar}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover border border-indigo-500/40"
                        />
                      ) : (
                        <Store className="w-4 h-4 text-indigo-400" />
                      )}
                      <span className="font-semibold text-slate-200">
                        {seller.merchant_shop_name || seller.merchant_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        ভেরিফাইড শপ
                      </span>
                    </div>
                  )}
                  <h2 className="text-base sm:text-lg font-black text-white leading-snug">
                    {modalProduct.name}
                  </h2>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xl font-black text-indigo-300">
                      ৳{Number(modalPrice).toLocaleString('bn-BD')}
                    </span>
                    {modalProduct.sale_price && modalProduct.base_price && modalProduct.base_price > modalProduct.sale_price && (
                      <span className="text-xs text-slate-500 line-through">
                        ৳{Number(modalProduct.base_price).toLocaleString('bn-BD')}
                      </span>
                    )}
                    {modalProduct.category && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-[11px] font-semibold text-slate-300">
                        {modalProduct.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {modalProduct.description && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <p className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-indigo-400" /> বিবরণ ও স্পেসিফিকেশন:
                    </p>
                    <div
                      className="text-xs text-slate-300 leading-relaxed space-y-1.5"
                      dangerouslySetInnerHTML={{ __html: modalProduct.description }}
                    />
                  </div>
                )}

                {/* Attributes / Key Specs */}
                {modalProduct.attributes && typeof modalProduct.attributes === 'object' && Object.keys(modalProduct.attributes).length > 0 && (
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-400 mb-1">বৈশিষ্ট্যাবলী:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(modalProduct.attributes).map(([key, val]) => (
                        <div key={key} className="text-xs bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">{key}</span>
                          <span className="text-slate-200 font-semibold">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warranty */}
                {modalProduct.warranty_information && (
                  <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                    ওয়ারেন্টি: {modalProduct.warranty_information}
                  </p>
                )}
              </div>

              {/* Sticky Bottom Action Bar with + / - & Cart Buttons */}
              <div className="shrink-0 p-4 bg-slate-950 border-t border-slate-800/90 flex items-center justify-between gap-3 safe-area-bottom">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 hidden sm:inline">পরিমাণ:</span>
                  <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-700 p-1">
                    <button
                      type="button"
                      onClick={() => changeQuantity(modalProduct.id, -1)}
                      className="w-8 h-8 rounded-lg hover:bg-slate-800 text-indigo-200 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center text-xs font-bold text-white">
                      {modalQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(modalProduct.id, 1)}
                      className="w-8 h-8 rounded-lg hover:bg-slate-800 text-indigo-200 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (modalQty === 0) changeQuantity(modalProduct.id, 1);
                    setModalProduct(null);
                  }}
                  className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all text-center"
                >
                  {modalQty > 0 ? 'পণ্য আপডেট করুন' : '+ কার্টে যোগ করুন'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
