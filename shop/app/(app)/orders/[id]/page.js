"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchStorefront } from '@/lib/api';
import InteractiveVoiceCallModal from '@/components/InteractiveVoiceCallModal';
import {
  Package,
  Store,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  Copy,
  Check,
  ChevronLeft,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  PhoneCall
} from 'lucide-react';

export default function OrderTrackingDetailPage() {
  const params = useParams();
  const orderId = params?.id;
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedConsignment, setCopiedConsignment] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  const loadOrder = useCallback(() => {
    if (!orderId) return;
    fetchStorefront(`/orders/${orderId}/`)
      .then((data) => {
        setOrder(data);
        // Automatically open interactive call screen if this order needs voice confirmation
        const callStatus = String(data?.call_status || '').toLowerCase();
        const orderStatus = String(data?.status || '').toLowerCase();
        const requiresCall = Boolean(data?.needs_call_verification || (orderStatus === 'pending' && !['confirmed', 'completed'].includes(callStatus)));
        if (requiresCall) {
          setIsCallModalOpen(true);
        }
      })
      .catch((err) => setError(err.message || 'অর্ডারের বিবরণ লোড করা যায়নি'))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const copyConsignmentId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedConsignment(true);
    setTimeout(() => setCopiedConsignment(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span>ট্র্যাকিং তথ্য লোড হচ্ছে...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-200">{error || 'অর্ডার পাওয়া যায়নি'}</p>
        <button
          onClick={() => router.push('/orders')}
          className="px-4 py-2 bg-slate-800 rounded-xl text-xs text-slate-300 hover:text-white"
        >
          অর্ডার তালিকায় ফিরে যান
        </button>
      </div>
    );
  }

  const tracking = order.tracking || {};
  const steps = tracking.steps || [];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-bold transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>পেছনে যান</span>
        </button>
        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">#{order.id}</span>
      </div>

      {/* Shop Info Card */}
      <div className="rounded-[2rem] p-5 bg-white border border-slate-200/80 shadow-md shadow-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">{order.shop_name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              তারিখ: {new Date(order.created_at).toLocaleDateString('bn-BD')}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">মোট বিল</span>
          <p className="text-base sm:text-lg font-black text-slate-900">৳{order.total_price}</p>
        </div>
      </div>

      {/* Voice Call Verification Action Banner (if pending verification) */}
      {order.needs_call_verification && (
        <div className="p-4 sm:p-5 rounded-[2rem] bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 animate-pulse">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-900">অর্ডার নিশ্চিতকরণ কল প্রয়োজন</h4>
              <p className="text-[11px] text-amber-700 mt-0.5 font-medium">আপনার কলটি গ্রহণ করে ১ চাপুন অথবা পুনরায় কল রিসিভ করতে ট্যাপ করুন।</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCallModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5" /> কল ধরুন
          </button>
        </div>
      )}

      {/* Courier Tracking ID Badge (If booked with Pathao or SteadFast) */}
      {tracking.consignment_id && (
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                {tracking.courier_name || 'কুরিয়ার ট্র্যাকিং'} আইডি
              </p>
              <p className="text-xs font-mono font-black text-slate-800 mt-0.5">
                {tracking.consignment_id}
              </p>
            </div>
          </div>
          <button
            onClick={() => copyConsignmentId(tracking.consignment_id)}
            className="p-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold shadow-xs transition-all text-xs flex items-center gap-1.5"
          >
            {copiedConsignment ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px]">{copiedConsignment ? 'কপি হয়েছে' : 'কপি'}</span>
          </button>
        </div>
      )}

      {/* Visual Tracking Timeline */}
      <div className="rounded-[2rem] p-6 bg-white border border-slate-200/80 shadow-md shadow-slate-100 space-y-4">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-indigo-600" />
          <span>লাইভ ট্র্যাকিং টাইমলাইন</span>
        </h2>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {steps.map((step, idx) => {
            const isCompleted = step.is_completed;
            const isCurrent = step.is_current;
            const isError = step.is_error;

            let dotColor = "bg-slate-100 border-slate-300 text-slate-400";
            if (isError) {
              dotColor = "bg-rose-600 border-rose-300 text-white shadow-md shadow-rose-500/20";
            } else if (isCurrent) {
              dotColor = "bg-indigo-600 border-indigo-300 text-white animate-pulse shadow-md shadow-indigo-500/30";
            } else if (isCompleted) {
              dotColor = "bg-emerald-600 border-emerald-300 text-white";
            }

            return (
              <div key={idx} className="relative">
                {/* Node icon */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] z-10 ${dotColor}`}
                >
                  {isCompleted && !isError ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-bold ${isCurrent ? 'text-indigo-600' : (isCompleted ? 'text-slate-900' : 'text-slate-500')}`}>
                      {step.title}
                    </p>
                    {step.timestamp && (
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {new Date(step.timestamp).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-medium">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivery Address Card */}
      <div className="rounded-[2rem] p-5 bg-white border border-slate-200/80 shadow-md shadow-slate-100 space-y-2">
        <div className="flex items-center gap-2 text-xs font-black text-slate-700">
          <MapPin className="w-4 h-4 text-indigo-600" />
          <span>ডেলিভারি ঠিকানা</span>
        </div>
        <p className="text-xs text-slate-900 font-bold">{order.customer_name} ({order.phone_number})</p>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">{order.address}</p>
        {order.district && (
          <p className="text-[11px] text-indigo-600 font-bold">জেলা: {order.district} {order.upazila ? `| ${order.upazila}` : ''}</p>
        )}
      </div>

      {/* Ordered Items Breakdown */}
      <div className="rounded-[2rem] p-5 sm:p-6 bg-white border border-slate-200/80 shadow-md shadow-slate-100 space-y-3">
        <div className="flex items-center justify-between text-xs font-black text-slate-500 uppercase tracking-wider pb-1">
          <span>অর্ডারকৃত পণ্য</span>
          <span>মূল্য</span>
        </div>

        <div className="divide-y divide-slate-100">
          {Array.isArray(order.items) && order.items.length > 0 ? (
            order.items.map((item, idx) => {
              const itemImg = item.image_url || order.product_image;
              return (
                <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {itemImg ? (
                        <img src={itemImg} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-indigo-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">পরিমাণ: {item.quantity || 1} x ৳{item.price}</p>
                    </div>
                  </div>
                  <span className="font-black text-slate-900 shrink-0">৳{(item.price || 0) * (item.quantity || 1)}</span>
                </div>
              );
            })
          ) : (
            <div className="py-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {order.product_image ? (
                    <img src={order.product_image} alt={order.product_name || 'পণ্য'} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
                <span className="text-slate-800 font-bold truncate">{order.product_name || 'পণ্য'}</span>
              </div>
              <span className="font-black text-slate-900 shrink-0">৳{order.price}</span>
            </div>
          )}
        </div>

        {/* Bill Summary */}
        <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-500 font-medium">
            <span>পণ্যের মূল্য</span>
            <span>৳{order.price}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 font-medium">
            <span>ডেলিভারি চার্জ</span>
            <span>৳{order.delivery_charge || 0}</span>
          </div>
          {Number(order.cod_charge || 0) > 0 && (
            <div className="flex items-center justify-between text-indigo-700 bg-indigo-50/70 px-2.5 py-1.5 rounded-lg font-semibold text-xs border border-indigo-100/80">
              <span className="flex items-center gap-1">
                <span>ক্যাশ অন ডেলিভারি (COD) ফি</span>
                <span className="text-[10px] bg-indigo-200/60 text-indigo-900 px-1.5 py-0.2 rounded font-black">১%</span>
              </span>
              <span className="font-bold">৳{Number(order.cod_charge).toFixed(0)}</span>
            </div>
          )}
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-slate-800">
            <span>সর্বমোট প্রদেয়</span>
            <span className="text-base font-black text-indigo-600">৳{order.total_price}</span>
          </div>
        </div>
      </div>

      {/* Order Self-Service Actions (Cancel, Edit Address, Support) */}
      <OrderActionsPanel order={order} setOrder={setOrder} orderId={orderId} />

      {/* Universal Interactive Voice Call Modal */}
      {order && (
        <InteractiveVoiceCallModal
          isOpen={isCallModalOpen}
          order={order}
          voiceConfig={order.voice_config}
          shopName={order.shop_name}
          shopAvatar={order.merchant_avatar || null}
          onClose={() => setIsCallModalOpen(false)}
          onActionComplete={(res) => {
            loadOrder();
          }}
        />
      )}
    </div>
  );
}

function OrderActionsPanel({ order, setOrder, orderId }) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('ভুল পণ্য নির্বাচন করেছি');
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(order.customer_name || '');
  const [editPhone, setEditPhone] = useState(order.phone_number || '');
  const [editAddress, setEditAddress] = useState(order.address || '');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);

  const status = String(order.status || '').toLowerCase();
  const isCancellable = ['pending', 'confirmed', 'processing', 'ready_to_ship'].includes(status);
  const isCancelled = status === 'cancelled';
  const isDelivered = status === 'delivered';

  const handleCancelOrder = async () => {
    setCancelling(true);
    setCancelError(null);
    const finalReason = cancelReason === 'অন্যান্য' ? customReason : cancelReason;
    try {
      const res = await fetchStorefront(`/orders/${orderId}/cancel/`, {
        method: 'POST',
        body: JSON.stringify({ reason: finalReason || 'কাস্টমার কর্তৃক বাতিল' })
      });
      if (res.order) {
        setOrder(res.order);
      } else {
        setOrder(prev => ({ ...prev, status: 'cancelled' }));
      }
      setShowCancelModal(false);
    } catch (err) {
      setCancelError(err.message || 'অর্ডার বাতিল করা যায়নি');
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetchStorefront(`/orders/${orderId}/edit-address/`, {
        method: 'PATCH',
        body: JSON.stringify({
          customer_name: editName,
          phone_number: editPhone,
          address: editAddress
        })
      });
      if (res.order) {
        setOrder(res.order);
      } else {
        setOrder(prev => ({
          ...prev,
          customer_name: editName,
          phone_number: editPhone,
          address: editAddress
        }));
      }
      setShowEditModal(false);
    } catch (err) {
      setEditError(err.message || 'ঠিকানা আপডেট করা যায়নি');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="rounded-[2rem] p-5 bg-white border border-slate-200/80 shadow-md shadow-slate-100 space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-700">অর্ডার ম্যানেজমেন্ট ও সহায়তা</span>
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${isCancelled ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
          স্ট্যাটাস: {order.status}
        </span>
      </div>

      {isCancelled ? (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
          ❌ এই অর্ডারটি বাতিল করা হয়েছে। প্রয়োজনে নতুন অর্ডার করতে পারেন।
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {isCancellable && (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>✏️</span>
                <span>ঠিকানা পরিবর্তন</span>
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold text-rose-600 transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>❌</span>
                <span>অর্ডার বাতিল</span>
              </button>
            </>
          )}

          {isDelivered && (
            <div className="col-span-2 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-700 flex items-center justify-between">
              <span className="font-medium">🔄 প্রোডাক্টে সমস্যা হলে রিটার্ন/এক্সচেঞ্জ আবেদন করুন:</span>
              <a
                href={`tel:${order.merchant_phone || ''}`}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold shadow-xs"
              >
                সাপোর্ট কল
              </a>
            </div>
          )}
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-black text-slate-900">অর্ডার বাতিল নিশ্চিত করুন</h3>
              <p className="text-xs text-slate-500 font-medium">আপনি কি নিশ্চিতভাবে এই অর্ডারটি বাতিল করতে চান?</p>
            </div>

            {cancelError && (
              <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-semibold">
                {cancelError}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-600 font-bold">বাতিলের কারণ নির্বাচন করুন:</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
              >
                <option value="ভুল পণ্য নির্বাচন করেছি">ভুল পণ্য নির্বাচন করেছি</option>
                <option value="ডেলিভারি ঠিকানা পরিবর্তন করতে চাই">ডেলিভারি ঠিকানা পরিবর্তন করতে চাই</option>
                <option value="অন্য কোথাও থেকে কিনেছি">অন্য কোথাও থেকে কিনেছি</option>
                <option value="অর্ডারে সময় বেশি লাগছে">অর্ডারে সময় বেশি লাগছে</option>
                <option value="অন্যান্য">অন্যান্য</option>
              </select>
            </div>

            {cancelReason === 'অন্যান্য' && (
              <input
                type="text"
                placeholder="বাতিলের কারণ লিখুন..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                ফিরে যান
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 shadow-md shadow-rose-600/20"
              >
                {cancelling ? 'বাতিল হচ্ছে...' : 'হ্যাঁ, বাতিল করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Address Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-black text-slate-900">ডেলিভারি ঠিকানা সংশোধন</h3>
              <p className="text-xs text-slate-500 font-medium">পার্সেল পিকআপের পূর্বে আপনার সঠিক তথ্য দিন</p>
            </div>

            {editError && (
              <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-semibold">
                {editError}
              </p>
            )}

            <form onSubmit={handleSaveAddress} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-600 font-bold">নাম</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-600 font-bold">মোবাইল নম্বর</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-600 font-bold">সম্পূর্ণ ঠিকানা</label>
                <textarea
                  rows={2}
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 shadow-md shadow-indigo-600/20"
                >
                  {savingEdit ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
