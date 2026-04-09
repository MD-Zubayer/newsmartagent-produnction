"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../lib/api";

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [otpCode, setOtpCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  
  // Auth States: 'password' | 'email_otp' | 'mobile_approval' | 'recovery_code' | 'try_another_way'
  const [viewState, setViewState] = useState("password"); 
  const [availableMethods, setAvailableMethods] = useState([]);
  const [sessionToken, setSessionToken] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const pollIntervalRef = useRef(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleInitialLogin = async (e, requestedMethod = 'mobile_approval') => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/login/", {
        email: formData.email,
        password: formData.password,
        auth_method: requestedMethod
      });

      if (res.status === 200) {
        if (res.data.two_factor_required) {
          setViewState(res.data.auth_method === 'mobile_approval' ? 'mobile_approval' : 'email_otp');
          setAvailableMethods(res.data.available_methods || ['email_otp', 'mobile_approval', 'recovery_code']);
          
          if (res.data.auth_method === 'mobile_approval' && res.data.session_token) {
            setSessionToken(res.data.session_token);
            startPolling(res.data.session_token);
          }
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || "Login failed!");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (token) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/auth/session-status/?session_token=${token}`);
        if (res.data.status === 'approved') {
          clearInterval(pollIntervalRef.current);
          router.push('/dashboard');
        } else if (res.data.status === 'rejected') {
          clearInterval(pollIntervalRef.current);
          setError("Login request blocked! Please reset your password if this wasn't you.");
          setViewState('password');
        } else if (res.data.status === 'expired') {
          clearInterval(pollIntervalRef.current);
          setError("Login request expired. Please try again.");
          setViewState('password');
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleVerify2FA = async (e, methodToVerify) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLoading(true);
    setError("");

    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        auth_method: methodToVerify,
        code: otpCode,
        trust_device: trustDevice
      };

      const res = await api.post("/auth/2fa/verify/", payload);
      if (res.status === 200) {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Invalid verification code!");
    } finally {
      setLoading(false);
    }
  };

  // Sync trustDevice state to LoginSession for Mobile Approval
  useEffect(() => {
    if (viewState === 'mobile_approval' && sessionToken) {
        api.post(`/auth/session-status/`, {
            session_token: sessionToken,
            trust_device: trustDevice
        }).catch(() => {});
    }
  }, [trustDevice, viewState, sessionToken]);

  const handleTryAnotherWay = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setViewState('try_another_way');
    setError("");
  };

  const selectMethod = (method) => {
    if (method === 'mobile_approval' || method === 'email_otp') {
      handleInitialLogin(null, method);
    } else {
      setViewState(method);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans text-black">
      <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">
            {viewState === 'password' ? "Welcome Back" : 
             viewState === 'try_another_way' ? "Choose how to sign in" :
             "2-Step Verification"}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {viewState === 'password' && "Log in securely to your dashboard"}
            {viewState === 'email_otp' && `Enter the 6-digit code sent to your email.`}
            {viewState === 'mobile_approval' && `Check your Mobile (Email/WhatsApp) and tap "Yes, it's me".`}
            {viewState === 'recovery_code' && "Enter one of your 8-digit backup codes."}
          </p>
        </div>

        {viewState === 'password' && (
          <form method="POST" onSubmit={(e) => handleInitialLogin(e, 'mobile_approval')} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <input
                name="email" type="email" required value={formData.email} onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <input
                name="password" type="password" required value={formData.password} onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg text-center font-bold">{error}</div>}

            <button type="submit" disabled={loading} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}>
              {loading ? "Verifying..." : "Login"}
            </button>
          </form>
        )}

        {viewState === 'mobile_approval' && (
          <div className="space-y-6 text-center">
            <div className="py-8">
              <div className="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center animate-pulse mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Check your device</h3>
              <p className="text-gray-500 text-sm">We sent a notification to your Email and WhatsApp. Tap <strong>Yes, it's me</strong> to sign in.</p>
            </div>
            
            <div className="flex items-center mt-4 mb-4">
              <input type="checkbox" id="trustDevice" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
              <label htmlFor="trustDevice" className="ml-2 block text-sm text-gray-900">Don't ask again on this device (30 days)</label>
            </div>

            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg text-center font-bold mb-4">{error}</div>}

            <button onClick={handleTryAnotherWay} className="text-blue-600 font-bold text-sm hover:underline mt-6">
              Try another way
            </button>
          </div>
        )}

        {['email_otp', 'recovery_code'].includes(viewState) && (
          <form method="POST" onSubmit={(e) => handleVerify2FA(e, viewState)} className="space-y-6">
            <div>
              <input
                name="otp" type="text" required value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center text-3xl font-black tracking-[8px]"
                placeholder={viewState === 'email_otp' ? "000000" : "8-DIGIT-CODE"}
                maxLength={viewState === 'email_otp' ? 6 : 8}
              />
            </div>

            <div className="flex items-center mt-4">
              <input type="checkbox" id="trustDeviceOtp" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
              <label htmlFor="trustDeviceOtp" className="ml-2 block text-sm text-gray-900">Don't ask again on this device</label>
            </div>

            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg text-center font-bold">{error}</div>}

            <button type="submit" disabled={loading} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${loading ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}>
              {loading ? "Verifying..." : "Verify & Login"}
            </button>

            <div className="text-center mt-6">
              <button type="button" onClick={handleTryAnotherWay} className="text-blue-600 font-bold text-sm hover:underline">
                Try another way
              </button>
            </div>
          </form>
        )}

        {viewState === 'try_another_way' && (
          <div className="space-y-3">
            {availableMethods.includes('mobile_approval') && (
              <button onClick={() => selectMethod('mobile_approval')} className="w-full p-4 border rounded-xl flex items-center hover:bg-gray-50 transition">
                <span className="text-2xl mr-4">📱</span>
                <div className="text-left"><p className="font-bold text-gray-900">Check your phone</p><p className="text-xs text-gray-500">Tap "Yes" on the prompt sent to you</p></div>
              </button>
            )}
            {availableMethods.includes('email_otp') && (
              <button onClick={() => selectMethod('email_otp')} className="w-full p-4 border rounded-xl flex items-center hover:bg-gray-50 transition">
                <span className="text-2xl mr-4">✉️</span>
                <div className="text-left"><p className="font-bold text-gray-900">Get a verification code</p><p className="text-xs text-gray-500">Code will be sent to your Email/WhatsApp</p></div>
              </button>
            )}
            {availableMethods.includes('recovery_code') && (
              <button onClick={() => selectMethod('recovery_code')} className="w-full p-4 border rounded-xl flex items-center hover:bg-gray-50 transition">
                <span className="text-2xl mr-4">🔑</span>
                <div className="text-left"><p className="font-bold text-gray-900">Enter 8-digit backup code</p><p className="text-xs text-gray-500">Use one of your saved recovery codes</p></div>
              </button>
            )}
            
            <button onClick={() => setViewState('password')} className="w-full p-4 text-sm font-bold text-gray-500 hover:text-gray-700 mt-4">
              Cancel
            </button>
          </div>
        )}

        {viewState === 'password' && (
          <div className="mt-8 text-center text-sm text-gray-600 space-y-2">
            <div><Link href="/forgot-password" className="text-indigo-600 font-bold hover:underline">Forgot password?</Link></div>
            <div>Don't have an account? <Link href="/signup" className="text-blue-600 font-bold hover:underline">Create an account</Link></div>
          </div>
        )}
      </div>
    </div>
  );
}
