"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { fetchStorefront } from '@/lib/api';
import {
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  X,
  Loader2,
  Truck,
  ChevronDown,
  User,
  Phone,
  Building2,
  FileText
} from 'lucide-react';

const LOCATION_LEVELS = [
  { key: 'city', label: 'জেলা' },
  { key: 'zone', label: 'থানা / উপজেলা' },
  { key: 'area', label: 'এলাকা / পোস্ট কোড' }
];

export default function CustomerAddressesPage() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Geographic Location Hierarchy State
  const [locationLevelValues, setLocationLevelValues] = useState({});
  const [locationOptions, setLocationOptions] = useState({});
  const [selectedCourierIds, setSelectedCourierIds] = useState({});

  // Location Picker Popover State
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationPickerLevel, setLocationPickerLevel] = useState(0);
  const [locationPickerSearch, setLocationPickerSearch] = useState('');

  // Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState([]);

  // Load Addresses
  const loadAddresses = useCallback(() => {
    setLoading(true);
    fetchStorefront('/addresses/')
      .then((data) => {
        if (Array.isArray(data)) setAddresses(data);
      })
      .catch((err) => console.error("Error loading addresses:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  // Load Geographic Locations from API (uses unified Pathao city/zone/area database)
  const loadLocations = async (level, parentId = '') => {
    const query = new URLSearchParams({ provider: 'pathao', level });
    if (parentId) query.set('parent_id', parentId);
    return fetchStorefront('/courier/locations/?' + query.toString());
  };

  const loadChildLocations = async (level, parentId) => {
    if (!level || !parentId) return;
    try {
      const result = await loadLocations(level, parentId);
      setLocationOptions((prev) => ({ ...prev, [level]: result.locations || [] }));
    } catch (_) {
      setLocationOptions((prev) => ({ ...prev, [level]: [] }));
    }
  };

  // Initialize District options when modal opens
  useEffect(() => {
    if (!showAddModal) return;
    loadLocations('city')
      .then((result) => {
        setLocationOptions((prev) => ({ ...prev, city: result.locations || [] }));
      })
      .catch(() => { });
  }, [showAddModal]);

  const handleLocationLevelChange = async (levelIndex, value) => {
    const activeLevel = LOCATION_LEVELS[levelIndex]?.key;
    if (!activeLevel) return;

    const nextValues = { ...locationLevelValues };
    LOCATION_LEVELS.slice(levelIndex).forEach((item) => { nextValues[item.key] = ''; });
    nextValues[activeLevel] = value;
    setLocationLevelValues(nextValues);

    const options = locationOptions[activeLevel] || [];
    const selected = options.find((item) => String(item[activeLevel + '_id']) === String(value));
    if (activeLevel === 'city') setDistrict(selected?.city_name || '');
    if (activeLevel === 'zone') setUpazila(selected?.zone_name || '');
    if (activeLevel === 'area' && !upazila) setUpazila(selected?.area_name || '');

    const nextLevel = LOCATION_LEVELS[levelIndex + 1]?.key;
    if (value && nextLevel) {
      await loadChildLocations(nextLevel, value);
    }

    const pathaoIds = {};
    if (nextValues.city) pathaoIds.city_id = Number(nextValues.city);
    if (nextValues.zone) pathaoIds.zone_id = Number(nextValues.zone);
    if (nextValues.area) pathaoIds.area_id = Number(nextValues.area);

    setSelectedCourierIds((prev) => ({
      ...prev,
      pathao: pathaoIds
    }));
  };

  // Address search autocomplete
  const handleAddressSearch = (val) => {
    setFullAddress(val);
    if (val.length >= 3) {
      fetchStorefront(`/courier/suggest-address/?q=${encodeURIComponent(val)}`)
        .then((res) => setSuggestions(Array.isArray(res) ? res : []))
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
  };

  const handleCreateAddress = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setErrorMsg("অনুগ্রহ করে একটি সঠিক ফোন নম্বর লিখুন");
      return;
    }
    if (!fullAddress || fullAddress.length < 4) {
      setErrorMsg("অনুগ্রহ করে সম্পূর্ণ বিস্তারিত ঠিকানা লিখুন");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await fetchStorefront('/addresses/', {
        method: 'POST',
        body: JSON.stringify({
          recipient_name: recipientName,
          phone,
          full_address: fullAddress,
          district,
          upazila,
          courier_location_ids: selectedCourierIds,
          is_default: isDefault
        })
      });
      setShowAddModal(false);
      resetForm();
      loadAddresses();
    } catch (err) {
      setErrorMsg(err.message || 'ঠিকানা সেভ করা সম্ভব হয়নি');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setRecipientName('');
    setPhone('');
    setFullAddress('');
    setDistrict('');
    setUpazila('');
    setIsDefault(false);
    setLocationLevelValues({});
    setSelectedCourierIds({});
    setErrorMsg(null);
  };

  const handleDelete = async (id) => {
    if (!confirm("আপনি কি নিশ্চিত এই ঠিকানাটি মুছে ফেলতে চান?")) return;
    try {
      await fetchStorefront(`/addresses/${id}/`, { method: 'DELETE' });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert("মুছে ফেলা সম্ভব হয়নি।");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn pb-24 md:pb-12 text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Building2 className="w-4 h-4" />
            </div>
            <span>সংরক্ষিত ঠিকানাসমূহ</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">সহজে ও দ্রুত চেকআউট করার জন্য আপনার ডেলিভারি ঠিকানাসমূহ</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>নতুন ঠিকানা</span>
        </button>
      </div>

      {/* Address List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-600" />
          <span>ঠিকানা লোড হচ্ছে...</span>
        </div>
      ) : addresses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`rounded-2xl p-4 border transition-all relative flex flex-col justify-between shadow-sm ${addr.is_default
                ? 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200'
                : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md'
                }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{addr.recipient_name || 'গ্রাহক'}</span>
                    {addr.is_default && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                        ডিফল্ট
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{addr.phone}</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {addr.full_address}
                </p>
              </div>

              {(addr.district || addr.upazila) && (
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-indigo-600 font-medium">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>{addr.district} {addr.upazila ? `› ${addr.upazila}` : ''}</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-white border border-slate-200/80 rounded-3xl p-6 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
            <MapPin className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">কোনো সংরক্ষিত ঠিকানা নেই</p>
          <p className="text-xs text-slate-500">নতুন ঠিকানা যোগ করুন যেন এক ক্লিকে যেকোনো পণ্য অর্ডার করতে পারেন</p>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="mt-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all"
          >
            + নতুন ঠিকানা যোগ করুন
          </button>
        </div>
      )}

      {/* Add / Edit Modal - Responsive, Scrollable, Above Bottom Nav */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          {/* Backdrop click to dismiss */}
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setShowAddModal(false)}
          />

          <div className="w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden pb-4 sm:pb-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">নতুন ডেলিভারি ঠিকানা</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto p-5 space-y-4 flex-1 overscroll-contain">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {errorMsg}
                </div>
              )}

              <form id="addressForm" onSubmit={handleCreateAddress} className="space-y-3.5">
                {/* Recipient Name */}
                <div>
                  <label className="text-[11px] text-slate-600 font-semibold mb-1 block">প্রাপকের নাম</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="যেমন: রফিকুল ইসলাম"
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none text-slate-900 placeholder:text-slate-400 transition-all"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-[11px] text-slate-600 font-semibold mb-1 block">মোবাইল নম্বর</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none text-slate-900 font-mono placeholder:text-slate-400 transition-all"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Geographic Location Picker (District -> Thana -> Area) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-600 font-semibold flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>জেলা ও থানা/উপজেলা নির্বাচন</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">৩ ধাপে নির্বাচন করুন</span>
                  </div>

                  {(() => {
                    const activeLevelInfo = LOCATION_LEVELS[locationPickerLevel] || LOCATION_LEVELS[0];
                    const activeLevel = activeLevelInfo.key;
                    const options = locationOptions[activeLevel] || [];
                    const idKey = activeLevel + '_id';
                    const nameKey = activeLevel + '_name';
                    const query = locationPickerSearch.toLowerCase();
                    const filtered = options.filter(
                      (item) => String(item[nameKey] || '').toLowerCase().includes(query) || String(item[idKey] || '').includes(query)
                    ).slice(0, 50);

                    const selectedLabels = LOCATION_LEVELS.map((lvl) => {
                      const opt = (locationOptions[lvl.key] || []).find(
                        (item) => String(item[lvl.key + '_id']) === String(locationLevelValues[lvl.key] || '')
                      );
                      return opt?.[lvl.key + '_name'];
                    }).filter(Boolean);

                    return (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setLocationPickerOpen(true); setLocationPickerLevel(0); setLocationPickerSearch(''); }}
                          className="w-full flex items-center justify-between text-left text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 outline-none transition-all"
                        >
                          <span className={selectedLabels.length ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            {selectedLabels.length ? selectedLabels.join('  ›  ') : 'জেলা, থানা ও এলাকা সিলেক্ট করুন'}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>

                        {locationPickerOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setLocationPickerOpen(false)} />
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-2xl bg-white border border-slate-200 shadow-2xl p-2.5 text-slate-800 animate-fadeIn">
                              {/* Breadcrumbs */}
                              <div className="flex items-center gap-1.5 px-1 pb-2 text-[11px] font-semibold text-slate-500">
                                {LOCATION_LEVELS.map((lvl, idx) => (
                                  <React.Fragment key={lvl.key}>
                                    {idx > 0 && <span className="text-slate-300">›</span>}
                                    <span className={locationPickerLevel === idx ? 'text-indigo-600 font-bold' : ''}>
                                      {lvl.label}
                                    </span>
                                  </React.Fragment>
                                ))}
                              </div>

                              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                {locationPickerLevel > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => { setLocationPickerLevel((v) => v - 1); setLocationPickerSearch(''); }}
                                    className="p-1 rounded text-slate-500 hover:text-slate-800 text-xs font-bold"
                                  >
                                    ← ব্যাকে যান
                                  </button>
                                )}
                                <input
                                  autoFocus
                                  type="search"
                                  value={locationPickerSearch}
                                  onChange={(e) => setLocationPickerSearch(e.target.value)}
                                  placeholder={`${activeLevelInfo.label} খুঁজুন...`}
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
                              <div className="max-h-48 overflow-y-auto mt-1 divide-y divide-slate-100">
                                {filtered.length > 0 ? (
                                  filtered.map((item) => {
                                    const selected = String(item[idKey]) === String(locationLevelValues[activeLevel] || '');
                                    return (
                                      <button
                                        type="button"
                                        key={item[idKey]}
                                        onClick={async () => {
                                          await handleLocationLevelChange(locationPickerLevel, String(item[idKey]));
                                          setLocationPickerSearch('');
                                          if (locationPickerLevel < LOCATION_LEVELS.length - 1) {
                                            setLocationPickerLevel((v) => v + 1);
                                          } else {
                                            setLocationPickerOpen(false);
                                          }
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-lg transition-colors ${selected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                          }`}
                                      >
                                        <span>{item[nameKey]}</span>
                                        <span className="text-slate-400">{locationPickerLevel < LOCATION_LEVELS.length - 1 ? '›' : selected ? '✓' : ''}</span>
                                      </button>
                                    );
                                  })
                                ) : (
                                  <div className="px-3 py-4 text-center text-xs text-slate-400">কোনো তথ্য পাওয়া যায়নি</div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Full Address Textarea */}
                <div className="relative">
                  <label className="text-[11px] text-slate-600 font-semibold mb-1 block">
                    বিস্তারিত ঠিকানা (রোড, বাড়ি, গ্রাম, বাজার)
                  </label>
                  <textarea
                    rows={2}
                    value={fullAddress}
                    onChange={(e) => handleAddressSearch(e.target.value)}
                    placeholder="যেমন: বাড়ি ১২, রোড ৩, সিমুলতলী বাজার..."
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none text-slate-900 placeholder:text-slate-400 resize-none transition-all leading-relaxed"
                  />

                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-30 mt-1 max-h-40 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-2xl p-1 divide-y divide-slate-100">
                      <div className="px-3 py-1 text-[10px] text-indigo-600 font-bold">
                        সাজেস্টেড এলাকা (ট্যাপ করুন)
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

                {/* Default Address Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 bg-white focus:ring-0"
                  />
                  <span className="text-[11px] text-slate-600">এটি ডিফল্ট ঠিকানা হিসেবে রাখুন</span>
                </label>
              </form>
            </div>

            {/* Modal Fixed Footer Buttons (Always visible above bottom navbar) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white sticky bottom-0 z-20 shrink-0 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 active:scale-98 transition-all"
              >
                বাতিল
              </button>
              <button
                type="submit"
                form="addressForm"
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 active:scale-98 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "ঠিকানা সেভ করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
