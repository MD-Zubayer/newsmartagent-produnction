"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  X, 
  MoreHorizontal, 
  Image as ImageIcon, 
  Smile, 
  PlusCircle,
} from "lucide-react";
import api from "@/lib/api";
import Image from "next/image";

export default function DashboardAI() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", content: "আসসালামু আলাইকুম! আমি New Smart Agent AI। আমি আপনাকে কিভাবে সাহায্য করতে পারি?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // ড্যাশবোর্ডের বাইরে দেখাবে না
  if (!pathname || !pathname.startsWith("/dashboard")) return null;

  // ১. ওয়েব সকেট কানেকশন
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const socketUrl = `${protocol}://${host}/ws/notifications/`;
    
    let socket;
    try {
      socket = new WebSocket(socketUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.action === "DASHBOARD_AI_REPLY") {
            setMessages((prev) => [...prev, { 
              role: "bot", 
              content: data.reply, 
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            }]);
            setIsTyping(false);
          }
        } catch (e) {
          console.error("WS Parse Error:", e);
        }
      };

      socket.onerror = (err) => console.error("WS Error:", err);
    } catch (err) {
      console.error("WS Connection Error:", err);
    }

    return () => {
      if (socket) socket.close();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleSend = async (val) => {
    const messageToSend = val || input;
    if (!messageToSend.trim()) return;

    const userMsg = messageToSend;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setMessages((prev) => [...prev, { role: "user", content: userMsg, time: now }]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await api.post("AgentAI/dashboard-ai/", {
        message: userMsg,
        path: pathname,
      });

      // সার্ভার মেসেজ রিসিভ করেছে, এখন ওয়েব সকেটের জন্য অপেক্ষা করব
      if (response.data && response.data.status === 'success') {
        console.log("Message queued:", response.data.message_id);
      } else {
        throw new Error("Queuing failed");
      }
    } catch (error) {
      console.error("AI Error:", error);
      setIsTyping(false);
      let errorMsg = "দুঃখিত, বর্তমানে আমার সিস্টেমে সমস্যা হচ্ছে।";
      
      if (error.response?.status === 401) {
        errorMsg = "আপনার সেশন শেষ হয়ে গেছে, দয়া করে আবার লগইন করুন।";
      }

      setMessages((prev) => [
        ...prev,
        { role: "bot", content: errorMsg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    }
  };

  return (
    <>
      {/* Messenger Style Floating Trigger */}
      <AnimatePresence mode="wait">
        {!isOpen && !isHidden && (
          <motion.div
            key="trigger"
            drag
            dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
            dragElastic={0.1}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            whileDrag={{ scale: 1.1, cursor: "grabbing" }}
            className="fixed bottom-6 right-6 z-[1000] cursor-grab p-1"
          >
            <div className="relative group">
               {/* Close Button (X) */}
               <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsHidden(true);
                  }}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full shadow-md z-20 flex items-center justify-center border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-gray-50"
               >
                 <X size={12} className="text-gray-500" />
               </button>

              {/* Animated Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-full blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-300"></div>
              
              {/* Main Button Container */}
              <div 
                onClick={() => setIsOpen(true)}
                className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-gradient-to-tr from-[#E0E7FF] to-[#F3E8FF] rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-[3px] border-white overflow-hidden relative z-10 p-0.5"
              >
                <div className="relative w-full h-full rounded-full overflow-hidden shadow-inner bg-white">
                  <Image 
                     src="/newsmartagent_ai_logo.jpeg" 
                     alt="New Smart Agent AI" 
                     fill
                     sizes="(max-width: 768px) 64px, 80px"
                     style={{ objectFit: 'cover' }}
                     className="hover:scale-110 transition-transform duration-500 ease-out"
                  />
                </div>
              </div>

              {/* Online Indicator Badge */}
              <div className="absolute bottom-1 right-1 w-4 h-4 md:w-5 md:h-5 bg-emerald-500 border-2 border-white rounded-full z-20 shadow-sm flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white opacity-80 animate-pulse"></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            initial={{ y: 100, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 right-0 sm:bottom-8 sm:right-8 z-[1001] w-full sm:w-[380px] h-[100dvh] sm:h-full sm:max-h-[600px] bg-white sm:rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-gray-100"
          >
            {/* Messenger Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-4 py-3 sm:py-4 flex items-center justify-between shadow-md relative z-10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white/20 shadow-sm relative p-0.5">
                    <div className="relative w-full h-full rounded-full overflow-hidden">
                      <Image 
                         src="/newsmartagent_ai_logo.jpeg" 
                         alt="AI Logo" 
                         fill
                         sizes="44px"
                         style={{ objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-indigo-700 rounded-full"></div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">New Smart Agent AI</h3>
                  <p className="text-[10px] text-indigo-100 font-medium font-sans flex items-center gap-1">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse"></span>
                    সবসময় আপনার পাশে
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-white/80">
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="hover:bg-white/10 p-2 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f0f2f5]/30 scrollbar-hide">
              <div className="flex flex-col items-center py-6 sm:py-8">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-3 p-1 bg-white rounded-full shadow-md border border-gray-100">
                   <div className="relative w-full h-full rounded-full overflow-hidden">
                      <Image 
                         src="/newsmartagent_ai_logo.jpeg" 
                         alt="New Smart Agent AI" 
                         fill
                         sizes="80px"
                         style={{ objectFit: 'cover' }}
                         className="rounded-full"
                      />
                   </div>
                </div>
                <h4 className="text-sm font-bold text-gray-800">New Smart Agent AI</h4>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mt-1">সবসময় আপনার পাশে</p>
              </div>

              {messages.map((m, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={i} 
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "bot" && (
                    <div className="w-7 h-7 rounded-full overflow-hidden mr-2 mt-auto border border-gray-100 flex-shrink-0 p-0.5 bg-white shadow-xs">
                      <div className="relative w-full h-full rounded-full overflow-hidden">
                        <Image 
                          src="/newsmartagent_ai_logo.jpeg" 
                          alt="Bot" 
                          fill
                          sizes="28px"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-2 sm:py-2.5 rounded-[1.25rem] text-xs sm:text-[13px] font-medium leading-[1.4] shadow-sm ${
                      m.role === "user" 
                        ? "bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-tr-[0.25rem]" 
                        : "bg-white border border-gray-100 text-gray-800 rounded-tl-[0.25rem]"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden mr-2 mt-auto border border-gray-100 flex-shrink-0 p-0.5 bg-white shadow-xs">
                    <div className="relative w-full h-full rounded-full overflow-hidden">
                      <Image 
                        src="/newsmartagent_ai_logo.jpeg" 
                        alt="Bot" 
                        fill
                        sizes="28px"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                  <div className="bg-white border border-gray-100 px-4 py-3 rounded-[1.25rem] rounded-tl-[0.25rem] flex gap-1.5 items-center shadow-sm">
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </motion.div>
              )}

              {/* Quick Suggestions */}
              {messages.length < 3 && !isTyping && (
                <div className="flex flex-wrap gap-2 pt-4">
                   {[
                     "Check my balance",
                     "How to create an Agent?",
                     "Check payments",
                     "Help with settings"
                     ].map((suggest, idx) => (
                     <motion.button
                       key={idx}
                       whileHover={{ scale: 1.05 }}
                       whileTap={{ scale: 0.95 }}
                       onClick={() => {
                         setInput(suggest);
                         // Use a short delay or state to trigger send
                         setTimeout(() => handleSend(suggest), 100);
                       }}
                       className="bg-white border border-blue-100 text-[#0084FF] px-4 py-2 rounded-full text-[11px] font-bold shadow-sm hover:shadow-md hover:bg-blue-50 transition-all cursor-pointer"
                     >
                       {suggest}
                     </motion.button>
                   ))}
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            {/* Messenger Style Input Area */}
            <div className="p-2 sm:p-3 bg-white border-t space-y-2 pb-safe">
              <div className="flex items-center gap-1 px-1">
                 <button className="text-indigo-500 hover:bg-indigo-50 p-1.5 sm:p-2 rounded-full transition-colors">
                    <PlusCircle size={18} className="sm:w-5 sm:h-5" />
                 </button>
                 <button className="text-indigo-500 hover:bg-indigo-50 p-1.5 sm:p-2 rounded-full transition-colors">
                    <ImageIcon size={18} className="sm:w-5 sm:h-5" />
                 </button>
                 <button className="text-indigo-500 hover:bg-indigo-50 p-1.5 sm:p-2 rounded-full transition-colors">
                    <Smile size={18} className="sm:w-5 sm:h-5" />
                 </button>
              </div>
              <div className="flex gap-2 items-center bg-[#f0f2f5] px-3 sm:px-4 py-1.5 sm:py-2 rounded-[1.25rem] sm:rounded-[1.5rem] focus-within:ring-2 focus-within:ring-indigo-100 transition-all mx-1">
                <input 
                  className="flex-1 bg-transparent outline-none text-xs sm:text-[13px] text-gray-700 placeholder:text-gray-500 font-medium"
                  placeholder="মেসেজ লিখুন..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <motion.button 
                  whileActive={{ scale: 0.9 }}
                  onClick={() => handleSend()} 
                  disabled={!input.trim() || isTyping}
                  className={`${input.trim() ? "text-indigo-600" : "text-gray-300"} transition-all duration-300`}
                >
                  <Send size={20} className="sm:w-[22px] sm:h-[22px]" fill={input.trim() ? "currentColor" : "none"} strokeWidth={input.trim() ? 1.5 : 2} />
                </motion.button>
              </div>
              <div className="text-[8px] sm:text-[9px] text-center text-gray-400 font-bold uppercase tracking-widest pb-1 opacity-50">
                End-to-end encrypted
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}