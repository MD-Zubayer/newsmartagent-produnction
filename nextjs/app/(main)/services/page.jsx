"use client";

import {
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  ChartBarIcon,
  ArrowRightIcon,
  BoltIcon,
  CodeBracketIcon,
  RocketLaunchIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  FaPhoneAlt,
  FaArrowRight,
  FaRocket,
  FaShieldAlt,
  FaLightbulb,
  FaRobot,
  FaChartBar,
  FaCheckCircle,
} from "react-icons/fa";
import { motion } from "framer-motion";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function ServicesPage() {
  const { lang } = useLanguage();
  const tr = (en, bn) => (lang === "bn" ? bn : en);

  return (
    <section className="min-h-screen bg-slate-50 relative overflow-hidden">

      {/* ── Animated Background Orbs ── */}
      <div className="absolute top-0 left-0 w-full h-[900px] overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{ x: [0, 80, 0], y: [0, -60, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/20 blur-[120px] rounded-full mix-blend-multiply"
        />
        <motion.div
          animate={{ x: [0, -80, 0], y: [0, 60, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          className="absolute top-20 -right-20 w-[500px] h-[500px] bg-purple-500/20 blur-[120px] rounded-full mix-blend-multiply"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/4 w-[700px] h-[500px] bg-rose-500/10 blur-[120px] rounded-full mix-blend-multiply"
        />
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -40, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-500/15 blur-[100px] rounded-full mix-blend-multiply"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">

        {/* ── Header Section ── */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow-xl shadow-indigo-500/10 border border-indigo-100 text-xs font-black tracking-widest uppercase mb-8 transform transition-transform hover:scale-105 cursor-default">
            <SparklesIcon className="h-4 w-4 text-amber-500" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Our Services</span>
            <SparklesIcon className="h-4 w-4 text-amber-500" />
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-6 leading-tight">
            {tr("Everything to", "সবকিছু আছে")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
              {tr("Scale", "স্কেলের জন্য")}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-medium">
            {tr(
              "Not just automation—an end-to-end business growth system. Comments, Messenger, analytics, AI replies—all in one platform.",
              "শুধু অটোমেশন না — পুরো বিজনেস গ্রোথ সিস্টেম। কমেন্ট, মেসেঞ্জার, অ্যানালিটিক্স, AI রিপ্লাই — সব এক প্ল্যাটফর্মে।"
            )}
          </p>
        </motion.div>

        {/* ── Services Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-28">
          <ServiceCard
            icon={<ChatBubbleLeftRightIcon className="h-9 w-9 stroke-[1.8]" />}
            title="Comment Automation"
            desc={tr(
              "Auto-reply to every comment, pull customers into inbox, and convert sales automatically.",
              "প্রতিটি কমেন্টে অটো রিপ্লাই দিন, কাস্টমারকে ইনবক্সে আনুন এবং সেল কনভার্ট করুন অটোভাবে।"
            )}
            color="indigo"
            tag={tr("Automation", "অটোমেশন")}
            delay={0}
          />
          <ServiceCard
            icon={<CpuChipIcon className="h-9 w-9 stroke-[1.8]" />}
            title="Messenger Bot"
            desc={tr(
              "24/7 AI chatbot. Handles FAQ, orders, and lead collection automatically.",
              "২৪/৭ AI চ্যাটবট। FAQ, অর্ডার, লিড কালেকশন — সবকিছু নিজে নিজে হ্যান্ডেল করবে।"
            )}
            color="purple"
            tag={tr("AI Bot", "এআই বট")}
            delay={0.05}
          />
          <ServiceCard
            icon={<ChartBarIcon className="h-9 w-9 stroke-[1.8]" />}
            title="Analytics Dashboard"
            desc={tr(
              "See live data: replies sent, leads captured, sales closed—one click.",
              "কতজন রিপ্লাই দিলো, কত লিড এলো, কত সেল হলো — লাইভ ডেটা দেখুন এক ক্লিকে।"
            )}
            color="emerald"
            tag={tr("Analytics", "অ্যানালিটিক্স")}
            delay={0.1}
          />
          <ServiceCard
            icon={<CpuChipIcon className="h-9 w-9 stroke-[1.8]" />}
            title="Custom Auto Machine"
            desc={tr(
              "Need special automation or ML for your business? We'll build it for you.",
              "আপনার বিজনেসের জন্য স্পেশাল অটোমেশন বা মেশিন লার্নিং সリューション লাগবে? আমরা আছি আপনার পাশে।"
            )}
            color="blue"
            tag={tr("Custom ML", "কাস্টম এমএল")}
            delay={0.15}
          />
          <ServiceCard
            icon={<CodeBracketIcon className="h-9 w-9 stroke-[1.8]" />}
            title="Web Development"
            desc={tr(
              "Premium, fast websites for your business built with the latest tech.",
              "আপনার বিজনেসের জন্য প্রিমিয়াম এবং ফাস্ট ওয়েবসাইট তৈরি করে দিচ্ছি লেটেস্ট টেকনোলজি দিয়ে।"
            )}
            color="slate"
            tag={tr("Web Dev", "ওয়েব ডেভ")}
            delay={0.2}
          />
          <ServiceCard
            icon={<BoltIcon className="h-9 w-9 stroke-[1.8]" />}
            title="Instant Setup"
            desc={tr(
              "Live in 5 minutes with just Page ID + Token. No coding or developers needed.",
              "শুধু Page ID + Token দিলেই ৫ মিনিটে লাইভ। কোন কোডিং বা ডেভেলপার লাগবে না।"
            )}
            color="amber"
            tag={tr("Fast Setup", "ইনস্ট্যান্ট সেটআপ")}
            delay={0.25}
          />
        </div>

        {/* ── Agent/Commission Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-28 relative group"
        >
          <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[3rem] blur-lg opacity-30 group-hover:opacity-60 transition duration-1000 animate-pulse" />
          <div className="relative bg-white/90 backdrop-blur-xl border border-white p-10 md:p-12 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-indigo-900/10">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur-lg opacity-40 animate-pulse" />
                <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-2xl shadow-lg shadow-indigo-500/30">
                  <RocketLaunchIcon className="h-10 w-10 text-white" />
                </div>
              </div>
              <div>
                <h4 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  {tr("Want to be an agent?", "এজেন্ট হতে চান?")}
                </h4>
                <p className="text-slate-500 font-medium mt-1 text-lg">
                  {tr("Join as our agent and start earning today.", "আমাদের agent হিসেবে জয়েন করুন আর আয় শুরু করুন আজই।")}
                </p>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white px-10 py-7 rounded-[2rem] text-center shadow-2xl shadow-purple-500/30 cursor-default"
            >
              <span className="block text-sm font-bold uppercase tracking-widest opacity-80">
                {tr("Special Offer", "ধামাকা অফার")}
              </span>
              <span className="text-3xl md:text-4xl font-black italic">
                {tr("20% Commission", "২০% কমিশন")}
              </span>
              <span className="block text-sm font-semibold mt-1 opacity-90">
                {tr("For the first 5 months!", "প্রথম ৫ মাস পর্যন্ত!")}
              </span>
            </motion.div>
          </div>
        </motion.div>

        {/* ── Benefits Section ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative mb-28"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-[4rem] transform -rotate-1 scale-[1.02] z-0" />
          <div className="relative z-10 bg-white/80 backdrop-blur-xl rounded-[3.5rem] shadow-2xl shadow-indigo-900/10 border border-white p-10 md:p-16 overflow-hidden">

            {/* Decorative Glows */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-400/20 rounded-full blur-[100px]" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-purple-400/20 rounded-full blur-[100px]" />

            <div className="relative z-10 text-center mb-16 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-xs font-black tracking-widest uppercase text-indigo-700">
                <SparklesIcon className="h-4 w-4 text-amber-500" />
                Unmatched Advantages
              </div>
              <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                Why choose our{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                  services?
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative z-10">
              <Benefit
                icon={<FaShieldAlt />}
                title="Full Control"
                color="indigo"
                text={tr("Full control over every setting of your business.", "আপনার ব্যবসার প্রতিটি সেটিংসের ওপর থাকবে আপনার পূর্ণ নিয়ন্ত্রণ।")}
              />
              <Benefit
                icon={<FaRocket />}
                title="Instant Deployment"
                color="rose"
                text={tr("Go live in 5 minutes without any technical knowledge.", "কোনো টেকনিক্যাল নলেজ ছাড়াই মাত্র ৫ মিনিটে লাইভ সেটআপ।")}
              />
              <Benefit
                icon={<FaRobot />}
                title="AI Auto-Reply"
                color="blue"
                text={tr("Human-like, smart AI auto-reply system.", "মানুষের মতো নিখুঁত এবং স্মার্ট এআই অটো রিপ্লাই সিস্টেম।")}
              />
              <Benefit
                icon={<FaChartBar />}
                title="Token Optimized"
                color="emerald"
                text={tr("Reduce token costs with advanced optimization.", "অत्याধুনিক প্রযুক্তিতে আপনার টোকেন খরচ কমিয়ে আনুন।")}
              />
              <Benefit
                icon={<FaLightbulb />}
                title="Advanced Analytics"
                color="amber"
                text={tr("Full dashboard and detailed reports in one place.", "ফুল ড্যাশবোর্ড এবং ডিটেইলড রিপোর্ট পাবেন এক জায়গায়।")}
              />
              <Benefit
                icon={<FaPhoneAlt />}
                title="24/7 Support"
                color="purple"
                text={tr("We're by your side 24/7 for any issue.", "যেকোনো সমস্যায় আমরা আছি ২৪ ঘণ্টা আপনার পাশে।")}
              />
              <Benefit
                icon={<FaArrowRight />}
                title="Guided Tutorials"
                color="cyan"
                text={tr("Easy video guides and documentation to learn the system.", "সিস্টেম বুঝতে আমাদের রয়েছে সহজ ভিডিও গাইড ও ডকুমেন্টেশন।")}
              />
              <Benefit
                icon={<FaCheckCircle />}
                title="Affordable Pricing"
                color="green"
                text={tr("Best value and most affordable pricing in the market.", "মার্কেটে সবচেয়ে সাশ্রয়ী প্রাইস এবং সেরা ডিল আমরাই দিচ্ছি।")}
              />
            </div>
          </div>
        </motion.div>

        {/* ── CTA Section ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[3rem] blur-lg opacity-40 group-hover:opacity-70 transition duration-700" />
          <div className="relative text-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white py-20 rounded-[3rem] shadow-2xl overflow-hidden">

            {/* Floating shapes */}
            <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-20 -translate-y-20 group-hover:scale-150 transition-all duration-1000" />
            <div className="absolute bottom-0 right-0 w-56 h-56 bg-white/5 rounded-full translate-x-20 translate-y-20 group-hover:scale-125 transition-all duration-1000" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full group-hover:scale-110 transition-all duration-1000" />

            <div className="relative z-10">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 shadow-lg"
              >
                <RocketLaunchIcon className="h-8 w-8 text-white" />
              </motion.div>

              <h3 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                {tr("Ready to Automate?", "অটোমেট করতে প্রস্তুত?")}
              </h3>
              <p className="opacity-90 mb-10 font-medium text-lg max-w-xl mx-auto">
                {tr("Start today. Go live in 5 minutes.", "আজই শুরু করুন। ৫ মিনিটে লাইভ হয়ে যান।")}
              </p>

              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-white text-indigo-600 font-black px-12 py-5 rounded-2xl hover:shadow-2xl hover:shadow-white/20 transition-all flex items-center gap-3 mx-auto shadow-xl text-lg"
                >
                  {tr("Get Started", "শুরু করুন")}
                  <ArrowRightIcon className="h-5 w-5" />
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}

/* ── Service Card Component ── */
function ServiceCard({ icon, title, desc, color = "indigo", tag, delay = 0 }) {
  const { lang } = useLanguage();
  const tr = (en, bn) => (lang === "bn" ? bn : en);

  const serviceColors = {
    indigo: {
      color: '#4f46e5',
      bg: 'rgba(79,70,229,0.06)',
      border: 'rgba(79,70,229,0.15)',
    },
    purple: {
      color: '#a855f7',
      bg: 'rgba(168,85,247,0.06)',
      border: 'rgba(168,85,247,0.15)',
    },
    emerald: {
      color: '#10b981',
      bg: 'rgba(16,185,129,0.06)',
      border: 'rgba(16,185,129,0.15)',
    },
    blue: {
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.06)',
      border: 'rgba(59,130,246,0.15)',
    },
    slate: {
      color: '#475569',
      bg: 'rgba(71,85,105,0.06)',
      border: 'rgba(71,85,105,0.15)',
    },
    amber: {
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.06)',
      border: 'rgba(245,158,11,0.15)',
    },
  };

  const theme = serviceColors[color] || serviceColors.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -8 }}
      className="group cursor-pointer h-full"
    >
      {/* Outer Card (The colorful thick border) */}
      <div 
        className="relative p-2 rounded-[2.5rem] h-full transition-all duration-500"
        style={{
          background: `linear-gradient(145deg, ${theme.bg}, #ffffff)`,
          boxShadow: `0 20px 40px -15px ${theme.color}30, 0 0 0 1px ${theme.border}`,
        }}
      >
        {/* Inner Card (The white content area) */}
        <div className="relative bg-white/90 backdrop-blur-2xl h-full rounded-[2.25rem] p-8 flex flex-col border border-white overflow-hidden shadow-sm transition-all duration-300 group-hover:bg-white group-hover:shadow-lg">
          
          {/* Glowing blur behind icon */}
          <div 
            className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40" 
            style={{ background: theme.color }} 
          />

          {/* Realistic 3D Icon Container & Tag */}
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div 
              className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3"
              style={{
                background: `linear-gradient(135deg, ${theme.bg}, #ffffff)`,
                border: `1px solid ${theme.border}`,
                boxShadow: `inset 0 4px 8px rgba(255,255,255,0.8), 0 10px 25px -5px ${theme.color}40`,
                filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.05))',
                color: theme.color
              }}
            >
              {icon}
            </div>
            
            {tag && (
              <span 
                className="px-4 py-1.5 rounded-full text-xs font-black tracking-wide shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${theme.color}, ${theme.color}dd)`, 
                  color: '#fff',
                  boxShadow: `0 4px 10px ${theme.color}40`
                }}
              >
                {tag}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="relative z-10 flex-1">
            <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight group-hover:text-slate-800 transition-colors">
              {title}
            </h2>
            <p className="text-base text-slate-500 font-medium leading-relaxed">
              {desc}
            </p>
          </div>

          {/* Fancy CTA Button inside card */}
          <div className="mt-8 relative z-10 flex items-center justify-between">
            <div 
              className="flex items-center gap-3 font-black text-sm px-5 py-2.5 rounded-2xl transition-all duration-300 group-hover:px-6"
              style={{ 
                background: theme.bg,
                color: theme.color,
                border: `1px solid ${theme.border}`
              }}
            >
              {tr("Learn More", "আরও জানুন")}
              <FaArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
          
        </div>
      </div>
    </motion.div>
  );
}

/* ── Benefit Card Component ── */
function Benefit({ icon, title, text, color = "indigo" }) {
  const colorMap = {
    indigo: { gradient: "from-indigo-500 to-blue-600", bg: "bg-indigo-100", text: "text-indigo-600", hover: "group-hover:bg-gradient-to-br group-hover:from-indigo-500 group-hover:to-blue-600", border: "border-indigo-200", bgTint: "from-indigo-50 to-white" },
    rose: { gradient: "from-rose-500 to-pink-600", bg: "bg-rose-100", text: "text-rose-600", hover: "group-hover:bg-gradient-to-br group-hover:from-rose-500 group-hover:to-pink-600", border: "border-rose-200", bgTint: "from-rose-50 to-white" },
    blue: { gradient: "from-blue-500 to-cyan-600", bg: "bg-blue-100", text: "text-blue-600", hover: "group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-cyan-600", border: "border-blue-200", bgTint: "from-blue-50 to-white" },
    emerald: { gradient: "from-emerald-500 to-teal-600", bg: "bg-emerald-100", text: "text-emerald-600", hover: "group-hover:bg-gradient-to-br group-hover:from-emerald-500 group-hover:to-teal-600", border: "border-emerald-200", bgTint: "from-emerald-50 to-white" },
    amber: { gradient: "from-amber-500 to-orange-500", bg: "bg-amber-100", text: "text-amber-600", hover: "group-hover:bg-gradient-to-br group-hover:from-amber-500 group-hover:to-orange-500", border: "border-amber-200", bgTint: "from-amber-50 to-white" },
    purple: { gradient: "from-purple-500 to-fuchsia-600", bg: "bg-purple-100", text: "text-purple-600", hover: "group-hover:bg-gradient-to-br group-hover:from-purple-500 group-hover:to-fuchsia-600", border: "border-purple-200", bgTint: "from-purple-50 to-white" },
    cyan: { gradient: "from-cyan-500 to-blue-500", bg: "bg-cyan-100", text: "text-cyan-600", hover: "group-hover:bg-gradient-to-br group-hover:from-cyan-500 group-hover:to-blue-500", border: "border-cyan-200", bgTint: "from-cyan-50 to-white" },
    green: { gradient: "from-green-500 to-emerald-500", bg: "bg-green-100", text: "text-green-600", hover: "group-hover:bg-gradient-to-br group-hover:from-green-500 group-hover:to-emerald-500", border: "border-green-200", bgTint: "from-green-50 to-white" },
  };
  const theme = colorMap[color] || colorMap.indigo;

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.04 }}
      className={`group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${theme.bgTint} border ${theme.border} shadow-md hover:shadow-xl transition-all duration-300 cursor-default`}
    >
      {/* Top gradient accent line */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-300 rounded-t-2xl`} />
      
      {/* Hover glow */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${theme.gradient} rounded-full opacity-0 blur-[60px] group-hover:opacity-15 transition-opacity duration-500`} />

      <div className="flex items-start gap-4 relative z-10">
        <div className={`flex-shrink-0 w-12 h-12 ${theme.bg} ${theme.hover} rounded-xl flex items-center justify-center ${theme.text} group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-lg`}>
          <span className="text-lg">{icon}</span>
        </div>
        <div>
          <h4 className="font-bold text-slate-900 text-sm mb-1.5 group-hover:text-slate-800 transition-colors">{title}</h4>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">{text}</p>
        </div>
      </div>
    </motion.div>
  );
}
