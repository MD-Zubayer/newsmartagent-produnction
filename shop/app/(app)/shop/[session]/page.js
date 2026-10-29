"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchStorefront } from '@/lib/api';
import { ArrowLeft, Image as ImageIcon, Loader2, Minus, Plus, ShoppingCart, Store } from 'lucide-react';

function publicImageUrl(value) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (typeof window === 'undefined') return value;
  return window.location.origin + (value.startsWith('/') ? value : '/' + value);
}

export default function SellerShopPage() {
  const params = useParams();
  const router = useRouter();
  const sessionCode = params?.session;
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionCode) return;
    Promise.all([
      fetchStorefront('/session/resolve/' + encodeURIComponent(sessionCode) + '/'),
      fetchStorefront('/shop/products/?session=' + encodeURIComponent(sessionCode)),
    ])
      .then(([sessionData, productData]) => {
        setSession(sessionData);
        setProducts(Array.isArray(productData) ? productData : []);
      })
      .catch((err) => setError(err.message || 'শপ লোড করা যাচ্ছে না'))
      .finally(() => setLoading(false));
  }, [sessionCode]);

  const selectedItems = useMemo(
    () => products
      .filter((product) => Number(quantities[product.id] || 0) > 0)
      .map((product) => ({ product_id: product.id, quantity: Number(quantities[product.id]) })),
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
      const result = await fetchStorefront('/shop/session/', {
        method: 'POST',
        body: JSON.stringify({ session_code: sessionCode, items: selectedItems }),
      });
      router.push('/checkout/' + result.code);
    } catch (err) {
      setError(err.message || 'নতুন checkout তৈরি করা যায়নি');
      setIsCreatingCheckout(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 text-indigo-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-indigo-300"><Store className="w-4 h-4" /><span className="text-xs font-semibold">Seller Shop</span></div>
          <h1 className="text-2xl font-black text-white mt-1">{session?.merchant_shop_name || session?.merchant_name || 'Shop'}</h1>
          <p className="text-xs text-slate-400 mt-1">আরও পণ্য দেখুন এবং পছন্দের পণ্য অর্ডার করুন</p>
        </div>
        <button type="button" onClick={() => router.push('/checkout/' + sessionCode)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200">
          <ArrowLeft className="w-3.5 h-3.5" /> Checkout
        </button>
      </div>

      {error && <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>}

      {!products.length ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">এই seller-এর কোনো পণ্য এখন পাওয়া যাচ্ছে না।</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {products.map((product) => {
            const image = publicImageUrl(product.gallery?.[0]?.image || product.gallery_images?.[0]);
            const price = product.sale_price ?? product.base_price ?? 0;
            const quantity = Number(quantities[product.id] || 0);
            return (
              <div key={product.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col">
                <div className="aspect-square bg-slate-800/80 flex items-center justify-center overflow-hidden">
                  {image ? <img src={image} alt={product.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-600" />}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h2 className="text-sm font-bold text-slate-100 line-clamp-2">{product.name}</h2>
                  {product.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{product.description}</p>}
                  <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-indigo-300">৳{price}</span>
                    {quantity ? (
                      <div className="flex items-center gap-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 p-1">
                        <button type="button" onClick={() => changeQuantity(product.id, -1)} className="w-6 h-6 rounded-lg hover:bg-indigo-500/20 text-indigo-200"><Minus className="w-3 h-3 mx-auto" /></button>
                        <span className="w-5 text-center text-xs font-bold text-white">{quantity}</span>
                        <button type="button" onClick={() => changeQuantity(product.id, 1)} className="w-6 h-6 rounded-lg hover:bg-indigo-500/20 text-indigo-200"><Plus className="w-3 h-3 mx-auto" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => changeQuantity(product.id, 1)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white"><Plus className="w-3 h-3" /> যোগ</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="sticky bottom-4 flex justify-center">
          <button type="button" onClick={openCheckout} disabled={isCreatingCheckout} className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-black shadow-2xl shadow-emerald-900/30">
            {isCreatingCheckout ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            {isCreatingCheckout ? 'Checkout তৈরি হচ্ছে...' : selectedItems.length + 'টি পণ্য নিয়ে অর্ডার করুন'}
          </button>
        </div>
      )}
    </div>
  );
}
