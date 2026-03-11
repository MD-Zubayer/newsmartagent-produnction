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

        <form onSubmit={handleFinalVerify} className="space-y-5">
          {/* Password Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Account Password</label>
            <div className="relative">
              <FaLock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="password"
                required
                className="w-full p-5 pl-12 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none font-bold text-slate-800 transition-all shadow-inner"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* OTP Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Code</label>
                <button 
                    type="button"
                    onClick={sendOtp}
                    disabled={sendingOtp}
                    className="text-[9px] font-black text-blue-600 uppercase hover:underline disabled:opacity-50"
                >
                    {sendingOtp ? "Sending..." : "Send Code"}
                </button>
            </div>
            <div className="relative">
              <FaEnvelopeOpenText className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="text"
                required
                className="w-full p-5 pl-12 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none font-bold text-slate-800 tracking-[0.5em] text-center shadow-inner"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className="w-full p-6 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-blue-100 hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50 mt-4"
          >
            {submitting ? "Verifying..." : "Complete Payment"}
          </button>
        </form>

        <p className="text-[9px] text-center text-slate-300 font-bold mt-8 uppercase tracking-tighter italic">
           Your IP and device info are being logged for security.
        </p>
      </div>
    </div>
  );
}