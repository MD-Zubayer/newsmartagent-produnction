"use client";

import { useState, Suspense } from "react";
import axios from "axios";
import { useSearchParams, useRouter } from "next/navigation";

// ১. লজিক এবং ফর্মের জন্য আলাদা কম্পোনেন্ট
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      alert("Invalid reset link. Token missing.");
      return;
    }
    if (!password || !confirmPassword) {
      alert("Both password fields are required");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1/api/reset-password/", {
        token,
        new_password: password,
      });
      alert(res.data.message || "Password reset successfully!");
      router.push("/signup");
    } catch (err) {
      alert(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
        Reset Password
      </h1>
      <p className="text-center text-gray-500 mb-6">
        Enter your new password below
      </p>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4 text-black"
      />

      <input
        type="password"
        placeholder="Confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-6 text-black"
      />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200"
      >
        {loading ? "Resetting..." : "Reset Password"}
      </button>

      <div className="mt-4 text-center">
        <button
          onClick={() => router.push("/signup")}
          className="text-indigo-600 hover:underline"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

// ২. মেইন এক্সপোর্ট কম্পোনেন্ট যা Suspense ব্যবহার করবে
export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500">
      <Suspense fallback={
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center">
          <p className="text-gray-600">Loading reset form...</p>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}