"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [msg, setMsg] = useState("Verifying your email...");

  useEffect(() => {
    if (token) {
      api.post("users/verify-email/", { token })
        .then(() => {
          setStatus("success");
          setMsg("Verification successful! Redirecting...");
          setTimeout(() => { window.location.href = "/dashboard"; }, 2000);
        })
        .catch((err) => {
          setStatus("error");
          setMsg(err.response?.data?.error || "Verification failed.");
        });
    } else {
        setStatus("error");
        setMsg("No token found in URL.");
    }
  }, [token]);

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-sm w-full">
      {status === "loading" && <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>}
      <h2 className={`text-xl font-bold ${status === 'error' ? 'text-red-500' : 'text-gray-800'}`}>
        {status === "success" ? "Success!" : status === "error" ? "Error" : "Verifying..."}
      </h2>
      <p className="text-gray-600 mt-2">{msg}</p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}