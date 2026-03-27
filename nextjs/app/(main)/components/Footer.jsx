"use client";

import Link from "next/link";
import {
  FaFacebookF, FaTwitter, FaLinkedinIn, FaInstagram,
  FaPhoneAlt, FaEnvelope, FaMapMarkerAlt
} from "react-icons/fa";

const PaymentBadge = ({ name, color, bg }) => (
  <div className={`px-3 py-1.5 ${bg} rounded-lg flex items-center justify-center border border-white/10 hover:scale-105 active:scale-95 transition-transform cursor-pointer`}>
    <span className={`text-[11px] font-black tracking-tight ${color}`}>{name}</span>
  </div>
);

function Footer() {
  const services = [
    "Facebook Automation",
    "Messenger Bot",
    "WhatsApp Marketing",
    "Auto Commenter",
    "Bulk Messaging",
    "Lead Generation",
  ];

  const socials = [
    { icon: <FaFacebookF />, bg: "hover:bg-blue-600", label: "Facebook" },
    { icon: <FaTwitter />, bg: "hover:bg-sky-500", label: "Twitter" },
    { icon: <FaInstagram />, bg: "hover:bg-gradient-to-tr hover:from-pink-600 hover:to-orange-400", label: "Instagram" },
    { icon: <FaLinkedinIn />, bg: "hover:bg-blue-700", label: "LinkedIn" },
  ];

  return (
    <footer className="relative bg-[#08081a] text-white overflow-hidden">

      {/* === Decorative top border === */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-30" />

      {/* === Ambient Glows === */}
      <div className="pointer-events-none absolute top-[-100px] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-600/10 rounded-full blur-[160px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[150px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-12">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 pb-20">
          
          {/* Brand Info */}           <div className="space-y-6">
              <Link href="/" className="inline-block">
                <h2 className="text-4xl font-black tracking-tighter">
                  New <span className="text-gradient">Smart</span> Agent
                </h2>
              </Link>
              <p className="text-gray-400 font-medium text-lg leading-relaxed">
                বাংলাদেশের ১ নম্বর এআই চালিত সোশ্যাল মিডিয়া অটোমেশন প্লাটফর্ম। আপনার ব্যবসাকে দিন এক নতুন গতি।
              </p>
            </div>
            
            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Connect With Us</h3>
              <div className="flex flex-wrap gap-4">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href="#"
                    className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg text-gray-400 hover:text-white transition-all duration-300 ${s.bg} hover:-translate-y-2 hover:shadow-xl hover:shadow-indigo-500/20`}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Links Grid */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-10">
            <div className="space-y-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Services</h3>
              <ul className="space-y-4">
                {services.map((link) => (
                  <li key={link}>
                    <Link href="#" className="text-gray-400 hover:text-white font-bold transition-colors flex items-center gap-2 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 scale-0 group-hover:scale-100 transition-transform"></span>
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Company</h3>
              <ul className="space-y-4">
                {["About Us", "Contact Us", "Privacy Policy", "Terms of Use", "Blog", "Docs"].map((link) => (
                  <li key={link}>
                    <Link href="#" className="text-gray-400 hover:text-white font-bold transition-colors">
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Contact & Support */}
          <div className="lg:col-span-3 space-y-10">
            <div className="space-y-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Contact</h3>
              <div className="space-y-5">
                <a href="tel:01727358743" className="flex items-center gap-4 text-gray-400 hover:text-white transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <FaPhoneAlt size={14} />
                  </div>
                  <span className="font-bold">01727358743</span>
                </a>
                <a href="mailto:newsmartagentbd@gmail.com" className="flex items-center gap-4 text-gray-400 hover:text-white transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:bg-pink-600 group-hover:text-white transition-all">
                    <FaEnvelope size={14} />
                  </div>
                  <span className="font-bold text-sm truncate">newsmartagentbd@gmail.com</span>
                </a>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Trusted By Businesses</p>
              <div className="flex gap-2">
                {["bKash", "Nagad", "Rocket"].map(p => (
                   <div key={p} className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black">{p}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-gray-500 text-xs font-bold">
            © {new Date().getFullYear()} NEW SMART AGENT. ALL RIGHTS RESERVED.
          </p>
          <p className="text-gray-500 text-[10px] font-black tracking-[0.2em] uppercase">
            Built with ❤️ in Bangladesh
          </p>
        </div>
      </div>
    </footer>
  );
}

   

export default Footer;