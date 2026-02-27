"use client";

import { useState, useEffect, useRef } from "react";
// ✅ আপনার আগের আইকনগুলোর সাথে বটের জন্য FaRobot, FaPaperPlane, FaTimes যুক্ত করা হয়েছে
import { 
  FaEye, FaEyeSlash, FaUser, FaLock, FaEnvelope, 
  FaPhone, FaArrowLeft, FaFingerprint, FaKey, 
  FaCheckCircle, FaExclamationCircle, FaRobot, FaPaperPlane, FaTimes 
} from "react-icons/fa";
import { useRouter } from "next/navigation";

// --- ১. ফোন এবং কান্ট্রি ফ্লাগ প্যাকেজ ইম্পোর্ট ---
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css'; 

import api from '../../lib/api';

export default function AuthPage() {
  const router = useRouter();
  const [showSignUp, setShowSignUp] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const[passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alert, setAlert] = useState({show: false, message: "", type: ""});

  // --- ২. ডিফল্ট কান্ট্রি স্টেট (অটো ডিটেকশনের জন্য) ---
  const [defaultCountry, setDefaultCountry] = useState("BD");

  const createdByOptions =[
    { label: "Self", value: "self" },
    { label: "Agent", value: "agent" },
  ];

  const idTypeOptions =[
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

  // ================= AI BOT CHAT STATES =================
  const [showBotModal, setShowBotModal] = useState(false);
  const[chatMessages, setChatMessages] = useState([]);
  const [currentChatField, setCurrentChatField] = useState("name");
  const [chatInput, setChatInput] = useState("");
  const[chatInputType, setChatInputType] = useState("text");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
  },[])

  let alertTimer;
  const showAlert = (message, type = 'error') => {
    if (alertTimer) clearTimeout(alertTimer);
    setAlert({show: true, message, type});
    alertTimer = setTimeout(() => {
      setAlert({show: false, message: "", type: ""});
    }, 5000)
  };

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        await api.post("/token/verify/"); 
        router.push("/dashboard");
      } catch (err) {}
    };
    checkUserStatus();
  }, [router]);

  // ================= আপনার অরিজিনাল ফাংশনগুলো =================
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "password" || name === "confirmPassword") {
        setPasswordError(
          updated.password !== updated.confirmPassword ? "Passwords do not match!" : ""
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
      const msg = errorData ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData) : "Login failed!";
      showAlert(msg, "error");
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    if (passwordError) return;

    if (formData.phone_number && !isValidPhoneNumber(formData.phone_number)) {
      showAlert("Invalid phone number format!", "error");
      return
    }

    try {
      const res = await api.post("/users/create_user/", { ...formData });
      if (res.status === 201 || res.status === 200) {
        setIsRegistered(true); 
        showAlert("Account created! Verify email.", "success");
      }
    } catch (err) {
      const errorData = err.response?.data;
      const msg = errorData ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData) : "Signup failed!";
      showAlert(msg, "error");
    }
  };

  // ================= AI BOT CHAT SUBMIT (এখানে API Call যুক্ত করা হয়েছে) =================
  const startBotChat = () => {
    setShowBotModal(true);
    setChatMessages([{ sender: "bot", text: "হ্যালো! আমি আপনার অ্যাকাউন্ট তৈরি করে দিবো। প্রথমে আপনার পুরো নামটি লিখুন।" }]);
    setCurrentChatField("name");
    setChatInputType("text");
    setChatInput(formData.name || "");
  };

  const handleChatSubmit = async (e) => {
    if(e) e.preventDefault();
    if (!chatInput && currentChatField !== 'created_by' && currentChatField !== 'id_type') return;

    // Validation
    if (currentChatField === 'phone_number' && !isValidPhoneNumber(chatInput)) {
      setChatMessages(prev =>[...prev, { sender: "user", text: chatInput }, { sender: "bot", text: "ফোন নম্বরটি সঠিক নয়!  সঠিক নম্বর দিন ।" }]);
      return;
    }
    if (currentChatField === 'confirmPassword' && chatInput !== formData.password) {
      setChatMessages(prev =>[...prev, { sender: "user", text: "********" }, { sender: "bot", text: "পাসওয়ার্ড মেলেনি! দয়া করে কনফার্ম পাসওয়ার্ডটি আবার লিখুন।" }]);
      setChatInput("");
      return;
    }

    // Update Form Data in background
    const valToSave = chatInput;
    const updatedFormData = { ...formData, [currentChatField]: valToSave };
    setFormData(updatedFormData);
    
    const displayMsg = (currentChatField === "password" || currentChatField === "confirmPassword") ? "********" : valToSave;
    const newMessages =[...chatMessages, { sender: "user", text: displayMsg }];

    let nextField = ""; let nextMsg = ""; let nextType = "text";

    switch(currentChatField) {
      case "name": nextField = "phone_number"; nextMsg = "দারুণ! এবার আপনার ফোন নম্বরটি দিন:"; nextType = "phone"; break;
      case "phone_number": nextField = "email"; nextMsg = "আপনার ইমেইল অ্যাড্রেসটি লিখুন:"; nextType = "email"; break;
      case "email": nextField = "division"; nextMsg = "আপনি কোন বিভাগে থাকেন?"; nextType = "text"; break;
      case "division": nextField = "district"; nextMsg = "আপনার জেলার নাম কী?"; nextType = "text"; break;
      case "district": nextField = "upazila"; nextMsg = "আপনার উপজেলার নাম লিখুন:"; nextType = "text"; break;
      case "upazila": nextField = "created_by"; nextMsg = "অআপনি যদি নিজের থেকেই একাউন্ট খুলে থাকেন তাহলে Self সিলেক্ট করবেন।  আর যদি কোনো এজেন্ট এর মাধ্যমে খুলে থাকেন তাহেলে  Agent সিলেক্ট করবেন। (Self / Agent)"; nextType = "select_created_by"; break;
      case "created_by": nextField = "id_type"; nextMsg = "আপনার ID Type সিলেক্ট করুন:"; nextType = "select_id_type"; break;
      case "id_type":
        if (updatedFormData.created_by === "agent") {
          nextField = "man_agent_unique_id"; nextMsg = "এজেন্ট ID (Agent Unique ID) দিন:"; nextType = "text";
        } else {
          nextField = "password"; nextMsg = "অ্যাকাউন্টের জন্য একটি গোপন পাসওয়ার্ড দিন:"; nextType = "password";
        }
        break;
      case "man_agent_unique_id": nextField = "man_agent_otp_key"; nextMsg = "এজেন্ট OTP Key দিন:"; nextType = "text"; break;
      case "man_agent_otp_key": nextField = "password"; nextMsg = "অ্যাকাউন্টের জন্য একটি গোপন পাসওয়ার্ড দিন:"; nextType = "password"; break;
      case "password": nextField = "confirmPassword"; nextMsg = "পাসওয়ার্ডটি আবার লিখে নিশ্চিত করুন:"; nextType = "password"; break;
      
      // ✅ FINAL STEP: DIRECT BOT API CALL
      case "confirmPassword":
        setChatMessages([...newMessages, { sender: "bot", text: "সব তথ্য পাওয়া গেছে! আপনার অ্যাকাউন্ট তৈরি করা হচ্ছে... দয়া করে অপেক্ষা করুন। আপনার ইমেইল চেক করুন, আমরা আপনার ইমেইলে verify link পাঠাবো, সেই লিংকে ক্লিক করে verify করুন।" }]);
        setCurrentChatField("done");
        setChatInputType("none");
        
        try {
          // বট নিজে থেকেই API Call করছে
          const res = await api.post("/users/create_user/", { ...updatedFormData });
          if (res.status === 201 || res.status === 200) {
            setIsRegistered(true); 
            setShowBotModal(false); // Modal বন্ধ করে দেওয়া হচ্ছে
            showAlert("Account created! Verify email.", "success");
          }
        } catch (err) {
          const errorData = err.response?.data;
          const msg = errorData ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData) : "Signup failed!";
          showAlert(msg, "error");
          setChatMessages(prev =>[...prev, { sender: "bot", text: `দুঃখিত, সমস্যা হয়েছে: ${msg}` }]);
          setCurrentChatField("confirmPassword"); // ফেইল করলে আবার পাসওয়ার্ড দিতে বলবে
          setChatInputType("password");
        }
        return; 
    }

    setChatMessages([...newMessages, { sender: "bot", text: nextMsg }]);
    setCurrentChatField(nextField);
    setChatInputType(nextType);
    
    // Set default value for select inputs
    if (nextType === "select_created_by") setChatInput(createdByOptions[0].value);
    else if (nextType === "select_id_type") setChatInput(idTypeOptions[0].value);
    else setChatInput("");
  };

  // UI Utility Classes
  const inputGroup = "relative flex items-center group";
  const iconBase = "absolute left-4 transition-all duration-300 z-10";
  const iconStyle = `${iconBase} text-gray-400 group-focus-within:text-indigo-500 group-focus-within:scale-110`;
  const inputStyle = "w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-gray-700 font-medium placeholder:text-gray-400 shadow-sm";
  const btnPrimary = "w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-2xl shadow-[0_10px_20px_rgba(79,70,229,0.3)] active:scale-[0.97] transition-all duration-200 mt-2";

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-50 via-white to-purple-50 py-28 relative overflow-hidden">

      <style jsx global>{`
        .PhoneInput {
          display: flex; align-items: center; width: 100%; padding: 0.2rem 1rem;
          background: rgba(249,250,251,0.5); border: 1px solid #f3f4f6; border-radius: 1rem; transition: all 0.3s;
        }
        .PhoneInput:focus-within {
          background: white; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }
        .PhoneInputInput {
          outline: none; background: transparent; border: none; width: 100%;
          font-weight: 500; font-size: 16px; color: #374151; padding: 0.8rem 0;
        }
        .PhoneInputCountry { margin-right: 0.75rem; }

        /* Bot Chat Scrollbar */
        .chat-scroll::-webkit-scrollbar { width: 6px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 10px; }
      `}</style>

      {/* --- সম্পূর্ণ মোবাইল রেসপন্সিভ অ্যালার্ট --- */}
      {alert.show && (
        <div className="fixed top-4 md:top-8 left-1/2 -translate-x-1/2 z-[1000] w-[95%] sm:w-[90%] max-w-md animate-in slide-in-from-top-4">
          <div className={`relative overflow-hidden bg-white border-2 p-4 md:py-5 md:px-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.12)] flex items-center gap-3 md:gap-4 ${
            alert.type === "success" ? "border-emerald-100" : "border-rose-100"
          }`}>
            <div className={`absolute bottom-0 left-0 h-1 md:h-1.5 animate-progress ${alert.type === "success" ? "bg-emerald-500" : "bg-rose-500"}`}></div>
            <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl shrink-0 animate-bounce shadow-inner ${alert.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              {alert.type === "success" ? <FaCheckCircle className="h-5 w-5 md:h-6 md:w-6" /> : <FaExclamationCircle className="h-5 w-5 md:h-6 md:w-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 md:mb-1 ${alert.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
                {alert.type === "success" ? "Success" : "Error"}
              </h4>
              <p className="text-[12px] md:text-[14px] font-bold text-slate-800 tracking-tight leading-tight truncate-2-lines">{alert.message}</p>
            </div>
            <button onClick={() => setAlert({ ...alert, show: false })} className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all p-1.5 md:p-2 rounded-full shrink-0">
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200/30 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-lg bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-6 sm:p-12 border border-white/50 relative z-10">
        
        {isRegistered ? (
          <div className="text-center animate-in zoom-in duration-500">
             <div className="inline-block p-4 rounded-3xl bg-green-600 text-white shadow-xl mb-6">
                <FaEnvelope size={28} />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Check Your Email</h1>
              <p className="text-gray-500 font-medium px-4 mb-8">
                আমরা আপনার <b>{formData.email}</b> ঠিকানায় একটি ভেরিফিকেশন লিঙ্ক পাঠিয়েছি। দয়া করে ইনবক্স চেক করুন।
              </p>
              <button className="text-indigo-600 font-extrabold hover:underline" onClick={() => { setIsRegistered(false); setShowSignUp(false); }}>
                Back to Login
              </button>
          </div>
        ) : (
          <>
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

            {!showSignUp ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <form className="space-y-5" onSubmit={handleLoginSubmit}>
                  <div className={inputGroup}>
                    <FaEnvelope className={iconStyle} />
                    <input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} className={inputStyle} required />
                  </div>
                  <div className={inputGroup}>
                    <FaLock className={iconStyle} />
                    <input name="password" type={showPassword ? "text" : "password"} placeholder="Password" value={formData.password} onChange={handleChange} className={inputStyle} required />
                    <button type="button" className="absolute right-4 text-gray-400 hover:text-indigo-600" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <button className={btnPrimary}>Continue to Dashboard</button>
                  <div className="mt-8 space-y-4 text-center">
                    <span className="text-sm text-indigo-600 font-bold hover:text-indigo-800 transition-colors cursor-pointer" onClick={() => router.push("/forgot-password")}>Reset Password?</span>
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500 font-medium">New here? <button type="button" className="text-indigo-600 font-extrabold hover:underline" onClick={() => setShowSignUp(true)}>Create Account</button></p>
                    </div>
                  </div>
                </form>
              </div>
            ) : (

              // ================= আপনার অরিজিনাল SIGN UP ফর্ম =================
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <form className="space-y-4" onSubmit={handleSignUpSubmit}>
                  <div className={inputGroup}>
                    <FaUser className={iconStyle} />
                    <input name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} className={inputStyle} required />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="relative">
                      <PhoneInput
                        international
                        defaultCountry={defaultCountry}
                        value={formData.phone_number}
                        onChange={(val) => setFormData(prev => ({...prev, phone_number: val}))}
                        onCountryChange={(country) => setFormData(prev => ({...prev, country: country}))}
                        placeholder="Phone Number"
                        className="custom-phone-class"
                      />
                    </div>
                    <div className={inputGroup}>
                      <FaEnvelope className={iconStyle} />
                      <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} className={inputStyle} required />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <input name="division" placeholder="Division" value={formData.division} onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-indigo-400 text-xs font-semibold transition-all" />
                    <input name="district" placeholder="District" value={formData.district} onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-indigo-400 text-xs font-semibold transition-all" />
                    <input name="upazila" placeholder="Upazila" value={formData.upazila} onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-indigo-400 text-xs font-semibold transition-all" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <select name="created_by" value={formData.created_by} onChange={handleChange} className={`${inputStyle} pl-4 pr-10 appearance-none`} required>
                      <option value="">Created By</option>
                      {createdByOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                    <select name="id_type" value={formData.id_type} onChange={handleChange} className={`${inputStyle} pl-4 pr-10 appearance-none`} required>
                      <option value="">ID Type</option>
                      {idTypeOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>

                  {formData.created_by === "agent" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                      <div className={inputGroup}>
                        <FaFingerprint className={iconStyle} />
                        <input name="man_agent_unique_id" placeholder="Agent ID" value={formData.man_agent_unique_id} onChange={handleChange} className={inputStyle} required />
                      </div>
                      <div className={inputGroup}>
                        <FaKey className={iconStyle} />
                        <input name="man_agent_otp_key" placeholder="OTP Key" value={formData.man_agent_otp_key} onChange={handleChange} className={inputStyle} required />
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className={inputGroup}>
                      <FaLock className={iconStyle} />
                      <input type={showPassword ? "text" : "password"} name="password" placeholder="Create Password" value={formData.password} onChange={handleChange} className={inputStyle} required />
                      <button type="button" className="absolute right-4 text-gray-400 hover:text-indigo-600" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>

                    <div className={inputGroup}>
                      <FaLock className={iconStyle} />
                      <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} className={inputStyle} required />
                      <button type="button" className="absolute right-4 text-gray-400 hover:text-indigo-600" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <p className="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded-lg border border-red-100 animate-pulse">{passwordError}</p>
                  )}

                  <button className={btnPrimary}>Register Account</button>

                  <button type="button" className="w-full text-center text-sm font-bold text-gray-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 pt-2" onClick={() => setShowSignUp(false)}>
                    <FaArrowLeft size={12} /> Already have an account? Login
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================= FLOATING AI BUTTON ================= */}
      {showSignUp && !isRegistered && !showBotModal && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500 flex flex-col items-end">
          <div className="bg-white px-4 py-3 rounded-2xl shadow-xl border border-indigo-100 text-sm font-bold text-indigo-800 mb-3 relative animate-bounce mr-2">
            আমি তোমার অ্যাকাউন্ট তৈরি করে দিবো! ✨
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white rotate-45 border-b border-r border-indigo-100"></div>
          </div>
          <button onClick={startBotChat} className="relative group w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-[0_10px_25px_rgba(79,70,229,0.5)] hover:scale-110 transition-transform duration-300">
            <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-30"></div>
            <FaRobot size={30} className="relative z-10" />
          </button>
        </div>
      )}

      {/* ================= AI BOT CHAT MODAL ================= */}
      {showBotModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col h-[600px] max-h-[90vh] animate-in zoom-in-95 duration-300">
             
             <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between text-white shadow-md z-10">
               <div className="flex items-center gap-3">
                 <div className="bg-white/20 p-2 rounded-full"><FaRobot size={24} /></div>
                 <div>
                   <h3 className="font-bold text-lg leading-tight">AI Assistant</h3>
                   <p className="text-xs text-indigo-100 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Online</p>
                 </div>
               </div>
               <button onClick={() => setShowBotModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                 <FaTimes size={18} />
               </button>
             </div>

             <div className="flex-1 overflow-y-auto chat-scroll p-4 space-y-4 bg-gray-50/50">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] p-3.5 px-5 rounded-2xl text-sm font-medium shadow-sm ${
                      msg.sender === "user" ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none border border-gray-100"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
             </div>

             {currentChatField !== "done" && (
               <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-gray-100 flex gap-2">
                 <div className="flex-1 relative">
                   {chatInputType === "phone" ? (
                      <PhoneInput
                        international
                        defaultCountry={defaultCountry}
                        value={chatInput}
                        onChange={(val) => setChatInput(val || "")}
                        className="custom-phone-class bg-gray-50 border border-gray-200 rounded-xl px-2"
                      />
                   ) : chatInputType === "select_created_by" ? (
                      <select value={chatInput} onChange={(e)=>setChatInput(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium">
                        {createdByOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                   ) : chatInputType === "select_id_type" ? (
                      <select value={chatInput} onChange={(e)=>setChatInput(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium">
                        {idTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                   ) : (
                      <input
                        type={chatInputType === "password" ? "password" : chatInputType}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type here..."
                        className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                        autoFocus
                      />
                   )}
                 </div>
                 
                 <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center shrink-0">
                   <FaPaperPlane size={18} />
                 </button>
               </form>
             )}
          </div>
        </div>
      )}
    </div>
  );
}