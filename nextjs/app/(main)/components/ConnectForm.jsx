"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import axiosInstance from "@/lib/api";
import {
  FaFacebook, FaWhatsapp, FaInstagram, FaTelegram, FaYoutube, FaTiktok,
  FaArrowLeft, FaLink, FaCopy, FaCode, FaRobot, FaShieldAlt, FaExternalLinkAlt,
  FaCheckCircle, FaExclamationCircle
} from "react-icons/fa";
import { HiOutlineSparkles } from "react-icons/hi2";
import WhatsAppConnector from "./WhatsAppConnector";
import TelegramConnector from "./TelegramConnector";

export default function IntegrationManager() {
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [connectedPages, setConnectedPages] = useState([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  
  // YouTube Selection State
  const [stagedYoutubeChannels, setStagedYoutubeChannels] = useState([]);
  const [youtubeSessionId, setYoutubeSessionId] = useState(null);
  const [isConfirmingChannel, setIsConfirmingChannel] = useState(false);

  // GBP Selection State
  const [stagedGbpLocations, setStagedGbpLocations] = useState([]);
  const [gbpSessionId, setGbpSessionId] = useState(null);
  const [isConfirmingGbp, setIsConfirmingGbp] = useState(false);

  useEffect(() => {
    // Listen for OAuth Success Messages
    const handleMessage = (event) => {
      // Security: Check origin if needed, but here we check status and platform
      if (event.data?.status === "select_channel") {
        if (event.data?.platform === "youtube") {
          setStagedYoutubeChannels(event.data.channels || []);
          setYoutubeSessionId(event.data.sessionId);
          import("react-hot-toast").then(({ toast }) => toast.success("Select a channel to connect"));
        } else if (event.data?.platform === "gbp") {
          setStagedGbpLocations(event.data.channels || []);
          setGbpSessionId(event.data.sessionId);
          import("react-hot-toast").then(({ toast }) => toast.success("Select a location to connect"));
        }
      } else if (event.data?.status === "success" && event.data?.platform === "tiktok") {
        import("react-hot-toast").then(({ toast }) => toast.success(`TikTok account ${event.data.account.display_name} connected!`));
        // Refresh TikTok accounts if we are on the tiktok platform view
        axiosInstance.get("/tiktok/accounts/").then(res => setConnectedPages(res.data.accounts || []));
      } else if (event.data?.status === "error") {
        import("react-hot-toast").then(({ toast }) => toast.error(event.data.message || "Authentication failed."));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const confirmGbpConnection = async (locationId) => {
    setIsConfirmingGbp(true);
    try {
      const res = await axiosInstance.post("/gbp/confirm/", {
        sessionId: gbpSessionId,
        channelId: locationId // Reuse channelId field for backend consistency
      });
      import("react-hot-toast").then(({ toast }) => toast.success(res.data.message));
      
      const refreshRes = await axiosInstance.get("/gbp/accounts/");
      setConnectedPages(refreshRes.data.accounts || []);
      
      setStagedGbpLocations([]);
      setGbpSessionId(null);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      console.error("Error confirming GBP connection", err);
      const errorMsg = err.response?.data?.error || "Failed to connect location";
      import("react-hot-toast").then(({ toast }) => toast.error(errorMsg));
    } finally {
      setIsConfirmingGbp(false);
    }
  };

  const confirmYoutubeConnection = async (channelId) => {
    setIsConfirmingChannel(true);
    try {
      const res = await axiosInstance.post("/youtube/confirm/", {
        sessionId: youtubeSessionId,
        channelId: channelId
      });
      import("react-hot-toast").then(({ toast }) => toast.success(res.data.message));
      
      // Refresh connected channels
      const refreshRes = await axiosInstance.get("/youtube/channels/");
      setConnectedPages(refreshRes.data.channels || []);
      
      // Clear selection state
      setStagedYoutubeChannels([]);
      setYoutubeSessionId(null);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      console.error("Error confirming YouTube connection", err);
      const errorMsg = err.response?.data?.error || "Failed to connect channel";
      import("react-hot-toast").then(({ toast }) => toast.error(errorMsg));
    } finally {
      setIsConfirmingChannel(false);
    }
  };

  const fetchGbpSessionLocations = async (sessionId) => {
    try {
      const res = await axiosInstance.get(`/gbp/session-locations/?sessionId=${sessionId}`);
      if (res.data.status === "success") {
        setStagedGbpLocations(res.data.channels || []);
        setGbpSessionId(res.data.sessionId);
        import("react-hot-toast").then(({ toast }) => toast.success("Locations recovered from session"));
      }
    } catch (err) {
      console.error("Error fetching GBP session locations", err);
    }
  };

  const fetchSessionChannels = async (sessionId) => {
    try {
      console.log("ConnectForm: Fetching session channels for", sessionId);
      const res = await axiosInstance.get(`/youtube/session-channels/?sessionId=${sessionId}`);
      if (res.data.status === "success") {
        setStagedYoutubeChannels(res.data.channels || []);
        setYoutubeSessionId(res.data.sessionId);
        import("react-hot-toast").then(({ toast }) => toast.success("Channels recovered from session"));
      }
    } catch (err) {
      console.error("Error fetching session channels", err);
    }
  };

  useEffect(() => {
    // Fail-safe: Check URL for sessionId on mount and URL change
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("sessionId");
    const type = params.get("success");
    if (sessionId) {
      if (type === "gbp_auth" && !gbpSessionId) {
        fetchGbpSessionLocations(sessionId);
      } else if (type === "youtube_auth" && !youtubeSessionId) {  // Fixed: was "yt_auth"
        fetchSessionChannels(sessionId);
      }
    }

    // Auto-select platform if returning from OAuth redirect
    if (sessionId && type === "youtube_auth") {
      setSelectedPlatform({
        id: "youtube",
        name: "YouTube",
        icon: <FaYoutube />,
        color: "from-red-600 via-rose-600 to-red-700",
        iconBg: "bg-red-600",
        devLink: "https://console.cloud.google.com/",
        btnText: "Google Console",
        description: "Automate your YouTube Channel comments and engagement with AI."
      });
    } else if (sessionId && type === "gbp_auth") {
      setSelectedPlatform({
        id: "gbp",
        name: "Google Business",
        icon: <FaShieldAlt />,
        color: "from-blue-500 via-indigo-500 to-blue-600",
        iconBg: "bg-blue-500",
        devLink: "https://business.google.com/",
        btnText: "Business Profile",
        description: "Manage and automate your Google Business Profile reviews and queries."
      });
    }
  }, [youtubeSessionId, gbpSessionId]);


  useEffect(() => {
    if (selectedPlatform?.id === 'facebook' || selectedPlatform?.id === 'instagram') {
      setIsLoadingPages(true);
      axiosInstance.get("/facebook/pages/")
        .then(res => {
          setConnectedPages(res.data.pages || []);
        })
        .catch(err => console.error("Error fetching Facebook pages", err))
        .finally(() => setIsLoadingPages(false));
    } else if (selectedPlatform?.id === 'youtube') {
      setIsLoadingPages(true);
      axiosInstance.get("/youtube/channels/")
        .then(res => {
          setConnectedPages(res.data.channels || []);
        })
        .catch(err => console.error("Error fetching YouTube channels", err))
        .finally(() => setIsLoadingPages(false));
    } else if (selectedPlatform?.id === 'gbp') {
      setIsLoadingPages(true);
      axiosInstance.get("/gbp/accounts/")
        .then(res => {
          setConnectedPages(res.data.accounts || []);
        })
        .catch(err => console.error("Error fetching GBP accounts", err))
        .finally(() => setIsLoadingPages(false));
    } else if (selectedPlatform?.id === 'tiktok') {
      setIsLoadingPages(true);
      axiosInstance.get("/tiktok/accounts/")
        .then(res => {
          setConnectedPages(res.data.accounts || []);
        })
        .catch(err => console.error("Error fetching TikTok accounts", err))
        .finally(() => setIsLoadingPages(false));
    }
  }, [selectedPlatform]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      const message = params.get('message') || "Authentication failed or was cancelled.";
      import("react-hot-toast").then(({ toast }) => toast.error(message));
    }
    if (params.get('success')) {
      import("react-hot-toast").then(({ toast }) => toast.success("Pages connected successfully!"));
    }
  }, []);

  const platformConfigs = {
    facebook: {
      id: "facebook",
      name: "Facebook",
      icon: <FaFacebook />,
      color: "from-blue-600 via-indigo-600 to-violet-700",
      iconBg: "bg-blue-600",
      devLink: "https://developers.facebook.com/apps/",
      btnText: "Developer Console",
      description: "Automate your Facebook Page conversations with industrial-grade AI."
    },
    whatsapp: {
      id: "whatsapp",
      name: "WhatsApp",
      icon: <FaWhatsapp />,
      color: "from-emerald-500 via-teal-500 to-cyan-600",
      iconBg: "bg-emerald-500",
      devLink: "https://developers.facebook.com/apps/",
      btnText: "Business Settings",
      description: "Scale your customer service with global WhatsApp API integration."
    },
    instagram: {
      id: "instagram",
      name: "Instagram",
      icon: <FaInstagram />,
      color: "from-pink-600 via-rose-600 to-purple-700",
      iconBg: "bg-pink-600",
      devLink: "https://developers.facebook.com/apps/",
      btnText: "Link API",
      description: "Connect with followers and manage DMs through intelligent automation."
    },
    telegram: {
      id: "telegram",
      name: "Telegram",
      icon: <FaTelegram />,
      color: "from-sky-500 via-blue-500 to-indigo-600",
      iconBg: "bg-sky-500",
      devLink: "https://t.me/BotFather",
      btnText: "BotFather",
      description: "Deploy secure bots across the world's most versatile cloud messenger."
    },
    web_widget: {
      id: "web_widget",
      name: "Web Widget",
      icon: <FaCode />,
      color: "from-amber-500 via-orange-500 to-red-600",
      iconBg: "bg-amber-500",
      devLink: "/dashboard/connect/widget-customize",
      btnText: "Customize Widget",
      description: "Embed a high-performance AI chat widget on any website in seconds."
    },
    youtube: {
      id: "youtube",
      name: "YouTube",
      icon: <FaYoutube />,
      color: "from-red-600 via-rose-600 to-red-700",
      iconBg: "bg-red-600",
      devLink: "https://console.cloud.google.com/",
      btnText: "Google Console",
      description: "Automate your YouTube Channel comments and engagement with AI."
    },
    gbp: {
      id: "gbp",
      name: "Google Business",
      icon: <FaShieldAlt />,
      color: "from-blue-500 via-indigo-500 to-blue-600",
      iconBg: "bg-blue-500",
      devLink: "https://business.google.com/",
      btnText: "Business Profile",
      description: "Manage and automate your Google Business Profile reviews and queries."
    },
    tiktok: {
      id: "tiktok",
      name: "TikTok",
      icon: <FaTiktok />,
      color: "from-slate-900 via-slate-800 to-black",
      iconBg: "bg-black",
      devLink: "https://developers.tiktok.com/",
      btnText: "TikTok Developers",
      description: "Automate your TikTok engagement and manage your profile interactions."
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Silent success for cleaner UI
  };

  if (!selectedPlatform) {
    return (
      <div className="w-full py-12 md:py-28 px-4 md:px-12 font-sans relative overflow-hidden">

        {/* Animated Background Blobs */}
        <div className="absolute top-0 -left-20 w-64 md:w-96 h-64 md:h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[80px] md:blur-[128px] opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-20 w-64 md:w-96 h-64 md:h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-[80px] md:blur-[128px] opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-64 md:w-96 h-64 md:h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-[80px] md:blur-[128px] opacity-20 animate-blob animation-delay-4000"></div>

        <div className="max-w-[1200px] mx-auto text-center relative z-10">
          <div className="mb-10 md:mb-20">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100/50 text-indigo-600 text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] mb-6 md:mb-8 shadow-sm">
              <HiOutlineSparkles className="h-4 w-4 animate-pulse" /> The Intelligence Hub
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-6xl lg:text-8xl font-black text-slate-900 tracking-tighter mb-4 md:mb-6 leading-[1.1] md:leading-none italic">
              Empower Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">Enterprise</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-lg lg:text-xl font-medium leading-relaxed opacity-80 px-4 md:px-0">
              Synchronize your business channels with our cutting-edge AI architecture.
              Select a platform to initialize your global agent network.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-12">
            {Object.values(platformConfigs).map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPlatform(p)}
                className="group relative cursor-pointer bg-white/70 backdrop-blur-3xl p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] hover:shadow-[0_48px_96px_-24px_rgba(79,70,229,0.18)] hover:border-indigo-200/50 transition-all duration-700 hover:-translate-y-2 overflow-hidden"
              >
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${p.color} opacity-80 group-hover:w-full group-hover:opacity-[0.03] transition-all duration-700`}></div>

                <div className={`relative z-10 w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2rem] ${p.iconBg} text-white flex items-center justify-center mb-8 md:mb-10 shadow-2xl group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700`}>
                  <span className="text-3xl md:text-4xl">{p.icon}</span>
                </div>

                <div className="relative z-10 text-left">
                  <h3 className="font-black text-slate-900 text-2xl md:text-3xl mb-3 tracking-tight group-hover:text-indigo-600 transition-colors uppercase italic">{p.name}</h3>
                  <p className="text-slate-500 text-[10px] md:text-xs font-semibold leading-relaxed mb-8 md:mb-10 group-hover:text-slate-700 transition-colors opacity-70">
                    {p.description}
                  </p>

                  <div className="flex items-center justify-between text-indigo-600 font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] pt-6 border-t border-slate-100/50">
                    <span className="opacity-60 group-hover:opacity-100 transition-opacity">Deploy Now</span>
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                      <span className="transform group-hover:translate-x-0.5 transition-transform text-base md:text-lg">→</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Background Icons */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay">
          <div className="absolute top-[20%] left-[10%] text-[6rem] md:text-[10rem] rotate-12"><FaRobot /></div>
          <div className="absolute bottom-[20%] right-[10%] text-[8rem] md:text-[12rem] -rotate-12"><FaShieldAlt /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-8 md:py-24 px-4 md:px-12 font-sans animate-in fade-in zoom-in-95 duration-1000 relative">

      <div className="max-w-[1100px] mx-auto relative z-10">

        <button
          onClick={() => setSelectedPlatform(null)}
          className="group flex items-center gap-3 md:gap-4 text-slate-400 hover:text-indigo-600 font-black text-[10px] md:text-[11px] mb-8 md:mb-12 transition-all uppercase tracking-[0.2em] md:tracking-[0.3em] bg-white/90 backdrop-blur-2xl px-5 md:px-6 py-2.5 md:py-3 rounded-full border border-slate-100 shadow-[0_8px_16px_rgba(0,0,0,0.04)]"
        >
          <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <FaArrowLeft className="group-hover:-translate-x-0.5 transition-transform text-[9px] md:text-[10px]" />
          </div>
          Return to Hub
        </button>

        <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.08)] md:shadow-[0_100px_160px_-40px_rgba(0,0,0,0.08)] border border-slate-50 overflow-hidden relative group">

          {/* Stunning Interaction Hero */}
          <div className={`bg-gradient-to-br ${selectedPlatform.color} p-6 md:p-12 lg:p-20 text-white relative overflow-hidden`}>
            {/* Animated Flare */}
            <div className="absolute top-0 right-0 w-[150%] h-[150%] bg-white/5 blur-[80px] md:blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2 animate-pulse"></div>

            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 lg:gap-14 text-center lg:text-left">
              <div className="p-5 md:p-10 bg-white/10 rounded-[2rem] md:rounded-[4rem] backdrop-blur-3xl border border-white/20 shadow-[inset_0_0_40px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform duration-700 shrink-0">
                <span className="text-4xl md:text-6xl lg:text-8xl drop-shadow-[0_20px_40px_rgba(0,0,0,0.2)]">{selectedPlatform.icon}</span>
              </div>
              <div className="space-y-3 md:space-y-6">
                <div>
                  <p className="text-white/60 text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] mb-2 md:mb-4 drop-shadow-sm flex items-center gap-3 justify-center lg:justify-start">
                    <span className="w-1.5 bg-emerald-400 rounded-full animate-ping aspect-square"></span> Enterprise Connectivity
                  </p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-none italic uppercase">
                    {selectedPlatform.name}
                  </h2>
                </div>
                <p className="text-white/80 text-sm md:text-lg lg:text-xl font-light leading-relaxed max-w-xl opacity-90 drop-shadow-sm px-4 lg:px-0">
                  Initialize high-performance agents for your {selectedPlatform.name} brand presence with one click.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-16 lg:p-24 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-white via-white to-indigo-50/20">

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 xl:gap-24 items-center mb-16 md:mb-24">
              <div className="space-y-6 md:space-y-8 text-center xl:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[8px] md:text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                  <FaShieldAlt className="animate-pulse" /> Precision Security
                </div>
                <h3 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black text-slate-900 tracking-tighter leading-none italic uppercase">Authorized <br className="hidden xl:block" /> Access</h3>
                <p className="text-slate-500 font-medium text-sm md:text-base lg:text-lg leading-relaxed max-w-md opacity-80 mx-auto xl:mx-0">
                  Your account synchronization is managed via enterprise-grade encryption protocol.
                  No technical configuration required.
                </p>
                <div className="flex items-center justify-center xl:justify-start gap-6 md:gap-8 opacity-40 grayscale grayscale-100">
                  <div className="flex flex-col items-center gap-1">
                    <FaCode size={18} className="md:w-5 md:h-5" />
                    <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest">AES-256</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <FaLink size={18} className="md:w-5 md:h-5" />
                    <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest">OAuth 2.0</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 p-1 rounded-[2rem] md:rounded-[3.5rem] border border-slate-100 shadow-xl md:shadow-2xl relative group-hover:-translate-y-2 transition-transform duration-1000">
                <div className="bg-white rounded-[1.9rem] md:rounded-[3.3rem] p-6 md:p-10 lg:p-12 flex flex-col items-center justify-center text-center gap-6 md:gap-10">
                  <div className="w-14 h-14 md:w-20 lg:w-24 md:h-20 lg:h-24 bg-indigo-50 rounded-[1.5rem] md:rounded-[2.5rem] shadow-inner flex items-center justify-center text-indigo-600">
                    <FaRobot size={32} className="md:w-10 lg:w-12 animate-bounce-slow" />
                  </div>
                  <div className="space-y-1 md:space-y-1.5">
                    <p className="text-sm md:text-lg font-black text-slate-900 uppercase tracking-tight italic">AI Infrastructure Ready</p>
                    <p className="text-[9px] md:text-xs text-slate-400 font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] opacity-80">Latency: 14ms | Status: Optimal</p>
                  </div>
                  <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-indigo-600 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Specific: WhatsApp */}
            {selectedPlatform.id === "whatsapp" && (
              <div className="pt-16 md:pt-24 border-t border-slate-100 animate-in slide-in-from-bottom-8 duration-1000">
                <WhatsAppConnector />
              </div>
            )}

            {/* Platform Specific: Web Widget */}
            {selectedPlatform.id === "web_widget" && (
              <div className="pt-16 md:pt-24 border-t border-slate-100 animate-in slide-in-from-bottom-8 duration-1000">
                <div className="text-center py-10 md:py-20 space-y-8">
                  <div className="w-24 h-24 bg-amber-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-amber-600 shadow-inner">
                    <FaCode size={48} className="animate-pulse" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase">Web Chat Hub</h3>
                    <p className="text-slate-500 font-medium max-w-sm mx-auto opacity-80 leading-relaxed">
                      Create and customize your embeddable AI widget. No API keys required.
                    </p>
                  </div>
                  <Link 
                    href="/dashboard/connect/widget-customize"
                    className="inline-flex items-center gap-4 bg-amber-600 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl hover:bg-amber-700 transition-all active:scale-95"
                  >
                    Go to Customizer <span className="text-xl">→</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Platform Specific: Facebook */}
            {selectedPlatform.id === "facebook" && (
              <div className="pt-16 md:pt-24 border-t border-slate-100 space-y-12 md:space-y-16 animate-in slide-in-from-bottom-8 duration-1000">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-12 text-center lg:text-left">
                  <div className="space-y-2">
                    <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase">
                      Connected Pages
                    </h3>
                    <p className="text-[10px] md:text-xs text-blue-600 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] opacity-70 flex items-center gap-2 justify-center lg:justify-start">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></span> Facebook Page Management
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://newsmartagent.com/api";
                      window.location.href = `${apiUrl}/facebook/login/`;
                    }}
                    className="group relative flex items-center justify-center gap-4 md:gap-5 bg-[#1877F2] text-white px-6 md:px-10 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] hover:bg-[#166fe5] transition-all shadow-[0_20px_40px_-10px_rgba(24,119,242,0.3)] active:scale-95 overflow-hidden w-full lg:w-auto"
                  >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                    <FaFacebook className="text-xl md:text-2xl group-hover:rotate-12 transition-transform duration-500" />
                    Connect to Facebook
                  </button>
                </div>

                <div className="bg-slate-50/50 rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-16 border border-slate-100 relative overflow-hidden group/list">
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-3xl pointer-events-none"></div>

                  {isLoadingPages ? (
                    <div className="flex flex-col items-center justify-center py-20 md:py-28 gap-6 md:gap-8 relative z-10">
                      <div className="relative">
                        <div className="w-16 h-16 md:w-20 md:h-20 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-[1.2rem] md:rounded-2xl animate-pulse"></div>
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.4em] md:tracking-[0.5em] animate-pulse">Fetching Pages...</p>
                    </div>
                  ) : connectedPages.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 relative z-10 w-full overflow-hidden">
                      {connectedPages.map(page => (
                        <div key={page.id} className="flex items-center justify-between bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_16px_32px_-12px_rgba(0,0,0,0.03)] border border-slate-50 hover:border-blue-100 hover:shadow-[0_32px_64px_-16px_rgba(24,119,242,0.12)] transition-all duration-700 group/page hover:-translate-y-1 min-w-0">
                          <div className="flex items-center gap-3 md:gap-6 min-w-0">
                            <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 bg-gradient-to-br from-blue-50 to-white rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-[#1877F2] shadow-inner group-hover/page:scale-110 transition-transform duration-700">
                              <FaFacebook className="text-2xl md:text-3xl" />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <p className="font-black text-base md:text-xl text-slate-900 tracking-tight italic truncate text-left">{page.name}</p>
                              {page.instagram_username && (
                                <div className="flex items-center gap-2 text-pink-600 text-[10px] md:text-xs font-bold">
                                  <FaInstagram className="shrink-0" />
                                  <span className="truncate">@{page.instagram_username} linked</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 w-fit">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest truncate">Active</span>
                              </div>
                            </div>
                          </div>
                          <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-slate-50 rounded-[0.8rem] md:rounded-2xl flex items-center justify-center group-hover/page:bg-blue-600 group-hover/page:text-white transition-all duration-500 ml-2">
                            <span className="transform transition-transform group-hover/page:translate-x-0.5 text-base md:text-xl">→</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 md:py-28 px-6 md:px-12 space-y-8 md:space-y-10 relative z-10">
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-lg md:shadow-xl flex items-center justify-center mx-auto border border-slate-50 hover:scale-110 transition-transform duration-700">
                        <FaFacebook size={48} className="md:w-16 md:h-16 opacity-10 text-blue-500" />
                      </div>
                      <div className="space-y-3 md:space-y-4">
                        <h4 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter italic">No Pages Connected</h4>
                        <p className="text-base md:text-lg text-slate-400 font-medium max-w-[280px] md:max-w-sm mx-auto opacity-70 leading-relaxed">
                          Click &quot;Connect to Facebook&quot; and grant page access to activate your AI agents.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Platform Specific: Instagram */}
            {selectedPlatform.id === "instagram" && (
              <div className="pt-16 md:pt-24 border-t border-slate-100 space-y-12 md:space-y-16 animate-in slide-in-from-bottom-8 duration-1000">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-12 text-center lg:text-left">
                  <div className="space-y-2">
                    <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase">
                      Instagram Accounts
                    </h3>
                    <p className="text-[10px] md:text-xs text-pink-600 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] opacity-70 flex items-center gap-2 justify-center lg:justify-start">
                      <span className="w-1.5 h-1.5 bg-pink-600 rounded-full shadow-[0_0_10px_rgba(219,39,119,0.5)]"></span> Instagram Business Integration
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://newsmartagent.com/api";
                      window.location.href = `${apiUrl}/facebook/login/`;
                    }}
                    className="group relative flex items-center justify-center gap-4 md:gap-5 bg-gradient-to-r from-pink-600 via-rose-600 to-purple-700 text-white px-6 md:px-10 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] hover:opacity-90 transition-all shadow-[0_20px_40px_-10px_rgba(219,39,119,0.3)] active:scale-95 overflow-hidden w-full lg:w-auto"
                  >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                    <FaInstagram className="text-xl md:text-2xl group-hover:rotate-12 transition-transform duration-500" />
                    Connect via Facebook
                  </button>
                </div>

                <div className="bg-slate-50/50 rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-16 border border-slate-100 relative overflow-hidden group/list">
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-3xl pointer-events-none"></div>

                  {isLoadingPages ? (
                    <div className="flex flex-col items-center justify-center py-20 md:py-28 gap-6 md:gap-8 relative z-10">
                      <div className="relative">
                        <div className="w-16 h-16 md:w-20 md:h-20 border-2 border-slate-200 border-t-pink-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-pink-50 rounded-[1.2rem] md:rounded-2xl animate-pulse"></div>
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.4em] md:tracking-[0.5em] animate-pulse">Fetching Instagram Accounts...</p>
                    </div>
                  ) : connectedPages.filter(p => p.instagram_username).length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 relative z-10 w-full overflow-hidden">
                      {connectedPages.filter(p => p.instagram_username).map(page => (
                        <div key={page.id} className="flex items-center justify-between bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_16px_32px_-12px_rgba(0,0,0,0.03)] border border-slate-50 hover:border-pink-100 hover:shadow-[0_32px_64px_-16px_rgba(219,39,119,0.12)] transition-all duration-700 group/page hover:-translate-y-1 min-w-0">
                          <div className="flex items-center gap-3 md:gap-6 min-w-0">
                            <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 bg-gradient-to-br from-pink-50 to-purple-50 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-pink-600 shadow-inner group-hover/page:scale-110 transition-transform duration-700">
                              <FaInstagram className="text-2xl md:text-3xl" />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <p className="font-black text-base md:text-xl text-slate-900 tracking-tight italic truncate text-left">@{page.instagram_username}</p>
                              <div className="flex items-center gap-2 text-blue-500 text-[10px] md:text-xs font-bold">
                                <FaFacebook className="shrink-0" />
                                <span className="truncate">{page.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 w-fit">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest truncate">Active</span>
                              </div>
                            </div>
                          </div>
                          <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-slate-50 rounded-[0.8rem] md:rounded-2xl flex items-center justify-center group-hover/page:bg-pink-600 group-hover/page:text-white transition-all duration-500 ml-2">
                            <span className="transform transition-transform group-hover/page:translate-x-0.5 text-base md:text-xl">→</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 md:py-28 px-6 md:px-12 space-y-8 md:space-y-10 relative z-10">
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-lg md:shadow-xl flex items-center justify-center mx-auto border border-slate-50 hover:scale-110 transition-transform duration-700">
                        <FaInstagram size={48} className="md:w-16 md:h-16 opacity-10 text-pink-500" />
                      </div>
                      <div className="space-y-3 md:space-y-4">
                        <h4 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter italic">No Instagram Connected</h4>
                        <p className="text-base md:text-lg text-slate-400 font-medium max-w-[280px] md:max-w-sm mx-auto opacity-70 leading-relaxed">
                          Link your Instagram Business Account to a Facebook Page, then connect via the button above.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Platform Specific: YouTube */}
            {/* Platform Specific: YouTube */}
            {selectedPlatform.id === "youtube" && (
              <div className="pt-16 md:pt-24 border-t border-slate-100 space-y-12 md:space-y-16 animate-in slide-in-from-bottom-8 duration-1000">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-12 text-center lg:text-left">
                  <div className="space-y-2">
                    <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase">
                      YouTube Channels
                    </h3>
                    <p className="text-[10px] md:text-xs text-red-600 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] opacity-70 flex items-center gap-2 justify-center lg:justify-start">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]"></span> YouTube Video Automation
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://newsmartagent.com/api";
                      // Full-page redirect (more reliable than popup for OAuth)
                      window.location.href = `${apiUrl}/youtube/login/`;
                    }}
                    className="group relative flex items-center justify-center gap-4 md:gap-5 bg-[#FF0000] text-white px-6 md:px-10 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] hover:bg-[#cc0000] transition-all shadow-[0_20px_40px_-10px_rgba(255,0,0,0.3)] active:scale-95 overflow-hidden w-full lg:w-auto"
                  >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                    <FaYoutube className="text-xl md:text-2xl group-hover:rotate-12 transition-transform duration-500" />
                    Connect to YouTube
                  </button>
                </div>

                <div className="bg-slate-50/50 rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-16 border border-slate-100 relative overflow-hidden group/list">
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-3xl pointer-events-none"></div>

                  {/* Channel Selection UI */}
                  {stagedYoutubeChannels.length > 0 && (
                    <div className="relative z-20 mb-12 p-8 bg-white/80 backdrop-blur-3xl rounded-[2.5rem] border-2 border-red-100 shadow-2xl animate-in slide-in-from-top-10 duration-700">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h4 className="text-xl md:text-2xl font-black text-slate-900 italic uppercase">Select Your Channel</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Available channels in your account</p>
                        </div>
                        <button 
                          onClick={() => setStagedYoutubeChannels([])}
                          className="text-slate-400 hover:text-red-600 text-[10px] font-black uppercase tracking-widest"
                        >
                          Cancel
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stagedYoutubeChannels.map(channel => (
                          <div key={channel.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-red-200 transition-all group/item">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-red-100">
                                <img src={channel.thumbnail} alt={channel.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 truncate">{channel.name}</p>
                                <p className="text-[9px] text-red-500 font-bold uppercase">{channel.handle}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => confirmYoutubeConnection(channel.id)}
                              disabled={isConfirmingChannel}
                              className="px-6 py-2 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg"
                            >
                              {isConfirmingChannel ? "Linking..." : "Link"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isLoadingPages ? (
                    <div className="flex flex-col items-center justify-center py-20 md:py-28 gap-6 md:gap-8 relative z-10">
                      <div className="relative">
                        <div className="w-16 h-16 md:w-20 md:h-20 border-2 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-50 rounded-[1.2rem] md:rounded-2xl animate-pulse"></div>
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.4em] md:tracking-[0.5em] animate-pulse">Fetching Channels...</p>
                    </div>
                  ) : connectedPages.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 relative z-10 w-full overflow-hidden">
                      {connectedPages.map(channel => (
                        <div key={channel.id} className="flex items-center justify-between bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_16px_32px_-12px_rgba(0,0,0,0.03)] border border-slate-50 hover:border-red-100 hover:shadow-[0_32px_64px_-16px_rgba(255,0,0,0.12)] transition-all duration-700 group/page hover:-translate-y-1 min-w-0">
                          <div className="flex items-center gap-3 md:gap-6 min-w-0">
                            <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 bg-gradient-to-br from-red-50 to-white rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-[#FF0000] shadow-inner group-hover/page:scale-110 transition-transform duration-700">
                                <FaYoutube className="text-2xl md:text-3xl" />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <p className="font-black text-base md:text-xl text-slate-900 tracking-tighter italic truncate text-left">{channel.name}</p>
                              <p className="text-[9px] text-red-500 font-bold uppercase truncate">{channel.handle || `ID: ${channel.id}`}</p>
                              <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 w-fit">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest truncate">Synced</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 md:py-28 px-6 md:px-12 space-y-8 md:space-y-10 relative z-10">
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-lg md:shadow-xl flex items-center justify-center mx-auto border border-slate-50 hover:scale-110 transition-transform duration-700">
                        <FaYoutube size={48} className="md:w-16 md:h-16 opacity-10 text-red-500" />
                      </div>
                      <div className="space-y-3 md:space-y-4">
                        <h4 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter italic">No Channels Connected</h4>
                        <p className="text-base md:text-lg text-slate-400 font-medium max-w-[280px] md:max-w-sm mx-auto opacity-70 leading-relaxed">
                          Click &quot;Connect to YouTube&quot; and select your channel to initialize AI automation.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Platform Specific: Google Business Profile (GBP) */}
            {selectedPlatform.id === "gbp" && (
              <div className="pt-16 md:pt-24 border-t border-slate-100 space-y-12 md:space-y-16 animate-in slide-in-from-bottom-8 duration-1000">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-12 text-center lg:text-left">
                  <div className="space-y-2">
                    <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase">
                      Business Profiles
                    </h3>
                    <p className="text-[10px] md:text-xs text-blue-600 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] opacity-70 flex items-center gap-2 justify-center lg:justify-start">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></span> GBP Integration
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://newsmartagent.com/api";
                      // Full-page redirect (more reliable than popup for OAuth)
                      window.location.href = `${apiUrl}/youtube/login/?type=gbp`;
                    }}
                    className="group relative flex items-center justify-center gap-4 md:gap-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-6 md:px-10 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] hover:opacity-90 transition-all shadow-[0_20px_40px_-10px_rgba(37,99,235,0.3)] active:scale-95 overflow-hidden w-full lg:w-auto"
                  >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                    <FaShieldAlt className="text-xl md:text-2xl group-hover:rotate-12 transition-transform duration-500" />
                    Connect Google Business
                  </button>
                </div>

                <div className="bg-slate-50/50 rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-16 border border-slate-100 relative overflow-hidden group/list">
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-3xl pointer-events-none"></div>

                  {/* Location Selection UI */}
                  {stagedGbpLocations.length > 0 && (
                    <div className="relative z-20 mb-12 p-8 bg-white/80 backdrop-blur-3xl rounded-[2.5rem] border-2 border-blue-100 shadow-2xl animate-in slide-in-from-top-10 duration-700">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h4 className="text-xl md:text-2xl font-black text-slate-900 italic uppercase">Select Your Location</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Available locations in your account</p>
                        </div>
                        <button 
                          onClick={() => setStagedGbpLocations([])}
                          className="text-slate-400 hover:text-blue-600 text-[10px] font-black uppercase tracking-widest"
                        >
                          Cancel
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stagedGbpLocations.map(loc => (
                          <div key={loc.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-all group/item">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border-2 border-blue-100">
                                <FaShieldAlt />
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 truncate">{loc.name}</p>
                                <p className="text-[9px] text-blue-500 font-bold uppercase">{loc.handle}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => confirmGbpConnection(loc.id)}
                              disabled={isConfirmingGbp}
                              className="px-6 py-2 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg"
                            >
                              {isConfirmingGbp ? "Connecting..." : "Link"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isLoadingPages ? (
                    <div className="flex flex-col items-center justify-center py-20 md:py-28 gap-6 md:gap-8 relative z-10">
                      <div className="relative">
                        <div className="w-16 h-16 md:w-20 md:h-20 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-[1.2rem] md:rounded-2xl animate-pulse"></div>
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.4em] md:tracking-[0.5em] animate-pulse">Fetching Locations...</p>
                    </div>
                  ) : connectedPages.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 relative z-10 w-full overflow-hidden">
                      {connectedPages.map(acc => (
                        <div key={acc.location_id} className="flex items-center justify-between bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_16px_32px_-12px_rgba(0,0,0,0.03)] border border-slate-50 hover:border-blue-100 hover:shadow-[0_32px_64px_-16px_rgba(37,99,235,0.12)] transition-all duration-700 group/page hover:-translate-y-1 min-w-0">
                          <div className="flex items-center gap-3 md:gap-6 min-w-0">
                            <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-blue-600 shadow-inner group-hover/page:scale-110 transition-transform duration-700">
                                <FaShieldAlt className="text-2xl md:text-3xl" />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <p className="font-black text-base md:text-xl text-slate-900 tracking-tight italic truncate text-left">{acc.location_name}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{acc.account_name}</p>
                              <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 w-fit">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest truncate">Connected</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 md:py-28 px-6 md:px-12 space-y-8 md:space-y-10 relative z-10">
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-lg md:shadow-xl flex items-center justify-center mx-auto border border-slate-50 hover:scale-110 transition-transform duration-700">
                        <FaShieldAlt size={48} className="md:w-16 md:h-16 opacity-10 text-blue-500" />
                      </div>
                      <div className="space-y-3 md:space-y-4">
                        <h4 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter italic">No Locations Connected</h4>
                        <p className="text-base md:text-lg text-slate-400 font-medium max-w-[280px] md:max-w-sm mx-auto opacity-70 leading-relaxed">
                          Click &quot;Connect Google Business&quot; to authorize our AI to manage your business reviews.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Platform Specific: TikTok */}
            {selectedPlatform.id === "tiktok" && (
              <div className="pt-16 md:pt-24 border-t border-slate-100 space-y-12 md:space-y-16 animate-in slide-in-from-bottom-8 duration-1000">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-12 text-center lg:text-left">
                  <div className="space-y-2">
                    <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase">
                      TikTok Profiles
                    </h3>
                    <p className="text-[10px] md:text-xs text-black font-black uppercase tracking-[0.3em] md:tracking-[0.4em] opacity-70 flex items-center gap-2 justify-center lg:justify-start">
                      <span className="w-1.5 h-1.5 bg-black rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]"></span> TikTok Login Kit v2
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://newsmartagent.com/api";
                      const width = 600, height = 700;
                      const left = (window.innerWidth - width) / 2;
                      const top = (window.innerHeight - height) / 2;
                      window.open(
                        `${apiUrl}/tiktok/login/`,
                        "TikTok Login",
                        `width=${width},height=${height},top=${top},left=${left}`
                      );
                    }}
                    className="group relative flex items-center justify-center gap-4 md:gap-5 bg-black text-white px-6 md:px-10 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] hover:bg-slate-900 transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] active:scale-95 overflow-hidden w-full lg:w-auto"
                  >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                    <FaTiktok className="text-xl md:text-2xl group-hover:rotate-12 transition-transform duration-500" />
                    Connect TikTok
                  </button>
                </div>

                <div className="bg-slate-50/50 rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-16 border border-slate-100 relative overflow-hidden group/list">
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-3xl pointer-events-none"></div>

                  {isLoadingPages ? (
                    <div className="flex flex-col items-center justify-center py-20 md:py-28 gap-6 md:gap-8 relative z-10">
                      <div className="relative">
                        <div className="w-16 h-16 md:w-20 md:h-20 border-2 border-slate-200 border-t-black rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 rounded-[1.2rem] md:rounded-2xl animate-pulse"></div>
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.4em] md:tracking-[0.5em] animate-pulse">Fetching Profiles...</p>
                    </div>
                  ) : connectedPages.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 relative z-10 w-full overflow-hidden">
                      {connectedPages.map(acc => (
                        <div key={acc.id} className="flex items-center justify-between bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_16px_32px_-12px_rgba(0,0,0,0.03)] border border-slate-50 hover:border-slate-200 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] transition-all duration-700 group/page hover:-translate-y-1 min-w-0">
                          <div className="flex items-center gap-3 md:gap-6 min-w-0">
                            <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-black shadow-inner group-hover/page:scale-110 transition-transform duration-700">
                                {acc.avatar ? (
                                  <img src={acc.avatar} alt={acc.name} className="w-full h-full object-cover rounded-[1.2rem] md:rounded-[1.5rem]" />
                                ) : (
                                  <FaTiktok className="text-2xl md:text-3xl" />
                                )}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <p className="font-black text-base md:text-xl text-slate-900 tracking-tight italic truncate text-left">{acc.name || 'TikTok User'}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase truncate">ID: {acc.id}</p>
                              <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 w-fit">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest truncate">Synced</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 md:py-28 px-6 md:px-12 space-y-8 md:space-y-10 relative z-10">
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-lg md:shadow-xl flex items-center justify-center mx-auto border border-slate-50 hover:scale-110 transition-transform duration-700">
                        <FaTiktok size={48} className="md:w-16 md:h-16 opacity-10 text-black" />
                      </div>
                      <div className="space-y-3 md:space-y-4">
                        <h4 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter italic">No TikTok Connected</h4>
                        <p className="text-base md:text-lg text-slate-400 font-medium max-w-[280px] md:max-w-sm mx-auto opacity-70 leading-relaxed">
                          Click &quot;Connect TikTok&quot; to authorize our AI to manage your TikTok engagement.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Platform Specific: Telegram */}
            {selectedPlatform.id === "telegram" && (
              <div className="pt-16 md:pt-24 border-t border-slate-100 animate-in slide-in-from-bottom-8 duration-1000">
                <TelegramConnector />
              </div>
            )}

            {/* Ultimate Action Gateway */}
            <div className="pt-20 md:pt-32 border-t border-slate-100">
              <Link href='/dashboard/aiAgent' className="block group">
                <div className="relative overflow-hidden bg-slate-950 p-1.5 md:p-2 rounded-[2.5rem] md:rounded-[3.5rem] shadow-4xl transition-all duration-1000 hover:scale-[1.01] active:scale-[0.99] hover:shadow-[0_64px_128px_-32px_rgba(79,70,229,0.3)]">
                  {/* Moving Aurora Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-600 to-rose-500 opacity-20 group-hover:opacity-40 blur-[40px] md:blur-[80px] transition-opacity duration-1000 animate-pulse"></div>

                  <div className="relative px-5 md:px-12 py-8 md:py-20 xl:py-24 rounded-[2rem] md:rounded-[3rem] border border-white/10 bg-slate-950 flex flex-col xl:flex-row items-center justify-between gap-10 xl:gap-16 overflow-hidden">
                    {/* Inner texture */}
                    <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

                    <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-10 text-center lg:text-left relative z-10 w-full xl:w-auto">
                      <div className="w-16 h-16 md:w-28 md:h-28 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center text-white shadow-[0_20px_40px_rgba(0,0,0,0.4)] group-hover:rotate-12 group-hover:scale-110 transition-all duration-700 border border-white/10 shrink-0">
                        <FaRobot className="text-3xl md:text-5xl" />
                      </div>
                      <div className="space-y-2 min-w-0">
                        <h4 className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-white italic tracking-tighter leading-none flex items-center gap-3 md:gap-4 justify-center lg:justify-start">
                          ENTER COMMAND <span className="w-3 md:w-4 h-6 md:h-8 bg-indigo-500 animate-cursor shrink-0"></span>
                        </h4>
                        <p className="text-slate-400 text-sm md:text-xl xl:text-2xl font-light opacity-60 tracking-tight">Deploy your cognitive workforce across the connected ecosystem.</p>
                      </div>
                    </div>

                    <div className="relative group/btn z-10 shrink-0">
                      <div className="absolute -inset-6 bg-white/10 blur-[40px] rounded-full scale-0 group-hover:scale-100 transition-transform duration-700"></div>
                      <div className="w-16 h-16 md:w-28 xl:w-36 md:h-16 xl:h-36 bg-white rounded-full flex items-center justify-center text-slate-950 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-700 shadow-[0_20px_40px_-10px_rgba(255,255,255,0.1)]">
                        <span className="text-xl md:text-4xl xl:text-6xl font-black transform group-hover:translate-x-3 transition-all duration-700 tracking-tighter italic uppercase">GO</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

          </div>
        </div>

        {/* Cinematic Footer */}
        <div className="mt-20 md:mt-28 text-center pb-20 md:pb-32">
          <div className="inline-flex flex-wrap justify-center items-center gap-6 md:gap-12 bg-white/30 backdrop-blur-3xl px-8 md:px-12 py-4 md:py-6 rounded-[2rem] md:rounded-[2.5rem] border border-white shadow-xl md:shadow-2xl">
            <a href="#" className="text-[9px] md:text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.4em] md:tracking-[0.5em] hover:scale-110 transition-transform duration-500 underline decoration-indigo-300 underline-offset-8">Terminal</a>
            <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-slate-200 hidden xs:block"></div>
            <a href="#" className="text-[9px] md:text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.4em] md:tracking-[0.5em] hover:scale-110 transition-transform duration-500 underline decoration-indigo-300 underline-offset-8">Core</a>
            <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-slate-200 hidden xs:block"></div>
            <a href="#" className="text-[9px] md:text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.4em] md:tracking-[0.5em] hover:scale-110 transition-transform duration-500 underline decoration-indigo-300 underline-offset-8">Matrix</a>
          </div>
        </div>

      </div>

      {/* Extreme Visual Flourishes */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 z-50"></div>
    </div>
  );
}