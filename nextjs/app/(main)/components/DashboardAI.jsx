"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { FaRobot, FaTimes, FaPaperPlane, FaMagic } from "react-icons/fa";
import api from "@/lib/api"; // আপনার lib/api.js ইমপোর্ট করুন

export default function DashboardAI() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // ড্যাশবোর্ডের বাইরে দেখাবে না
  if (!pathname || !pathname.startsWith("/dashboard")) return null;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsTyping(true);

    try {
      // আপনার api.js ব্যবহার করে রিকোয়েস্ট পাঠানো
      // এটি অটোমেটিক কুকি, রিফ্রেশ টোকেন এবং ৪০১ এরর হ্যান্ডেল করবে
      const response = await api.post("AgentAI/dashboard-ai/", {
        message: userMsg,
        path: pathname,
      });

      if (response.data && response.data.reply) {
        setMessages((prev) => [...prev, { role: "bot", content: response.data.reply }]);
      } else {
        throw new Error("Invalid response");
      }
    } catch (error) {
      console.error("AI Error:", error);
      let errorMsg = "দুঃখিত, সংযোগে সমস্যা হচ্ছে।";
      
      if (error.response?.status === 401) {
        errorMsg = "আপনার সেশন শেষ হয়ে গেছে, দয়া করে আবার লগইন করুন।";
      }

      setMessages((prev) => [
        ...prev,
        { role: "bot", content: errorMsg },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating AI Button */}
      <div 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-[1000] w-16 h-16 bg-gradient-to-tr from-slate-900 to-indigo-800 rounded-full flex items-center justify-center text-white shadow-2xl cursor-pointer hover:scale-110 transition-all border-2 border-indigo-400 animate-pulse"
      >
        <FaRobot size={28} />
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-28 right-8 z-[1001] w-[350px] h-[550px] bg-white rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden border border-slate-200 animate-in slide-in-from-right-5 duration-300">
          
          {/* Header */}
          <div className="bg-slate-900 p-6 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg"><FaMagic size={14} /></div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest">Assistant AI</h3>
                <p className="text-[8px] text-emerald-400 font-bold uppercase">Auth Secured</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:text-red-400 transition-colors"><FaTimes /></button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center py-10 opacity-30">
                <FaRobot className="mx-auto mb-4" size={40} />
                <p className="text-[10px] font-bold">পেজ সম্পর্কে জানতে প্রশ্ন করুন।</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-[12px] font-bold leading-relaxed shadow-sm ${
                  m.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-200 rounded-tl-none"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && <div className="text-[9px] text-indigo-500 font-black animate-pulse ml-2">AI টাইপ করছে...</div>}
            <div ref={scrollRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t">
            <div className="flex gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200 focus-within:border-indigo-400 transition-all">
              <input 
                className="flex-1 bg-transparent px-2 outline-none text-[12px] font-bold"
                placeholder="কী জানতে চান?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-slate-900 transition-all shadow-md disabled:opacity-50" disabled={isTyping}>
                <FaPaperPlane size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}