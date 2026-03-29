"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "../../../../lib/api";

export default function MobileApprovalPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const action = searchParams.get("action"); // 'approve' or 'reject'

  const [status, setStatus] = useState("processing"); // processing, success, error
  const [message, setMessage] = useState("Processing your request...");

  useEffect(() => {
    if (!token || !action) {
      setStatus("error");
      setMessage("Invalid approval link. Please try logging in again.");
      return;
    }

    const processApproval = async () => {
      try {
        const res = await api.get(`/auth/approve-login/?token=${token}&action=${action}`);
        setStatus(action === "approve" ? "success" : "rejected");
        setMessage(res.data.message || "Request handled successfully.");
      } catch (err) {
        setStatus("error");
        setMessage(err.response?.data?.error || "Link expired or invalid.");
      }
    };

    processApproval();
  }, [token, action]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center">
        {status === "processing" && (
          <div className="py-10 animate-pulse">
            <div className="w-16 h-16 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6"></div>
            <h2 className="text-xl font-bold text-gray-800">Verifying...</h2>
            <p className="text-gray-500 mt-2">{message}</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-8">
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Approved!</h2>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 mt-4">You can now close this window and go back to your computer.</p>
          </div>
        )}

        {status === "rejected" && (
          <div className="py-8">
            <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Blocked</h2>
            <p className="text-gray-600">{message}</p>
            <div className="mt-8">
              <Link href="/forgot-password" className="inline-block bg-red-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-red-700 w-full">
                Reset Password Now
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="py-8">
            <div className="w-20 h-20 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Action Failed</h2>
            <p className="text-gray-600">{message}</p>
            <div className="mt-8 text-sm">
              <Link href="/login" className="text-blue-600 font-bold hover:underline">
                Return to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
