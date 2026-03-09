// /home/md-zubayer/newsmartagent/production/nextjs/app/(dashboard)/dashboard/offer-payment/page.jsx
"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { FaWallet, FaMobileAlt, FaHashtag, FaCheckCircle } from "react-icons/fa";
import toast from "react-hot-toast";

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const offerId = searchParams.get("offer_id");
  const [offer, setOffer] = useState(null);
  const [tranId, setTranId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (offerId) api.get(`/offers/${offerId}/`).then(res => setOffer(res.data));
  }, [offerId]);

  const handleManualPayment = async () => {
    if (!tranId) return toast.error("Please enter Transaction ID");
    setLoading(true);
    try {
      await api.post("/payments/", { offer_id: offerId, transaction_id: tranId });
      toast.success("Payment submitted! Admin will verify soon.");
      window.location.href = "/dashboard";
    } catch (err) { toast.error("Submission failed."); }
    finally { setLoading(false); }
  };

  if (!offer) return <div className="p-20 text-center font-black italic">Loading Payment...</div>;

  return (
    <div className="py-12 px-4 max-w-lg mx-auto">
      <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-slate-50 text-center">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <FaWallet size={30} />
        </div>
        <h2 className="text-3xl font-black italic uppercase italic">Pay ৳{offer.price}</h2>
        <p className="text-slate-400 text-[10px] font-black mt-2 uppercase tracking-widest italic">Plan: {offer.tokens} Tokens</p>

        <div className="mt-10 space-y-3">
          <PaymentOption label="bKash (Personal)" number="01326277782" />
          <PaymentOption label="Nagad (Personal)" number="01326277782" />
        </div>

        <div className="mt-10 pt-10 border-t border-slate-50">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Input Transaction ID</label>
          <input 
            className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-600 outline-none font-bold text-center"
            placeholder="TXN-XXXXXX"
            value={tranId}
            onChange={(e) => setTranId(e.target.value)}
          />
          <button 
            onClick={handleManualPayment}
            disabled={loading}
            className="w-full mt-4 p-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            {loading ? "Processing..." : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentOption({ label, number }) {
  return (
    <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center border border-slate-100">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{label}</span>
      <span className="font-black text-slate-800 tracking-tighter">{number}</span>
    </div>
  );
}