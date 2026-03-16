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
  const [messages, setMessages] = useState([
    { role: "bot", content: "আসসালামু আলাইকুম! আমি New Smart Agent AI। আমি আপনাকে কিভাবে সাহায্য করতে পারি?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // ড্যাশবোর্ডের বাইরে দেখাবে না
  if (!pathname || !pathname.startsWith("/dashboard")) return null;

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

      if (response.data && response.data.reply) {
        setMessages((prev) => [...prev, { 
          role: "bot", 
          content: response.data.reply, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }]);
      } else {
        throw new Error("Invalid response");
      }
    } catch (error) {
      console.error("AI Error:", error);
      let errorMsg = "দুঃখিত, বর্তমানে আমার সিস্টেমে সমস্যা হচ্ছে।";
      
      if (error.response?.status === 401) {
        errorMsg = "আপনার সেশন শেষ হয়ে গেছে, দয়া করে আবার লগইন করুন।";
      }

      setMessages((prev) => [
        ...prev,
        { role: "bot", content: errorMsg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Messenger Style Floating Trigger */}
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.div
            key="trigger"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-8 right-8 z-[1000] cursor-pointer"
          >
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-tr from-[#0084FF] to-[#00C6FF] rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,132,255,0.4)] border-2 border-white overflow-hidden">
                <Image 
                   src="/newsmartagent_ai_logo.jpeg" 
                   alt="AI Logo" 
                   fill
                   style={{ objectFit: 'cover' }}
                   className="shadow-inner"
                />
              </div>
              <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-8 right-8 z-[1001] w-full max-w-[380px] h-full max-h-[600px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-gray-100"
          >
            {/* Messenger Header */}
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border border-blue-50 relative">
                    <Image 
                       src="/newsmartagent_ai_logo.jpeg" 
                       alt="AI Logo" 
                       fill
                       style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Smart Agent AI</h3>
                  <p className="text-[10px] text-green-500 font-medium font-sans">Active Now</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-blue-500">
                <button className="hover:bg-gray-100 p-2 rounded-full transition-colors">
                  <MoreHorizontal size={20} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="hover:bg-red-50 hover:text-red-500 p-2 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f0f2f5]/30 scrollbar-hide">
              <div className="flex flex-col items-center py-6">
                <div className="relative w-16 h-16 mb-2">
                   <Image 
                      src="/newsmartagent_ai_logo.jpeg" 
                      alt="AI Logo" 
                      fill
                      style={{ objectFit: 'cover' }}
                      className="rounded-full shadow-md"
                   />
                </div>
                <h4 className="text-xs font-bold text-gray-700">Smart Agent Support</h4>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Powered by AI</p>
              </div>

              {messages.map((m, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={i} 
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "bot" && (
                    <div className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-auto border border-gray-100 flex-shrink-0">
                      <Image src="/newsmartagent_ai_logo.jpeg" alt="Bot" width={24} height={24} />
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-2.5 rounded-[1.25rem] text-[13px] font-medium leading-[1.4] shadow-sm ${
                      m.role === "user" 
                        ? "bg-gradient-to-tr from-[#0084FF] to-[#00C6FF] text-white rounded-tr-[0.25rem]" 
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
                  <div className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-auto border border-gray-100 flex-shrink-0">
                    <Image src="/newsmartagent_ai_logo.jpeg" alt="Bot" width={24} height={24} />
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
            <div className="p-3 bg-white border-t space-y-2">
              <div className="flex items-center gap-1">
                 <button className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors tooltip" title="Quick Menu">
                    <PlusCircle size={20} />
                 </button>
                 <button className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors">
                    <ImageIcon size={20} />
                 </button>
                 <button className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors">
                    <Smile size={20} />
                 </button>
              </div>
              <div className="flex gap-2 items-center bg-[#f0f2f5] px-4 py-2 rounded-[1.5rem] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <input 
                  className="flex-1 bg-transparent outline-none text-[13px] text-gray-700 placeholder:text-gray-500 font-medium"
                  placeholder="Message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <motion.button 
                  whileActive={{ scale: 0.9 }}
                  onClick={handleSend} 
                  disabled={!input.trim() || isTyping}
                  className={`${input.trim() ? "text-[#0084FF]" : "text-gray-300"} transition-all duration-300`}
                >
                  <Send size={22} fill={input.trim() ? "currentColor" : "none"} strokeWidth={input.trim() ? 1.5 : 2} />
                </motion.button>
              </div>
              <div className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-widest pb-1 opacity-50">
                End-to-end encrypted
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}