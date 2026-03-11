"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { FaLock, FaEnvelopeOpenText, FaChevronLeft, FaShieldAlt, FaCheckCircle } from "react-icons/fa";
import toast from "react-hot-toast";
import Link from "next/link";

export default function PaymentVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const offerId = searchParams.get("offer_id");

  const [offer, setOffer] = useState(null);
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  useEffect(() => {
    if (!offerId) router.push("/dashboard/offers");
    api.get(`/offers/${offerId}/`).then(res => setOffer(res.data)).catch(() => router.push("/dashboard/offers"));
  }, [offerId, router]);

  // OTP পাঠানোর ফাংশন
  const sendOtp = async () => {
    setSendingOtp(true);
    try {
      await api.post("/send-payment-otp/");
      toast.success("Verification code sent to your email!");
    } catch (err) {
      toast.error("Failed to send code. Try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  // ফাইনাল পেমেন্ট কনফার্মেশন
  const handleFinalVerify = async (e) => {
    e.preventDefault();
    if (!password || !otpCode) return toast.error("All fields are required!");

    setSubmitting(true);
    const lt = toast.loading("Verifying security details...");

    try {
      const res = await api.post("/payments/", {
        offer_id: offerId,
        payment_type: "subscription",
        amount: offer.price,
        status: "paid",
        transaction_id: "BALANCE_PURCHASE",
        password: password,
        otp_code: otpCode
      });
      
      toast.success("Payment Successful!", { id: lt });
      router.push(`/dashboard/payment-success?payment_id=${res.data.payment_id}`); // আপনার সাকসেস পেজ
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid Password or Code.";
      toast.error(msg, { id: lt });
    } finally {
      setSubmitting(false);
    }
  };

  if (!offer) return <div className="p-20 text-center font-black animate-pulse text-slate-400">LOADING SECURITY...</div>;

  return (
    <div className="py-12 px-4 max-w-md mx-auto min-h-screen flex flex-col justify-center">
      <Link href={`/dashboard/payment?offer_id=${offerId}`} className="inline-flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase mb-8 hover:text-blue-600 transition-all">
        <FaChevronLeft /> Back to Checkout
      </Link>

      <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-2xl border border-slate-50 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-600/5 rounded-full"></div>
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-slate-900 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3">
            <FaShieldAlt size={28} />
          </div>
          <h2 className="text-2xl font-black italic uppercase text-slate-900 leading-none">Security Check</h2>
          <p className="text-slate-400 text-[9px] font-black mt-3 uppercase tracking-widest italic">
            Confirming ৳{offer.price} from your balance
          </p>
        </div>

        <form onSubmit={handleFinalVerify} className="space-y-6">
  {/* Password Input */}
  <div className="group space-y-2">
    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-widest flex items-center gap-2">
      <FaLock className="text-blue-500 text-[10px]" /> Account Password
    </label>
    <div className="relative overflow-hidden">
      <input 
        type="password"
        required
        className="w-full p-4 pl-12 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50/50 outline-none font-bold text-slate-800 transition-all shadow-sm"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <FaLock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
    </div>
  </div>

  {/* OTP Input with Integrated Send Button */}
  <div className="group space-y-2">
    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-widest flex items-center gap-2">
      <FaEnvelopeOpenText className="text-blue-500 text-[10px]" /> Verification Code
    </label>
    <div className="relative flex items-center bg-slate-50 rounded-2xl border-2 border-slate-100 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50/50 transition-all shadow-sm">
      {/* Icon */}
      <FaEnvelopeOpenText className="absolute left-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
      
      {/* Input */}
      <input 
        type="text"
        required
        maxLength={6}
        className="w-full p-4 pl-12 pr-32 bg-transparent outline-none font-bold text-slate-800 tracking-[0.4em] text-lg"
        placeholder="000000"
        value={otpCode}
        onChange={(e) => setOtpCode(e.target.value)}
      />

      {/* Dynamic Send Button Inside Input */}
      <button 
        type="button"
        onClick={sendOtp}
        disabled={sendingOtp}
        className={`absolute right-2 px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all
          ${sendingOtp 
            ? "bg-slate-200 text-slate-500 cursor-not-allowed" 
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 active:scale-95"
          }`}
      >
        {sendingOtp ? (
          <span className="flex items-center gap-1">
            <svg className="animate-spin h-3 w-3 text-slate-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Sending
          </span>
        ) : "Send Code"}
      </button>
    </div>
    <p className="text-[9px] text-slate-400 ml-2 italic">Check your email for the 6-digit verification code.</p>
  </div>

  {/* Submit Button */}
  <button 
    type="submit"
    disabled={submitting}
    className="w-full p-5 bg-slate-900 text-white rounded-2xl font-bold uppercase text-[11px] tracking-[0.3em] shadow-lg hover:bg-blue-600 hover:shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 flex justify-center items-center gap-2"
  >
    {submitting ? (
      <>
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        Verifying...
      </>
    ) : (
      "Confirm & Pay Now"
    )}
  </button>
</form>
        <p className="text-[9px] text-center text-slate-300 font-bold mt-8 uppercase tracking-tighter italic">
           Your IP and device info are being logged for security.
        </p>
      </div>
    </div>
  );
}