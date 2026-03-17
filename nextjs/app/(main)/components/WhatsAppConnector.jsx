"use client";

import { useState, useEffect, useCallback } from "react";
import { FaWhatsapp, FaSync, FaCheckCircle, FaExclamationCircle, FaShieldAlt } from "react-icons/fa";
import axiosInstance from "@/lib/api";
import { toast } from "react-hot-toast";

export default function WhatsAppConnector() {
  const [status, setStatus] = useState("close"); // close, connecting, open
  const [qrCode, setQrCode] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connectedPhone, setConnectedPhone] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [usePairingCode, setUsePairingCode] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/whatsapp/status/");
      const s = res.data.state || "close";
      setStatus(s);
      setConnectedPhone(res.data.phone);
      setPairingCode(res.data.pairingCode);
      if (s === "open") {
        setQrCode(null);
        setPairingCode(null);
      }
    } catch (err) {
      console.error("Status check failed", err);
    }
  }, []);

  const fetchQR = useCallback(async () => {
    if (status === "open") return;
    try {
      const res = await axiosInstance.get("/whatsapp/qr/");
      if (res.data.qr) {
        setQrCode(res.data.qr);
      }
    } catch (err) {
      console.error("QR fetch failed", err);
    }
  }, [status]);

  const initSession = async () => {
    if (usePairingCode && !phoneNumber) {
      toast.error("Please enter your phone number");
      return;
    }
    setIsInitializing(true);
    try {
      await axiosInstance.post("/whatsapp/init/", { phone: phoneNumber });
      toast.success(usePairingCode ? "Generating Pairing Code..." : "Initializing WhatsApp session...");
      setStatus("connecting");
    } catch (err) {
      toast.error("Failed to initialize session");
      console.error(err);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
      if (status === "connecting" && !pairingCode) {
        fetchQR();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [status, fetchStatus, fetchQR, pairingCode]);

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter italic uppercase">
            WhatsApp Connectivity
          </h3>
          <p className="text-[10px] md:text-xs text-emerald-600 font-black uppercase tracking-[0.3em] opacity-70 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span> 
            {status === "open" ? "System Online" : status === "connecting" ? "Establishing Link..." : "Ready for Deployment"}
          </p>
        </div>

        {status === "close" && !usePairingCode && (
          <button
            onClick={() => setUsePairingCode(true)}
            className="text-[10px] font-black text-slate-400 hover:text-emerald-500 uppercase tracking-widest transition-all"
          >
            Pair with Phone Number?
          </button>
        )}
      </div>

      {/* Main Connection Area */}
      <div className="bg-slate-50/50 rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-12 border border-slate-100 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          
          {/* Status Display / QR Code / Pairing Code */}
          <div className="shrink-0 w-full md:w-auto">
            {status === "open" ? (
              <div className="bg-white p-10 rounded-[2rem] border border-emerald-100 shadow-2xl flex flex-col items-center gap-6 text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
                  <FaCheckCircle size={48} />
                </div>
                <div>
                  <p className="font-black text-slate-900 text-xl tracking-tight uppercase italic mb-1">Authenticated</p>
                  <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Linked: {connectedPhone}</p>
                </div>
                <button 
                  onClick={() => {
                    setStatus("close");
                    setUsePairingCode(false);
                    setPairingCode(null);
                    setQrCode(null);
                  }}
                  className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors"
                >
                  Reconnect New Device?
                </button>
              </div>
            ) : status === "connecting" ? (
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-2xl relative group min-w-[300px] flex flex-col items-center justify-center min-h-[300px]">
                {pairingCode ? (
                   <div className="space-y-6 flex flex-col items-center text-center">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Your Pairing Code</p>
                        <div className="flex gap-2">
                          {pairingCode.split('').map((char, i) => (
                            <div key={i} className={`w-8 h-12 md:w-10 md:h-14 flex items-center justify-center rounded-xl text-xl md:text-2xl font-black shadow-sm border ${char === '-' ? 'bg-transparent border-none w-4' : 'bg-slate-50 border-slate-100 text-indigo-600'}`}>
                              {char}
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 max-w-[200px]">Enter this code on your phone to link your account.</p>
                      <button 
                        onClick={() => { setPairingCode(null); initSession(); }}
                        className="text-[9px] font-black text-slate-300 hover:text-indigo-600 uppercase tracking-widest transition-colors"
                      >
                        Regenerate Code?
                      </button>
                   </div>
                ) : qrCode && !usePairingCode ? (
                  <div className="space-y-6 flex flex-col items-center">
                    <div className="bg-white p-4 rounded-3xl border-2 border-slate-50 shadow-inner">
                      <div className="w-48 h-48 md:w-64 md:h-64 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCode)}`}
                          alt="WhatsApp QR Code"
                          className="w-full h-full p-2"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] animate-pulse">Scan with WhatsApp</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                      {usePairingCode ? "Generating Code..." : "Generating QR..."}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-2xl flex flex-col items-center justify-center gap-8 min-w-[320px]">
                {usePairingCode ? (
                  <div className="w-full space-y-6">
                    <div className="text-center space-y-2">
                       <FaShieldAlt className="mx-auto text-emerald-500 text-3xl" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secure Pairing</p>
                    </div>
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        placeholder="Phone (e.g. 88017...)" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-900 font-bold placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        onClick={initSession}
                        disabled={isInitializing || !phoneNumber}
                        className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isInitializing ? "Processing..." : "Get Pairing Code"}
                      </button>
                      <button
                        onClick={() => setUsePairingCode(false)}
                        className="w-full text-[9px] font-black text-slate-300 hover:text-slate-500 uppercase tracking-widest transition-colors"
                      >
                         Use QR Code Instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
                       <FaWhatsapp size={48} className="text-emerald-500" />
                    </div>
                    <div className="space-y-4">
                      <button
                        onClick={initSession}
                        disabled={isInitializing}
                        className="w-full bg-emerald-500 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                      >
                        {isInitializing ? "Wait..." : "Connect Session"}
                      </button>
                      <p className="text-[9px] font-black text-slate-200 uppercase tracking-[0.3em]">Awaiting Command</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Explanation / Stepper */}
          <div className="space-y-8 flex-1">
             <div className="space-y-4">
               <h4 className="text-xl font-bold text-slate-900 tracking-tight uppercase italic flex items-center gap-3">
                 <FaShieldAlt className="text-indigo-600" /> Connection Protocol
               </h4>
               <p className="text-slate-500 text-sm md:text-base leading-relaxed opacity-80">
                 Follow these steps to synchronize your WhatsApp business asset with our AI cognitive system.
               </p>
             </div>

             <div className="space-y-6">
               <div className="flex gap-4">
                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-[10px] font-black text-slate-400">01</div>
                 <div>
                   <p className="text-xs font-black text-slate-900 uppercase tracking-tight mb-1">Initialize Session</p>
                   <p className="text-[11px] text-slate-500 leading-tight">
                     {usePairingCode 
                       ? "Enter your WhatsApp phone number and request a secure pairing code." 
                       : "Click the button to request a secure link from the Baileys server matrix."}
                   </p>
                 </div>
               </div>
               <div className="flex gap-4">
                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-[10px] font-black text-slate-400">02</div>
                 <div>
                   <p className="text-xs font-black text-slate-900 uppercase tracking-tight mb-1">
                     {usePairingCode ? "Enter Code on Phone" : "Scan QR Code"}
                   </p>
                   <p className="text-[11px] text-slate-500 leading-tight">
                     {usePairingCode 
                       ? "Open WhatsApp → Settings → Linked Devices → Link with phone number → Enter the 8-digit code."
                       : "Open WhatsApp on your mobile → Settings → Linked Devices → Scan the generated code."}
                   </p>
                 </div>
               </div>
               <div className="flex gap-4">
                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-[10px] font-black text-slate-400">03</div>
                 <div>
                   <p className="text-xs font-black text-slate-900 uppercase tracking-tight mb-1">Auto-Provisioning</p>
                   <p className="text-[11px] text-slate-500 leading-tight">Once connected, an AI Agent will be automatically deployed to handle your conversations.</p>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
