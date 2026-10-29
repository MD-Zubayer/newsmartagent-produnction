"use client";

import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { useAuth } from "app/context/AuthContext";
import {
  Users,
  Search,
  ShoppingBag,
  TrendingUp,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  X,
  MessageSquare,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  ChevronRight,
  UserCheck
} from "lucide-react";

export default function MerchantCustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchCustomers = async (searchTerm = "") => {
    try {
      setLoading(true);
      const res = await api.get(`/storefront/v1/merchant/customers/${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`);
      if (res.data?.results) {
        setCustomers(res.data.results);
      }
    } catch (err) {
      console.error("Failed to fetch merchant customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCustomers(search);
  };

  const handleOpenCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/storefront/v1/merchant/customers/${cust.id}/`);
      setCustomerDetail(res.data);
    } catch (err) {
      console.error("Failed to load customer details:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Top stats
  const totalCustomersCount = customers.length;
  const totalOrdersSum = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.total_orders || 0), 0);
  }, [customers]);
  const totalRevenueSum = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  }, [customers]);

  const getPlatformBadge = (platform) => {
    switch (platform) {
      case 'whatsapp':
        return <span key="wa" className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">WhatsApp</span>;
      case 'messenger':
      case 'facebook':
        return <span key="ms" className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">Messenger</span>;
      case 'telegram':
        return <span key="tg" className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800">Telegram</span>;
      case 'instagram':
        return <span key="ig" className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-100 text-pink-800">Instagram</span>;
      default:
        return <span key="web" className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">Web</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-600" />
            <span>Customers (গ্রাহক তালিকা)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            আপনার দোকান থেকে ক্রয়কারী সব গ্রাহকের গুগল প্রোফাইল, অর্ডার হিস্টোরি ও সংযুক্ত প্ল্যাটফর্ম
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">মোট গ্রাহক</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{totalCustomersCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">সর্বমোট অর্ডার</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{totalOrdersSum}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">মোট বিক্রয়মূল্য</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">৳{totalRevenueSum.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="গ্রাহকের নাম, ইমেইল অথবা মোবাইল নম্বর দিয়ে খুঁজুন..."
          className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </form>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span>গ্রাহক তথ্য লোড হচ্ছে...</span>
          </div>
        ) : customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">গ্রাহক</th>
                  <th className="py-3.5 px-4">সংযুক্ত চ্যানেল</th>
                  <th className="py-3.5 px-4 text-center">শপ অর্ডার</th>
                  <th className="py-3.5 px-4 text-right">মোট খরচ</th>
                  <th className="py-3.5 px-4 text-center">কুরিয়ার ফ্রড ও রেপুটেশন লেভেল</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {customers.map((cust) => {
                  const rep = cust.courier_reputation;
                  const totalParcels = rep?.total_orders || 0;
                  const deliveredCount = rep?.delivered || 0;
                  const returnedCount = rep?.returned || 0;
                  const successRate = rep?.success_rate;
                  const riskLevel = rep?.risk_level || 'unknown';

                  // Risk styles
                  const isHigh = riskLevel === 'high';
                  const isMedium = riskLevel === 'medium';
                  const isLow = riskLevel === 'low';

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer Info */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          {cust.avatar_url ? (
                            <img
                              src={cust.avatar_url}
                              alt={cust.name}
                              className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 shrink-0">
                              {cust.name?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 truncate">{cust.name}</p>
                              {!cust.is_registered && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  গেস্ট
                                </span>
                              )}
                            </div>
                            {cust.email && (
                              <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span>{cust.email}</span>
                              </p>
                            )}
                            {cust.phone && (
                              <p className="text-xs text-slate-600 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span className="font-semibold">{cust.phone}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Linked Platforms */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {cust.linked_platforms?.length > 0 ? (
                            cust.linked_platforms.map((p) => getPlatformBadge(p))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Orders count */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                          {cust.total_orders}টি
                        </span>
                      </td>

                      {/* Total spent */}
                      <td className="py-4 px-4 text-right font-black text-slate-900">
                        ৳{cust.total_spent.toLocaleString()}
                      </td>

                      {/* Courier Fraud & Reputation Level with Mini Graph */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-center justify-center space-y-1.5 min-w-[190px]">
                          {/* Level Badge */}
                          <div className="flex items-center gap-1.5">
                            {isHigh ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>উচ্চ ঝুঁকি (Fraud Alert)</span>
                              </span>
                            ) : isMedium ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>সতর্কতা (Caution)</span>
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>নিরাপদ (Safe) • {successRate !== null ? `${successRate}%` : '100%'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <span>নতুন কাস্টমার (রেকর্ড নেই)</span>
                              </span>
                            )}
                          </div>

                          {/* Mini Visual Graph / Ratio Bar */}
                          {totalParcels > 0 ? (
                            <div className="w-full max-w-[160px] space-y-1">
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                <div
                                  style={{ width: `${successRate || 0}%` }}
                                  className={`h-full transition-all ${
                                    isHigh ? 'bg-rose-500' : isMedium ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  title={`ডেলিভারি সাকসেস: ${successRate}%`}
                                />
                                {returnedCount > 0 && (
                                  <div
                                    style={{ width: `${Math.round((returnedCount / (totalParcels || 1)) * 100)}%` }}
                                    className="h-full bg-rose-400"
                                    title={`রিটার্ন: ${returnedCount}টি`}
                                  />
                                )}
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-0.5">
                                <span className="text-emerald-700">{deliveredCount} ডেলিভারি</span>
                                <span className="text-slate-400">•</span>
                                <span className={returnedCount > 0 ? "text-rose-600 font-extrabold" : "text-slate-400"}>
                                  {returnedCount} রিটার্ন
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-700">{totalParcels}টি পার্সেল</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">সার্বজনীন কুরিয়ার পার্সেল ইতিহাস অনুপস্থিত</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <button
                          onClick={() => handleOpenCustomer(cust)}
                          className="py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all inline-flex items-center gap-1 active:scale-95 shadow-2xs"
                        >
                          <span>বিস্তারিত</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">কোনো গ্রাহক পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400">অর্ডার সম্পন্ন হলে এখানে গ্রাহক তালিকা প্রদর্শিত হবে</p>
          </div>
        )}
      </div>

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-end">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                {selectedCustomer.avatar_url ? (
                  <img
                    src={selectedCustomer.avatar_url}
                    alt={selectedCustomer.name}
                    className="w-12 h-12 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-lg">
                    {selectedCustomer.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedCustomer.name}</h2>
                  <p className="text-xs text-slate-500">{selectedCustomer.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerDetail(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loadingDetail ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>তথ্য লোড হচ্ছে...</span>
                </div>
              ) : customerDetail ? (
                <>
                  {/* Summary Metric Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                      <p className="text-[11px] font-bold text-indigo-600 uppercase">মোট শপ অর্ডার</p>
                      <p className="text-xl font-black text-slate-900 mt-1">{customerDetail.total_orders}টি</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <p className="text-[11px] font-bold text-emerald-600 uppercase">মোট কেনাকাটা</p>
                      <p className="text-xl font-black text-slate-900 mt-1">৳{customerDetail.total_spent.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Multi-Courier Reputation & Fraud Intelligence Card */}
                  {customerDetail.courier_reputation && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200/90 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-indigo-600" />
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                            কুরিয়ার ফ্রড ও রেপুটেশন রিপোর্ট
                          </h3>
                        </div>
                        {customerDetail.courier_reputation.risk_level === 'high' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            উচ্চ ঝুঁকি (Fraud Alert)
                          </span>
                        ) : customerDetail.courier_reputation.risk_level === 'medium' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            সতর্কতা (Caution)
                          </span>
                        ) : customerDetail.courier_reputation.risk_level === 'low' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            নিরাপদ / বিশ্বস্ত
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            রেকর্ড নেই
                          </span>
                        )}
                      </div>

                      {/* Visual Ratio Bar */}
                      {customerDetail.courier_reputation.total_orders > 0 ? (
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                            <div
                              style={{ width: `${customerDetail.courier_reputation.success_rate || 0}%` }}
                              className="h-full bg-emerald-500"
                            />
                            {customerDetail.courier_reputation.returned > 0 && (
                              <div
                                style={{
                                  width: `${Math.round(
                                    (customerDetail.courier_reputation.returned /
                                      (customerDetail.courier_reputation.total_orders || 1)) *
                                      100
                                  )}%`,
                                }}
                                className="h-full bg-rose-500"
                              />
                            )}
                          </div>

                          <div className="grid grid-cols-4 gap-2 text-center pt-1">
                            <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">মোট পার্সেল</p>
                              <p className="text-sm font-black text-slate-800 mt-0.5">{customerDetail.courier_reputation.total_orders}</p>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-emerald-100">
                              <p className="text-[10px] text-emerald-600 font-bold uppercase">ডেলিভারড</p>
                              <p className="text-sm font-black text-emerald-700 mt-0.5">{customerDetail.courier_reputation.delivered}</p>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-rose-100">
                              <p className="text-[10px] text-rose-600 font-bold uppercase">রিটার্ন</p>
                              <p className="text-sm font-black text-rose-700 mt-0.5">{customerDetail.courier_reputation.returned}</p>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-indigo-100">
                              <p className="text-[10px] text-indigo-600 font-bold uppercase">সাকসেস রেট</p>
                              <p className="text-sm font-black text-indigo-700 mt-0.5">{customerDetail.courier_reputation.success_rate || 0}%</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic bg-white p-3 rounded-xl border border-slate-200">
                          Steadfast বা অন্যান্য কুরিয়ার নেটওয়ার্কে এই মোবাইল নম্বরের কোনো পূর্ববর্তী পার্সেল হিস্টোরি পাওয়া যায়নি।
                        </p>
                      )}
                    </div>
                  )}

                  {/* Linked Platforms */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                      <span>সংযুক্ত মেসেজিং অ্যাকাউন্টসমূহ</span>
                    </h3>
                    {customerDetail.identities?.length > 0 ? (
                      <div className="space-y-2">
                        {customerDetail.identities.map((ident, i) => (
                          <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800 capitalize">{ident.platform}</span>
                              <p className="text-slate-500 font-mono text-[11px]">ID: {ident.platform_user_id}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">কোনো প্ল্যাটফর্ম আইডি লিঙ্ক করা নেই</p>
                    )}
                  </div>

                  {/* Saved Addresses */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>ডেলিভারি ঠিকানাসমূহ</span>
                    </h3>
                    {customerDetail.addresses?.length > 0 ? (
                      <div className="space-y-2">
                        {customerDetail.addresses.map((addr) => (
                          <div key={addr.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{addr.recipient_name} ({addr.phone})</span>
                              {addr.is_default && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600">{addr.full_address}</p>
                            {addr.district && <p className="text-indigo-600 font-medium">{addr.district} {addr.upazila ? `| ${addr.upazila}` : ''}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">কোনো সংরক্ষিত ঠিকানা নেই</p>
                    )}
                  </div>

                  {/* Orders from this merchant */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>অর্ডার হিস্টোরি ({customerDetail.orders?.length || 0})</span>
                    </h3>

                    <div className="space-y-2">
                      {customerDetail.orders?.map((ord) => (
                        <div key={ord.id} className="p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-colors space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900">#{ord.id}</span>
                            <span className="font-bold text-slate-900">৳{ord.total_price}</span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-1">{ord.product_name}</p>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-400">
                            <span>{new Date(ord.created_at).toLocaleDateString('bn-BD')}</span>
                            <span className="font-semibold text-indigo-600 capitalize">{ord.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
