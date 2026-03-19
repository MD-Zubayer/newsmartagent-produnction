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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-gray-100 p-4 md:p-8 lg:p-12 transition-colors duration-300">
      
      {/* Header Section */}
      <div className="max-w-6xl mx-auto mb-10 bg-white/80 dark:bg-slate-900/90 border border-slate-100 dark:border-slate-800 shadow-2xl rounded-[2.5rem] p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl shadow-lg shadow-blue-500/30">
            <ClockIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">History & Logs</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Track your payments, token usage, and active offers
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="sticky top-8 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
            <TabButton 
              active={activeTab === "all"} 
              onClick={() => setActiveTab("all")}
              icon={<ClockIcon className="h-5 w-5" />}
              label="All Activity"
            />
            <TabButton 
              active={activeTab === "payment"} 
              onClick={() => setActiveTab("payment")}
              icon={<CreditCardIcon className="h-5 w-5" />}
              label="Payments"
            />
            <TabButton 
              active={activeTab === "usage"} 
              onClick={() => setActiveTab("usage")}
              icon={<CpuChipIcon className="h-5 w-5" />}
              label="Token Usage"
            />
            <TabButton 
              active={activeTab === "offer"} 
              onClick={() => setActiveTab("offer")}
              icon={<TagIcon className="h-5 w-5" />}
              label="Offers & Plans"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12">
               <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="mt-4 text-slate-500 font-medium">Loading history records...</p>
            </div>
          ) : (
            <>
              {/* --- Offers History --- */}
              {(activeTab === "all" || activeTab === "offer") && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <TagIcon className="h-6 w-6 text-purple-500" />
                    Offers History
                  </h2>
                  {offerHistory.map((offer) => (
                    <div key={offer.id} className="group flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-300 gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${offer.status === 'Active' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-slate-300'}`}>
                          <TagIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{offer.name}</p>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{offer.date} • {offer.id}</p>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0">
                        <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500 sm:mb-2 text-lg">
                          {offer.discount}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full ${offer.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {offer.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* --- Payment History --- */}
              {(activeTab === "all" || activeTab === "payment") && (
                <div className={`space-y-4 ${activeTab === 'all' ? 'pt-8 border-t border-slate-100 dark:border-slate-800' : ''}`}>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <CreditCardIcon className="h-6 w-6 text-emerald-500" />
                    Payment History
                  </h2>
                  {paymentHistory.map((txn) => (
                    <div key={txn.id} className="group flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-300 gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${txn.status === 'Success' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                          {txn.status === 'Success' ? <CheckCircleIcon className="h-6 w-6" /> : <XCircleIcon className="h-6 w-6" />}
                        </div>
                        <div>
                          <p className="font-bold text-lg uppercase tracking-wide">{txn.id}</p>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{txn.date} • via {txn.method}</p>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0">
                        <p className="font-black text-xl sm:mb-2">৳{txn.amount}</p>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full ${txn.status === 'Success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'}`}>
                          {txn.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* --- Token Usage History --- */}
              {(activeTab === "all" || activeTab === "usage") && (
                <div className={`space-y-4 ${activeTab === 'all' ? 'pt-8 border-t border-slate-100 dark:border-slate-800' : ''}`}>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <CpuChipIcon className="h-6 w-6 text-blue-500" />
                    Token Usage
                  </h2>
                  {usageHistory.map((log) => (
                    <div key={log.id} className="group flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
                          <CpuChipIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{log.task}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 dark:text-slate-300">{log.model}</span>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{log.date} • {log.id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0">
                        <div className="flex items-center gap-1.5 sm:mb-2">
                          <span className="font-black text-xl text-blue-600 dark:text-blue-400">-{log.tokens}</span>
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Tokens</span>
                        </div>
                        <button className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          View Details <ArrowRightIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {((activeTab === "payment" && paymentHistory.length === 0) || 
                (activeTab === "usage" && usageHistory.length === 0) || 
                (activeTab === "offer" && offerHistory.length === 0) ||
                (activeTab === "all" && paymentHistory.length === 0 && usageHistory.length === 0 && offerHistory.length === 0)
                ) && (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                   <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                      <ClockIcon className="h-8 w-8 text-gray-400" />
                   </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No Records Found</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm text-center">There is no history available for this category yet.</p>
                </div>
              )}
            </>
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
          className={`flex items-center gap-3 px-5 py-3.5 rounded-xl font-semibold transition-all duration-200 whitespace-nowrap lg:whitespace-normal text-left ${
            active 
            ? "bg-white text-slate-900 shadow-sm border border-slate-200 scale-[1.02] dark:bg-slate-900/80 dark:text-white dark:border-slate-800" 
            : "text-slate-500 hover:bg-white hover:border-slate-100 hover:text-slate-900 border border-transparent dark:hover:bg-slate-900/50 dark:hover:text-white"
          }`}
        >
      <div className={`${active ? "animate-pulse" : ""} shrink-0`}>
        {icon}
      </div>
      <span className="text-sm">{label}</span>
      {active && (
        <div className="hidden lg:block ml-auto w-1.5 h-6 bg-blue-500 rounded-full"></div>
      )}
    </button>
  );
}
