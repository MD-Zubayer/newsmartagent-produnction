"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { 
  FaMobileAlt, FaHashtag, FaCopy, FaCheckCircle, FaChevronLeft,
  FaWallet, FaArrowRight, FaInfoCircle, FaUniversity, FaFacebookMessenger 
} from "react-icons/fa";
import toast from "react-hot-toast";
import Link from "next/link";

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const offerId = searchParams.get("offer_id");

  const [offer, setOffer] = useState(null);
  const [profileBalance, setProfileBalance] = useState(0);
  const [tranId, setTranId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!offerId) {
      router.push("/dashboard/offers");
      return;
    }

    async function loadData() {
      try {
        const [offerRes, meRes] = await Promise.all([
          api.get(`/offers/${offerId}/`),
          api.get("/users/me/")
        ]);
        setOffer(offerRes.data);
        setProfileBalance(meRes.data?.profile?.acount_balance || 0);
      } catch (err) {
        toast.error("Failed to load checkout details.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [offerId, router]);

  // ১. ব্যালেন্স পেমেন্টের জন্য ভেরিফিকেশন পেজে পাঠানো
  const handleBalancePurchaseClick = () => {
    if (profileBalance < offer.price) {
      return toast.error("Insufficient balance in your account!");
    }
    // সরাসরি ভেরিফিকেশন পেজে পাঠিয়ে দেওয়া
    router.push(`/dashboard/offer-payment-verify?offer_id=${offer.id}`);
  };

  // ২. ম্যানুয়াল পেমেন্ট (Bkash/Nagad)
  const handleManualPayment = async () => {
    if (!tranId) return toast.error("Please enter Transaction ID");
    setSubmitting(true);
    const lt = toast.loading("Submitting ID...");
    try {
      await api.post("/payments/", { 
        offer_id: offer.id, 
        transaction_id: tranId,
        amount: offer.price 
      });
      toast.success("Submitted! Admin will verify soon.", { id: lt });
      router.push("/dashboard");
    } catch (err) {
      toast.error("Submission failed.", { id: lt });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase tracking-widest">Securing Connection...</div>;

  if (!offer) return (
    <div className="p-20 text-center">
      <FaInfoCircle className="mx-auto text-slate-200 mb-4" size={50} />
      <p className="font-black text-slate-400 uppercase tracking-widest leading-none">Checkout instance not found</p>
      <Link href="/dashboard/offers" className="text-blue-600 text-[10px] font-black uppercase underline mt-8 block tracking-widest">Back to Offers</Link>
    </div>
  );

  return (
    <div className="py-12 px-4 max-w-lg mx-auto">
      <Link href="/dashboard/offers" className="inline-flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase mb-8 hover:text-blue-600 transition-all">
        <FaChevronLeft /> Back to Offers
      </Link>

      <div className="bg-white rounded-[3.5rem] p-8 md:p-12 shadow-2xl border border-slate-50 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-600/5 rounded-full"></div>

        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3 hover:rotate-0 transition-transform">
            <FaWallet size={30} />
          </div>
          <h2 className="text-4xl font-black italic uppercase leading-tight text-slate-900">৳{offer.price}</h2>
          <p className="text-blue-600 text-[10px] font-black mt-2 uppercase tracking-[0.2em] italic">
            Plan: {offer.name || `${offer.tokens} Tokens`}
          </p>
        </div>

        {/* 🔹 Option 01: Balance Purchase Button */}
        <div className="mb-10">
          <button 
            onClick={handleBalancePurchaseClick}
            className="w-full p-6 bg-blue-50 border-2 border-dashed border-blue-200 rounded-[2.5rem] flex items-center justify-between group hover:bg-blue-600 hover:border-blue-600 transition-all shadow-sm"
          >
            <div className="flex items-center gap-4 text-left">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-all">
                <FaWallet size={20}/>
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-400 group-hover:text-blue-100 uppercase tracking-widest leading-none mb-1">Verify & Pay</p>
                <p className="text-sm font-black text-slate-800 group-hover:text-white">Profile Balance: ৳{profileBalance}</p>
              </div>
            </div>
            <FaArrowRight className="text-blue-200 group-hover:text-white" />
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-10">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
          <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]"><span className="bg-white px-4 text-slate-300">OR Manual Transfer</span></div>
        </div>

        {/* 🔹 Option 02: Manual Payment */}
        <div className="space-y-3 mb-10">
          <PaymentRow icon={<FaMobileAlt className="text-[#D12053]"/>} label="bKash (Personal)" val="01326277782" />
          <PaymentRow icon={<FaMobileAlt className="text-[#F7941D]"/>} label="Nagad (Personal)" val="01326277782" />

          {/* 🏦 Premium Bank Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white border border-slate-700/50 mt-6">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-blue-400 border border-white/10 shadow-inner">
                  <FaUniversity size={20}/>
               </div>
               <div>
                  <h3 className="text-sm font-black uppercase tracking-tight italic">Bank Transfer</h3>
                  <p className="text-[8px] font-black text-blue-300 uppercase tracking-widest leading-none">Premium Settlement</p>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-3 relative z-10">
              <BankDetailItem label="Bank Name" value="Dutch-Bangla Bank" isCopyable />
              <BankDetailItem label="Account Holder" value="MD JONAYED" isCopyable />
              <BankDetailItem label="Account Number" value="1811580389470" isCopyable />
              <BankDetailItem label="Card Number" value="4840 6100 2281 7706" isCopyable />
            </div>
          </div>
        </div>

        {/* Manual Input Section */}
        <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Manual Transaction ID</label>
          <div className="relative">
            <FaHashtag className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              className="w-full p-5 pl-12 bg-white rounded-2xl border-2 border-transparent focus:border-blue-600 outline-none font-bold text-slate-800"
              placeholder="Enter ID here..."
              value={tranId}
              onChange={(e) => setTranId(e.target.value)}
            />
          </div>
          <button 
            onClick={handleManualPayment}
            disabled={submitting}
            className="w-full mt-4 p-6 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] hover:bg-blue-600 transition-all shadow-xl"
          >
            {submitting ? "Processing..." : "Submit Transaction"}
          </button>
        </div>
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
    <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/5 group hover:bg-white/10 transition-all flex items-center justify-between">
      <div>
        <p className="text-[7px] font-black text-blue-300 uppercase tracking-widest mb-0.5 leading-none">{label}</p>
        <p className="text-[11px] font-bold tracking-wider text-white truncate max-w-[150px]">{value}</p>
      </div>
      {isCopyable && (
        <button onClick={handleCopy} className={`p-1.5 rounded-lg transition-colors ${copied ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
          {copied ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
        </button>
      )}
    </div>
  );
}

// কপি ফাংশনালিটি সহ রো কম্পোনেন্ট
function PaymentRow({ icon, label, val }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-blue-100 transition-all">
      <div className="flex items-center gap-4 text-left">
        <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-blue-50 transition-colors">{icon}</div>
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
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