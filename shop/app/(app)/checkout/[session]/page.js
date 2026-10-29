"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCustomer } from '@/lib/auth-context';
import { fetchStorefront } from '@/lib/api';
import InteractiveVoiceCallModal from '@/components/InteractiveVoiceCallModal';
import {
  ShoppingBag,
  Store,
  MapPin,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Tag,
  Percent,
  Gift,
  Check,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  FileText,
  Clock,
  ArrowRight,
  Trash2,
  Info,
  X,
  PhoneCall,
  PhoneOff,
  Volume2
} from 'lucide-react';

export default function SmartCheckoutPage() {
  const params = useParams();
  const sessionCode = params?.session;
  const router = useRouter();
  const { customer, isAuthenticated, isLoading: authLoading, loginWithInstantToken, refreshCustomer } = useCustomer();

  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [showAllAddresses, setShowAllAddresses] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);

  // AI Voice Web Call Confirmation State
  const [activeCallOrder, setActiveCallOrder] = useState(null);
  const [callVoiceConfig, setCallVoiceConfig] = useState(null);

  // Address Form State
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [specialInstruction, setSpecialInstruction] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCourierIds, setSelectedCourierIds] = useState({});

  // Dynamic Courier Capability
  const [courierProviders, setCourierProviders] = useState([]);
  const [selectedCourierProvider, setSelectedCourierProvider] = useState('');
  const [courierLevelValues, setCourierLevelValues] = useState({});
  const [courierLocationOptions, setCourierLocationOptions] = useState({});
  const [courierLoadError, setCourierLoadError] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationPickerLevel, setLocationPickerLevel] = useState(0);
  const [locationPickerSearch, setLocationPickerSearch] = useState('');

  // Phone History Profile Badge
  const [phoneProfile, setPhoneProfile] = useState(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // Delivery Quote & Promotions
  const [deliveryCharge, setDeliveryCharge] = useState(100);
  const [estimatedDays, setEstimatedDays] = useState('২-৩ দিন');
  const [quoteSource, setQuoteSource] = useState('');
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(0);
  const [remainingForFreeShipping, setRemainingForFreeShipping] = useState(null);
  const [promotionDiscount, setPromotionDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState(null);
  const [couponError, setCouponError] = useState(null);

  // Active Promotions from Session
  const activePromotions = useMemo(() => session?.active_promotions || [], [session]);
  const countdownPromo = useMemo(() => activePromotions.find(p => p.show_countdown_timer && p.end_date), [activePromotions]);
  const freeShipPromo = useMemo(() => activePromotions.find(p => p.is_free_shipping || p.promotion_type === 'free_shipping'), [activePromotions]);

  // Live countdown state
  const [countdownText, setCountdownText] = useState('');
  useEffect(() => {
    if (!countdownPromo?.end_date) {
      setCountdownText('');
      return;
    }
    const update = () => {
      const diff = new Date(countdownPromo.end_date).getTime() - Date.now();
      if (diff <= 0) {
        setCountdownText('অফারের মেয়াদ সমাপ্ত');
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownText(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [countdownPromo]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // 1. Load Session Data & Auto-Authenticate Platform Account
  useEffect(() => {
    if (!sessionCode) return;

    fetchStorefront(`/session/resolve/${sessionCode}/`)
      .then((data) => {
        setSession(data);
        setItems(data.items || []);
        const prefill = data.checkout_prefill || {};
        if (prefill.customer_name) setRecipientName(prefill.customer_name);
        if (prefill.phone) setPhone(prefill.phone);
        if (prefill.address) setFullAddress(prefill.address);
        if (prefill.district) setDistrict(prefill.district);
        if (prefill.upazila) setUpazila(prefill.upazila);
        const savedCourier = prefill.courier_location_ids || {};
        if (Object.keys(savedCourier).length) setSelectedCourierIds(savedCourier);
        if (data.delivery_charge) setDeliveryCharge(Number(data.delivery_charge));

        // Re-trigger Voice Call if session already has an unverified pending order
        if (data.unverified_order) {
          if (data.voice_config) {
            setCallVoiceConfig(data.voice_config);
          }
          setActiveCallOrder(data.unverified_order);
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || 'চেকআউট সেশন লোড করা সম্ভব হয়নি');
      });
  }, [sessionCode]);

  // Auto-authenticate or link session with browser customer account
  useEffect(() => {
    if (!sessionCode || authLoading) return;
    loginWithInstantToken(sessionCode)
      .then(() => {
        return fetchStorefront('/addresses/');
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAddresses(data);
          // If the checkout session already has fresh prefill from chat draft/metadata,
          // DO NOT blindly overwrite the user's fresh chat input with an old saved address!
          const hasChatPrefill = Boolean(
            session?.checkout_prefill?.address ||
            session?.checkout_prefill?.phone ||
            session?.checkout_prefill?.district
          );

          if (!hasChatPrefill) {
            const defaultAddr = data.find((a) => a.is_default) || data[0];
            setSelectedAddressId(defaultAddr.id);
            applySavedAddress(defaultAddr);
          } else {
            // Keep chat draft in form and show addresses as option
            setIsAddingNewAddress(false);
          }
        } else {
          setIsAddingNewAddress(true);
        }
      })
      .catch((err) => {
        setIsAddingNewAddress(true);
        console.error("Error authenticating/fetching addresses:", err);
      });
  }, [sessionCode, authLoading, session]);

  const loadCourierLocations = async (provider, level, parentId = '') => {
    const query = new URLSearchParams({ session: sessionCode, provider, level });
    if (parentId) query.set('parent_id', parentId);
    return fetchStorefront('/courier/locations/?' + query.toString());
  };

  useEffect(() => {
    if (!sessionCode) return;
    fetchStorefront('/courier/providers/?session=' + encodeURIComponent(sessionCode))
      .then((data) => {
        const providers = data.providers || [];
        setCourierProviders(providers);
        // Respect seller's configured default courier provider first
        const defaultCode = data.default_provider;
        const preferred = (defaultCode ? providers.find((item) => item.code === defaultCode) : null)
          || providers.find((item) => item.is_default)
          || providers[0];
        setSelectedCourierProvider(preferred?.code || '');
        if (preferred) {
          loadCourierLocations(preferred.code, preferred.levels[0])
            .then((result) => setCourierLocationOptions((prev) => ({ ...prev, [preferred.levels[0]]: result.locations || [] })))
            .catch(() => { });
          if (district) {
            fetchDeliveryQuote(district, selectedCourierIds, preferred.code);
          }
        }
      })
      .catch((error) => {
        setCourierProviders([]);
        setCourierLoadError(error?.message || 'কুরিয়ার তথ্য এখন পাওয়া যাচ্ছে না');
      });
  }, [sessionCode]);

  useEffect(() => {
    if (!selectedCourierProvider || !selectedCourierIds[selectedCourierProvider]) return;
    const provider = courierProviders.find((item) => item.code === selectedCourierProvider);
    const saved = selectedCourierIds[selectedCourierProvider];
    if (!provider || !saved) return;
    const values = {};
    provider.levels.forEach((level) => {
      if (saved[level + '_id']) values[level] = String(saved[level + '_id']);
    });
    setCourierLevelValues(values);
    provider.levels.forEach((level, index) => {
      if (index > 0 && values[provider.levels[index - 1]]) {
        loadChildCourierLocations(selectedCourierProvider, level, values[provider.levels[index - 1]]);
      }
    });
  }, [courierProviders, selectedCourierProvider, selectedCourierIds]);

  const loadChildCourierLocations = async (provider, level, parentId) => {
    if (!provider || !level || !parentId) return;
    try {
      const result = await loadCourierLocations(provider, level, parentId);
      setCourierLocationOptions((prev) => ({ ...prev, [level]: result.locations || [] }));
    } catch (_) {
      setCourierLocationOptions((prev) => ({ ...prev, [level]: [] }));
    }
  };

  const handleCourierLevelChange = async (levelIndex, value) => {
    const provider = courierProviders.find((item) => item.code === selectedCourierProvider);
    if (!provider) return;
    const level = provider.levels[levelIndex];
    const nextValues = { ...courierLevelValues };
    provider.levels.slice(levelIndex).forEach((key) => { nextValues[key] = ''; });
    nextValues[level] = value;
    setCourierLevelValues(nextValues);

    const options = courierLocationOptions[level] || [];
    const selected = options.find((item) => String(item[level + '_id']) === String(value));
    if (level === 'city') setDistrict(selected?.city_name || '');
    if (level === 'zone') setUpazila(selected?.zone_name || '');

    if (value && provider.levels[levelIndex + 1]) {
      await loadChildCourierLocations(selectedCourierProvider, provider.levels[levelIndex + 1], value);
    }

    const currentSelection = {};
    provider.levels.forEach((key) => {
      if (nextValues[key]) currentSelection[key + '_id'] = Number(nextValues[key]);
    });
    setSelectedCourierIds((prev) => ({ ...prev, [selectedCourierProvider]: currentSelection }));

    const resolvedDistrict = level === 'city' ? (selected?.city_name || district) : district;
    fetchDeliveryQuote(resolvedDistrict, { [selectedCourierProvider]: currentSelection }, selectedCourierProvider);
  };

  const handleCourierProviderChange = async (code) => {
    const provider = courierProviders.find((item) => item.code === code);
    setSelectedCourierProvider(code);
    setCourierLevelValues({});
    setLocationPickerOpen(false);
    setLocationPickerLevel(0);
    setLocationPickerSearch('');
    setCourierLocationOptions({});
    setSelectedCourierIds((prev) => ({ ...prev, [code]: null }));
    if (provider?.levels?.[0]) {
      try {
        const result = await loadCourierLocations(code, provider.levels[0]);
        setCourierLocationOptions({ [provider.levels[0]]: result.locations || [] });
      } catch (_) { }
    }
    if (district) {
      fetchDeliveryQuote(district, {}, code);
    }
  };

  // Set default recipient and phone from customer profile
  useEffect(() => {
    if (customer) {
      if (!recipientName) setRecipientName(customer.name || '');
      if (!phone && customer.primary_phone) {
        setPhone(customer.primary_phone);
        checkPhoneDeliveryScore(customer.primary_phone);
      }
    }
  }, [customer]);

  // 2. Phone History Badge Lookup
  const checkPhoneDeliveryScore = useCallback((number) => {
    if (!number || number.length < 10) {
      setPhoneProfile(null);
      return;
    }
    setIsCheckingPhone(true);
    fetchStorefront(`/phone-history/?phone=${encodeURIComponent(number)}&session=${encodeURIComponent(sessionCode || '')}`)
      .then((prof) => setPhoneProfile(prof))
      .catch(() => setPhoneProfile(null))
      .finally(() => setIsCheckingPhone(false));
  }, [sessionCode]);

  const applySavedAddress = (addr) => {
    setRecipientName(addr.recipient_name || '');
    setPhone(addr.phone || '');
    setFullAddress(addr.full_address || '');
    setDistrict(addr.district || '');
    setUpazila(addr.upazila || '');
    const savedCourier = addr.courier_location_ids || {};
    setSelectedCourierIds(savedCourier);
    if (addr.phone) {
      checkPhoneDeliveryScore(addr.phone);
    }
    const courierToUse = selectedCourierProvider || Object.keys(savedCourier)[0] || 'steadfast';
    fetchDeliveryQuote(addr.district, savedCourier, courierToUse);
  };

  // Live Auto-quote whenever District, Courier IDs or Provider changes
  useEffect(() => {
    if (district || Object.keys(selectedCourierIds).length > 0) {
      const courierToUse = selectedCourierProvider || Object.keys(selectedCourierIds)[0] || 'steadfast';
      fetchDeliveryQuote(district, selectedCourierIds, courierToUse);
    }
  }, [district, selectedCourierIds, selectedCourierProvider]);

  // Live Auto-fraud check whenever Phone changes (if 11 digits or more)
  useEffect(() => {
    if (phone && phone.length >= 11) {
      checkPhoneDeliveryScore(phone);
    }
  }, [phone, checkPhoneDeliveryScore]);

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setPhone(val);
    if (val.length >= 11) {
      checkPhoneDeliveryScore(val);
    }
  };

  // 3. Autocomplete address search
  const handleAddressInputChange = (e) => {
    const val = e.target.value;
    setFullAddress(val);

    if (val.length >= 3) {
      fetchStorefront(`/courier/suggest-address/?q=${encodeURIComponent(val)}`)
        .then((res) => {
          setSuggestions(Array.isArray(res) ? res : []);
        })
        .catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (sug) => {
    setDistrict(sug.district || '');
    setUpazila(sug.upazila || '');
    const nextCourierIds = { pathao: sug.pathao || null, steadfast: sug.steadfast || null };
    setSelectedCourierIds(nextCourierIds);
    setSuggestions([]);
    fetchDeliveryQuote(sug.district, nextCourierIds, selectedCourierProvider || (sug.steadfast ? 'steadfast' : 'pathao'));
  };

  // 4. Delivery Quote Fetch
  const fetchDeliveryQuote = (destDistrict, courierIds, courierProvider = selectedCourierProvider, coupon = appliedCoupon?.code) => {
    fetchStorefront('/courier/quote/', {
      method: 'POST',
      body: JSON.stringify({
        district: destDistrict,
        courier_ids: courierIds,
        courier_provider: courierProvider,
        session_code: sessionCode,
        weight: 0.5,
        subtotal: subtotal,
        items: items,
        coupon_code: coupon || '',
      })
    })
      .then((data) => {
        if (data.delivery_charge !== undefined) {
          setDeliveryCharge(Number(data.delivery_charge));
          setEstimatedDays(data.estimated_days || '২-৩ দিন');
          setQuoteSource(data.quote_source || '');
          setIsFreeShipping(Boolean(data.is_free_shipping));
          setFreeShippingThreshold(Number(data.free_shipping_threshold || freeShipPromo?.min_order_amount || 0));
          setRemainingForFreeShipping(data.remaining_for_free_shipping != null ? Number(data.remaining_for_free_shipping) : null);
          if (data.promotion_evaluation?.total_discount !== undefined) {
            setPromotionDiscount(Number(data.promotion_evaluation.total_discount || 0));
          }
        }
      })
      .catch((e) => console.error("Error quoting delivery:", e));
  };

  // Quantity modification & synchronization
  const syncSessionItems = (nextItems) => {
    if (!sessionCode) return;
    fetchStorefront(`/session/resolve/${encodeURIComponent(sessionCode)}/`, {
      method: 'PATCH',
      body: JSON.stringify({ items: nextItems }),
    }).catch((err) => console.error("Session items sync error:", err));
  };

  const updateQuantity = (idx, delta) => {
    setItems((prev) => {
      const updated = [...prev];
      const newQty = (updated[idx].quantity || 1) + delta;
      if (newQty <= 0) {
        return removeItem(idx);
      }
      updated[idx].quantity = newQty;
      syncSessionItems(updated);
      return updated;
    });
  };

  const removeItem = (idx) => {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
    syncSessionItems(updated);
    return updated;
  };

  // Subtotal & Total
  const subtotal = useMemo(() => {
    return items.reduce((acc, itm) => acc + (Number(itm.price || 0) * (Number(itm.quantity || 1))), 0);
  }, [items]);

  const totalAmount = useMemo(() => {
    const discounted = Math.max(0, subtotal - promotionDiscount);
    const shipping = isFreeShipping ? 0 : deliveryCharge;
    return discounted + shipping;
  }, [subtotal, promotionDiscount, isFreeShipping, deliveryCharge]);

  // Re-quote when subtotal changes
  useEffect(() => {
    if (district || Object.keys(selectedCourierIds).length > 0) {
      const courierToUse = selectedCourierProvider || Object.keys(selectedCourierIds)[0] || 'steadfast';
      fetchDeliveryQuote(district, selectedCourierIds, courierToUse, appliedCoupon?.code);
    }
  }, [subtotal]);

  // Apply Coupon
  const handleApplyCoupon = async (e) => {
    e?.preventDefault();
    const clean = (couponCode || '').trim().toUpperCase();
    if (!clean) return;
    setIsApplyingCoupon(true);
    setCouponError(null);
    setCouponMessage(null);
    try {
      const res = await fetchStorefront('/coupons/validate/', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: session?.merchant_id,
          coupon_code: clean,
          subtotal: subtotal,
          items: items,
          district: district
        })
      });
      if (res?.is_valid) {
        setAppliedCoupon({ code: clean, title: res.title, discount: res.discount_amount || 0 });
        setCouponMessage(res.message || `কুপন '${clean}' যুক্ত হয়েছে!`);
        fetchDeliveryQuote(district, selectedCourierIds, selectedCourierProvider, clean);
      } else {
        setCouponError(res?.message || 'কুপনটি সঠিক নয় বা এর মেয়াদ শেষ হয়ে গেছে।');
      }
    } catch (err) {
      setCouponError(err?.message || 'কুপন যাচাই করতে সমস্যা হয়েছে');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponMessage(null);
    setCouponError(null);
    setPromotionDiscount(0);
    fetchDeliveryQuote(district, selectedCourierIds, selectedCourierProvider, '');
  };

  // Submit Order
  const handleConfirmOrder = async () => {
    if (!items || items.length === 0) {
      setErrorMsg("আপনার কার্টে কোনো পণ্য নেই। অনুগ্রহ করে শপ থেকে পণ্য যোগ করুন।");
      return;
    }
    if (!phone || phone.length < 10) {
      setErrorMsg("অনুগ্রহ করে একটি সঠিক মোবাইল নম্বর লিখুন।");
      return;
    }
    if (!fullAddress || fullAddress.length < 5) {
      setErrorMsg("অনুগ্রহ করে আপনার বিস্তারিত ডেলিভারি ঠিকানা লিখুন।");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetchStorefront('/checkout/submit/', {
        method: 'POST',
        body: JSON.stringify({
          session_code: sessionCode,
          recipient_name: recipientName,
          phone: phone,
          full_address: fullAddress,
          district: district,
          upazila: upazila,
          items: items,
          special_instruction: specialInstruction,
          courier_location_ids: selectedCourierIds,
          courier_provider: selectedCourierProvider,
          save_address: saveAddress,
          coupon_code: appliedCoupon?.code || ''
        })
      });

      if (res.token && typeof window !== 'undefined') {
        localStorage.setItem('customer_token', res.token);
        refreshCustomer?.();
      }

      if (res.success && res.public_id) {
        // Trigger Interactive AI Voice Call Confirmation
        if (res.voice_config) {
          setCallVoiceConfig(res.voice_config);
        }
        setActiveCallOrder(res.order || { public_id: res.public_id, price: res.order?.price, total_price: res.order?.total_price });
        setIsSubmitting(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'অর্ডার সাবমিট করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4 animate-fadeIn">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-white">অর্ডার সফলভাবে নিশ্চিত হয়েছে!</h1>
        <p className="text-sm text-slate-400 max-w-xs">
          আপনাকে লাইভ ট্র্যাকিং পেজে নিয়ে যাওয়া হচ্ছে...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-10 space-y-4 animate-fadeIn text-slate-800">
      {/* 1. Header: Store & Payment Badge */}
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-900">
              {session?.merchant_shop_name || session?.merchant_name || 'স্মার্ট শপ'}
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">সহজ ও বিশ্বস্ত চেকআউট</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>ক্যাশ অন ডেলিভারি</span>
        </div>
      </div>

      {/* Countdown Flash Sale Banner */}
      {countdownPromo && (
        <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-bold text-slate-800">{countdownPromo.banner_message || countdownPromo.title}</span>
          </div>
          {countdownText && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-xl border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>{countdownText}</span>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 shadow-sm font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Order Items Card */}
      <div className="bg-white border border-slate-200/80 rounded-[1.75rem] p-5 shadow-md shadow-slate-100">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
            নির্বাচিত পণ্য ({items.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(sessionCode ? '/shop/' + sessionCode : '/shop')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700 border border-indigo-200 transition-colors shadow-xs"
            >
              <Store className="w-3 h-3" /> + আরও পণ্য যোগ করুন
            </button>
            <span className="text-xs font-black text-indigo-600">৳{subtotal}</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              <p>আপনার কার্টে কোনো পণ্য নেই।</p>
              {sessionCode && (
                <button
                  type="button"
                  onClick={() => router.push('/shop/' + sessionCode)}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-xs font-bold transition-colors"
                >
                  <Store className="w-3.5 h-3.5" /> পণ্য যোগ করুন
                </button>
              )}
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="py-3.5 flex items-center justify-between gap-3 group">
                <div
                  className="flex items-center gap-3 min-w-0 cursor-pointer"
                  onClick={() => setPreviewProduct(item)}
                  title="পণ্যের বিস্তারিত বিবরণ দেখুন"
                >
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative group-hover:border-indigo-400 transition-colors shadow-sm">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextSibling) {
                            e.currentTarget.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"
                      style={{ display: item.image_url ? 'none' : 'flex' }}
                    >
                      <ShoppingBag className="w-5 h-5 text-indigo-400" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-indigo-600 font-bold font-mono">৳{item.price}</span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-0.5 font-medium">
                        <Info className="w-2.5 h-2.5 text-indigo-500" /> বিস্তারিত
                      </span>
                    </div>
                  </div>
                </div>

                {/* Minimal Quantity Switcher & Remove / Cancel Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-inner">
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, -1)}
                      title={item.quantity <= 1 ? "পণ্যটি বাদ দিন" : "পরিমাণ কমান"}
                      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 text-xs font-bold transition-colors"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-slate-800 px-2 min-w-[20px] text-center">
                      {item.quantity || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, 1)}
                      title="পরিমাণ বাড়ান"
                      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 text-xs font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    title="কার্ট থেকে পণ্য বাতিল / রিমুভ করুন"
                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )))}
        </div>
      </div>

      {/* Free Delivery Threshold Incentive Progress Bar */}
      {(freeShipPromo || freeShippingThreshold > 0) && (
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-3.5 space-y-2 shadow-sm">
          {isFreeShipping || (freeShippingThreshold > 0 && subtotal >= freeShippingThreshold) ? (
            <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                অভিনন্দন! আপনার অর্ডারে ফ্রি ডেলিভারি আনলক হয়েছে
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                ফ্রি শিপিং
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                আর মাত্র <strong className="text-indigo-600 font-bold">৳{remainingForFreeShipping != null ? remainingForFreeShipping : Math.max(0, freeShippingThreshold - subtotal)}</strong> টাকার পণ্য যোগ করলেই <strong className="text-emerald-600">ফ্রি ডেলিভারি</strong>!
              </span>
              <button
                type="button"
                onClick={() => router.push(sessionCode ? '/shop/' + sessionCode : '/shop')}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 underline"
              >
                + পণ্য যোগ করুন
              </button>
            </div>
          )}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isFreeShipping || subtotal >= (freeShippingThreshold || 1)
                ? 'bg-emerald-500 w-full'
                : 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                }`}
              style={{
                width: isFreeShipping || subtotal >= (freeShippingThreshold || 1)
                  ? '100%'
                  : `${Math.min(100, Math.round((subtotal / (freeShippingThreshold || 1)) * 100))}%`
              }}
            />
          </div>
        </div>
      )}

      {/* 3. Customer & Delivery Address Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <span>ডেলিভারি তথ্য</span>
          </div>
          {addresses.length > 0 && (
            <button
              type="button"
              onClick={() => setIsAddingNewAddress(!isAddingNewAddress)}
              className="text-[11px] text-indigo-600 font-semibold hover:underline"
            >
              {isAddingNewAddress ? "Saved Addresses" : "+ Add New Address"}
            </button>
          )}
        </div>

        {/* Saved Address Carousel / List */}
        {!isAddingNewAddress && addresses.length > 0 && (() => {
          const selectedAddr = addresses.find((a) => a.id === selectedAddressId) || addresses[0];
          const otherAddresses = addresses.filter((a) => a.id !== selectedAddr?.id);

          return (
            <div className="space-y-2">
              {/* Primary / Selected Address */}
              {selectedAddr && (
                <div
                  className="p-3.5 rounded-xl border bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-200/60 transition-all cursor-pointer shadow-sm"
                  onClick={() => applySavedAddress(selectedAddr)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{selectedAddr.recipient_name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">({selectedAddr.phone})</span>
                        {selectedAddr.is_default && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{selectedAddr.full_address}</p>
                    </div>
                    <div className="w-4 h-4 rounded-full border border-indigo-500 bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* Expandable Other Addresses */}
              {showAllAddresses && otherAddresses.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => {
                    setSelectedAddressId(addr.id);
                    applySavedAddress(addr);
                    setShowAllAddresses(false);
                  }}
                  className="p-3 rounded-xl border cursor-pointer transition-all bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800">{addr.recipient_name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">({addr.phone})</span>
                        {addr.is_default && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 font-medium px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{addr.full_address}</p>
                    </div>
                    <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center shrink-0 mt-0.5" />
                  </div>
                </div>
              ))}

              {/* Show more / Show less Toggle Button */}
              {otherAddresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllAddresses(!showAllAddresses)}
                  className="w-full py-1.5 text-[11px] text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 font-medium transition-colors"
                >
                  {showAllAddresses ? (
                    <>
                      <span>Show less</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Show more ({otherAddresses.length})</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })()}

        {/* Clean Input Form */}
        {(isAddingNewAddress || addresses.length === 0) && (
          <div className="space-y-3.5">
            {/* Name */}
            <div>
              <label className="text-[11px] text-slate-600 font-semibold mb-1 block">আপনার নাম</label>
              <div className="relative">
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="যেমন: রফিকুল ইসলাম"
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none text-slate-900 placeholder:text-slate-400 transition-all"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Phone */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-600 font-semibold">মোবাইল নম্বর</label>
                {isCheckingPhone && <span className="text-[10px] text-indigo-600 font-semibold animate-pulse">যাচাই হচ্ছে...</span>}
              </div>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="01XXXXXXXXX"
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none text-slate-900 font-mono placeholder:text-slate-400 transition-all"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {/* Clean Phone Risk Badge */}
              {phoneProfile && (
                <div className={`mt-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 ${phoneProfile.risk_level === 'low'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : phoneProfile.risk_level === 'medium'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{phoneProfile.badge_text}</span>
                </div>
              )}
            </div>

            {/* Courier Selection Tabs */}
            {courierProviders.length > 0 && (
              <div className="space-y-2 pt-1">
                <label className="text-[11px] text-slate-600 font-semibold block">ডেলিভারি কুরিয়ার</label>
                <div className="grid grid-cols-2 gap-2">
                  {courierProviders.map((provider) => {
                    const isSelected = selectedCourierProvider === provider.code;
                    return (
                      <button
                        type="button"
                        key={provider.code}
                        onClick={() => handleCourierProviderChange(provider.code)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${isSelected
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5" />
                          <span>{provider.label}</span>
                        </div>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                      </button>
                    );
                  })}
                </div>

                {/* Location Picker */}
                {selectedCourierProvider && (() => {
                  const activeProvider = courierProviders.find((item) => item.code === selectedCourierProvider);
                  const levels = activeProvider?.levels || [];
                  const activeLevel = levels[locationPickerLevel] || levels[0];
                  const options = courierLocationOptions[activeLevel] || [];
                  const idKey = activeLevel ? activeLevel + '_id' : '';
                  const nameKey = activeLevel ? activeLevel + '_name' : '';
                  const query = locationPickerSearch.toLowerCase();
                  const filtered = options.filter((item) => String(item[nameKey] || '').toLowerCase().includes(query) || String(item[idKey] || '').includes(query)).slice(0, 50);
                  const selectedLabels = levels.map((level) => {
                    const option = (courierLocationOptions[level] || []).find((item) => String(item[level + '_id']) === String(courierLevelValues[level] || ''));
                    return option?.[level + '_name'];
                  }).filter(Boolean);

                  return (
                    <div className="relative mt-2">
                      <button
                        type="button"
                        onClick={() => { setLocationPickerOpen(true); setLocationPickerLevel(0); setLocationPickerSearch(''); }}
                        className="w-full flex items-center justify-between text-left text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 outline-none"
                      >
                        <span className={selectedLabels.length ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                          {selectedLabels.length ? selectedLabels.join('  ›  ') : (levels.map(l => l.toUpperCase()).join('  ›  '))}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>

                      {locationPickerOpen && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl bg-white border border-slate-200 shadow-2xl p-2.5 text-slate-800">
                          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            {locationPickerLevel > 0 && (
                              <button
                                type="button"
                                onClick={() => { setLocationPickerLevel((v) => v - 1); setLocationPickerSearch(''); }}
                                className="p-1 rounded text-slate-500 hover:text-slate-800 text-xs font-bold"
                              >
                                ← ফিরে যান
                              </button>
                            )}
                            <input
                              autoFocus
                              type="search"
                              value={locationPickerSearch}
                              onChange={(e) => setLocationPickerSearch(e.target.value)}
                              placeholder={`খুঁজুন (${activeLevel === 'city' ? 'জেলা' : activeLevel === 'zone' ? 'থানা' : 'এলাকা'})...`}
                              className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs outline-none text-slate-900 focus:bg-white focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => setLocationPickerOpen(false)}
                              className="px-2 py-1 text-xs text-slate-400 hover:text-slate-700"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="max-h-52 overflow-y-auto mt-1 divide-y divide-slate-100">
                            {filtered.length > 0 ? (
                              filtered.map((item) => {
                                const selected = String(item[idKey]) === String(courierLevelValues[activeLevel] || '');
                                return (
                                  <button
                                    type="button"
                                    key={item[idKey]}
                                    onClick={async () => {
                                      await handleCourierLevelChange(locationPickerLevel, String(item[idKey]));
                                      setLocationPickerSearch('');
                                      if (locationPickerLevel < levels.length - 1) {
                                        setLocationPickerLevel((v) => v + 1);
                                      } else {
                                        setLocationPickerOpen(false);
                                      }
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-lg transition-colors ${selected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                      }`}
                                  >
                                    <span>{item[nameKey]}</span>
                                    <span className="text-slate-400">{locationPickerLevel < levels.length - 1 ? '›' : selected ? '✓' : ''}</span>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-3 py-4 text-center text-xs text-slate-400">কোনো তথ্য পাওয়া যায়নি</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Detailed Address */}
            <div className="relative">
              <label className="text-[11px] text-slate-600 font-semibold mb-1 block">
                বিস্তারিত ঠিকানা (রোড, বাড়ি, গ্রাম, বাজার)
              </label>
              <textarea
                rows={2}
                value={fullAddress}
                onChange={handleAddressInputChange}
                placeholder="যেমন: বাড়ি নং ১২, রোড ৩, সিমুলতলী বাজার..."
                className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none text-slate-900 placeholder:text-slate-400 resize-none transition-all leading-relaxed"
              />

              {/* Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-2xl p-1 divide-y divide-slate-100">
                  <div className="px-3 py-1 text-[10px] text-indigo-600 font-bold">
                    সাজেস্টেড লোকেশন (ট্যাপ করুন)
                  </div>
                  {suggestions.map((sug, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectSuggestion(sug)}
                      className="p-2.5 hover:bg-indigo-50 rounded-lg cursor-pointer text-xs text-slate-700 transition-colors"
                    >
                      <div className="font-semibold text-slate-900">{sug.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        জেলা: {sug.district} | এলাকা: {sug.upazila}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Special Instructions */}
            <div>
              <label className="text-[11px] text-slate-600 font-semibold mb-1 block">বিশেষ নির্দেশনা (ঐচ্ছিক)</label>
              <div className="relative">
                <input
                  type="text"
                  value={specialInstruction}
                  onChange={(e) => setSpecialInstruction(e.target.value)}
                  placeholder="যেমন: কল দিয়ে আসবেন / সকালে ডেলিভারি দিন"
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none text-slate-900 placeholder:text-slate-400 transition-all"
                />
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 bg-white focus:ring-0"
              />
              <span className="text-[11px] text-slate-600">পরবর্তী অর্ডারের জন্য ঠিকানাটি সংরক্ষণ করুন</span>
            </label>
          </div>
        )}
      </div>

      {/* 4. Promo & Coupon Code Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-600" />
            কুপন বা ডিসকাউন্ট কোড
          </span>
          {appliedCoupon && (
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" /> যুক্ত হয়েছে
            </span>
          )}
        </div>

        {appliedCoupon ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
            <div>
              <span className="font-bold text-emerald-800 font-mono tracking-wider">{appliedCoupon.code}</span>
              <span className="text-[11px] text-slate-600 ml-2">ছাড়: ৳{appliedCoupon.discount}</span>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline"
            >
              বাতিল করুন
            </button>
          </div>
        ) : (
          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="যেমন: EID2026"
              className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none uppercase font-mono tracking-wider text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={isApplyingCoupon || !couponCode.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors disabled:opacity-40 shadow-sm"
            >
              {isApplyingCoupon ? "যাচাই হচ্ছে..." : "প্রয়োগ করুন"}
            </button>
          </form>
        )}

        {couponMessage && <p className="text-[11px] text-emerald-700 font-medium">{couponMessage}</p>}
        {couponError && <p className="text-[11px] text-rose-600 font-medium">{couponError}</p>}
      </div>

      {/* 5. Bill Summary & Checkout Button */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>পণ্যের সাবটোটাল</span>
          <span className="font-semibold text-slate-900">৳{subtotal}</span>
        </div>

        {promotionDiscount > 0 && (
          <div className="flex items-center justify-between text-xs text-emerald-700">
            <span className="flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5" />
              <span>অফার ছাড়</span>
            </span>
            <span className="font-bold font-mono">-৳{promotionDiscount}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-indigo-600" />
            <span>ডেলিভারি চার্জ</span>
            <span className="text-[10px] text-slate-400">({estimatedDays})</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isFreeShipping ? (
              <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px]">
                ফ্রি (৳০)
              </span>
            ) : (
              <>
                {quoteSource === 'live_api' && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">লাইভ</span>
                )}
                <span className="font-semibold text-slate-900">৳{deliveryCharge}</span>
              </>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-800 block">সর্বমোট প্রদেয় বিল</span>
            <span className="text-[10px] text-slate-400">ক্যাশ অন ডেলিভারি</span>
          </div>
          <span className="text-xl font-black text-indigo-600">৳{totalAmount}</span>
        </div>

        <button
          onClick={handleConfirmOrder}
          disabled={isSubmitting}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.99]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>অর্ডার প্রক্রিয়াকরণ হচ্ছে...</span>
            </>
          ) : (
            <>
              <span>অর্ডার কনফার্ম করুন</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Product Details Preview Modal */}
      {previewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setPreviewProduct(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-full h-56 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
              {previewProduct.image_url ? (
                <img
                  src={previewProduct.image_url}
                  alt={previewProduct.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) {
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className="w-full h-full flex flex-col items-center justify-center text-slate-400"
                style={{ display: previewProduct.image_url ? 'none' : 'flex' }}
              >
                <ShoppingBag className="w-12 h-12 text-indigo-400 mb-2" />
                <span className="text-xs text-slate-400">কোনো ছবি নেই</span>
              </div>
            </div>

            <div>
              {previewProduct.category && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full inline-block mb-1.5">
                  {previewProduct.category}
                </span>
              )}
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {previewProduct.name}
              </h2>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-black text-indigo-600">৳{previewProduct.price}</span>
                {previewProduct.sku && (
                  <span className="text-[11px] text-slate-400 font-mono">SKU: {previewProduct.sku}</span>
                )}
              </div>
            </div>

            {previewProduct.description && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-600" /> বিবরণ:
                </p>
                <div
                  className="text-xs text-slate-700 leading-relaxed max-h-40 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: previewProduct.description }}
                />
              </div>
            )}

            {previewProduct.attributes && typeof previewProduct.attributes === 'object' && Object.keys(previewProduct.attributes).length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-600 mb-1">বৈশিষ্ট্যাবলী:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(previewProduct.attributes).map(([key, val]) => (
                    <div key={key} className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-slate-400 block text-[10px] font-medium">{key}</span>
                      <span className="text-slate-800 font-semibold truncate block">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewProduct.warranty_information && (
              <div className="text-xs text-slate-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ওয়ারেন্টি: {previewProduct.warranty_information}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPreviewProduct(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* Universal Interactive Voice Call Modal */}
      {activeCallOrder && (
        <InteractiveVoiceCallModal
          isOpen={Boolean(activeCallOrder)}
          order={activeCallOrder}
          voiceConfig={callVoiceConfig}
          shopName={session?.merchant_shop_name || session?.merchant_name || 'Store'}
          shopAvatar={session?.merchant_avatar || null}
          onClose={() => {
            const orderIdentifier = activeCallOrder.public_id || activeCallOrder.id;
            setActiveCallOrder(null);
            router.replace(`/orders/${orderIdentifier}`);
          }}
          onActionComplete={(res) => {
            const orderIdentifier = activeCallOrder.public_id || activeCallOrder.id;
            setTimeout(() => {
              setActiveCallOrder(null);
              router.replace(`/orders/${orderIdentifier}`);
            }, 3000);
          }}
        />
      )}
    </div>
  );
}