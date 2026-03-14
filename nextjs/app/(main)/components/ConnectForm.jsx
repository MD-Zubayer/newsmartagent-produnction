"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import axiosInstance from "@/lib/api";
import { 
  FaFacebook, FaWhatsapp, FaInstagram, FaTelegram, 
  FaArrowLeft, FaLink, FaCopy, FaCode, FaRobot, FaShieldAlt, FaExternalLinkAlt,
  FaCheckCircle, FaExclamationCircle
} from "react-icons/fa";
import { HiOutlineSparkles } from "react-icons/hi2";

export default function IntegrationManager({ webhookUrl = "" }) {
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [connectedPages, setConnectedPages] = useState([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  useEffect(() => {
    if (selectedPlatform?.id === 'facebook') {
      setIsLoadingPages(true);
      axiosInstance.get("/facebook/pages/")
        .then(res => {
          setConnectedPages(res.data.pages || []);
        })
        .catch(err => console.error("Error fetching Facebook pages", err))
        .finally(() => setIsLoadingPages(false));
    }
  }, [selectedPlatform]);

  const platformConfigs = {
    facebook: { 
      id: "facebook", 
      name: "Facebook", 
      icon: <FaFacebook />, 
      color: "from-blue-600 to-indigo-700", 
      iconBg: "bg-blue-600",
      devLink: "https://developers.facebook.com/apps/",
      btnText: "Developer Console",
      description: "Automate your Facebook Page conversations"
    },
    whatsapp: { 
      id: "whatsapp", 
      name: "WhatsApp", 
      icon: <FaWhatsapp />, 
      color: "from-emerald-500 to-teal-600", 
      iconBg: "bg-emerald-500",
      devLink: "https://developers.facebook.com/apps/", 
      btnText: "Business Settings",
      description: "Scale your business with WhatsApp API"
    },
    instagram: { 
      id: "instagram", 
      name: "Instagram", 
      icon: <FaInstagram />, 
      color: "from-pink-600 to-purple-700", 
      iconBg: "bg-pink-600",
      devLink: "https://developers.facebook.com/apps/",
      btnText: "Link API",
      description: "Manage DMs and comments automatically"
    },
    telegram: { 
      id: "telegram", 
      name: "Telegram", 
      icon: <FaTelegram />, 
      color: "from-sky-500 to-blue-600", 
      iconBg: "bg-sky-500",
      devLink: "https://t.me/BotFather", 
      btnText: "BotFather",
      description: "Deploy bots across the Telegram network"
    }
  };

  const copyToClipboard = () => {
    const url = webhookUrl || `https://api.site.com/wh/${selectedPlatform.id}`;
    navigator.clipboard.writeText(url);
    alert("Webhook URL Copied!");
  };

  if (!selectedPlatform) {
    return (
      <div className="w-full py-12 md:py-20 px-4 md:px-10 font-sans">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-6">
              <HiOutlineSparkles className="h-4 w-4" /> Seamless Integrations
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-4">
              Connect Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Channels</span>
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm md:text-lg font-medium leading-relaxed">
              Unlock the power of AI across your favorite platforms. Select a channel to begin the instant setup process.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
            {Object.values(platformConfigs).map((p) => (
              <div 
                key={p.id} 
                onClick={() => setSelectedPlatform(p)} 
                className="group relative cursor-pointer bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-12px_rgba(79,70,229,0.15)] hover:border-indigo-100 transition-all duration-500 overflow-hidden"
              >
                {/* Hover Background Accent */}
                <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`}></div>
                
                <div className={`relative z-10 w-16 h-16 rounded-2xl ${p.iconBg} text-white flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                  <span className="text-3xl">{p.icon}</span>
                </div>
                
                <div className="relative z-10">
                  <h3 className="font-black text-slate-900 text-2xl mb-2">{p.name}</h3>
                  <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-6 group-hover:text-slate-600 transition-colors">
                    {p.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-indigo-600 font-black text-[10px] uppercase tracking-widest pt-4 border-t border-slate-50">
                    <span>Connect Now</span>
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-8 md:py-16 px-4 md:px-10 font-sans animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="max-w-[900px] mx-auto">
        
        <button 
          onClick={() => setSelectedPlatform(null)} 
          className="group flex items-center gap-3 text-slate-400 hover:text-indigo-600 font-black text-[10px] md:text-xs mb-8 transition-all uppercase tracking-widest bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-100 shadow-sm"
        >
          <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" /> 
          Back to Channels
        </button>

        <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden relative">
          
          {/* Header */}
          <div className={`bg-gradient-to-br ${selectedPlatform.color} p-10 md:p-16 text-white relative`}>
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="p-6 bg-white/20 rounded-[2.5rem] backdrop-blur-2xl border border-white/30 shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]">
                <span className="text-5xl md:text-7xl drop-shadow-lg">{selectedPlatform.icon}</span>
              </div>
              <div className="space-y-1">
                <p className="text-white/70 text-[10px] md:text-xs font-black uppercase tracking-[0.3em]">Configure API</p>
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">
                  Link <span className="italic">{selectedPlatform.name}</span>
                </h2>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-16 space-y-12">
            
            {/* Webhook Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                    <FaCode className="text-indigo-600 text-[10px]" />
                  </div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Webhook Endpoint</label>
                </div>
                
                {selectedPlatform.devLink && (
                  <a 
                    href={selectedPlatform.devLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-xs transition-colors bg-indigo-50 px-4 py-2 rounded-xl"
                  >
                    {selectedPlatform.btnText} <FaExternalLinkAlt size={10} />
                  </a>
                )}
              </div>
              
              <div className="group relative">
                <div className="w-full px-8 py-7 bg-slate-50 border border-slate-100 rounded-[2rem] overflow-hidden transition-all group-hover:bg-slate-100/50">
                   <p className="text-xs md:text-sm font-mono font-bold text-slate-600 break-all leading-relaxed">
                     {webhookUrl || `https://api.site.com/wh/${selectedPlatform.id}`}
                   </p>
                </div>
                <button 
                  onClick={copyToClipboard}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white p-4 rounded-2xl shadow-xl hover:bg-indigo-600 hover:scale-105 active:scale-95 transition-all"
                >
                  <FaCopy />
                </button>
              </div>
              
              <div className="flex items-start gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                <FaShieldAlt className="text-blue-500 mt-1 shrink-0" />
                <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                  Protect your endpoint. Only share this URL within the official {selectedPlatform.name} Developer Dashboard.
                </p>
              </div>
            </div>

            {/* Platform Specific: Facebook */}
            {selectedPlatform.id === "facebook" && (
              <div className="pt-12 border-t border-slate-100 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                      Connected Pages
                    </h3>
                    <p className="text-xs text-slate-400 font-medium tracking-wide">Manage your linked Facebook visibility</p>
                  </div>
                  
                  <button 
                    onClick={() => {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://newsmartagent.com/api";
                      window.location.href = `${apiUrl}/facebook/login/`;
                    }}
                    className="flex items-center justify-center gap-3 bg-[#1877F2] text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-[#166fe5] transition-all shadow-lg hover:shadow-[#1877F244] active:scale-95"
                  >
                    <FaFacebook className="text-lg" />
                    Authorize New Page
                  </button>
                </div>
                
                <div className="bg-slate-50/50 rounded-[2.5rem] p-6 border border-slate-100">
                  {isLoadingPages ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Synchronizing...</p>
                    </div>
                  ) : connectedPages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {connectedPages.map(page => (
                        <div key={page.id} className="flex items-center justify-between bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-indigo-100 transition-colors group">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                <FaFacebook className="text-xl" />
                             </div>
                             <div>
                               <p className="font-black text-sm text-slate-800 tracking-tight">{page.name}</p>
                               <p className="text-[10px] font-mono text-slate-400">ID: {page.id}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Linked</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 px-6 space-y-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                        <FaExclamationCircle size={32} />
                      </div>
                      <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto">
                        No connected pages found. Authorize your account to start managing your pages.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="pt-12 border-t border-slate-100">
              <Link href='/dashboard/aiAgent'>
                <button className="relative w-full group overflow-hidden bg-indigo-600 text-white p-1 rounded-3xl shadow-2xl transition-all hover:scale-[1.01] active:scale-[0.99]">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <div className="relative py-6 md:py-8 rounded-[1.4rem] border border-white/10 bg-indigo-600 flex items-center justify-center gap-4">
                    <FaRobot className="text-2xl md:text-3xl group-hover:rotate-12 transition-transform" />
                    <span className="text-base md:text-xl font-black uppercase tracking-[0.2em]">Deploy AI Workforce</span>
                    <span className="text-2xl group-hover:translate-x-2 transition-transform">→</span>
                  </div>
                </button>
              </Link>
            </div>
            
          </div>
        </div>

        {/* Support Section */}
        <div className="mt-12 text-center">
           <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Need Assistance?</p>
           <div className="flex items-center justify-center gap-6">
              <a href="#" className="text-[11px] font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase">Documentation</a>
              <div className="w-1 h-1 rounded-full bg-slate-200"></div>
              <a href="#" className="text-[11px] font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase">Community Support</a>
              <div className="w-1 h-1 rounded-full bg-slate-200"></div>
              <a href="#" className="text-[11px] font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase">Live Chat</a>
           </div>
        </div>

      </div>
    </div>
  );
}