"use client";

import Link from "next/link";
import { useState } from "react";
import { 
  FaFacebook, FaWhatsapp, FaInstagram, FaTelegram, 
  FaArrowLeft, FaLink, FaCopy, FaYoutube, FaCode, FaRobot, FaShieldAlt, FaExternalLinkAlt
} from "react-icons/fa";

export default function IntegrationManager({ webhookUrl = "" }) {
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  const platformConfigs = {
    facebook: { 
      id: "facebook", 
      name: "Facebook", 
      icon: <FaFacebook />, 
      color: "bg-blue-600", 
      videoUrl: "https://www.youtube.com/embed/your-fb-video-id",
      devLink: "https://developers.facebook.com/apps/",
      btnText: "Create App"
    },
    whatsapp: { 
      id: "whatsapp", 
      name: "WhatsApp Business", 
      icon: <FaWhatsapp />, 
      color: "bg-green-500", 
      videoUrl: "https://www.youtube.com/embed/your-wa-video-id",
      devLink: "https://developers.facebook.com/apps/", // WhatsApp ও ফেইসবুক ডেভেলপার ড্যাশবোর্ড থেকেই হয়
      btnText: "Setup Business"
    },
    instagram: { 
      id: "instagram", 
      name: "Instagram", 
      icon: <FaInstagram />, 
      color: "bg-pink-600", 
      videoUrl: "https://www.youtube.com/embed/your-insta-video-id",
      devLink: "https://developers.facebook.com/apps/",
      btnText: "Link API"
    },
    telegram: { 
      id: "telegram", 
      name: "Telegram Bot", 
      icon: <FaTelegram />, 
      color: "bg-sky-500", 
      videoUrl: "https://www.youtube.com/embed/your-tg-video-id",
      devLink: "https://t.me/BotFather", // টেলিগ্রামের জন্য সরাসরি BotFather লিঙ্ক
      btnText: "Create Bot"
    }
  };

  const copyToClipboard = () => {
    const url = webhookUrl || `https://api.site.com/wh/${selectedPlatform.id}`;
    navigator.clipboard.writeText(url);
    alert("Webhook URL Copied!");
  };

  if (!selectedPlatform) {
    return (
      <div className="w-full py-6 md:py-12 px-3 md:px-10 font-sans">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-8 md:mb-12 text-left">
            <h2 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">Connect Channels</h2>
            <p className="text-gray-500 mt-1 text-sm md:text-lg font-medium">Select a platform to start</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {Object.values(platformConfigs).map((p) => (
              <div key={p.id} onClick={() => setSelectedPlatform(p)} className="group cursor-pointer bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl ${p.color} text-white flex items-center justify-center mb-4 shadow-lg group-hover:scale-105 transition-transform`}>
                  <span className="text-2xl md:text-3xl">{p.icon}</span>
                </div>
                <h3 className="font-black text-gray-800 text-lg md:text-xl">{p.name}</h3>
                <div className="mt-4 flex items-center text-indigo-600 font-bold text-xs uppercase">Configure <span className="ml-2">→</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-4 md:py-10 px-2 md:px-10 font-sans animate-in fade-in duration-500">
      <div className="max-w-[1200px] mx-auto">
        
        <button onClick={() => setSelectedPlatform(null)} className="flex items-center gap-2 text-gray-400 hover:text-indigo-600 font-black text-xs mb-5 transition-all uppercase tracking-widest">
          <FaArrowLeft /> Back
        </button>

        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          
          <div className={`${selectedPlatform.color} p-6 md:p-14 text-white relative`}>
            <div className="relative z-10 flex items-center gap-4 md:gap-8">
              <div className="p-4 md:p-6 bg-white/20 rounded-[1.2rem] md:rounded-[2rem] backdrop-blur-xl border border-white/30 shadow-inner">
                <span className="text-3xl md:text-6xl">{selectedPlatform.icon}</span>
              </div>
              <div className="text-left">
                <h2 className="text-xl md:text-5xl font-black tracking-tighter leading-tight">Link {selectedPlatform.name}</h2>
                <p className="text-white/80 text-[10px] md:text-sm font-black uppercase tracking-[0.1em] mt-1">Configuration</p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-12">
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 md:gap-16">
              
              <div className="lg:col-span-7 space-y-6 md:y-8 w-full order-1">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FaCode className="text-indigo-600 text-sm" />
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">Webhook Endpoint</label>
                    </div>
                    
                    {/* Dynamic Developer Link for all platforms */}
                    {selectedPlatform.devLink && (
                      <a 
                        href={selectedPlatform.devLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-black text-[10px] md:text-[11px] uppercase tracking-tighter transition-colors"
                      >
                        <FaExternalLinkAlt size={10} /> {selectedPlatform.btnText}
                      </a>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <div className="w-full px-4 md:px-6 py-4 md:py-5 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl md:rounded-2xl overflow-hidden">
                       <p className="text-[11px] md:text-sm font-mono font-bold text-indigo-600 break-all">
                         {webhookUrl || `https://api.site.com/wh/${selectedPlatform.id}`}
                       </p>
                    </div>
                    <button 
                      onClick={copyToClipboard}
                      className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
                    >
                      <FaCopy /> Copy URL
                    </button>
                  </div>
                  
                  <p className="text-[10px] md:text-[11px] text-gray-400 font-bold italic flex items-center gap-1 leading-relaxed">
                    <FaShieldAlt className="text-emerald-500 shrink-0" /> Copy this URL and paste it into your developer console.
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-50">
                  <Link href='/dashboard/aiAgent'>
                  <button 
                    
                    className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white py-5 md:py-6 rounded-xl md:rounded-2xl font-black text-sm md:text-lg uppercase tracking-widest hover:bg-gray-900 transition-all shadow-xl active:scale-[0.98] group"
                  >
                    <FaRobot className="text-xl md:text-2xl group-hover:animate-bounce" />
                    Connect AI Agent
                  </button>
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4 w-full order-2">
                <div className="flex items-center gap-2">
                  <FaYoutube className="text-red-600" />
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Setup Video Guide</label>
                </div>
                <div className="relative w-full aspect-video rounded-2xl md:rounded-3xl overflow-hidden shadow-xl border-4 border-gray-900 bg-black">
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src={selectedPlatform.videoUrl}
                    title="Tutorial"
                    frameBorder="0"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                   <p className="text-[10px] text-amber-700 font-black leading-relaxed text-center uppercase tracking-tighter">
                     ⚠️ Watch carefully to avoid connection errors
                   </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}