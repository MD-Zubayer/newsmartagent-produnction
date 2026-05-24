"use client";
import { useState, useEffect } from "react";
import axiosInstance from "@/lib/api";
import { 
  ClockIcon, 
  CreditCardIcon, 
  CpuChipIcon, 
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [paymentHistory, setPaymentHistory] = useState([]);
  const [usageHistory, setUsageHistory] = useState([]);
  const [offerHistory, setOfferHistory] = useState([]);

  useEffect(() => {

    const fetchHistoryData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all three APIs in parallel
        const [subRes, payRes, tokenRes] = await Promise.all([
          axiosInstance.get("/subscriptions/"),
          axiosInstance.get("/payments/"),
          axiosInstance.get("/AgentAI/tokens/analytics/"),
        ]);

        // DRF can return {results: [...]} (paginated) or direct array
        const subData = Array.isArray(subRes.data) ? subRes.data : (subRes.data?.results || []);
        const payData = Array.isArray(payRes.data) ? payRes.data : (payRes.data?.results || []);

        // Format Offers
        const formattedOffers = subData.map((sub) => ({
          id: `OFF-${sub.id}`,
          date: new Date(sub.start_date || sub.created_at || new Date()).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          name: sub.offer?.name || "Unknown Plan",
          discount: sub.offer?.price ? `৳${sub.offer.price}` : "Free",
          status: sub.is_active ? "Active" : "Expired",
          end_date: sub.end_date ? new Date(sub.end_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : "—"
        }));
        setOfferHistory(formattedOffers);

        // Format Payments
        const formattedPayments = payData.map((pay) => ({
          id: pay.transaction_id || `TXN-${pay.id}`,
          date: new Date(pay.paid_at || pay.created_at || new Date()).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          amount: pay.amount || 0,
          status: pay.status?.toLowerCase() === 'paid' ? "Success" : pay.status === "pending" ? "Pending" : "Failed",
          method: pay.transaction_id === "BALANCE_PURCHASE" ? "NSA Balance" : "Manual",
          offer_name: pay.offer?.name || "—"
        }));
        setPaymentHistory(formattedPayments);

        // Format Token Usage from recent_logs
        const recentLogs = tokenRes.data?.recent_logs || [];
        const formattedUsage = recentLogs.map((log) => ({
          id: `USE-${log.id}`,
          date: new Date(log.created_at || new Date()).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          tokens: log.total_tokens || 0,
          task: "AI Chat / Generation",
          model: log.model_name || "Unknown Model",
          platform: log.platform || "—"
        }));
        setUsageHistory(formattedUsage);

      } catch (error) {
        console.error("Failed to fetch history data", error);
        setError("ইতিহাস লোড করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।");
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, []);


  return (
    <div className="min-h-screen bg-slate-50/50 text-gray-800 p-3.5 sm:p-6 md:p-10 font-sans overflow-x-hidden relative">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-10 w-96 h-96 bg-blue-200/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header Section */}
      <div className="max-w-5xl mx-auto mb-8 sm:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-pink-500 animate-pulse" />
            <span className="text-[10px] font-bold text-pink-500 uppercase tracking-widest">Workspace Logs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase">
            History &amp; <span className="bg-gradient-to-r from-pink-500 to-indigo-600 bg-clip-text text-transparent">Logs</span>
          </h1>
          <p className="text-slate-400 font-medium text-xs sm:text-sm mt-1">Real-time Activity Intelligence &amp; Transaction Details</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm self-start md:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">System Live</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        {/* Horizontal Tabs Container */}
        <div className="bg-white/80 backdrop-blur-md p-1 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-100/40 flex flex-row items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <TabButton 
            active={activeTab === "all"} 
            onClick={() => setActiveTab("all")}
            icon={<ClockIcon className="h-4 w-4" />}
            label="All Activity"
          />
          <TabButton 
            active={activeTab === "payment"} 
            onClick={() => setActiveTab("payment")}
            icon={<CreditCardIcon className="h-4 w-4" />}
            label="Payments"
          />
          <TabButton 
            active={activeTab === "usage"} 
            onClick={() => setActiveTab("usage")}
            icon={<CpuChipIcon className="h-4 w-4" />}
            label="Token Usage"
          />
          <TabButton 
            active={activeTab === "offer"} 
            onClick={() => setActiveTab("offer")}
            icon={<TagIcon className="h-4 w-4" />}
            label="Offers & Plans"
          />
        </div>

        {/* Content Area */}
        <div className="space-y-8">
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <XCircleIcon className="h-5 w-5 text-rose-500 shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
              <button 
                onClick={() => window.location.reload()} 
                className="text-xs font-bold uppercase tracking-wider text-rose-600 hover:text-rose-700 hover:underline"
              >
                Retry
              </button>
            </div>
          )}
          
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white/40 backdrop-blur-sm rounded-2xl border border-slate-100">
               <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="mt-4 text-slate-400 font-bold text-xs uppercase tracking-widest">Loading history records...</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {/* --- Offers History --- */}
              {(activeTab === "all" || activeTab === "offer") && offerHistory.length > 0 && (
                <motion.div 
                  key="offers-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                    <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
                      <TagIcon className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Offers History</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {offerHistory.map((offer, index) => (
                      <motion.div 
                        key={offer.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="group relative bg-white/70 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/50 hover:border-purple-200 hover:bg-white/95 hover:shadow-md transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full md:w-auto">
                          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3 ${offer.status === 'Active' ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-purple-200/30' : 'bg-slate-100 text-slate-400'}`}>
                            <TagIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm sm:text-base font-extrabold text-slate-800 uppercase tracking-tight truncate">{offer.name}</p>
                              <span className={`inline-flex md:hidden items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${offer.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                {offer.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] sm:text-xs">
                              <span className="font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100/50 font-bold">{offer.id}</span>
                              <span className="text-slate-400 font-medium flex items-center gap-1">
                                <ClockIcon className="h-3 w-3 shrink-0" />
                                {offer.date} {offer.end_date && `– ${offer.end_date}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-row md:flex-row items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t border-slate-100/80 md:border-none pt-3 md:pt-0">
                          <div className="text-left md:text-right">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Price</p>
                            <p className="text-base sm:text-lg font-black text-slate-900 tracking-tight">{offer.discount}</p>
                          </div>
                          <div className="hidden md:block text-right min-w-[90px]">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${offer.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${offer.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                              {offer.status}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* --- Payment History --- */}
              {(activeTab === "all" || activeTab === "payment") && paymentHistory.length > 0 && (
                <motion.div 
                  key="payments-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                    <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                      <CreditCardIcon className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Payment History</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {paymentHistory.map((txn, index) => (
                      <motion.div 
                        key={txn.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="group relative bg-white/70 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/50 hover:border-emerald-200 hover:bg-white/95 hover:shadow-md transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full md:w-auto">
                          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3 ${txn.status === 'Success' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-200/30' : txn.status === 'Pending' ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-200/30' : 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-200/30'}`}>
                            {txn.status === 'Success' ? (
                              <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                            ) : txn.status === 'Pending' ? (
                              <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                            ) : (
                              <XCircleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm sm:text-base font-extrabold text-slate-800 uppercase tracking-tight truncate">{txn.id}</p>
                              <span className={`inline-flex md:hidden items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${txn.status === 'Success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : txn.status === 'Pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                {txn.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] sm:text-xs">
                              <span className="text-slate-400 font-semibold uppercase">{txn.date}</span>
                              <span className="text-indigo-600 bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-100/50 font-bold">via {txn.method}</span>
                              {txn.offer_name && txn.offer_name !== "—" && (
                                <span className="text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 font-semibold">{txn.offer_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-row md:flex-row items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t border-slate-100/80 md:border-none pt-3 md:pt-0">
                          <div className="text-left md:text-right">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Amount</p>
                            <p className="text-base sm:text-lg font-black text-slate-900 tracking-tight">৳{(txn.amount || 0).toLocaleString()}</p>
                          </div>
                          <div className="hidden md:block text-right min-w-[90px]">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Outcome</p>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${txn.status === 'Success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : txn.status === 'Pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${txn.status === 'Success' ? 'bg-emerald-500 animate-pulse' : txn.status === 'Pending' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
                              {txn.status}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* --- Token Usage History --- */}
              {(activeTab === "all" || activeTab === "usage") && usageHistory.length > 0 && (
                <motion.div 
                  key="usages-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                    <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                      <CpuChipIcon className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Token Usage</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {usageHistory.map((log, index) => (
                      <motion.div 
                        key={log.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="group relative bg-white/70 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/50 hover:border-blue-200 hover:bg-white/95 hover:shadow-md transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full md:w-auto">
                          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-200/30 shadow-sm shrink-0 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3">
                            <CpuChipIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm sm:text-base font-extrabold text-slate-800 uppercase tracking-tight truncate">{log.task}</p>
                              <span className="text-[9px] font-bold bg-slate-900 text-slate-100 px-1.5 py-0.5 rounded border border-slate-800 uppercase tracking-tight font-mono">
                                {log.model}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] sm:text-xs text-slate-400 font-medium">
                              <span>{log.date}</span>
                              <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 font-semibold">{log.id}</span>
                              {log.platform && log.platform !== "—" && (
                                <span className="text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-100/50 font-bold">via {log.platform}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-row md:flex-row items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t border-slate-100/80 md:border-none pt-3 md:pt-0">
                          <div className="text-left md:text-right">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Consumption</p>
                            <div className="flex items-center gap-1">
                              <span className="font-extrabold text-base sm:text-lg text-rose-600 tracking-tight">-{ (log.tokens || 0).toLocaleString() }</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tokens</span>
                            </div>
                          </div>
                          <button className="hidden md:flex w-9 h-9 rounded-xl bg-slate-50 items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all hover:scale-105 shrink-0 border border-slate-200/60 shadow-sm">
                            <ArrowRightIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Empty State */}
              {((activeTab === "payment" && paymentHistory.length === 0) || 
                (activeTab === "usage" && usageHistory.length === 0) || 
                (activeTab === "offer" && offerHistory.length === 0) ||
                (activeTab === "all" && paymentHistory.length === 0 && usageHistory.length === 0 && offerHistory.length === 0)
                ) && (
                <motion.div 
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center p-16 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm"
                >
                   <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                      <ClockIcon className="h-8 w-8 text-slate-400" />
                   </div>
                  <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight mb-1">No Records Found</h3>
                  <p className="text-slate-400 font-medium text-xs uppercase tracking-wider text-center max-w-sm">There is no history available for this category yet.</p>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl font-extrabold text-[10px] sm:text-xs uppercase tracking-wider transition-all duration-300 flex-1 whitespace-nowrap group ${
        active 
          ? "text-white" 
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
      }`}
    >
      {active && (
        <motion.div 
          layoutId="activeTabIndicator"
          className="absolute inset-0 bg-slate-900 rounded-xl -z-10 shadow-md shadow-slate-950/10"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span className={`shrink-0 transition-all duration-300 ${active ? "scale-110 text-pink-500" : "group-hover:scale-110 text-slate-400 group-hover:text-indigo-500"}`}>
        {icon}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
