"use client";

import Link from "next/link";
import { 
  FaFacebookF, FaTwitter, FaLinkedinIn, FaInstagram, 
  FaCcVisa, FaCcMastercard, FaCcPaypal, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt 
} from "react-icons/fa";

// পেমেন্ট আইকনগুলোর জন্য একটি কাস্টম কম্পোনেন্ট (যেহেতু bKash/Nagad ডিফল্ট আইকন লাইব্রেরিতে থাকে না)
const PaymentIcon = ({ name, color }) => (
  <div className={`px-3 py-1 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-100 hover:scale-110 transition-transform cursor-pointer`}>
    <span className={`text-[10px] font-black tracking-tighter ${color}`}>{name}</span>
  </div>
);

function Footer() {
  return (
    <footer className="relative bg-[#05050a] text-white pt-20 pb-6 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-pink-600/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Top Section: CTA / Newsletter */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-16 border-b border-white/5 items-center">
          <div className="lg:col-span-2">
            <h2 className="text-2xl md:text-3xl font-black mb-2">Grow your business faster today!</h2>
            <p className="text-gray-400 font-medium">আমাদের নিউজলেটারে যোগ দিন এবং নতুন সব আপডেট পান সরাসরি আপনার ইনবক্সে।</p>
          </div>
          <div className="relative group">
            <input 
              type="email" 
              placeholder="আপনার ইমেইল এড্রেস" 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-indigo-500/50 transition-all pr-32 font-medium"
            />
            <button className="absolute right-2 top-2 bottom-2 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:to-indigo-800 rounded-xl transition-all font-bold text-sm shadow-lg shadow-indigo-500/20">
              Subscribe
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 py-16">

          {/* Column 1: Brand */}
          <div className="space-y-6">
            <h1 className="text-3xl font-black tracking-tighter italic">
              New <span className="text-indigo-500">Smart</span> Agent
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed font-medium">
              আমরা দিচ্ছি বাংলাদেশের সেরা অটোমেশন সলিউশন। আমাদের স্মার্ট এজেন্ট টুলস দিয়ে আপনার সোশ্যাল মিডিয়া ম্যানেজমেন্ট হবে আরও সহজ এবং কার্যকর।
            </p>
            <div className="flex gap-3">
              {[
                { icon: <FaFacebookF />, bg: "hover:bg-blue-600" },
                { icon: <FaTwitter />, bg: "hover:bg-sky-500" },
                { icon: <FaInstagram />, bg: "hover:bg-pink-600" },
                { icon: <FaLinkedinIn />, bg: "hover:bg-blue-700" },
              ].map((s, i) => (
                <a key={i} href="#" className={`w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10 transition-all ${s.bg} hover:-translate-y-1`}>
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="md:pl-10">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500 mb-6">সেবাসমূহ</h3>
            <ul className="space-y-4">
              {["Facebook Automation", "Auto Commenter", "WhatsApp Marketing", "Bulk Messaging"].map((link) => (
                <li key={link}>
                  <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-bold flex items-center group">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500 mb-6">যোগাযোগ</h3>
            <div className="space-y-5">
              <a href="tel:01727358743" className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <FaPhoneAlt size={14} />
                </div>
                <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">01727358743</span>
              </a>
              <a href="mailto:newsmartagentbd@gmail.com" className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-all">
                  <FaEnvelope size={14} />
                </div>
                <span className="text-sm font-bold text-gray-300 group-hover:text-white break-all">newsmartagentbd@gmail.com</span>
              </a>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                  <FaMapMarkerAlt size={14} />
                </div>
                <span className="text-sm font-bold text-gray-300 italic">Dhaka, Bangladesh</span>
              </div>
            </div>
          </div>

          {/* Column 4: All Payment Methods */}
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">পেমেন্ট মেথড</h3>
            
            {/* Local Payments */}
            <div className="flex flex-wrap gap-2">
              <PaymentIcon name="bKash" color="text-pink-600" />
              <PaymentIcon name="Nagad" color="text-orange-500" />
              <PaymentIcon name="Rocket" color="text-purple-700" />
              <PaymentIcon name="Upay" color="text-yellow-500" />
            </div>

            {/* Global Payments */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
              <FaCcVisa className="text-3xl text-gray-400 hover:text-white transition-colors" />
              <FaCcMastercard className="text-3xl text-gray-400 hover:text-white transition-colors" />
              <FaCcPaypal className="text-3xl text-gray-400 hover:text-white transition-colors" />
            </div>
            
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
              * আমরা সব ধরণের লোকাল এবং ইন্টারন্যাশনাল পেমেন্ট গ্রহণ করি।
            </p>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-gray-500 text-[12px] font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} NEW SMART AGENT. অল রাইটস রিজার্ভড।
          </p>
          <div className="flex gap-8 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Terms of Use</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Refund Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;