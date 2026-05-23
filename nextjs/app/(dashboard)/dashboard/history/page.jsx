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
    <div className="min-h-screen bg-[#f8fafc] text-gray-800 p-3 md:p-10 font-sans overflow-x-hidden transition-colors duration-300">
      
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-6 sm:mb-10 border-l-8 border-pink-500 pl-4 sm:pl-6 space-y-1 sm:space-y-2">
        <h1 className="text-xl sm:text-2xl md:text-4xl font-black text-gray-900 tracking-tighter italic uppercase">History & Logs</h1>
        <p className="text-gray-400 font-bold text-xs sm:text-sm uppercase tracking-widest">Real-time Activity Intelligence</p>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 sm:gap-8">
        
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="sticky top-8 grid grid-cols-4 lg:grid-cols-1 gap-2 sm:gap-3 pb-2 lg:pb-0">
            <TabButton 
              active={activeTab === "all"} 
              onClick={() => setActiveTab("all")}
              icon={<ClockIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
              label="All Activity"
            />
            <TabButton 
              active={activeTab === "payment"} 
              onClick={() => setActiveTab("payment")}
              icon={<CreditCardIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
              label="Payments"
            />
            <TabButton 
              active={activeTab === "usage"} 
              onClick={() => setActiveTab("usage")}
              icon={<CpuChipIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
              label="Token Usage"
            />
            <TabButton 
              active={activeTab === "offer"} 
              onClick={() => setActiveTab("offer")}
              icon={<TagIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
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
                  <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 mb-6 italic uppercase">
                    <TagIcon className="h-6 w-6 text-purple-600" />
                    Offers History
                  </h2>
                  {offerHistory.map((offer) => (
                    <div key={offer.id} className="group relative bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-gray-100 hover:shadow-2xl transition-all overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
                      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                        <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shrink-0 transition-transform duration-500 group-hover:scale-110 ${offer.status === 'Active' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <TagIcon className="h-5 w-5 sm:h-8 sm:w-8" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm sm:text-lg font-black text-slate-800 uppercase tracking-tighter truncate">{offer.name}</p>
                          <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1 truncate">{offer.date} • {offer.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-10 w-full sm:w-auto justify-between sm:justify-end pl-13 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5 sm:mb-1">Price</p>
                          <p className="text-lg sm:text-2xl font-black text-gray-900 tracking-tighter">{offer.discount}</p>
                        </div>
                        <div className="text-right min-w-[70px] sm:min-w-[100px]">
                          <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5 sm:mb-1">Status</p>
                          <span className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-tighter ${offer.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                            {offer.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* --- Payment History --- */}
              {(activeTab === "all" || activeTab === "payment") && (
                <div className={`space-y-4 ${activeTab === 'all' ? 'pt-12 border-t border-slate-100' : ''}`}>
                  <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 mb-6 italic uppercase">
                    <CreditCardIcon className="h-6 w-6 text-emerald-600" />
                    Payment History
                  </h2>
                  {paymentHistory.map((txn) => (
                    <div key={txn.id} className="group relative bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-gray-100 hover:shadow-2xl transition-all overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
                      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                        <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shrink-0 transition-transform duration-500 group-hover:scale-110 ${txn.status === 'Success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                          {txn.status === 'Success' ? <CheckCircleIcon className="h-5 w-5 sm:h-8 sm:w-8" /> : <XCircleIcon className="h-5 w-5 sm:h-8 sm:w-8" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm sm:text-lg font-black text-slate-800 uppercase tracking-tighter truncate">{txn.id}</p>
                          <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1 truncate">{txn.date} • via {txn.method}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-10 w-full sm:w-auto justify-between sm:justify-end pl-13 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5 sm:mb-1">Amount</p>
                          <p className="text-lg sm:text-2xl font-black text-gray-900 tracking-tighter">৳{txn.amount}</p>
                        </div>
                        <div className="text-right min-w-[70px] sm:min-w-[100px]">
                          <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5 sm:mb-1">Outcome</p>
                          <span className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-tighter ${txn.status === 'Success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {txn.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* --- Token Usage History --- */}
              {(activeTab === "all" || activeTab === "usage") && (
                <div className={`space-y-4 ${activeTab === 'all' ? 'pt-12 border-t border-slate-100' : ''}`}>
                  <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 mb-6 italic uppercase">
                    <CpuChipIcon className="h-6 w-6 text-blue-600" />
                    Token Usage
                  </h2>
                  {usageHistory.map((log) => (
                    <div key={log.id} className="group relative bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-gray-100 hover:shadow-2xl transition-all overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
                      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                        <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center bg-blue-600 text-white shadow-lg shrink-0 transition-transform duration-500 group-hover:scale-110">
                          <CpuChipIcon className="h-5 w-5 sm:h-8 sm:w-8" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm sm:text-lg font-black text-slate-800 uppercase tracking-tighter truncate">{log.task}</p>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 mt-1 sm:mt-1.5">
                            <span className="text-[8px] sm:text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg uppercase tracking-tight border border-slate-200/50">{log.model}</span>
                            <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider sm:tracking-widest truncate">{log.date} • {log.id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end pl-13 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5 sm:mb-1">Consumption</p>
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            <span className="font-black text-lg sm:text-2xl text-rose-600 tracking-tighter">-{log.tokens}</span>
                            <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider sm:tracking-widest shrink-0">Tokens</span>
                          </div>
                        </div>
                        <button className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:scale-75 sm:group-hover:scale-100 shrink-0">
                          <ArrowRightIcon className="h-4 w-4 sm:h-5 sm:w-5" />
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
                <div className="flex flex-col items-center justify-center p-16 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                   <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                      <ClockIcon className="h-10 w-10 text-slate-300" />
                   </div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">No Records Found</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-center px-10">There is no history available for this category yet.</p>
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
      className={`flex flex-col lg:flex-row items-center lg:items-center gap-1 lg:gap-4 px-2 py-2.5 sm:px-4 sm:py-3 lg:px-6 lg:py-4 rounded-xl lg:rounded-2xl font-black transition-all duration-300 text-center lg:text-left group border w-full ${
        active 
        ? "bg-slate-900 text-white border-transparent shadow-2xl shadow-slate-900/20" 
        : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50 hover:text-slate-600 shadow-sm"
      }`}
    >
      <div className={`${active ? "text-pink-500" : "group-hover:text-indigo-500 transition-colors"} shrink-0`}>
        {icon}
      </div>
      <span className="text-[7px] sm:text-[9px] lg:text-xs uppercase tracking-wide lg:tracking-[0.1em] leading-tight">{label}</span>
      {active && (
        <div className="hidden lg:block ml-auto w-1 h-6 bg-pink-500 rounded-full shrink-0" />
      )}
    </button>
  );
}
