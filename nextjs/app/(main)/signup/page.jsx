"use client";

import { useState, useEffect } from "react";
// import { FaEye, FaEyeSlash, FaUser, FaLock, FaEnvelope, FaPhone, FaArrowLeft, FaFingerprint, FaKey } from "react-icons/fa";
import { FaEye, FaEyeSlash, FaUser, FaLock, FaEnvelope, FaPhone, FaArrowLeft, FaFingerprint, FaKey, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { useRouter } from "next/navigation";

// --- ১. ফোন এবং কান্ট্রি ফ্লাগ প্যাকেজ ইম্পোর্ট ---

import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css'; 


import api from '../../lib/api';

export default function AuthPage() {
  const router = useRouter();
  const [showSignUp, setShowSignUp] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false); // ✅ নতুন স্টেট (মেসেজ দেখানোর জন্য)
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alert, setAlert] = useState({show: false, message: "", type: ""})

  // --- ২. ডিফল্ট কান্ট্রি স্টেট (অটো ডিটেকশনের জন্য) ---
  const [defaultCountry, setDefaultCountry] = useState("BD");



  const createdByOptions = [
    { label: "Self", value: "self" },
    { label: "Agent", value: "agent" },
  ];

  const idTypeOptions = [
    { label: "Agent", value: "agent" },
    { label: "User", value: "user" },
  ];

  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    country: "",
    email: "",
    division: "",
    district: "",
    upazila: "",
    created_by: "",
    id_type: "",
    password: "",
    confirmPassword: "",
    man_agent_unique_id: "",
    man_agent_otp_key: "",
  });
  // --- ৩. অটো কান্ট্রি ডিটেকশন (IP API দিয়ে) ---
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((res) => res.json())
      .then((data) => {
        if (data.country_code) {
          setDefaultCountry(data.country_code);
          setFormData(prev => ({ ...prev, country: data.country_code}));
        }
      })
      .catch(() => console.log("IP detection failed, defaulting to BD"));
  }, [])



  let alertTimer;

  const showAlert = (message, type = 'error') => {

    if (alertTimer) clearTimeout(alertTimer);
    setAlert({show: true, message, type});
    alertTimer = setTimeout(() => {

      setAlert({show: false, message: "", type: ""});
    }, 5000)
  };

  // ✅ Check if user is already logged in
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        await api.post("/token/verify/"); 
        router.push("/dashboard");
      } catch (err) {
     const errorData = err.response?.data;
    const msg = errorData 
      ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData)
      : "Signup failed!";
    
    // showAlert(msg, "error");
    }
    };
    checkUserStatus();
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "password" || name === "confirmPassword") {
        setPasswordError(
          updated.password !== updated.confirmPassword
            ? "Passwords do not match!"
            : ""
        );
      }
      return updated;
    });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const { email, password } = formData;
      const res = await api.post("/login/", { email, password });

      if (res.status === 200) {

        showAlert("Login Successful! Redirecting...", "success")
        router.push("/dashboard");
      } 
    } catch (err) {
     const errorData = err.response?.data;
    const msg = errorData 
      ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData)
      : "Signup failed!";
    
    showAlert(msg, "error");
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    if (passwordError) return;

    // --- ৪. ফোন নাম্বার ভ্যালিডেশন ---
    if (formData.phone_number && !isValidPhoneNumber(formData.phone_number)) {
      showAlert("Invalid phone number format!", "error");
      return
    }

    try {
      const res = await api.post("/users/create_user/", { ...formData });

      if (res.status === 201 || res.status === 200) {
        // ✅ অ্যালার্টের বদলে সাকসেস স্টেট সেট করা
        setIsRegistered(true); 
        showAlert("Account created! Verify email.", "success");
      }
    } catch (err) {
      const errorData = err.response?.data;
    const msg = errorData 
      ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData)
      : "Signup failed!";
    
    showAlert(msg, "error");

    }
  };

  // UI Utility Classes
  const inputGroup = "relative flex items-center group";
  const iconBase = "absolute left-4 transition-all duration-300 z-10";
  const iconStyle = `${iconBase} text-gray-400 group-focus-within:text-indigo-500 group-focus-within:scale-110`;
  const inputStyle =
    "w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-gray-700 font-medium placeholder:text-gray-400 shadow-sm";
  const btnPrimary =
    "w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-2xl shadow-[0_10px_20px_rgba(79,70,229,0.3)] active:scale-[0.97] transition-all duration-200 mt-2";

  return (

    
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-50 via-white to-purple-50 py-28">

      {/* --- ৫. ফোন ইনপুটের জন্য গ্লোবাল CSS (ডিজাইন ঠিক রাখার জন্য) --- */}
<style jsx global>{`
        .PhoneInput {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0.2rem 1rem;
          background: rgba(249,250,251,0.5); /* bg-gray-50/50 matching */
          border: 1px solid #f3f4f6; /* border-gray-100 matching */
          border-radius: 1rem; /* rounded-2xl matching */
          transition: all 0.3s;
        }
        .PhoneInput:focus-within {
          background: white;
          border-color: #6366f1; /* indigo-500 */
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }
        .PhoneInputInput {
          outline: none;
          background: transparent;
          border: none;
          width: 100%;
          font-weight: 500;
          font-size: 16px;
          color: #374151;
          padding: 0.8rem 0;
        }
        .PhoneInputCountry {
          margin-right: 0.75rem;
        }
      `}</style>


{/* --- সম্পূর্ণ মোবাইল রেসপন্সিভ অ্যালার্ট --- */}
{alert.show && (
  <div className="fixed top-4 md:top-8 left-1/2 -translate-x-1/2 z-[1000] w-[95%] sm:w-[90%] max-w-md animate-alert-in">
    <div className={`relative overflow-hidden bg-white border-2 p-4 md:py-5 md:px-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.12)] flex items-center gap-3 md:gap-4 ${
      alert.type === "success" ? "border-emerald-100" : "border-rose-100"
    }`}>
      
      {/* প্রগ্রেস বার (নিচে) */}
      <div className={`absolute bottom-0 left-0 h-1 md:h-1.5 animate-progress ${
        alert.type === "success" ? "bg-emerald-500" : "bg-rose-500"
      }`}></div>

      {/* আইকন: মোবাইলে একটু ছোট করা হয়েছে */}
      <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl shrink-0 animate-bounce shadow-inner ${
        alert.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}>
        {alert.type === "success" 
          ? <FaCheckCircle className="h-5 w-5 md:h-6 md:w-6" /> 
          : <FaExclamationCircle className="h-5 w-5 md:h-6 md:w-6" />
        }
      </div>
      
      {/* টেক্সট এরিয়া */}
      <div className="flex-1 min-w-0">
        <h4 className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 md:mb-1 ${
          alert.type === "success" ? "text-emerald-600" : "text-rose-600"
        }`}>
          {alert.type === "success" ? "Success" : "Error"}
        </h4>
        <p className="text-[12px] md:text-[14px] font-bold text-slate-800 tracking-tight leading-tight truncate-2-lines">
          {alert.message}
        </p>
      </div>

      {/* ক্লোজ বাটন: মোবাইলে টাচ সুবিধার্থে ছোট কিন্তু ক্লিকেবল */}
      <button 
        onClick={() => setAlert({ ...alert, show: false })} 
        className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all p-1.5 md:p-2 rounded-full shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
)}
      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200/30 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-lg bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-6 sm:p-12 border border-white/50 relative z-10">
        
        {/* ✅ যদি রেজিস্ট্রেশন হয়ে যায়, তবে এই ভিউটি দেখাবে */}
        {isRegistered ? (
          <div className="text-center animate-in zoom-in duration-500">
             <div className="inline-block p-4 rounded-3xl bg-green-600 text-white shadow-xl mb-6">
                <FaEnvelope size={28} />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Check Your Email</h1>
              <p className="text-gray-500 font-medium px-4 mb-8">
                আমরা আপনার <b>{formData.email}</b> ঠিকানায় একটি ভেরিফিকেশন লিঙ্ক পাঠিয়েছি। দয়া করে ইনবক্স চেক করুন।
              </p>
              <button 
                className="text-indigo-600 font-extrabold hover:underline"
                onClick={() => { setIsRegistered(false); setShowSignUp(false); }}
              >
                Back to Login
              </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-block p-4 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 mb-6 animate-bounce-slow">
                <FaLock size={28} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                {showSignUp ? "Create Account" : "Secure Login"}
              </h1>
              <p className="text-gray-500 mt-3 font-medium px-4">
                {showSignUp ? "Join our community today" : "Access your workspace"}
              </p>
            </div>

            {/* Login / Signup */}
            {!showSignUp ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <form className="space-y-5" onSubmit={handleLoginSubmit}>
                  <div className={inputGroup}>
                    <FaEnvelope className={iconStyle} />
                    <input
                      name="email"
                      type="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={handleChange}
                      className={inputStyle}
                      required
                    />
                  </div>

                  <div className={inputGroup}>
                    <FaLock className={iconStyle} />
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleChange}
                      className={inputStyle}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-4 text-gray-400 hover:text-indigo-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>

                  <button className={btnPrimary}>Continue to Dashboard</button>

                  <div className="mt-8 space-y-4 text-center">
                    <span
                      className="text-sm text-indigo-600 font-bold hover:text-indigo-800 transition-colors cursor-pointer"
                      onClick={() => router.push("/forgot-password")}
                    >
                      Reset Password?
                    </span>
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500 font-medium">
                        New here?{" "}
                        <button
                          className="text-indigo-600 font-extrabold hover:underline"
                          onClick={() => setShowSignUp(true)}
                        >
                          Create Account
                        </button>
                      </p>
                    </div>
                  </div>
                </form>
              </div>
            ) : (

              // --- Sign Up Form (Updated with Phone Input) ---

              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <form className="space-y-4" onSubmit={handleSignUpSubmit}>
                  {/* Name */}
                  <div className={inputGroup}>
                    <FaUser className={iconStyle} />
                    <input
                      name="name"
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={handleChange}
                      className={inputStyle}
                      required
                    />
                  </div>


                     {/* --- ৬. ফোন ইনপুট এবং ইমেইল সেকশন আপডেট --- */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* PhoneInput ব্যবহার করা হয়েছে */}
                    <div className="relative">
                      <PhoneInput
                        international
                        defaultCountry={defaultCountry}
                        value={formData.phone_number}
                        onChange={(val) => setFormData(prev => ({...prev, phone_number: val}))}
                        onCountryChange={(country) => setFormData(prev => ({...prev, country: country}))}
                        placeholder="Phone Number"
                        className="custom-phone-class" // Global CSS দিয়ে স্টাইল করা হয়েছে
                      />
                    </div>
                    
                    <div className={inputGroup}>
                      <FaEnvelope className={iconStyle} />
                      <input
                        name="email"
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        className={inputStyle}
                        required
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      name="division"
                      placeholder="Division"
                      value={formData.division}
                      onChange={handleChange}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-indigo-400 text-xs font-semibold transition-all"
                    />
                    <input
                      name="district"
                      placeholder="District"
                      value={formData.district}
                      onChange={handleChange}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-indigo-400 text-xs font-semibold transition-all"
                    />
                    <input
                      name="upazila"
                      placeholder="Upazila"
                      value={formData.upazila}
                      onChange={handleChange}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-indigo-400 text-xs font-semibold transition-all"
                    />
                  </div>

                  {/* Selects */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <select
                      name="created_by"
                      value={formData.created_by}
                      onChange={handleChange}
                      className={`${inputStyle} pl-4 pr-10 appearance-none`}
                      required
                    >
                      <option value="">Created By</option>
                      {createdByOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      name="id_type"
                      value={formData.id_type}
                      onChange={handleChange}
                      className={`${inputStyle} pl-4 pr-10 appearance-none`}
                      required
                    >
                      <option value="">ID Type</option>
                      {idTypeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ✅ Conditional Agent Inputs (When Created By is Agent) */}
                  {formData.created_by === "agent" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                      <div className={inputGroup}>
                        <FaFingerprint className={iconStyle} />
                        <input
                          name="man_agent_unique_id"
                          placeholder="Agent ID"
                          value={formData.man_agent_unique_id}
                          onChange={handleChange}
                          className={inputStyle}
                          required
                        />
                      </div>
                      <div className={inputGroup}>
                        <FaKey className={iconStyle} />
                        <input
                          name="man_agent_otp_key"
                          placeholder="OTP Key"
                          value={formData.man_agent_otp_key}
                          onChange={handleChange}
                          className={inputStyle}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div className="space-y-4">
                    <div className={inputGroup}>
                      <FaLock className={iconStyle} />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Create Password"
                        value={formData.password}
                        onChange={handleChange}
                        className={inputStyle}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-4 text-gray-400 hover:text-indigo-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>

                    <div className={inputGroup}>
                      <FaLock className={iconStyle} />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="Confirm Password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={inputStyle}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-4 text-gray-400 hover:text-indigo-600"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <p className="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded-lg border border-red-100 animate-pulse">
                      {passwordError}
                    </p>
                  )}

                  <button className={btnPrimary}>Register Account</button>

                  <button
                    type="button"
                    className="w-full text-center text-sm font-bold text-gray-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 pt-2"
                    onClick={() => setShowSignUp(false)}
                  >
                    <FaArrowLeft size={12} /> Already have an account? Login
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}