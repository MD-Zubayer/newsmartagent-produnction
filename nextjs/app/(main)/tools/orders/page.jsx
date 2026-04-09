'use client';

import { useState } from 'react';
import { Search, Package, Phone, MapPin, Clock, CheckCircle, Truck, AlertCircle, Loader2 } from 'lucide-react';

const statusConfig = {
  pending:   { label: 'Pending',   color: 'bg-amber-50 text-amber-700 border-amber-200',     icon: <Clock className="w-4 h-4" /> },
  shipped:   { label: 'Shipped',   color: 'bg-indigo-50 text-indigo-700 border-indigo-200',  icon: <Truck className="w-4 h-4" /> },
  delivered: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle className="w-4 h-4" /> },
};

const STATUS_STEPS = ['pending', 'shipped', 'delivered'];

export default function PublicOrderTrackPage() {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    setOrders(null);
    setSearched(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/orders/track/?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setOrders(Array.isArray(data) ? data : []);
      } else {
        setError(data.error || 'No orders found for this number.');
      }
    } catch {
      setError('Unable to connect to the server. Please check your internet connection.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/20 pt-28 pb-20 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2 rounded-full mb-5 uppercase tracking-widest">
            <Package className="w-3.5 h-3.5" /> Order Tracking
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-3">
            Track Your <span className="text-indigo-600">Order</span>
          </h1>
          <p className="text-gray-500 text-sm sm:text-base">Enter your phone number to view all orders placed under that number.</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 sm:p-6 mb-8">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 017XXXXXXXX"
                className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-5 py-4 rounded-2xl mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {orders !== null && (
          <div>
            {orders.length === 0 && searched && !error ? (
              <div className="text-center bg-white rounded-2xl border border-dashed border-gray-200 py-16">
                <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-semibold text-sm">No orders found for this phone number.</p>
                <p className="text-gray-400 text-xs mt-1">Please check that you entered the correct number.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                  {orders.length} order{orders.length !== 1 ? 's' : ''} found
                </p>
                {orders.map((order) => {
                  const status = statusConfig[order.status] || statusConfig.pending;
                  const currentStep = STATUS_STEPS.indexOf(order.status);
                  return (
                    <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 hover:shadow-md transition-shadow">
                      {/* Header */}
                      <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h2 className="font-bold text-gray-900 text-base">{order.customer_name}</h2>
                            <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">#{order.id}</span>
                          </div>
                          <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-dashed border-gray-100 my-4" />

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Product</p>
                          <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-indigo-400" />
                            {order.product_name || 'N/A'}
                          </p>
                        </div>
                        {order.price > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Price</p>
                            <p className="font-bold text-indigo-700">৳ {Number(order.price).toLocaleString()}</p>
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Delivery Address</p>
                          <p className="text-gray-600 flex items-start gap-1.5 leading-relaxed">
                            <MapPin className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                            {[order.address, order.upazila, order.district].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        {order.extra_info && (
                          <div className="sm:col-span-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Additional Info</p>
                            <p className="text-gray-600 text-xs">{order.extra_info}</p>
                          </div>
                        )}
                      </div>

                      {/* Progress Tracker */}
                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <div className="relative flex items-start justify-between">
                          {/* Progress Line */}
                          <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-gray-200 mx-7" />
                          <div
                            className="absolute top-3.5 left-0 h-0.5 bg-indigo-500 mx-7 transition-all"
                            style={{ width: currentStep === 0 ? '0%' : currentStep === 1 ? '50%' : '100%' }}
                          />
                          {STATUS_STEPS.map((s, i) => {
                            const done = currentStep >= i;
                            const cfg = statusConfig[s];
                            return (
                              <div key={s} className="relative flex flex-col items-center flex-1 z-10">
                                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${done ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'}`}>
                                  <div className={`w-2.5 h-2.5 rounded-full ${done ? 'bg-white' : 'bg-gray-200'}`} />
                                </div>
                                <p className={`text-[10px] font-bold mt-1.5 uppercase tracking-wide ${done ? 'text-indigo-600' : 'text-gray-300'}`}>{cfg.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
