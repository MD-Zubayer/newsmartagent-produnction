"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { 
  FaMobileAlt, FaWhatsapp, FaHistory, FaCreditCard, 
  FaCopy, FaCheckCircle, FaArrowRight,
  FaExchangeAlt, FaUserShield, FaArrowUp, FaArrowDown,
  FaLock, FaEnvelopeOpenText, FaShieldAlt, // added for verification
  FaFacebookMessenger, FaUniversity, FaUser 
} from "react-icons/fa";
import toast from "react-hot-toast";

export default function ManualPaymentPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("payment");
  const [tranId, setTranId] = useState("");
  const [amount, setAmount] = useState(""); 
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
const [submitting, setSubmitting] = useState(false);
  // --- নতুন ট্রান্সফার স্টেট ---
  const [receiverId, setReceiverId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  // পেমেন্ট এবং ট্রান্সফার হিস্ট্রি একসাথে ফেচ করা
  const fetchHistory = async () => {
    try {
      // একসাথে পেমেন্ট এবং ট্রান্সফার ডাটা কল করা হচ্ছে
      const [paymentRes, transferRes] = await Promise.all([
        api.get("/payments/"),
        api.get("/transfer/") // আপনার দেওয়া url অনুযায়ী GET রিকোয়েস্ট
      ]);

      // পেমেন্ট ডাটা প্রসেস করা (Type: Deposit)
      const payments = (paymentRes.data || []).map(item => ({
        ...item,
        type: 'deposit' // টাকা জমা
      }));

      // ট্রান্সফার ডাটা প্রসেস করা (Type: Transfer)
      const transfers = (transferRes.data || []).map(item => ({
        ...item,
        type: 'transfer' // টাকা পাঠানো
      }));

      // দুটি লিস্ট একসাথে করে তারিখ অনুযায়ী (নতুন আগে) সাজানো
      const combinedHistory = [...payments, ...transfers].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );

      setHistory(combinedHistory);
    } catch (err) {
      console.error("Failed to fetch history:", err);
      toast.error("History could not be loaded!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // --- পেমেন্ট সাবমিট ---
  const handleConfirmPayment = async () => {
    if (!amount || !tranId) return toast.error("Enter the amount and transaction ID.");
    
    setSubmitting(true);
    const loadingToast = toast.loading("Verifying payment...");
    
    try {
      const res = await api.post("/manual-payments/", { 
        transaction_id: tranId,
        amount: amount 
      });
      
      toast.success("Payment submitted successfully!", { id: loadingToast });
      router.push(`/dashboard/payment-success?payment_id=${res.data.payment_id}`);
    } catch (err) {
      toast.error("Submit failed. Please try again.", { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  const startTransferFlow = () => {
    if (!receiverId || !transferAmount) return toast.error("Please provide all information correctly.");
    router.push(`/dashboard/transfer-verify?receiver_id=${receiverId}&amount=${transferAmount}`);
  };

  // --- ৩. লোডিং স্ট্যাট (Skeleton) ---
  if (loading) return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="h-12 bg-white rounded-2xl animate-pulse shadow-sm" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-64 bg-white rounded-[2.5rem] animate-pulse" />
        <div className="h-64 bg-white rounded-[2.5rem] animate-pulse" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f7fe] py-4 px-2 md:p-12 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 w-full bg-white p-2 rounded-[2rem] shadow-sm mb-10 border border-slate-100 overflow-hidden">
          <button 
            onClick={() => setActiveTab("payment")}
            className={`flex items-center justify-center gap-2 px-1 py-4 rounded-[1.5rem] font-black text-[9px] md:text-xs uppercase tracking-widest transition-all ${activeTab === 'payment' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <FaCreditCard className="hidden xs:block" size={16}/> Add Balance
          </button>
          <button 
            onClick={() => setActiveTab("transfer")}
            className={`flex items-center justify-center gap-2 px-1 py-4 rounded-[1.5rem] font-black text-[9px] md:text-xs uppercase tracking-widest transition-all ${activeTab === 'transfer' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <FaExchangeAlt className="hidden xs:block" size={16}/> Transfer
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`flex items-center justify-center gap-2 px-1 py-4 rounded-[1.5rem] font-black text-[9px] md:text-xs uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <FaHistory className="hidden xs:block" size={16}/> History
          </button>
        </div>

        {/* --- PAYMENT FORM --- */}
        {activeTab === "payment" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-2xl mx-auto space-y-6">
              
              <div className="bg-indigo-900 px-5 py-8 md:p-8 rounded-[2.5rem] text-white space-y-2 relative overflow-hidden">
                 <div className="relative z-10">
                    <h2 className="text-xl md:text-3xl font-black mb-1">অ্যাকাউন্টে টাকা যোগ করুন</h2>
                    <p className="text-indigo-200 text-center md:text-left text-sm font-medium">নিচের নাম্বারে সেন্ড মানি করে ট্রানজেকশন আইডি সাবমিট করুন।</p>
                 </div>
                 <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              </div>

              <div className="space-y-3">
                <PaymentMethodCard icon={<FaMobileAlt className="text-pink-500"/>} name="bKash (Personal)" number="01326277782" />
                <PaymentMethodCard icon={<FaMobileAlt className="text-orange-500"/>} name="Nagad (Personal)" number="01326277782" />
                
                {/* 🏦 Premium Bank Card */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-[2.8rem] shadow-2xl relative overflow-hidden text-white border border-slate-700/50 my-6">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
                  
                  <div className="flex items-center gap-4 mb-8">
                     <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-indigo-400 border border-white/10 shadow-inner">
                        <FaUniversity size={28}/>
                     </div>
                     <div>
                        <h3 className="text-xl font-black uppercase tracking-tight italic">Direct Bank Transfer</h3>
                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Premium Settlement Channel</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    <BankDetailItem label="Bank Name" value="Dutch-Bangla Bank" isCopyable />
                    <BankDetailItem label="Account Holder" value="MD JONAYED" isCopyable />
                    <BankDetailItem label="Account Number" value="1811580389470" isCopyable />
                    <BankDetailItem label="Card Number" value="4840 6100 2281 7706" isCopyable />
                  </div>
                </div>
              </div>

              <div className="bg-white px-2 py-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Amount</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="e.g. 1000" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none focus:ring-2 focus:ring-indigo-500 font-black text-slate-800"
                    />
                    <span className="absolute right-6 top-5 text-slate-400 font-bold">৳</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Transaction ID</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 8N7K10L9P" 
                    value={tranId}
                    onChange={(e) => setTranId(e.target.value)}
                    className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none focus:ring-2 focus:ring-indigo-500 font-black text-slate-800 uppercase"
                  />
                </div>

                <button 
                  onClick={handleConfirmPayment}
                  disabled={loading}
                  className="w-full p-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? "Processing..." : <>Submit <FaArrowRight /></>}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <a href="https://wa.me/8801727358743" target="_blank" className="flex-1 flex items-center justify-center gap-3 p-5 bg-[#25D366] text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-emerald-100">
                  <FaWhatsapp size={20}/> WhatsApp support
                </a>
                <a href="https://www.messenger.com/t/947204378476536/" target="_blank" className="flex-1 flex items-center justify-center gap-3 p-5 bg-[#0084FF] text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-blue-100">
                  <FaFacebookMessenger size={20}/> Messenger support
                </a>
              </div>
            </div>
          </div>
        )}

        {/* --- TRANSFER FORM --- */}
        {activeTab === "transfer" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-slate-900 px-5 py-8 md:p-8 rounded-[2.5rem] text-white space-y-2 relative overflow-hidden">
                 <div className="relative z-10">
                    <h2 className="text-xl md:text-3xl font-black mb-1">ব্যালেন্স ট্রান্সফার</h2>
                    <p className="text-slate-400 text-center md:text-left text-sm font-medium">অন্য ইউজারের ইউনিক আইডি দিয়ে সহজেই টাকা পাঠান।</p>
                 </div>
                 <FaExchangeAlt className="absolute -right-5 -bottom-5 w-32 h-32 text-white/5 rotate-12" />
              </div>

              <div className="bg-white px-4 py-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 italic flex items-center gap-2">
                    <FaUserShield /> Receiver Unique ID
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. USER12345" 
                    value={receiverId}
                    onChange={(e) => setReceiverId(e.target.value)}
                    className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none focus:ring-2 focus:ring-indigo-500 font-black text-slate-800 uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 italic">Transfer Amount</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none focus:ring-2 focus:ring-indigo-500 font-black text-slate-800"
                    />
                    <span className="absolute right-6 top-5 text-slate-400 font-bold">৳</span>
                  </div>
                </div>

                <button 
                  onClick={startTransferFlow}
                  disabled={submitting}
                  className="w-full p-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-slate-900 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {submitting ? "Processing..." : <>Next to Verify <FaArrowRight /></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- HISTORY TABLE (Updated with Transfer) --- */}
        {activeTab === "history" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                <th className="p-6">Details</th>
                                <th className="p-6">Date</th>
                                <th className="p-6">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs">
                            {history.length === 0 ? (
                              <tr><td colSpan="3" className="p-10 text-center text-slate-400 font-bold tracking-widest uppercase">No transactions found</td></tr>
                            ) : (
                              history.map((pay, index) => (
                                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-6">
                                          <div className="flex items-center gap-3">
                                            {/* আইকন দিয়ে ইন/আউট বোঝানো হচ্ছে */}
                                            <div className={`p-2 rounded-full ${pay.type === 'transfer' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                              {pay.type === 'transfer' ? <FaArrowUp size={12}/> : <FaArrowDown size={12}/>}
                                            </div>
                                            <div>
                                              <p className={`font-black text-base ${pay.type === 'transfer' ? 'text-red-500' : 'text-slate-700'}`}>
                                                {pay.type === 'transfer' ? '-' : '+'}৳{pay.amount}
                                              </p>
                                              <p className="font-mono text-[10px] text-slate-400 uppercase">
                                                {pay.type === 'transfer' 
                                                  ? `To: ${pay.receiver_unique_id || 'User'}` 
                                                  : `Trx: ${pay.transaction_id || 'N/A'}`
                                                }
                                              </p>
                                            </div>
                                          </div>
                                      </td>
                                      <td className="p-6 text-slate-500 font-bold uppercase text-[10px]">
                                          {new Date(pay.created_at).toLocaleDateString()}
                                      </td>
                                      <td className="p-6">
                                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${pay.status === 'paid' || pay.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                                              {pay.status || 'Pending'}
                                          </span>
                                      </td>
                                  </tr>
                              ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BankDetailItem({ label, value, isCopyable }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
      <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1 leading-none">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold tracking-wider truncate">{value}</p>
        {isCopyable && (
          <button onClick={handleCopy} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${copied ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
            {copied ? <FaCheckCircle size={14}/> : <FaCopy size={14}/>}
          </button>
        )}
      </div>
    </div>
  );
}

function PaymentMethodCard({ icon, name, number }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-100 transition-all shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-xl shadow-inner group-hover:bg-indigo-50 transition-colors">{icon}</div>
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{name}</p>
          <p className="text-sm font-black text-slate-800 tracking-tight italic">{number}</p>
        </div>
      </div>
      <button onClick={handleCopy} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
        {copied ? <><FaCheckCircle size={12}/> Copied</> : <><FaCopy size={12}/> Copy</>}
      </button>
    </div>
  );
}