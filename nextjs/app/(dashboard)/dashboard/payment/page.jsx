"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  FaMobileAlt, FaWhatsapp, FaHistory, FaCreditCard, 
  FaCopy, FaCheckCircle, FaFacebookMessenger, FaArrowRight,
  FaExchangeAlt, FaUserShield // নতুন আইকন
} from "react-icons/fa";

export default function ManualPaymentPage() {
  const [activeTab, setActiveTab] = useState("payment");
  const [tranId, setTranId] = useState("");
  const [amount, setAmount] = useState(""); 
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- নতুন ট্রান্সফার স্টেট ---
  const [receiverId, setReceiverId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  // পেমেন্ট হিস্ট্রি ফেচ করা
  const fetchHistory = async () => {
    try {
      const res = await api.get("/payments/"); 
      setHistory(res.data || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleConfirmPayment = async () => {
    if (!amount || !tranId) return alert("অনুগ্রহ করে টাকার পরিমাণ এবং ট্রানজেকশন আইডি দিন।");
    
    setLoading(true);
    try {
      await api.post("/manual-payments/", { 
        transaction_id: tranId,
        amount: amount 
      });
      
      alert("✅ পেমেন্ট সফলভাবে সাবমিট হয়েছে! ভেরিফিকেশনের জন্য অপেক্ষা করুন।");
      
      setTranId("");
      setAmount("");
      fetchHistory();
      setActiveTab("history");
    } catch (err) {
      alert("Error: সাবমিট ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  // --- নতুন ট্রান্সফার ফাংশন ---
  const handleTransferBalance = async () => {
    if (!receiverId || !transferAmount) return alert("রিসিভার আইডি এবং টাকার পরিমাণ দিন।");
    
    setLoading(true);
    try {
      const res = await api.post("/transfer/", { // আপনার ব্যাকএন্ড এন্ডপয়েন্ট অনুযায়ী
        receiver_unique_id: receiverId,
        amount: transferAmount
      });
      alert(`✅ সফলভাবে ${transferAmount} BDT ট্রান্সফার হয়েছে!`);
      setReceiverId("");
      setTransferAmount("");
      fetchHistory(); // প্রয়োজনে হিস্ট্রি আপডেট
    } catch (err) {
      const errorMsg = err.response?.data?.error || "ট্রান্সফার ব্যর্থ হয়েছে।";
      alert("Error: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fe] py-4 px-2 md:p-12 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation Tabs - Updated with Transfer Tab */}
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

              <div className="flex gap-4">
                <a href="https://wa.me/8801727358743" target="_blank" className="flex-1 flex items-center justify-center gap-3 p-5 bg-[#25D366] text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all">
                  <FaWhatsapp size={20}/> Send Screenshot
                </a>
              </div>
            </div>
          </div>
        )}

        {/* --- TRANSFER FORM (New Option) --- */}
        {activeTab === "transfer" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-slate-900 px-5 py-8 md:p-8 rounded-[2.5rem] text-white space-y-2 relative overflow-hidden">
                 <div className="relative z-10">
                    <h2 className="text-xl md:text-3xl font-black mb-1">ব্যালেন্স ট্রান্সফার</h2>
                    <p className="text-slate-400 text-center md:text-left text-sm font-medium">অন্য ইউজারের ইউনিক আইডি দিয়ে সহজেই টাকা পাঠান।</p>
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
                  onClick={handleTransferBalance}
                  disabled={loading}
                  className="w-full p-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? "Processing..." : <>Send Balance <FaExchangeAlt /></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- HISTORY TABLE --- */}
        {activeTab === "history" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                <th className="p-6">Payment Details</th>
                                <th className="p-6">Date</th>
                                <th className="p-6">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs">
                            {history.length === 0 ? (
                              <tr><td colSpan="3" className="p-10 text-center text-slate-400 font-bold tracking-widest uppercase">No transactions found</td></tr>
                            ) : (
                              history.map((pay) => (
                                  <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-6">
                                          <p className="font-black text-slate-700 text-base">৳{pay.amount}</p>
                                          <p className="font-mono text-[10px] text-slate-400 uppercase">{pay.transaction_id || 'Transfer'}</p>
                                      </td>
                                      <td className="p-6 text-slate-500 font-bold uppercase text-[10px]">
                                          {new Date(pay.created_at).toLocaleDateString()}
                                      </td>
                                      <td className="p-6">
                                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${pay.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                                              {pay.status}
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