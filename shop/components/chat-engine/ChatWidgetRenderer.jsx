"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchStorefront } from '@/lib/api';
import {
  MapPin,
  Truck,
  Plus,
  CheckCircle2,
  Loader2,
  Phone,
  User,
  Search,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building2,
  PackageCheck,
  ExternalLink,
  X,
} from 'lucide-react';

const GUEST_ADDRESS_STORAGE_KEY = 'smart_shop_guest_addresses_v1';

export function readGuestAddresses() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_ADDRESS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestAddress(addr) {
  if (typeof window === 'undefined' || !addr) return [];
  try {
    const current = readGuestAddresses();
    const newEntry = {
      ...addr,
      id: addr.id || `guest_addr_${Date.now()}`,
      is_guest: true,
    };
    const filtered = current.filter(
      (a) =>
        !(
          a.full_address === newEntry.full_address &&
          a.district === newEntry.district &&
          a.upazila === newEntry.upazila
        )
    );
    const next = [newEntry, ...filtered].slice(0, 6);
    window.localStorage.setItem(GUEST_ADDRESS_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

const DEFAULT_PATHAO_LEVELS = [
  { key: 'city', label: 'জেলা / City' },
  { key: 'zone', label: 'থানা / Zone' },
  { key: 'area', label: 'এলাকা / Area' },
];

/**
 * 0. ORDER CONFIRMED CARD WIDGET
 * Rendered when order is directly placed inside the chat!
 */
export function OrderConfirmedCardWidget({ widget }) {
  if (!widget) return null;
  const orderId = widget.order_id;
  const productName = widget.product_name;
  const quantity = widget.quantity || 1;
  const price = widget.price || 0;
  const deliveryCharge = widget.delivery_charge || 0;
  const total = widget.total || (price + deliveryCharge);
  const address = widget.address;
  const phone = widget.phone;

  return (
    <div className="mt-2.5 w-full max-w-full sm:max-w-md min-w-0 rounded-2xl bg-white border border-emerald-300 p-3.5 sm:p-4 shadow-lg space-y-3">
      <div className="flex items-center gap-2.5 border-b border-emerald-100 pb-2.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
          <PackageCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-black text-slate-900">অর্ডার কনফার্ম হয়েছে!</h4>
            <Link
              href={`/orders/${orderId}`}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1 transition-colors"
            >
              #{orderId}
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
            চ্যাট থেকেই আপনার অর্ডারটি বুক করা হয়েছে
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-1.5 text-xs">
        <div className="flex justify-between items-center text-slate-700">
          <span className="font-semibold truncate">{productName} (x{quantity})</span>
          <span className="font-bold text-slate-900 shrink-0">৳{Math.round(price)}</span>
        </div>
        <div className="flex justify-between items-center text-slate-500 text-[11px]">
          <span>ডেলিভারি চার্জ</span>
          <span className="font-medium text-slate-700">৳{Math.round(deliveryCharge)}</span>
        </div>
        <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center text-xs font-black">
          <span className="text-slate-800">সর্বমোট প্রদেয়</span>
          <span className="text-sm text-emerald-600 font-black">৳{Math.round(total)}</span>
        </div>
      </div>

      <div className="space-y-1 text-[11px] text-slate-600 pl-1">
        <p className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>{phone}</span>
        </p>
        <p className="flex items-start gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{address}</span>
        </p>
      </div>

      <div className="pt-1.5 border-t border-emerald-100">
        <Link
          href={`/orders/${orderId}`}
          className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
        >
          <span>অর্ডার ট্র্যাকিং ও বিস্তারিত দেখুন</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

/**
 * 0.1 ORDER TRACKING & STATUS CARD WIDGET
 * Rendered when customer inquires about their order update, courier progress, or parcel tracking.
 */
export function OrderTrackingCardWidget({ widget }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!widget) return null;
  const orders = Array.isArray(widget.orders) ? widget.orders : [];
  const hasOrders = orders.length > 0;

  const handleSearch = (e) => {
    e.preventDefault();
    const clean = searchQuery.trim().replace(/^#/, '');
    if (!clean) {
      setErrorMsg('অনুগ্রহ করে অর্ডার আইডি বা ফোন নম্বর লিখুন');
      return;
    }
    setErrorMsg('');
    router.push(`/orders/${encodeURIComponent(clean)}`);
  };

  const getStatusInfo = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'confirmed':
        return {
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dotClass: 'bg-indigo-600',
          label: 'কনফার্মড',
        };
      case 'shipped':
        return {
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
          dotClass: 'bg-purple-600 animate-pulse',
          label: 'কুরিয়ারে শিপড',
        };
      case 'delivered':
        return {
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotClass: 'bg-emerald-600',
          label: 'ডেলিভার্ড',
        };
      case 'cancelled':
      case 'returned':
        return {
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
          dotClass: 'bg-rose-600',
          label: 'বাতিল',
        };
      default:
        return {
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          dotClass: 'bg-amber-600 animate-pulse',
          label: 'পেন্ডিং',
        };
    }
  };

  return (
    <div className="mt-2.5 w-full max-w-full sm:max-w-md min-w-0 rounded-2xl bg-white border border-slate-200 p-3.5 sm:p-4 shadow-lg space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-2.5">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
          <Truck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-black text-slate-900">অর্ডার ট্র্যাকিং ও আপডেট</h4>
          <p className="text-[11px] text-indigo-600 font-medium">
            {hasOrders ? 'আপনার সাম্প্রতিক অর্ডারের লাইভ স্ট্যাটাস' : 'অর্ডার আইডি বা মোবাইল নম্বর দিয়ে খুঁজুন'}
          </p>
        </div>
      </div>

      {/* Orders List */}
      {hasOrders ? (
        <div className="space-y-2.5">
          {orders.map((o) => {
            const st = getStatusInfo(o.status);
            return (
              <div
                key={o.id}
                className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-900">
                    অর্ডার #{o.id}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dotClass}`} />
                    {o.status_bangla || st.label}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold truncate max-w-[200px]">{o.product_name}</span>
                    <span className="font-bold text-slate-900 shrink-0">৳{Math.round(o.total_price)}</span>
                  </div>
                  {o.created_at && (
                    <p className="text-[10px] text-slate-400">
                      অর্ডার তারিখ: {o.created_at}
                    </p>
                  )}
                  {(o.courier || o.consignment_id) && (
                    <p className="text-[10px] text-indigo-300 flex items-center gap-1 font-medium pt-0.5">
                      <Truck className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span>{o.courier || 'কুরিয়ার'}{o.consignment_id ? `: ${o.consignment_id}` : ''}</span>
                    </p>
                  )}
                </div>

                <Link
                  href={o.tracking_url || `/orders/${o.public_id || o.id}`}
                  className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]"
                >
                  <span>লাইভ ট্র্যাকিং ও বিস্তারিত দেখুন</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Inline Search Lookup Box */}
      <div className={`space-y-2 ${hasOrders ? 'pt-2 border-t border-slate-800' : ''}`}>
        <p className="text-[11px] text-slate-400 font-medium">
          {hasOrders ? 'অন্য কোনো অর্ডার ট্র্যাক করতে চান?' : 'আপনার অর্ডার আইডি (#1234) বা মোবাইল নম্বর লিখুন:'}
        </p>
        <form onSubmit={handleSearch} className="flex gap-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="যেমন: #1024 বা 017XXXXXXXX"
            className="flex-1 min-w-0 bg-slate-950/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shrink-0 shadow-md transition-all active:scale-95"
          >
            ট্র্যাক
          </button>
        </form>
        {errorMsg && (
          <p className="text-[10px] text-red-400 font-medium">{errorMsg}</p>
        )}
        <div className="flex justify-end pt-0.5">
          <Link
            href="/orders"
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            <span>আমার সব অর্ডার দেখুন</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * IN-CHAT QUICK CHECKOUT DIALOG / MODAL
 * Directly completes the order inside the chat without redirecting to shop page!
 */
export function InChatOrderModal({
  product,
  merchantId,
  visitorId,
  onOrderPlaced,
  onClose,
}) {
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('');
  const [selectedAddrIndex, setSelectedAddrIndex] = useState(-1);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const guestAddrs = readGuestAddresses();
    setSavedAddresses(guestAddrs);
    if (product?.address) {
      setRecipientName(product.address.recipient_name || '');
      setPhone(product.address.phone || '');
      setFullAddress(product.address.full_address || '');
      setDistrict(product.address.district || 'Dhaka');
      setUpazila(product.address.upazila || '');
    } else if (guestAddrs.length > 0) {
      const first = guestAddrs[0];
      setSelectedAddrIndex(0);
      setRecipientName(first.recipient_name || '');
      setPhone(first.phone || '');
      setFullAddress(first.full_address || '');
      setDistrict(first.district || 'Dhaka');
      setUpazila(first.upazila || '');
    }
  }, [product]);

  const handleSelectSaved = (addr, idx) => {
    setSelectedAddrIndex(idx);
    setRecipientName(addr.recipient_name || '');
    setPhone(addr.phone || '');
    setFullAddress(addr.full_address || '');
    setDistrict(addr.district || 'Dhaka');
    setUpazila(addr.upazila || '');
  };

  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 10) {
      setErrorMsg('অনুগ্রহ করে সঠিক মোবাইল নম্বর লিখুন');
      return;
    }
    if (!fullAddress || fullAddress.trim().length < 4) {
      setErrorMsg('অনুগ্রহ করে সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const addrPayload = {
      recipient_name: recipientName.trim() || 'গ্রাহক',
      phone: phone.trim(),
      full_address: fullAddress.trim(),
      district: district || 'Dhaka',
      upazila: upazila || '',
    };
    saveGuestAddress(addrPayload);

    try {
      const res = await fetchStorefront('/messages/widget-action/', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: merchantId,
          visitor_id: visitorId,
          action: 'submit_chat_order',
          product_id: product?.id,
          quantity,
          address: addrPayload,
        }),
      });

      if (res?.success) {
        if (onOrderPlaced) onOrderPlaced(res);
        if (onClose) onClose();
      } else {
        setErrorMsg(res?.error || 'অর্ডার করতে সমস্যা হয়েছে।');
      }
    } catch (err) {
      setErrorMsg(err.message || 'অর্ডার করতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const unitPrice = Number(product?.price || product?.base_price || 0);
  const subtotal = unitPrice * quantity;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">ইন-চ্যাট সরাসরি অর্ডার</h3>
              <p className="text-[10px] text-slate-500">চ্যাট থেকেই সরাসরি আপনার অর্ডার কনফার্ম করুন</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Summary */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
          {product?.image_url || (Array.isArray(product?.images) && product.images[0]) ? (
            <img
              src={product.image_url || product.images[0]}
              alt={product.name}
              className="w-12 h-12 rounded-xl object-cover bg-white border border-slate-200/60 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-800 truncate">{product?.name}</h4>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-black text-emerald-600">৳{unitPrice}</span>
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-xs">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="text-xs text-slate-500 hover:text-slate-900 font-bold"
                >
                  -
                </button>
                <span className="text-xs font-bold text-slate-800">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="text-xs text-slate-500 hover:text-slate-900 font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Saved Address Quick Select */}
        {savedAddresses.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              সংরক্ষিত ঠিকানা থেকে বাছুন
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {savedAddresses.map((addr, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSaved(addr, idx)}
                  className={`px-3 py-1.5 rounded-xl border text-[11px] shrink-0 text-left transition-all ${selectedAddrIndex === idx
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <p className="truncate max-w-[140px] font-semibold">{addr.recipient_name || 'ঠিকানা'}</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{addr.full_address}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleConfirmOrder} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block font-medium">আপনার নাম</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="নাম লিখুন"
                className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block font-medium">মোবাইল নম্বর *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 mb-1 block font-medium">সম্পূর্ণ ডেলিভারি ঠিকানা *</label>
            <textarea
              required
              rows={2}
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              placeholder="বাসা/রোড, এলাকা, জেলা..."
              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none resize-none transition-colors"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
            <span className="text-slate-600 font-medium">সাবটোটাল (ডেলিভারি ফি ব্যতীত)</span>
            <span className="font-extrabold text-emerald-600">৳{subtotal}</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>অর্ডার তৈরি হচ্ছে...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>অর্ডার নিশ্চিত করুন (ক্যাশ অন ডেলিভারি)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * 1. LIVE DELIVERY QUOTE RESULT CARD
 * Rendered when a customer selects a saved address or submits the checkout-style address form.
 */
export function LiveDeliveryQuoteCard({ widget, onOpenAddressForm, sessionCode, onOpenOrderModal }) {
  const charge = Number(widget?.delivery_charge ?? 100);
  const estDays = widget?.estimated_days || '২-৪ দিন';
  const provider = widget?.courier_provider || 'Standard Courier';
  const region = widget?.region || '';
  const addr = widget?.address || {};
  const activeSessionCode = widget?.session_code || sessionCode || '';

  return (
    <div className="mt-2.5 w-full max-w-full sm:max-w-md min-w-0 rounded-2xl bg-white border border-emerald-200 p-3 sm:p-4 shadow-md space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-extrabold text-slate-800">লাইভ ডেলিভারি চার্জ</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {provider}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-indigo-500" />
              <span>সম্ভাব্য ডেলিভারি: {estDays}</span>
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg sm:text-xl font-black text-emerald-600 tracking-tight">
            ৳{Math.round(charge)}
          </div>
          <span className="text-[10px] text-slate-400 block font-medium">ডেলিভারি ফি</span>
        </div>
      </div>

      {/* Selected Address Details */}
      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>
              {[addr.district, addr.upazila].filter(Boolean).join(' › ') ||
                region ||
                'নির্বাচিত এলাকা'}
            </span>
          </span>
          {addr.recipient_name && (
            <span className="text-[11px] text-slate-500 truncate">{addr.recipient_name}</span>
          )}
        </div>
        {addr.full_address && (
          <p className="text-[11px] text-slate-500 pl-5 line-clamp-2">{addr.full_address}</p>
        )}
      </div>

      {/* Actions: Change / Try Another Address or Direct In-Chat Order */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {onOpenAddressForm && (
          <button
            type="button"
            onClick={onOpenAddressForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>অন্য ঠিকানায় হিসাব করুন</span>
          </button>
        )}

        {onOpenOrderModal ? (
          <button
            type="button"
            onClick={() => onOpenOrderModal({ name: 'অর্ডার পণ্য', address: addr })}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-[11px] font-bold transition-all shadow-md ml-auto"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>সরাসরি অর্ডার করুন</span>
          </button>
        ) : activeSessionCode ? (
          <Link
            href={`/shop/${activeSessionCode}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all ml-auto"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>এখনই অর্ডার করুন</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 2. CHECKOUT-STYLE INTERACTIVE ADDRESS & COURIER CALCULATOR TEMPLATE
 * Supports seller's configured courier providers (Pathao: City > Zone > Area, Steadfast: City > Area)
 * with live delivery quote preview + address saving right inside the chat!
 */
export function CheckoutAddressFormWidget({
  widget,
  merchantId,
  visitorId,
  onQuoteCalculated,
  onCancel,
}) {
  const activeMerchantId = widget?.merchant_id || merchantId;
  const providers = Array.isArray(widget?.courier_providers) && widget.courier_providers.length > 0
    ? widget.courier_providers
    : [{ code: 'pathao', label: 'Pathao', levels: DEFAULT_PATHAO_LEVELS }];

  const [selectedProviderCode, setSelectedProviderCode] = useState(
    providers[0]?.code || 'pathao'
  );
  const activeProviderSpec =
    providers.find((p) => p.code === selectedProviderCode) || providers[0];
  const levels = Array.isArray(activeProviderSpec?.levels) && activeProviderSpec.levels.length > 0
    ? activeProviderSpec.levels
    : DEFAULT_PATHAO_LEVELS;

  const [recipientName, setRecipientName] = useState(widget?.default_customer?.name || '');
  const [phone, setPhone] = useState(widget?.default_customer?.phone || '');
  const [fullAddress, setFullAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');

  // Dynamic Courier Hierarchy State
  const [levelValues, setLevelValues] = useState({});
  const [levelOptions, setLevelOptions] = useState({});
  const [loadingLevel, setLoadingLevel] = useState('');
  const [courierLocationIds, setCourierLocationIds] = useState({});
  const [locationSearch, setLocationSearch] = useState('');

  // Address Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState([]);

  // Live Preview Quote inside Form
  const [livePreviewQuote, setLivePreviewQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadLocations = useCallback(async (providerCode, levelKey, parentId = '') => {
    setLoadingLevel(levelKey);
    try {
      const q = new URLSearchParams({ provider: providerCode || 'pathao', level: levelKey });
      if (parentId) q.set('parent_id', String(parentId));
      const res = await fetchStorefront(`/courier/locations/?${q.toString()}`);
      setLevelOptions((prev) => ({
        ...prev,
        [levelKey]: Array.isArray(res?.locations) ? res.locations : [],
      }));
    } catch {
      setLevelOptions((prev) => ({ ...prev, [levelKey]: [] }));
    } finally {
      setLoadingLevel('');
    }
  }, []);

  // Load top-level cities when provider changes
  useEffect(() => {
    const firstLevel = levels[0]?.key || 'city';
    setLevelValues({});
    setLevelOptions({});
    loadLocations(selectedProviderCode, firstLevel, '');
  }, [selectedProviderCode, loadLocations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch live quote preview whenever district or courierLocationIds change
  useEffect(() => {
    const activeProviderIds = courierLocationIds[selectedProviderCode] || {};
    const hasCity = Boolean(activeProviderIds.city_id || district);
    if (!hasCity || !activeMerchantId) return;

    let cancelled = false;
    setQuoteLoading(true);
    fetchStorefront('/courier/quote/', {
      method: 'POST',
      body: JSON.stringify({
        merchant_id: activeMerchantId,
        district,
        courier_ids: courierLocationIds,
        courier_provider: selectedProviderCode,
      }),
    })
      .then((res) => {
        if (!cancelled && res?.delivery_charge !== undefined) {
          setLivePreviewQuote(res);
        }
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMerchantId, district, courierLocationIds, selectedProviderCode]);

  const handleSelectLevelValue = async (levelIndex, rawVal) => {
    const levelObj = levels[levelIndex];
    if (!levelObj) return;
    const levelKey = levelObj.key;

    const nextValues = { ...levelValues };
    levels.slice(levelIndex).forEach((l) => {
      nextValues[l.key] = '';
    });
    nextValues[levelKey] = rawVal;
    setLevelValues(nextValues);

    const opts = levelOptions[levelKey] || [];
    const matched = opts.find((item) => String(item[`${levelKey}_id`]) === String(rawVal));

    if (levelKey === 'city') {
      setDistrict(matched?.city_name || '');
      setUpazila('');
    } else if (levelKey === 'zone') {
      setUpazila(matched?.zone_name || '');
    } else if (levelKey === 'area') {
      if (!upazila) setUpazila(matched?.area_name || '');
    }

    const providerIds = {};
    if (nextValues.city) providerIds.city_id = Number(nextValues.city);
    if (nextValues.zone) providerIds.zone_id = Number(nextValues.zone);
    if (nextValues.area) providerIds.area_id = Number(nextValues.area);

    setCourierLocationIds((prev) => ({
      ...prev,
      [selectedProviderCode]: providerIds,
    }));

    const nextLevel = levels[levelIndex + 1]?.key;
    if (rawVal && nextLevel) {
      await loadLocations(selectedProviderCode, nextLevel, rawVal);
    }
  };

  const handleAddressInput = (val) => {
    setFullAddress(val);
    if (val.trim().length >= 3) {
      fetchStorefront(`/courier/suggest-address/?q=${encodeURIComponent(val)}`)
        .then((res) => setSuggestions(Array.isArray(res) ? res.slice(0, 4) : []))
        .catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
    }
  };

  const handleApplySuggestion = (sug) => {
    if (sug.district) setDistrict(sug.district);
    if (sug.upazila) setUpazila(sug.upazila);
    setCourierLocationIds({
      pathao: sug.pathao || undefined,
      steadfast: sug.steadfast || undefined,
    });
    setSuggestions([]);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!district && !fullAddress.trim()) {
      setErrorMsg('অনুগ্রহ করে অন্তত আপনার জেলা/এলাকা নির্বাচন করুন অথবা ঠিকানা লিখুন।');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const composedFullAddress =
      fullAddress.trim() || [upazila, district].filter(Boolean).join(', ');

    const addressPayload = {
      recipient_name: recipientName.trim() || 'গ্রাহক',
      phone: phone.trim(),
      full_address: composedFullAddress,
      district: district || 'Dhaka',
      upazila: upazila || '',
      courier_location_ids: courierLocationIds,
    };

    try {
      // Save to guest localStorage so even unauthenticated visitors keep their address history
      saveGuestAddress(addressPayload);

      const res = await fetchStorefront('/messages/widget-action/', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: activeMerchantId,
          visitor_id: visitorId,
          action: 'calculate_address_quote',
          save_new_address: true,
          courier_provider: selectedProviderCode,
          address: addressPayload,
        }),
      });

      if (res?.success && onQuoteCalculated) {
        onQuoteCalculated(res, addressPayload);
      }
    } catch (err) {
      setErrorMsg(err.message || 'ডেলিভারি চার্জ হিসাব করতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2.5 w-full max-w-full sm:max-w-md min-w-0 rounded-2xl bg-white border border-indigo-200/90 p-3 sm:p-4 shadow-xl space-y-3.5 text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-800">
              ডেলিভারি ঠিকানা ও লাইভ কুরিয়ার ক্যালকুলেটর
            </h4>
            <p className="text-[10px] text-slate-500">
              জেলা ও থানা সিলেক্ট করলেই অটোমেটিক ডেলিভারি চার্জ দেখা যাবে
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg bg-slate-100"
          >
            বন্ধ করুন
          </button>
        )}
      </div>

      {/* Courier Provider Selector (if seller has multiple active couriers) */}
      {providers.length > 1 && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            কুরিয়ার সার্ভিস নির্বাচন করুন
          </label>
          <div className="grid grid-cols-2 gap-2">
            {providers.map((prov) => {
              const active = prov.code === selectedProviderCode;
              return (
                <button
                  key={prov.code}
                  type="button"
                  onClick={() => setSelectedProviderCode(prov.code)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${active
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  <Truck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{prov.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmitForm} className="space-y-3">
        {/* Dynamic Cascading Location Selects (City -> Zone -> Area according to Courier Provider) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {levels.map((lvl, idx) => {
            const parentKey = idx > 0 ? levels[idx - 1].key : null;
            const isDisabled = idx > 0 && !levelValues[parentKey];
            const options = levelOptions[lvl.key] || [];
            const filteredOpts =
              idx === 0 && locationSearch.trim()
                ? options.filter((o) =>
                  String(o[`${lvl.key}_name`] || '')
                    .toLowerCase()
                    .includes(locationSearch.trim().toLowerCase())
                )
                : options;

            return (
              <div
                key={lvl.key}
                className={idx === levels.length - 1 && levels.length === 3 ? 'sm:col-span-2' : ''}
              >
                <label className="text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{lvl.label}</span>
                  {loadingLevel === lvl.key && (
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                  )}
                </label>
                <select
                  disabled={isDisabled}
                  value={levelValues[lvl.key] || ''}
                  onChange={(e) => handleSelectLevelValue(idx, e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none disabled:opacity-40 transition-colors"
                >
                  <option value="">
                    {isDisabled ? `আগে ${levels[idx - 1].label} বাছুন` : `${lvl.label} নির্বাচন করুন`}
                  </option>
                  {filteredOpts.map((opt) => {
                    const idVal = opt[`${lvl.key}_id`];
                    const nameVal = opt[`${lvl.key}_name`];
                    return (
                      <option key={idVal} value={idVal}>
                        {nameVal}
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })}
        </div>

        {/* Full Address with Smart Autocomplete */}
        <div className="relative">
          <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
            বিস্তারিত ঠিকানা (বাসা/রোড/এলাকা)
          </label>
          <input
            type="text"
            value={fullAddress}
            onChange={(e) => handleAddressInput(e.target.value)}
            placeholder="যেমন: মিরপুর ১০, রোড ৪, বাসা ১২..."
            className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-slate-800 placeholder:text-slate-400 outline-none transition-colors"
          />
          {suggestions.length > 0 && (
            <div className="mt-1 rounded-xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xl">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplySuggestion(sug)}
                  className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 flex items-center justify-between"
                >
                  <span>{sug.label || `${sug.upazila}, ${sug.district}`}</span>
                  <span className="text-[10px] text-indigo-600 font-semibold">সিলেক্ট</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Optional Name & Phone row for saving like Checkout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block font-medium">প্রাপকের নাম (ঐচ্ছিক)</label>
            <div className="relative">
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="আপনার নাম"
                className="w-full text-xs pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-colors"
              />
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block font-medium">মোবাইল নম্বর (ঐচ্ছিক)</label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full text-xs pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-colors"
              />
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Live Quote Instant Preview Bar inside the Form */}
        {(livePreviewQuote || quoteLoading) && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
              <Truck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>
                {quoteLoading
                  ? 'কুরিয়ার চার্জ হিসাব হচ্ছে...'
                  : `${livePreviewQuote?.courier_provider || 'কুরিয়ার'} চার্জ (${district || 'নির্বাচিত এলাকা'}):`}
              </span>
            </span>
            {quoteLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <span className="text-sm font-black text-emerald-700">
                ৳{Math.round(Number(livePreviewQuote?.delivery_charge || 100))}
              </span>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>হিসাব ও সেভ করা হচ্ছে...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>ঠিকানা সেভ ও লাইভ ডেলিভারি চার্জ দেখুন</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

/**
 * 3. DELIVERY INQUIRY TEMPLATE (SAVED ADDRESSES SELECTOR + LIVE QUOTE + NEW ADDRESS TRIGGER)
 * When customer asks about delivery charge:
 * - Shows their saved addresses (from DB + Guest localStorage).
 * - Clicking any address immediately calculates & displays the Live Delivery Quote Card.
 * - Clicking "নতুন ঠিকানা যোগ করুন" opens the Checkout-style Address Form right inside the chat!
 */
export function DeliveryInquiryWidget({
  widget,
  merchantId,
  visitorId,
  onQuoteCalculated,
  onOpenOrderModal,
}) {
  const activeMerchantId = widget?.merchant_id || merchantId;
  const [savedAddresses, setSavedAddresses] = useState(() => {
    const apiAddrs = Array.isArray(widget?.saved_addresses) ? widget.saved_addresses : [];
    const guestAddrs = readGuestAddresses();
    const combined = [...apiAddrs];
    for (const ga of guestAddrs) {
      if (
        !combined.some(
          (a) => a.full_address === ga.full_address && a.district === ga.district
        )
      ) {
        combined.push(ga);
      }
    }
    return combined;
  });

  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [calculatingId, setCalculatingId] = useState(null);
  const [calculatedQuoteWidget, setCalculatedQuoteWidget] = useState(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(savedAddresses.length === 0);

  const handleSelectSavedAddress = async (addr) => {
    const addrKey = addr.id || addr.full_address;
    setSelectedAddrId(addrKey);
    setCalculatingId(addrKey);
    try {
      const res = await fetchStorefront('/messages/widget-action/', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: activeMerchantId,
          visitor_id: visitorId,
          action: 'calculate_address_quote',
          save_new_address: false,
          address: addr,
        }),
      });

      if (res?.success) {
        const quoteCard = res.assistant_message?.widgets?.[0] || {
          widget_type: 'live_delivery_quote_card',
          delivery_charge: res.quote?.delivery_charge,
          estimated_days: res.quote?.estimated_days,
          courier_provider: res.quote?.courier_provider,
          region: res.quote?.region,
          address: addr,
          session_code: widget?.session_code,
        };
        setCalculatedQuoteWidget(quoteCard);
        if (onQuoteCalculated) {
          onQuoteCalculated(res, addr);
        }
      }
    } catch (err) {
      console.error('Failed calculating delivery quote for saved address:', err);
    } finally {
      setCalculatingId(null);
    }
  };

  const handleNewAddressSubmitted = (res, newAddr) => {
    if (res?.saved_addresses?.length) {
      setSavedAddresses(res.saved_addresses);
    } else if (newAddr) {
      setSavedAddresses((prev) => [newAddr, ...prev]);
    }
    const quoteCard = res?.assistant_message?.widgets?.[0];
    if (quoteCard) {
      setCalculatedQuoteWidget(quoteCard);
    }
    setShowNewAddressForm(false);
    if (onQuoteCalculated) {
      onQuoteCalculated(res, newAddr);
    }
  };

  return (
    <div className="mt-2.5 w-full max-w-md space-y-2.5">
      {/* Saved Addresses Card List */}
      {savedAddresses.length > 0 && !showNewAddressForm && (
        <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 shadow-md space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">আপনার সংরক্ষিত ঠিকানাসমূহ</h4>
                <p className="text-[10px] text-slate-500">
                  যেকোনো ঠিকানায় ট্যাপ করে সাথে সাথে ডেলিভারি চার্জ দেখুন
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNewAddressForm(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-all shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>নতুন ঠিকানা</span>
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
            {savedAddresses.map((addr, idx) => {
              const addrKey = addr.id || addr.full_address || idx;
              const isSelected = selectedAddrId === addrKey;
              const isCalculating = calculatingId === addrKey;

              return (
                <button
                  key={addrKey}
                  type="button"
                  disabled={Boolean(calculatingId)}
                  onClick={() => handleSelectSavedAddress(addr)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${isSelected
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:border-indigo-300 text-slate-700'
                    }`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="text-xs font-bold truncate">
                        {[addr.district, addr.upazila].filter(Boolean).join(' › ') ||
                          addr.recipient_name ||
                          'সংরক্ষিত ঠিকানা'}
                      </span>
                      {addr.is_default && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">
                          ডিফল্ট
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate pl-5">
                      {addr.full_address}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isCalculating ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-semibold">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>হিসাব হচ্ছে</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        <Truck className="w-3 h-3" />
                        <span>চার্জ দেখুন</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline Live Quote Result if user clicked a saved address */}
      {calculatedQuoteWidget && !showNewAddressForm && (
        <LiveDeliveryQuoteCard
          widget={calculatedQuoteWidget}
          sessionCode={widget?.session_code}
          onOpenAddressForm={() => setShowNewAddressForm(true)}
          onOpenOrderModal={onOpenOrderModal}
        />
      )}

      {/* Inline Checkout-Style New Address Form */}
      {showNewAddressForm && (
        <CheckoutAddressFormWidget
          widget={widget}
          merchantId={activeMerchantId}
          visitorId={visitorId}
          onQuoteCalculated={handleNewAddressSubmitted}
          onCancel={savedAddresses.length > 0 ? () => setShowNewAddressForm(false) : null}
        />
      )}
    </div>
  );
}

/**
 * 4. PRODUCT SHOWCASE TEMPLATE
 * Displays interactive horizontal product cards inside the chat.
 */
export function ProductShowcaseWidget({ widget, onOpenOrderModal }) {
  const products = Array.isArray(widget?.products) ? widget.products : [];
  const sessionCode = widget?.session_code || '';
  if (products.length === 0) return null;

  return (
    <div className="mt-2.5 w-full max-w-full sm:max-w-lg min-w-0 space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span className="flex items-center gap-1 font-semibold text-indigo-700">
          <ShoppingBag className="w-3.5 h-3.5" /> স্টকে থাকা পণ্যসমূহ
        </span>
        {sessionCode && (
          <Link
            href={`/shop/${sessionCode}`}
            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5"
          >
            <span>সব দেখুন</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
        {products.map((p) => (
          <div
            key={p.id}
            className="w-44 shrink-0 rounded-2xl bg-white border border-slate-200 p-2.5 flex flex-col justify-between shadow-md"
          >
            <div>
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-full h-24 object-cover rounded-xl bg-slate-100 mb-2 border border-slate-100"
                />
              ) : (
                <div className="w-full h-24 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <ShoppingBag className="w-6 h-6" />
                </div>
              )}
              <h5 className="text-xs font-bold text-slate-800 line-clamp-2">{p.name}</h5>
            </div>

            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-600">
                ৳{Math.round(Number(p.price || 0))}
              </span>
              {onOpenOrderModal ? (
                <button
                  type="button"
                  onClick={() => onOpenOrderModal(p)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>অর্ডার</span>
                </button>
              ) : sessionCode ? (
                <Link
                  href={`/shop/${sessionCode}`}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-colors"
                >
                  অর্ডার
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * RICH INTERACTIVE PRODUCT DETAIL CARD WIDGET
 * Rendered when a customer drags/attaches a product or asks specific questions about it!
 */
export function ProductDetailCardWidget({ widget, sessionCode, onOpenOrderModal }) {
  const p = widget?.product;
  if (!p) return null;

  const activeSessionCode = widget?.session_code || sessionCode || '';
  const price = p.price ?? p.base_price ?? 0;
  const originalPrice = p.base_price;
  const hasDiscount = originalPrice && originalPrice > price;
  const image = p.image_url || (Array.isArray(p.images) ? p.images[0] : null);

  return (
    <div className="mt-2.5 w-full max-w-full sm:max-w-md min-w-0 rounded-2xl bg-white border border-indigo-200/90 p-3 sm:p-4 shadow-md space-y-3">
      <div className="flex gap-2.5 sm:gap-3 items-start">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center">
          {image ? (
            <img src={image} alt={p.name} className="w-full h-full object-cover" />
          ) : (
            <ShoppingBag className="w-8 h-8 text-slate-400" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              নির্দিষ্ট পণ্য
            </span>
            {p.stock > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700">
                ইন স্টক ({p.stock} টি)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-600">
                স্টক শেষ
              </span>
            )}
          </div>

          <h4 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2">{p.name}</h4>

          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-base sm:text-lg font-black text-emerald-600">৳{price}</span>
            {hasDiscount && (
              <span className="text-xs text-slate-400 line-through">৳{originalPrice}</span>
            )}
            {p.discount > 0 && (
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded">
                -{p.discount}%
              </span>
            )}
          </div>
        </div>
      </div>

      {p.description && (
        <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 line-clamp-3 leading-relaxed">
          {p.description}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
        {p.warranty && (
          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
            🛡️ {p.warranty}
          </span>
        )}

        {onOpenOrderModal ? (
          <button
            type="button"
            onClick={() => onOpenOrderModal(p)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 ml-auto"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>এখনই অর্ডার করুন</span>
          </button>
        ) : activeSessionCode ? (
          <Link
            href={`/shop/${activeSessionCode}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 ml-auto"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>এখনই অর্ডার করুন</span>
          </Link>
        ) : (
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold ml-auto"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>শপ থেকে দেখুন</span>
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * MASTER DISPATCHER FOR CONVERSATIONAL UI ENGINE WIDGETS
 */
export default function ChatWidgetRenderer({
  widgets,
  merchantId,
  visitorId,
  sessionCode,
  onQuoteCalculated,
  onOpenAddressForm,
  onOpenOrderModal,
}) {
  if (!Array.isArray(widgets) || widgets.length === 0) return null;

  return (
    <div className="space-y-2.5 w-full">
      {widgets.map((widget, idx) => {
        const type = widget?.widget_type;
        if (type === 'order_confirmed_card') {
          return <OrderConfirmedCardWidget key={idx} widget={widget} />;
        }
        if (type === 'order_tracking_card') {
          return <OrderTrackingCardWidget key={idx} widget={widget} />;
        }
        if (type === 'delivery_inquiry_template') {
          return (
            <DeliveryInquiryWidget
              key={idx}
              widget={widget}
              merchantId={merchantId}
              visitorId={visitorId}
              onQuoteCalculated={onQuoteCalculated}
              onOpenOrderModal={onOpenOrderModal}
            />
          );
        }
        if (type === 'checkout_address_form_template') {
          return (
            <CheckoutAddressFormWidget
              key={idx}
              widget={widget}
              merchantId={merchantId}
              visitorId={visitorId}
              onQuoteCalculated={onQuoteCalculated}
            />
          );
        }
        if (type === 'live_delivery_quote_card') {
          return (
            <LiveDeliveryQuoteCard
              key={idx}
              widget={widget}
              sessionCode={sessionCode}
              onOpenAddressForm={onOpenAddressForm}
              onOpenOrderModal={onOpenOrderModal}
            />
          );
        }
        if (type === 'product_showcase_template') {
          return (
            <ProductShowcaseWidget
              key={idx}
              widget={widget}
              sessionCode={sessionCode}
              onOpenOrderModal={onOpenOrderModal}
            />
          );
        }
        if (type === 'product_detail_card') {
          return (
            <ProductDetailCardWidget
              key={idx}
              widget={widget}
              sessionCode={sessionCode}
              onOpenOrderModal={onOpenOrderModal}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
