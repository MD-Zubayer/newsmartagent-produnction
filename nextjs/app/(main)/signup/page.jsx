"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import {
  FaEye, FaEyeSlash, FaUser, FaLock, FaEnvelope,
  FaPhone, FaArrowLeft, FaFingerprint, FaKey,
  FaCheckCircle, FaExclamationCircle, FaRobot, FaPaperPlane, FaTimes,
  FaStore, FaMapMarkerAlt, FaShieldAlt
} from "react-icons/fa";
import { useRouter, useSearchParams } from "next/navigation";
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

import api from '../../lib/api';

// SVG Google Icon
function GoogleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode: "signup" | "login" | "onboarding"
  const [mode, setMode] = useState("signup");
  const [isRegistered, setIsRegistered] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: "", type: "" });
  const [is2FARequired, setIs2FARequired] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Referral code from URL (?ref=... or ?agent_id=...)
  const [referralCode, setReferralCode] = useState("");

  // Country & Location States
  const [defaultCountry, setDefaultCountry] = useState("BD");
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState("");

  // Google Sign-in ref & client id
  const googleBtnRef = useRef(null);
  const [googleClientId, setGoogleClientId] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    country: "BD",
    email: "",
    shop_name: "",
    district: "",
    upazila: "",
    password: "",
    confirmPassword: "",
    man_agent_unique_id: "",
  });

  // Onboarding Form State (for Google signups needing profile completion)
  const [onboardingData, setOnboardingData] = useState({
    name: "",
    phone_number: "",
    shop_name: "",
    district: "",
    upazila: "",
    password: "",
    confirm_password: "",
  });

  // ================= AI BOT CHAT STATES =================
  const [showBotModal, setShowBotModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentChatField, setCurrentChatField] = useState("name");
  const [chatInput, setChatInput] = useState("");
  const [chatInputType, setChatInputType] = useState("text");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Read referral query param
  useEffect(() => {
    const ref = searchParams.get("ref") || searchParams.get("agent_id") || searchParams.get("ref_code") || searchParams.get("agent");
    if (ref) {
      setReferralCode(ref);
      setFormData(prev => ({ ...prev, man_agent_unique_id: ref }));
    }
  }, [searchParams]);

  // IP Location detection
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((res) => res.json())
      .then((data) => {
        if (data.country_code) {
          setDefaultCountry(data.country_code);
          setFormData(prev => ({ ...prev, country: data.country_code }));
        }
      })
      .catch(() => console.log("IP detection fallback to BD"));
  }, []);

  // Fetch Cities (Districts) from Courier DB
  useEffect(() => {
    api.get("courier/cities/")
      .then(res => {
        if (Array.isArray(res.data)) {
          const sorted = [...res.data].sort((a, b) => a.city_name.localeCompare(b.city_name));
          setCities(sorted);
        }
      })
      .catch(err => console.log("Failed to load districts:", err));
  }, []);

  // Fetch Zones (Upazilas/Thanas) when City changes
  const handleDistrictSelect = (cityId, cityName, isOnboarding = false) => {
    setSelectedCityId(cityId);
    if (isOnboarding) {
      setOnboardingData(prev => ({ ...prev, district: cityName, upazila: "" }));
    } else {
      setFormData(prev => ({ ...prev, district: cityName, upazila: "" }));
    }

    if (!cityId) {
      setZones([]);
      return;
    }

    setLoadingZones(true);
    api.get(`courier/zones/?city_id=${cityId}`)
      .then(res => {
        if (Array.isArray(res.data)) {
          const sorted = [...res.data].sort((a, b) => a.zone_name.localeCompare(b.zone_name));
          setZones(sorted);
        }
      })
      .catch(err => console.log("Failed to load zones:", err))
      .finally(() => setLoadingZones(false));
  };

  let alertTimer;
  const showAlert = (message, type = 'error') => {
    if (alertTimer) clearTimeout(alertTimer);
    setAlert({ show: true, message, type });
    alertTimer = setTimeout(() => {
      setAlert({ show: false, message: "", type: "" });
    }, 5000);
  };

  // Check already logged in status
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        await api.post("/token/verify/");
        window.location.href = "/dashboard";
      } catch (err) { }
    };
    checkUserStatus();
  }, []);

  // ================= GOOGLE IDENTITY SERVICES SETUP =================
  const handleGoogleCredentialResponse = async (response) => {
    if (!response.credential) return;
    setGoogleLoading(true);
    try {
      const res = await api.post("users/google-auth/", {
        credential: response.credential,
        ref_code: referralCode || undefined
      });

      if (res.status === 200) {
        if (res.data.is_new_user === false || res.data.profile_completed === true) {
          // Existing user -> Go straight to dashboard!
          showAlert("লগইন সফল হয়েছে! ড্যাশবোর্ডে প্রবেশ করা হচ্ছে...", "success");
          setTimeout(() => { window.location.href = "/dashboard"; }, 400);
        } else if (res.data.is_team_member) {
          // Team member: only ask for Name if they want to confirm/edit it, or go straight to dashboard!
          setMode("team_onboarding");
          setOnboardingData(prev => ({
            ...prev,
            name: res.data.user?.name || "",
          }));
          showAlert("টিম অ্যাকাউন্ট সংযুক্ত হয়েছে! শুধু আপনার নাম নিশ্চিত করুন।", "success");
        } else {
          // Brand new user needs onboarding (phone, shop name, district, thana)
          setMode("onboarding");
          setOnboardingData(prev => ({
            ...prev,
            name: res.data.user?.name || "",
            phone_number: res.data.user?.phone_number || "",
            district: res.data.user?.district || "",
            upazila: res.data.user?.upazila || "",
          }));
          showAlert("গুগল অ্যাকাউন্ট সংযুক্ত হয়েছে! অনুগ্রহ করে শপ ও কুরিয়ার তথ্য সম্পন্ন করুন।", "success");
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || "গুগল সাইন আপ ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।";
      showAlert(errorMsg, "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (!googleClientId) {
      api
        .get("/settings/public/")
        .then((res) => {
          if (res.data?.google_client_id) {
            setGoogleClientId(res.data.google_client_id);
          }
        })
        .catch(() => {});
    }
  }, [googleClientId]);

  useEffect(() => {
    const clientId = googleClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (googleBtnRef.current) {
            googleBtnRef.current.innerHTML = "";
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: "outline",
              size: "large",
              width: "100%",
              text: "signup_with",
              shape: "pill",
              logo_alignment: "left"
            });
          }
        } catch (e) {
          console.warn("Google identity init notice:", e);
        }
      }
    };

    if (!window.google?.accounts?.id) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else {
      initGoogle();
    }
  }, [mode, googleClientId]);

  const triggerGooglePrompt = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If One Tap is suppressed, click standard rendered button
          const btn = googleBtnRef.current?.querySelector('div[role="button"]');
          if (btn) btn.click();
        }
      });
    }
  };

  // ================= FORM CHANGE HANDLERS =================
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "password" || name === "confirmPassword") {
        setPasswordError(
          updated.password && updated.confirmPassword && updated.password !== updated.confirmPassword
            ? "Passwords do not match!"
            : ""
        );
      }
      return updated;
    });
  };

  const handleOnboardingChange = (e) => {
    const { name, value } = e.target;
    setOnboardingData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === "password" || name === "confirm_password") {
        setPasswordError(
          updated.password && updated.confirm_password && updated.password !== updated.confirm_password
            ? "Passwords do not match!"
            : ""
        );
      }
      return updated;
    });
  };

  // ================= EMAIL SIGNUP SUBMIT =================
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    if (passwordError) return;

    if (formData.phone_number && !isValidPhoneNumber(formData.phone_number)) {
      showAlert("সঠিক আন্তর্জাতিক মোবাইল নম্বর দিন!", "error");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone_number: formData.phone_number,
        country: formData.country || defaultCountry,
        district: formData.district,
        upazila: formData.upazila,
        password: formData.password,
        id_type: 'user', // Defaults seamlessly
        created_by: referralCode ? 'agent' : 'self',
        man_agent_unique_id: referralCode || formData.man_agent_unique_id || undefined,
      };

      const res = await api.post("users/create_user/", payload);
      if (res.status === 201 || res.status === 200) {
        setIsRegistered(true);
        showAlert("অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! ইমেইল ভেরিফাই করুন।", "success");
      }
    } catch (err) {
      const errorData = err.response?.data;
      const msg = errorData ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData) : "সাইন আপ ব্যর্থ হয়েছে!";
      showAlert(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // ================= TEAM MEMBER 1-STEP NAME SUBMIT =================
  const handleTeamOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (!onboardingData.name?.trim()) {
      showAlert("অনুগ্রহ করে আপনার নাম লিখুন!", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("users/complete-onboarding/", {
        name: onboardingData.name.trim(),
      });
      if (res.status === 200) {
        showAlert("স্বাগতম! ড্যাশবোর্ডে প্রবেশ করা হচ্ছে...", "success");
        setTimeout(() => { window.location.href = "/dashboard"; }, 500);
      }
    } catch (err) {
      showAlert("নাম সংরক্ষণ করতে সমস্যা হয়েছে!", "error");
    } finally {
      setLoading(false);
    }
  };

  // ================= GOOGLE ONBOARDING SUBMIT =================
  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (passwordError) return;

    if (onboardingData.phone_number && !isValidPhoneNumber(onboardingData.phone_number)) {
      showAlert("সঠিক আন্তর্জাতিক মোবাইল নম্বর দিন!", "error");
      return;
    }

    if (!onboardingData.district || !onboardingData.upazila) {
      showAlert("কুরিয়ার ডেলিভারির জন্য জেলা ও থানা নির্বাচন করুন!", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("users/complete-onboarding/", {
        phone_number: onboardingData.phone_number,
        shop_name: onboardingData.shop_name,
        district: onboardingData.district,
        upazila: onboardingData.upazila,
        password: onboardingData.password || undefined,
        confirm_password: onboardingData.confirm_password || undefined,
      });

      if (res.status === 200) {
        showAlert("প্রোফাইল সেটআপ সম্পন্ন হয়েছে! রিডাইরেক্ট করা হচ্ছে...", "success");
        setTimeout(() => { window.location.href = "/dashboard"; }, 600);
      }
    } catch (err) {
      const errorData = err.response?.data;
      const msg = errorData ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData) : "সেটআপ ব্যর্থ হয়েছে!";
      showAlert(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // ================= LOGIN SUBMIT =================
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { email, password } = formData;
      const res = await api.post("/login/", { email, password });
      if (res.status === 200) {
        if (res.data.status === "2fa_required") {
          setIs2FARequired(true);
          showAlert("Verification code sent to your email", "success");
        } else {
          showAlert("Login Successful! Redirecting...", "success");
          window.location.href = "/dashboard";
        }
      }
    } catch (err) {
      const errorData = err.response?.data;
      const msg = errorData ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData) : "Login failed!";
      showAlert(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { email, password } = formData;
      const res = await api.post("/auth/2fa/verify/", {
        email,
        password,
        otp_code: otpCode
      });
      if (res.status === 200) {
        showAlert("Verified! Redirecting...", "success");
        window.location.href = "/dashboard";
      }
    } catch (err) {
      const errorData = err.response?.data;
      const msg = errorData?.error || "Invalid verification code!";
      showAlert(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // ================= AI BOT CHAT FLOW =================
  const startBotChat = () => {
    setShowBotModal(true);
    setChatMessages([{ sender: "bot", text: "হ্যালো! আমি আপনার অ্যাকাউন্ট তৈরিতে সাহায্য করছি। প্রথমে আপনার পুরো নামটি লিখুন:" }]);
    setCurrentChatField("name");
    setChatInputType("text");
    setChatInput(formData.name || "");
  };

  const handleChatSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput) return;

    if (currentChatField === 'phone_number' && !isValidPhoneNumber(chatInput)) {
      setChatMessages(prev => [...prev, { sender: "user", text: chatInput }, { sender: "bot", text: "ফোন নম্বরটি সঠিক নয়! সঠিক কান্ট্রি কোড সহ নম্বর দিন।" }]);
      return;
    }
    if (currentChatField === 'confirmPassword' && chatInput !== formData.password) {
      setChatMessages(prev => [...prev, { sender: "user", text: "********" }, { sender: "bot", text: "পাসওয়ার্ড মেলেনি! পাসওয়ার্ডটি আবার লিখুন:" }]);
      setChatInput("");
      return;
    }

    const valToSave = chatInput;
    const updatedFormData = { ...formData, [currentChatField]: valToSave };
    setFormData(updatedFormData);

    const displayMsg = (currentChatField === "password" || currentChatField === "confirmPassword") ? "********" : valToSave;
    const newMessages = [...chatMessages, { sender: "user", text: displayMsg }];

    let nextField = ""; let nextMsg = ""; let nextType = "text";

    switch (currentChatField) {
      case "name": nextField = "phone_number"; nextMsg = "দারুণ! এবার আপনার মোবাইল নম্বরটি দিন:"; nextType = "phone"; break;
      case "phone_number": nextField = "email"; nextMsg = "আপনার ইমেইল অ্যাড্রেসটি লিখুন:"; nextType = "email"; break;
      case "email": nextField = "shop_name"; nextMsg = "আপনার শপ বা কোম্পানির নাম কী?"; nextType = "text"; break;
      case "shop_name": nextField = "district"; nextMsg = "আপনার জেলার নাম কী? (যেমন: Dhaka, Chittagong, Sylhet)"; nextType = "text"; break;
      case "district": nextField = "upazila"; nextMsg = "আপনার উপজেলার/থানার নাম লিখুন:"; nextType = "text"; break;
      case "upazila": nextField = "password"; nextMsg = "অ্যাকাউন্টের জন্য একটি গোপন পাসওয়ার্ড দিন:"; nextType = "password"; break;
      case "password": nextField = "confirmPassword"; nextMsg = "পাসওয়ার্ডটি আবার লিখে নিশ্চিত করুন:"; nextType = "password"; break;

      case "confirmPassword":
        setChatMessages([...newMessages, { sender: "bot", text: "সব তথ্য পাওয়া গেছে! অ্যাকাউন্ট তৈরি করা হচ্ছে... অনুগ্রহ করে আপনার ইমেইল চেক করে ভেরিফাই করুন।" }]);
        setCurrentChatField("done");
        setChatInputType("none");

        try {
          const res = await api.post("users/create_user/", {
            name: updatedFormData.name,
            email: updatedFormData.email,
            phone_number: updatedFormData.phone_number,
            district: updatedFormData.district,
            upazila: updatedFormData.upazila,
            password: updatedFormData.password,
            created_by: referralCode ? 'agent' : 'self',
            man_agent_unique_id: referralCode || undefined
          });
          if (res.status === 201 || res.status === 200) {
            setIsRegistered(true);
            setShowBotModal(false);
            showAlert("Account created! Check email to verify.", "success");
          }
        } catch (err) {
          const errorData = err.response?.data;
          const msg = errorData ? (typeof errorData === 'object' ? Object.values(errorData).flat().join(", ") : errorData) : "Signup failed!";
          showAlert(msg, "error");
          setChatMessages(prev => [...prev, { sender: "bot", text: `সমস্যা হয়েছে: ${msg}` }]);
          setCurrentChatField("confirmPassword");
          setChatInputType("password");
        }
        return;
    }

    setChatMessages([...newMessages, { sender: "bot", text: nextMsg }]);
    setCurrentChatField(nextField);
    setChatInputType(nextType);
    setChatInput("");
  };

  // UI Utility Classes
  const inputGroup = "relative flex items-center group";
  const iconBase = "absolute left-4 transition-all duration-300 z-10";
  const iconStyle = `${iconBase} text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-110`;
  const inputStyle = "w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all text-slate-800 text-sm font-medium placeholder:text-slate-400";
  const btnPrimary = "w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer";

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/60 via-slate-50 to-white py-20 relative overflow-hidden">

      <style jsx global>{`
        .PhoneInput {
          display: flex; align-items: center; width: 100%; padding: 0.15rem 0.85rem;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; transition: all 0.2s;
        }
        .PhoneInput:focus-within {
          background: #ffffff; border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
        }
        .PhoneInputInput {
          outline: none; background: transparent; border: none; width: 100%;
          font-weight: 500; font-size: 14px; color: #1e293b; padding: 0.65rem 0;
        }
        .PhoneInputCountry { margin-right: 0.5rem; }
        .chat-scroll::-webkit-scrollbar { width: 6px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 10px; }
      `}</style>

      {/* Responsive Toast Alert */}
      {alert.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[95%] sm:w-[90%] max-w-md animate-in slide-in-from-top-4">
          <div className={`relative overflow-hidden bg-white border-2 p-4 rounded-2xl shadow-xl flex items-center gap-3 ${alert.type === "success" ? "border-emerald-100" : "border-rose-100"
            }`}>
            <div className={`p-2 rounded-xl shrink-0 ${alert.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              {alert.type === "success" ? <FaCheckCircle className="h-5 w-5" /> : <FaExclamationCircle className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-[10px] font-black uppercase tracking-wider ${alert.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
                {alert.type === "success" ? "Success" : "Notice"}
              </h4>
              <p className="text-xs font-bold text-slate-800 leading-snug">{alert.message}</p>
            </div>
            <button onClick={() => setAlert({ ...alert, show: false })} className="text-slate-400 hover:text-slate-600 p-1">
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Background Ambient Glow */}
      <div className="fixed top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-200/25 rounded-full blur-[130px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-purple-200/25 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-lg bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-10 border border-slate-200/80 relative z-10">

        {/* Email verification screen */}
        {isRegistered ? (
          <div className="text-center py-4 animate-in zoom-in duration-300">
            <div className="inline-flex p-4 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 mb-5">
              <FaEnvelope size={32} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
              ইমেইল চেক করুন
            </h1>
            <p className="text-slate-600 font-medium text-sm px-2 mb-6 leading-relaxed">
              আমরা আপনার <b>{formData.email}</b> ঠিকানায় একটি অ্যাক্টিভেশন লিঙ্ক পাঠিয়েছি। লিংকে ক্লিক করে অ্যাকাউন্ট ভেরিফাই করুন।
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setIsRegistered(false); setMode("login"); }}
                className={btnPrimary}
              >
                লগইন পেজে যান
              </button>
            </div>
          </div>
        ) : mode === "team_onboarding" ? (
          /* ================= TEAM MEMBER 1-STEP NAME ONBOARDING ================= */
          <div className="animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100">
                <FaUser size={26} />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                টিম মেম্বার প্রোফাইল
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                গুগল দিয়ে সাইন-ইন সম্পন্ন হয়েছে! শুধু আপনার নামটি নিশ্চিত করে ড্যাশবোর্ডে প্রবেশ করুন
              </p>
            </div>

            <form onSubmit={handleTeamOnboardingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  আপনার নাম (চ্যাটে কাস্টমার ও টিম মেম্বাররা এই নাম দেখবে) *
                </label>
                <div className={inputGroup}>
                  <FaUser className={iconStyle} />
                  <input
                    name="name"
                    placeholder="যেমন: তানভীর আহমেদ"
                    value={onboardingData.name}
                    onChange={handleOnboardingChange}
                    className={inputStyle}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className={`${btnPrimary} mt-2`}>
                {loading ? "প্রবেশ করা হচ্ছে..." : "ড্যাশবোর্ডে প্রবেশ করুন"}
              </button>
            </form>
          </div>
        ) : mode === "onboarding" ? (

          /* ================= STEP 2: GOOGLE ONBOARDING FORM ================= */
          <div className="animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-indigo-50 text-indigo-600 mb-3 border border-indigo-100">
                <FaStore size={26} />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                শপ ও কুরিয়ার তথ্য সম্পন্ন করুন
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                আপনার প্রোডাক্ট ডেলিভারি ও কুরিয়ার সিঙ্কের জন্য নিচের তথ্যগুলো প্রয়োজন
              </p>
            </div>

            <form onSubmit={handleOnboardingSubmit} className="space-y-3.5">
              {/* Phone Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">মোবাইল নম্বর *</label>
                <PhoneInput
                  international
                  defaultCountry={defaultCountry}
                  value={onboardingData.phone_number}
                  onChange={(val) => setOnboardingData(prev => ({ ...prev, phone_number: val }))}
                  placeholder="01XXXXXXXXX"
                  className="custom-phone-class"
                />
              </div>

              {/* Shop / Company Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">শপ বা কোম্পানির নাম *</label>
                <div className={inputGroup}>
                  <FaStore className={iconStyle} />
                  <input
                    name="shop_name"
                    placeholder="e.g. My Style Boutique"
                    value={onboardingData.shop_name}
                    onChange={handleOnboardingChange}
                    className={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* District & Thana (from DB) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">জেলা (District) *</label>
                  <select
                    value={selectedCityId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      const cname = cities.find(c => String(c.city_id) === String(cid))?.city_name || "";
                      handleDistrictSelect(cid, cname, true);
                    }}
                    className={`${inputStyle} pl-3 cursor-pointer`}
                    required
                  >
                    <option value="">জেলা নির্বাচন করুন</option>
                    {cities.map(c => (
                      <option key={c.city_id} value={c.city_id}>{c.city_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    থানা/উপজেলা * {loadingZones && <span className="text-[10px] text-indigo-600 font-normal">(লোড হচ্ছে...)</span>}
                  </label>
                  <select
                    value={onboardingData.upazila}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, upazila: e.target.value }))}
                    disabled={!selectedCityId || loadingZones}
                    className={`${inputStyle} pl-3 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400`}
                    required
                  >
                    <option value="">থানা নির্বাচন করুন</option>
                    {zones.map(z => (
                      <option key={z.zone_id} value={z.zone_name}>{z.zone_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Password creation for direct login */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1">পাসওয়ার্ড সেট করুন (ভবিষ্যতে সরাসরি লগইনের জন্য)</label>
                <div className="space-y-2">
                  <div className={inputGroup}>
                    <FaLock className={iconStyle} />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                      value={onboardingData.password}
                      onChange={handleOnboardingChange}
                      className={inputStyle}
                    />
                    <button type="button" className="absolute right-3.5 text-slate-400 hover:text-indigo-600" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <div className={inputGroup}>
                    <FaLock className={iconStyle} />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirm_password"
                      placeholder="পাসওয়ার্ড নিশ্চিত করুন"
                      value={onboardingData.confirm_password}
                      onChange={handleOnboardingChange}
                      className={inputStyle}
                    />
                    <button type="button" className="absolute right-3.5 text-slate-400 hover:text-indigo-600" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
                {passwordError && (
                  <p className="text-rose-500 text-xs font-bold mt-1.5">{passwordError}</p>
                )}
              </div>

              <button type="submit" disabled={loading} className={`${btnPrimary} mt-4`}>
                {loading ? "সংরক্ষণ হচ্ছে..." : "সম্পূর্ণ করে ড্যাশবোর্ডে যান"}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {is2FARequired ? "Verify OTP" : mode === "signup" ? "অ্যাকাউন্ট খুলুন" : "স্বাগতম"}
              </h1>
              <p className="text-slate-500 mt-1 text-xs sm:text-sm font-medium">
                {is2FARequired
                  ? `Enter the 6-digit code sent to ${formData.email}`
                  : mode === "signup"
                    ? "সহজেই শুরু করুন আপনার এআই অটোমেশন বিজনেস"
                    : "আপনার অ্যাকাউন্টে প্রবেশ করুন"}
              </p>
              {referralCode && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                  <FaShieldAlt className="w-3 h-3 text-indigo-600" />
                  <span>Referred by Agent: <b>#{referralCode}</b></span>
                </div>
              )}
            </div>

            {/* 2FA Verification Form */}
            {is2FARequired ? (
              <form className="space-y-4" onSubmit={handleVerify2FA}>
                <div className={inputGroup}>
                  <FaFingerprint className={iconStyle} />
                  <input
                    name="otp"
                    type="text"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className={`${inputStyle} text-center tracking-[10px] text-2xl font-black text-indigo-600`}
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>
                <button className={btnPrimary} disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Continue"}
                </button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    className="text-xs text-slate-400 font-bold hover:text-indigo-600 transition-colors"
                    onClick={() => setIs2FARequired(false)}
                  >
                    <FaArrowLeft className="inline mr-1" /> Back to Login
                  </button>
                </div>
              </form>
            ) : mode === "login" ? (

              /* ================= LOGIN FORM ================= */
              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                {/* Google Sign In option */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={triggerGooglePrompt}
                    disabled={googleLoading}
                    className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer"
                  >
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </button>
                  <div ref={googleBtnRef} className="hidden" />
                </div>

                <div className="relative flex items-center justify-center py-2">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider absolute">বা ইমেইল দিয়ে</span>
                </div>

                <div className={inputGroup}>
                  <FaEnvelope className={iconStyle} />
                  <input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} className={inputStyle} required />
                </div>

                <div className={inputGroup}>
                  <FaLock className={iconStyle} />
                  <input name="password" type={showPassword ? "text" : "password"} placeholder="Password" value={formData.password} onChange={handleChange} className={inputStyle} required />
                  <button type="button" className="absolute right-3.5 text-slate-400 hover:text-indigo-600" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>

                <button className={btnPrimary} disabled={loading}>
                  {loading ? "Authenticating..." : "লগইন করুন"}
                </button>

                <div className="pt-3 text-center space-y-2">
                  <button type="button" onClick={() => router.push("/forgot-password")} className="text-xs text-indigo-600 font-bold hover:underline block mx-auto">
                    পাসওয়ার্ড ভুলে গেছেন?
                  </button>
                  <p className="text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
                    অ্যাকাউন্ট নেই?{" "}
                    <button type="button" onClick={() => setMode("signup")} className="text-indigo-600 font-bold hover:underline">
                      নতুন অ্যাকাউন্ট খুলুন
                    </button>
                  </p>
                </div>
              </form>
            ) : (

              /* ================= SIGN UP FORM ================= */
              <div className="space-y-4">
                {/* 1. PROMINENT GOOGLE SIGN UP BUTTON */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={triggerGooglePrompt}
                    disabled={googleLoading}
                    className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 hover:border-indigo-400 font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer"
                  >
                    <GoogleIcon className="w-5 h-5" />
                    <span>{googleLoading ? "কানেক্ট হচ্ছে..." : "Sign up with Google (গুগল দিয়ে সাইন আপ)"}</span>
                  </button>
                  <div ref={googleBtnRef} className="hidden" />
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center py-1">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider absolute">
                    অথবা ইমেইল দিয়ে সাইন আপ
                  </span>
                </div>

                {/* 2. REGULAR EMAIL SIGNUP FORM */}
                <form onSubmit={handleSignUpSubmit} className="space-y-3">
                  {/* Full Name */}
                  <div className={inputGroup}>
                    <FaUser className={iconStyle} />
                    <input name="name" placeholder="আপনার পুরো নাম" value={formData.name} onChange={handleChange} className={inputStyle} required />
                  </div>

                  {/* Phone & Email */}
                  <div>
                    <PhoneInput
                      international
                      defaultCountry={defaultCountry}
                      value={formData.phone_number}
                      onChange={(val) => setFormData(prev => ({ ...prev, phone_number: val }))}
                      placeholder="মোবাইল নম্বর"
                      className="custom-phone-class"
                    />
                  </div>

                  <div className={inputGroup}>
                    <FaEnvelope className={iconStyle} />
                    <input name="email" type="email" placeholder="ইমেইল অ্যাড্রেস" value={formData.email} onChange={handleChange} className={inputStyle} required />
                  </div>

                  {/* District & Thana (from DB) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <select
                        value={selectedCityId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          const cname = cities.find(c => String(c.city_id) === String(cid))?.city_name || "";
                          handleDistrictSelect(cid, cname, false);
                        }}
                        className={`${inputStyle} pl-3 text-xs cursor-pointer`}
                        required
                      >
                        <option value="">জেলা সিলেক্ট করুন</option>
                        {cities.map(c => (
                          <option key={c.city_id} value={c.city_id}>{c.city_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={formData.upazila}
                        onChange={(e) => setFormData(prev => ({ ...prev, upazila: e.target.value }))}
                        disabled={!selectedCityId || loadingZones}
                        className={`${inputStyle} pl-3 text-xs cursor-pointer disabled:bg-slate-100 disabled:text-slate-400`}
                        required
                      >
                        <option value="">থানা/উপজেলা সিলেক্ট করুন</option>
                        {zones.map(z => (
                          <option key={z.zone_id} value={z.zone_name}>{z.zone_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Passwords */}
                  <div className="space-y-2">
                    <div className={inputGroup}>
                      <FaLock className={iconStyle} />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="পাসওয়ার্ড তৈরি করুন"
                        value={formData.password}
                        onChange={handleChange}
                        className={inputStyle}
                        required
                      />
                      <button type="button" className="absolute right-3.5 text-slate-400 hover:text-indigo-600" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>

                    <div className={inputGroup}>
                      <FaLock className={iconStyle} />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="পাসওয়ার্ড নিশ্চিত করুন"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={inputStyle}
                        required
                      />
                      <button type="button" className="absolute right-3.5 text-slate-400 hover:text-indigo-600" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <p className="text-rose-500 text-xs font-bold text-center bg-rose-50 py-1.5 rounded-lg border border-rose-100">{passwordError}</p>
                  )}

                  <button className={btnPrimary} disabled={loading}>
                    {loading ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "Create Account (অ্যাকাউন্ট খুলুন)"}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                      Already have an account? <span className="text-indigo-600 font-extrabold hover:underline">Login</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating AI Assistant Button */}
      {mode === "signup" && !isRegistered && !showBotModal && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500 flex flex-col items-end">
          <div className="bg-white px-3.5 py-2.5 rounded-2xl shadow-xl border border-indigo-100 text-xs font-bold text-indigo-900 mb-2 relative animate-bounce mr-2">
            অ্যাকাউন্ট খুলতে সাহায্য চান? ✨
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white rotate-45 border-b border-r border-indigo-100" />
          </div>
          <button
            onClick={startBotChat}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 hover:scale-105 transition-transform duration-200 cursor-pointer"
          >
            <FaRobot size={26} />
          </button>
        </div>
      )}

      {/* AI Bot Chat Modal */}
      {showBotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[520px] border border-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-xs">
                  <FaRobot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Smart AI Assistant</h3>
                  <p className="text-[11px] text-indigo-200">অ্যাকাউন্ট সেটআপ অ্যাসিস্ট্যান্ট</p>
                </div>
              </div>
              <button onClick={() => setShowBotModal(false)} className="text-white/80 hover:text-white p-1">
                <FaTimes size={16} />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 chat-scroll bg-slate-50">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${msg.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-xs"
                      : "bg-white text-slate-800 shadow-xs border border-slate-200 rounded-bl-xs"
                    }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            {currentChatField !== "done" && (
              <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t border-slate-100 flex gap-2">
                <input
                  type={chatInputType === "password" ? "password" : chatInputType === "email" ? "email" : "text"}
                  placeholder="আপনার উত্তর লিখুন..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 text-xs font-medium"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center"
                >
                  <FaPaperPlane size={14} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">লোড হচ্ছে...</div>}>
      <SignupContent />
    </Suspense>
  );
}
