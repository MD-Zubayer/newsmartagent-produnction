"use client";

import { useState } from "react";
import { KeyIcon, ArrowLeftIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("https://newsmartagent.com/api/forgot-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMsg(data.message || "Password reset link sent!");
      } else {
        setMsg(data.error || "Unable to send reset link.");
      }
    } catch (err) {
      setMsg("Server error. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
      <div className="max-w-md w-full">
        {/* Back to Login Link */}
        <Link 
          href="/signup" 
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-indigo-600 mb-8 transition-colors group"
        >
          <ArrowLeftIcon className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Login
        </Link>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden"
        >
          {/* Decorative Background Element */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[3rem] -z-10 transition-all"></div>

          {/* Icon & Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-indigo-200">
              <KeyIcon className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">
              Forgot Password?
            </h2>
            <p className="text-gray-500 text-sm mt-2 font-medium">
              আপনার ইমেইলটি দিন, আমরা আপনাকে পাসওয়ার্ড রিসেট করার একটি লিঙ্ক পাঠিয়ে দেব।
            </p>
          </div>

          <div className="space-y-6">
            <div className="relative">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <EnvelopeIcon className="h-5 w-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </div>

          {/* Message Area */}
          {msg && (
            <div className={`mt-6 p-4 rounded-xl text-sm font-bold text-center ${
              msg.includes("sent") ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}>
              {msg}
            </div>
          )}
        </form>

        {/* Support Footer */}
        <p className="mt-8 text-center text-gray-400 text-xs font-bold">
          সাহায্যের প্রয়োজন? আমাদের <Link href="/contact" className="text-indigo-600 hover:underline">সাপোর্ট টিমে</Link> যোগাযোগ করুন।
        </p>
      </div>
    </div>
  );
}
