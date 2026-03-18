"use client";

import Link from "next/link";
import {
  FaFacebookF, FaTwitter, FaLinkedinIn, FaInstagram,
  FaPhoneAlt, FaEnvelope, FaMapMarkerAlt
} from "react-icons/fa";

const PaymentBadge = ({ name, color, bg }) => (
  <div className={`px-3 py-1.5 ${bg} rounded-lg flex items-center justify-center border border-white/10 hover:scale-105 transition-transform cursor-pointer`}>
    <span className={`text-[11px] font-black tracking-tight ${color}`}>{name}</span>
  </div>
);

function Footer() {
  const services = [
    "Facebook Automation",
    "Auto Commenter",
    "WhatsApp Marketing",
    "Bulk Messaging",
  ];

  const socials = [
    { icon: <FaFacebookF />, bg: "hover:bg-blue-600", label: "Facebook" },
    { icon: <FaTwitter />, bg: "hover:bg-sky-500", label: "Twitter" },
    { icon: <FaInstagram />, bg: "hover:bg-gradient-to-tr hover:from-pink-600 hover:to-orange-400", label: "Instagram" },
    { icon: <FaLinkedinIn />, bg: "hover:bg-blue-700", label: "LinkedIn" },
  ];

  return (
    <footer className="relative bg-[#06060f] text-white overflow-hidden">

      {/* === Decorative top border === */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      {/* === Ambient Glows === */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-indigo-700/10 rounded-full blur-[160px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-[400px] h-[400px] bg-pink-700/8 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-700/8 rounded-full blur-[140px]" />

      {/* === Dot-grid texture overlay === */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-8">

        {/* === Top Brand Bar === */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-16 border-b border-white/5">

          {/* Brand Identity */}
          <div className="space-y-4 max-w-md">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Bangladesh's Leading AI Tool</span>
            </div>
            <h1 className="text-5xl font-black tracking-[-0.03em] leading-none">
              New{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                Smart
              </span>{" "}
              Agent
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed font-medium max-w-sm">
              বাংলাদেশের সেরা অটোমেশন সলিউশন। আমাদের স্মার্ট এজেন্ট টুলস দিয়ে আপনার সোশ্যাল মিডিয়া ম্যানেজমেন্ট হবে আরও সহজ ও কার্যকর।
            </p>
          </div>

          {/* Stats strip */}
          <div className="flex gap-10 lg:gap-16">
            {[
              { value: "৫০০+", label: "সক্রিয় ক্লায়েন্ট" },
              { value: "৯৮%", label: "সন্তুষ্টি রেটিং" },
              { value: "২৪/৭", label: "সাপোর্ট" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* === Main Grid === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 py-16">

          {/* Column 1: Socials */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">আমাদের অনুসরণ করুন</h3>
            <div className="flex flex-wrap gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className={`w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-sm text-gray-400 hover:text-white transition-all duration-300 ${s.bg} hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/20`}
                >
                  {s.icon}
                </a>
              ))}
            </div>

            <div className="pt-2 space-y-3">
              <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Trusted by businesses across BD</p>
              <div className="flex -space-x-2">
                {["JR", "SA", "MH", "NK", "RL"].map((init, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-[#06060f] flex items-center justify-center text-[9px] font-black"
                    style={{
                      background: `hsl(${220 + i * 30}, 70%, 50%)`,
                    }}
                  >
                    {init}
                  </div>
                ))}
                <div className="w-7 h-7 rounded-full border-2 border-[#06060f] bg-white/10 flex items-center justify-center text-[8px] font-black text-gray-400">
                  +
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Services */}
          <div className="md:pl-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-6">সেবাসমূহ</h3>
            <ul className="space-y-3">
              {services.map((link) => (
                <li key={link}>
                  <Link
                    href="#"
                    className="group flex items-center gap-3 text-sm font-bold text-gray-500 hover:text-white transition-all duration-200"
                  >
                    <span className="w-5 h-px bg-indigo-500/0 group-hover:bg-indigo-500 group-hover:w-6 transition-all duration-300" />
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-6">যোগাযোগ</h3>
            <div className="space-y-4">

              <a href="tel:01727358743" className="group flex items-start gap-4">
                <div className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:border-indigo-500 group-hover:text-white transition-all duration-300">
                  <FaPhoneAlt size={13} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-0.5">ফোন</p>
                  <p className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">01727358743</p>
                </div>
              </a>

              <a href="mailto:newsmartagentbd@gmail.com" className="group flex items-start gap-4">
                <div className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:bg-pink-500 group-hover:border-pink-500 group-hover:text-white transition-all duration-300">
                  <FaEnvelope size={13} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-0.5">ইমেইল</p>
                  <p className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors break-all">newsmartagentbd@gmail.com</p>
                </div>
              </a>

              <div className="flex items-start gap-4">
                <div className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FaMapMarkerAlt size={13} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-0.5">ঠিকানা</p>
                  <p className="text-sm font-bold text-gray-400">Dhaka, Bangladesh</p>
                </div>
              </div>

            </div>
          </div>

          {/* Column 4: Payment */}
          <div className="space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">পেমেন্ট মেথড</h3>

            <div className="p-4 rounded-2xl bg-white/3 border border-white/6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">লোকাল পেমেন্ট</p>
              <div className="flex flex-wrap gap-2">
                <PaymentBadge name="bKash" color="text-pink-500" bg="bg-pink-500/10" />
                <PaymentBadge name="Nagad" color="text-orange-400" bg="bg-orange-500/10" />
                <PaymentBadge name="Rocket" color="text-purple-400" bg="bg-purple-500/10" />
              </div>

              <div className="h-px bg-white/5" />

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">ইন্টারন্যাশনাল</p>
              <div className="flex items-center gap-3 text-gray-500">
                {/* Visa SVG pill */}
                <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:scale-105 transition-transform cursor-pointer">
                  <svg width="36" height="12" viewBox="0 0 36 12" fill="none">
                    <text x="0" y="11" fontFamily="serif" fontWeight="900" fontStyle="italic" fontSize="13" fill="#60a5fa">VISA</text>
                  </svg>
                </div>
                {/* Mastercard circles */}
                <div className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:scale-105 transition-transform cursor-pointer flex items-center">
                  <div className="w-5 h-5 rounded-full bg-red-500/60" />
                  <div className="w-5 h-5 rounded-full bg-yellow-500/60 -ml-2" />
                </div>
                {/* PayPal */}
                <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:scale-105 transition-transform cursor-pointer">
                  <svg width="40" height="12" viewBox="0 0 40 12" fill="none">
                    <text x="0" y="11" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#38bdf8">Pay</text>
                    <text x="22" y="11" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#818cf8">Pal</text>
                  </svg>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-gray-600 font-bold leading-relaxed">
              ✦ সব ধরণের লোকাল ও ইন্টারন্যাশনাল পেমেন্ট গ্রহণযোগ্য।
            </p>
          </div>
        </div>

        {/* === Bottom Bar === */}
        <div className="relative pt-8 border-t border-white/5">
          {/* center glow on border */}
          <div className="absolute -top-px left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 text-[11px] font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} New Smart Agent — অল রাইটস রিজার্ভড।
            </p>
            <div className="flex gap-8 text-[11px] font-black uppercase tracking-widest">
              <a href="/privacy-policy" className="text-gray-600 hover:text-indigo-400 transition-colors">Privacy Policy</a>
              <a href="/terms-of-service" className="text-gray-600 hover:text-indigo-400 transition-colors">Terms of Use</a>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}

export default Footer;