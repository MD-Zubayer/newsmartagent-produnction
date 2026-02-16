"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { 
  FaMobileAlt, FaWhatsapp, FaTimes, FaHashtag, 
  FaFacebook, FaFacebookMessenger, FaCopy, FaCheckCircle,
  FaWallet, FaExclamationTriangle, FaArrowRight, FaInfoCircle
} from "react-icons/fa";

export default function OffersPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [tranId, setTranId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // --- কাস্টম কনফার্মেশন স্টেট ---
  const [showConfirmCard, setShowConfirmCard] = useState(false);
  const [profileBalance, setProfileBalance] = useState(0); 
  const [errorMessage, setErrorMessage] = useState(""); 

  useEffect(() => {
    async function loadOffers() {
      try {
        const [offersRes, meRes] = await Promise.all([
          api.get("/offers/"),
          api.get("/users/me/") // আপনার এন্ডপয়েন্ট অনুযায়ী
        ]);
        setOffers(offersRes.data || []);
        
        // আপনার দেওয়া পাথ: user.profile.acount_balance
        const balance = meRes.data?.profile?.acount_balance || 0;
        setProfileBalance(balance);
        console.log(balance)
        console.log(meRes.data)
        console.log(offersRes.data)
      
      } catch (err) {
        console.error("API ERROR:", err);
      } finally {
        setLoading(false);
      }
    }
    loadOffers();
  }, []);

  const handleConfirmPayment = async () => {
    if (!tranId) return alert("Please enter Transaction ID");
    
    setSubmitting(true);
    try {
      await api.post("/payments/", { 
        offer_id: selectedOffer.id,
        transaction_id: tranId,
        amount: selectedOffer.price
      });

      alert("✅ Payment submitted! Waiting for Admin approval.");
      setSelectedOffer(null);
      setTranId("");
    } catch (err) {
      console.error("Error:", err);
      alert("Submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const processBalancePurchase = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      await api.post("/payments/", { 
        offer_id: selectedOffer.id,
        payment_type: "subscription",
        amount: selectedOffer.price,
        status: "paid",
        transaction_id: "BALANCE_PURCHASE" 
      });

      alert("✅ অফারটি সফলভাবে কেনা হয়েছে!");
      setSelectedOffer(null);
      window.location.reload(); 
    } catch (err) {
      const msg = err.response?.data?.error || "ব্যালেন্স কম অথবা সমস্যা হয়েছে।";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="py-6 px-2 md:p-12 bg-[#f4f7fe] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12">
          <span className="text-blue-600 font-black text-xs uppercase tracking-[0.3em] mb-2 block">Premium Access</span>
          <h1 className="text-2xl md:text-5xl font-black text-slate-900 italic uppercase leading-none">
            Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Plan</span>
          </h1>
          <p className="mt-4 text-slate-500 font-medium max-w-md">Upgrade your AI experience with more tokens and longer validity.</p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {offers.map((offer) => (
            <div
              key={offer.id}
              onClick={() => {setSelectedOffer(offer); setErrorMessage("");}}
              className="group bg-white border border-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer relative overflow-hidden"
            >
              {offer.target_audience === 'created_by_agent' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
                  <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white text-[8px] font-black px-5 py-1.5 rounded-b-xl uppercase tracking-[0.2em] shadow-lg shadow-orange-200/40 animate-pulse border-x border-b border-white/20 whitespace-nowrap">
                    ✨ Special Offer
                  </div>
                </div>
              )}

              <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-600/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              
              <div className="flex justify-between items-start mb-10">
                <div className="p-4 bg-blue-50 rounded-2xl">
                  <FaHashtag className="text-blue-600 text-xl" />
                </div>
                <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                  {offer.duration_days} Days
                </span>
              </div>

              <h2 className="text-5xl font-black text-slate-900 italic uppercase">
                {offer.word || offer.tokens} 
                <span className="block text-sm not-italic text-slate-400 mt-1">Tokens Capacity</span>
              </h2>

              <div className="mt-8 flex items-end gap-1">
                <span className="text-3xl font-black text-slate-900">৳{offer.price}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-2">Total Amount</span>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                        <div className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center text-white border-4 border-white shadow-sm">
                           <FaFacebook size={14}/>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-[#00B2FF] flex items-center justify-center text-white border-4 border-white shadow-sm">
                           <FaFacebookMessenger size={14}/>
                        </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Supported Platforms</span>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white group-hover:bg-blue-600 transition-colors">
                    <span className="text-xl font-light">→</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>



      {selectedOffer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] overflow-hidden shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-y-auto max-h-[95vh]">
            
            <button 
              onClick={() => {setSelectedOffer(null); setShowConfirmCard(false); setErrorMessage("");}}
              className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 hover:rotate-90 transition-all z-10"
            >
              <FaTimes size={18}/>
            </button>

            <div className="py-10 px-6 md:p-10 pt-14">
              
              {!showConfirmCard ? (
                <>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                      <FaCheckCircle size={28}/>
                    </div>
                    <div>
                      <h2 className="text-lg mt-2.5 md:text-2xl font-black text-slate-900 uppercase italic leading-none">Complete Purchase</h2>
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1">Plan: {selectedOffer.word || selectedOffer.tokens} Tokens</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <button 
                      onClick={() => setShowConfirmCard(true)}
                      disabled={submitting}
                      className="w-full p-6 bg-blue-50 border-2 border-dashed border-blue-200 rounded-[2.5rem] flex items-center justify-between group hover:bg-blue-600 hover:border-blue-600 transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                          <FaWallet size={20}/>
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black text-blue-400 group-hover:text-blue-100 uppercase tracking-widest">Option 01</p>
                          <p className="text-sm font-black text-slate-800 group-hover:text-white">Buy with Profile Balance</p>
                        </div>
                      </div>
                      <FaArrowRight className="text-blue-200 group-hover:text-white" />
                    </button>
                  </div>

                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]"><span className="bg-white px-4 text-slate-300">OR Manual Payment</span></div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 mb-8">
                    <PaymentRow icon={<FaMobileAlt className="text-[#D12053]"/>} label="bKash (Personal)" val="01326277782" />
                    <PaymentRow icon={<FaMobileAlt className="text-[#F7941D]"/>} label="Nagad (Personal)" val="01326277782" />
                  </div>

                  <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Manual Transaction ID</label>
                    <div className="relative">
                       <FaHashtag className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                        type="text"
                        placeholder="Enter ID here..."
                        className="w-full p-5 pl-12 bg-white rounded-2xl border-2 border-transparent focus:border-blue-600 outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300"
                        value={tranId}
                        onChange={(e) => setTranId(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={handleConfirmPayment}
                      disabled={submitting}
                      className="w-full mt-4 p-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all disabled:opacity-50"
                    >
                      {submitting ? "Verifying..." : "Submit Transaction"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="animate-in zoom-in-95 duration-300">
                  <div className="text-center space-y-6">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner ${profileBalance < selectedOffer.price ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                      {profileBalance < selectedOffer.price ? <FaInfoCircle size={40}/> : <FaExclamationTriangle size={40} />}
                    </div>
                    
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase italic">Confirm Purchase</h2>
                      <p className="text-slate-500 text-sm mt-2 font-medium">
                        আপনার ব্যালেন্স থেকে <span className="font-black text-slate-900">৳{selectedOffer.price}</span> কাটা হবে।
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-3">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>Current Balance</span>
                          <span className={`font-bold ${profileBalance < selectedOffer.price ? 'text-red-500' : 'text-emerald-500'}`}>৳{profileBalance}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>Plan Price</span>
                          <span className="text-slate-900">৳{selectedOffer.price}</span>
                       </div>
                    </div>

                    {(profileBalance < selectedOffer.price || errorMessage) && (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-left animate-pulse">
                         <FaInfoCircle className="shrink-0" />
                         <p className="text-[11px] font-bold leading-tight">
                            {errorMessage || "ব্যালেন্স কম! দয়া করে রিচার্জ করুন।"}
                         </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                       <button 
                         onClick={() => {setShowConfirmCard(false); setErrorMessage("");}}
                         className="p-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                       >
                         No, Cancel
                       </button>
                       <button 
                         onClick={processBalancePurchase}
                         disabled={submitting || profileBalance < selectedOffer.price}
                         className={`p-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${profileBalance < selectedOffer.price ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
                       >
                         {submitting ? "Processing..." : <>Confirm <FaCheckCircle/></>}
                       </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentRow({ icon, label, val }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-blue-100 transition-all">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-blue-50 transition-colors">{icon}</div>
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-sm font-black text-slate-800 tracking-tight">{val}</p>
        </div>
      </div>
      <button 
        onClick={handleCopy}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm'}`}
      >
        {copied ? <FaCheckCircle /> : <FaCopy />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}