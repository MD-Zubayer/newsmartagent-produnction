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
      <div className="max-w-[1000px] mx-auto">
        
        <button 
          onClick={() => setSelectedPlatform(null)} 
          className="group flex items-center gap-3 text-slate-400 hover:text-indigo-600 font-bold text-[10px] md:text-sm mb-8 transition-all uppercase tracking-widest bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-slate-100 shadow-sm"
        >
          <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" /> 
          Back to Platforms
        </button>

        <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] shadow-[0_40px_80px_-16px_rgba(0,0,0,0.06)] border border-slate-50 overflow-hidden relative">
          
          {/* Hero Section */}
          <div className={`bg-gradient-to-br ${selectedPlatform.color} p-12 md:p-20 text-white relative`}>
            {/* Ambient Light Effect */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-white opacity-[0.05] blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 text-center md:text-left">
              <div className="p-8 bg-white/20 rounded-[3rem] backdrop-blur-2xl border border-white/30 shadow-[0_20px_40px_rgba(0,0,0,0.1)] group transition-transform hover:scale-105 duration-500">
                <span className="text-6xl md:text-8xl drop-shadow-2xl">{selectedPlatform.icon}</span>
              </div>
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                   Instant Sync Enabled
                </div>
                <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none italic">
                  {selectedPlatform.name}
                </h2>
                <p className="text-white/80 text-sm md:text-lg font-medium opacity-90 max-w-md mx-auto md:mx-0">
                  {selectedPlatform.description}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-20 space-y-16">
            
            {/* Simplified Connection Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
               <div className="space-y-4 text-center md:text-left">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Ready to Connect?</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    Authorize your {selectedPlatform.name} account to begin using your AI workforce. Everything is handled securely.
                  </p>
               </div>
               
               <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600">
                     <FaShieldAlt size={28} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Security First</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">Official OAuth 2.0</p>
                  </div>
               </div>
            </div>

            {/* Platform Specific: Facebook */}
            {selectedPlatform.id === "facebook" && (
              <div className="pt-16 border-t border-slate-100 space-y-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                      Manage Connections
                    </h3>
                    <p className="text-sm text-slate-400 font-semibold uppercase tracking-widest">Linked Facebook Pages</p>
                  </div>
                  
                  <button 
                    onClick={() => {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://newsmartagent.com/api";
                      window.location.href = `${apiUrl}/facebook/login/`;
                    }}
                    className="group relative flex items-center justify-center gap-4 bg-[#1877F2] text-white px-10 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.1em] hover:bg-[#166fe5] transition-all shadow-[0_20px_40px_-10px_rgba(24,119,242,0.4)] active:scale-95 w-full md:w-auto overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                    <FaFacebook className="text-xl group-hover:rotate-12 transition-transform" />
                    Authorize New Page
                  </button>
                </div>
                
                <div className="bg-slate-50/50 rounded-[3rem] p-8 md:p-12 border border-slate-100 relative overflow-hidden">
                  {/* Subtle noise pattern */}
                  <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none"></div>

                  {isLoadingPages ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-6 relative z-10">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                           <div className="w-8 h-8 bg-indigo-50 rounded-lg animate-pulse"></div>
                        </div>
                      </div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Synchronizing Data...</p>
                    </div>
                  ) : connectedPages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                      {connectedPages.map(page => (
                        <div key={page.id} className="flex items-center justify-between bg-white p-6 rounded-[2rem] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.04)] border border-slate-50 hover:border-indigo-100 hover:shadow-xl transition-all group">
                          <div className="flex items-center gap-5">
                             <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:rotate-6 transition-transform">
                                <FaFacebook className="text-2xl" />
                             </div>
                             <div className="space-y-0.5">
                               <p className="font-black text-base text-slate-800 tracking-tight">{page.name}</p>
                               <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-lg border border-emerald-100 w-fit">
                                  <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Active Connection</span>
                               </div>
                             </div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                             <span className="text-slate-300 group-hover:text-indigo-600 transform transition-transform group-hover:translate-x-1">→</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 px-8 space-y-6 relative z-10">
                      <div className="w-24 h-24 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto text-slate-100 border border-slate-50">
                        <FaFacebook size={48} />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">No Pages Linked</h4>
                        <p className="text-sm text-slate-400 font-medium max-w-xs mx-auto">
                          Choose "Authorize New Page" to link your Facebook visibility and enable AI features.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Massive Call to Action */}
            <div className="pt-20 border-t border-slate-100">
              <Link href='/dashboard/aiAgent' className="block group">
                <div className="relative overflow-hidden bg-slate-900 p-1.5 rounded-[2.5rem] shadow-3xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                  {/* Glowing background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 group-hover:opacity-40 blur-2xl transition-opacity"></div>
                  
                  <div className="relative px-8 py-10 md:py-14 rounded-[2rem] border border-white/5 bg-slate-900 flex flex-col md:flex-row items-center justify-between gap-10">
                    <div className="flex items-center gap-6 text-center md:text-left">
                      <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                        <FaRobot className="text-4xl" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-2xl md:text-4xl font-black text-white italic tracking-tighter">Launch AI Agent</h4>
                        <p className="text-slate-400 text-sm md:text-base font-medium opacity-80">Next Step: Deploy your intelligence workforce</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center w-16 h-16 md:w-24 md:h-24 bg-white rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-2xl overflow-hidden shrink-0">
                       <span className="text-3xl md:text-5xl font-black transform group-hover:translate-x-2 transition-transform duration-500">→</span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
            
          </div>
        </div>

        {/* Support Section */}
        <div className="mt-20 text-center pb-20">
           <div className="inline-flex items-center gap-8 bg-white/50 backdrop-blur-xl px-10 py-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <a href="#" className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em] decoration-2 underline-offset-8 decoration-indigo-200">Docs</a>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
              <a href="#" className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em] decoration-2 underline-offset-8 decoration-indigo-200">Support</a>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
              <a href="#" className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em] decoration-2 underline-offset-8 decoration-indigo-200">Pricing</a>
           </div>
        </div>

      </div>
    </div>
  );
}