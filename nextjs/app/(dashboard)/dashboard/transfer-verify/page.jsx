"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { FaLock, FaEnvelopeOpenText, FaChevronLeft, FaShieldAlt, FaExchangeAlt } from "react-icons/fa";
import toast from "react-hot-toast";
import Link from "next/link";

function TransferVerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const receiverId = searchParams.get("receiver_id");
  const amount = searchParams.get("amount");

  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  useEffect(() => {
    if (!receiverId || !amount) {
      router.push("/dashboard/payment");
    }
  }, [receiverId, amount, router]);

  // Transfer OTP পাঠানোর ফাংশন - /api/send-transfer-otp/ এন্ডপয়েন্ট ব্যবহার করছি
  const sendOtp = async () => {
    setSendingOtp(true);
    try {
      await api.post("/send-transfer-otp/");
      toast.success("Transfer verification code sent to your email!");
    } catch (err) {
      toast.error("Failed to send code. Try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  // ওটিপি কনফার্ম এবং ব্যালেন্স ট্রান্সফার
  const handleFinalVerify = async (e) => {
    e.preventDefault();
    if (!password || !otpCode) return toast.error("Password and OTP are required!");

    setSubmitting(true);
    const lt = toast.loading("Processing balance transfer...");

    try {
      await api.post("/transfer/", {
        receiver_unique_id: receiverId,
        amount: amount,
        password: password,
        otp_code: otpCode
      });
      
      toast.success("Transfer Successful!", { id: lt });
      // সাকসেস হলে ড্যাশবোর্ডে বা পেমেন্ট পেজে পাঠাচ্ছি
      router.push("/dashboard/payment"); 
      toast.success(`৳${amount} transferred to ${receiverId} successfully!`);
    } catch (err) {
      const msg = err.response?.data?.error || "Invalid Password or OTP Code.";
      toast.error(msg, { id: lt });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-12 px-4 max-w-md mx-auto min-h-screen flex flex-col justify-center">
      <Link href="/dashboard/payment" className="inline-flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase mb-8 hover:text-indigo-600 transition-all">
        <FaChevronLeft /> Back to Payment
      </Link>

      <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-2xl border border-slate-50 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-600/5 rounded-full"></div>
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-slate-900 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl -rotate-3">
            <FaShieldAlt size={28} />
          </div>
          <h2 className="text-2xl font-black italic uppercase text-slate-900 leading-none">Transfer Verify</h2>
          <div className="bg-slate-50 rounded-2xl p-4 mt-6 border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest italic mb-1">Sending Amount</p>
            <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-black text-slate-900">৳{amount}</span>
                <FaExchangeAlt className="text-indigo-500" />
                <span className="text-sm font-black text-indigo-600 uppercase">{receiverId}</span>
            </div>
          </div>
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
                className="w-full p-5 pl-12 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-800 transition-all shadow-inner"
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
                    className="text-[9px] font-black text-indigo-600 uppercase hover:underline disabled:opacity-50"
                >
                    {sendingOtp ? "Sending..." : "Send Code"}
                </button>
            </div>
            <div className="relative">
              <FaEnvelopeOpenText className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="text"
                required
                className="w-full p-5 pl-12 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-800 tracking-[0.5em] text-center shadow-inner"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className="w-full p-6 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50 mt-4"
          >
            {submitting ? "Verifying..." : "Confirm Transfer"}
          </button>
        </form>

        <p className="text-[9px] text-center text-slate-300 font-bold mt-8 uppercase tracking-tighter italic">
           Transactions are protected by end-to-end encryption.
        </p>
      </div>
    </div>
  );
}

export default function TransferVerifyPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase tracking-widest">Loading Security...</div>}>
      <TransferVerifyContent />
    </Suspense>
  );
}
