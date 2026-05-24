"use client";

import {
  RocketLaunchIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  SparklesIcon,
  BoltIcon,
  CpuChipIcon,
  ChartBarIcon,
  LifebuoyIcon,
  CheckBadgeIcon,
  ArrowRightIcon
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";

export default function AboutPage() {
  const { lang } = useLanguage();
  const tr = (en, bn) => (lang === "bn" ? bn : en);

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "New Smart Agent",
    url: "https://newsmartagent.com",
    logo: "https://newsmartagent.com/newsmartagent.png",
    description:
      "New Smart Agent is an AI automation platform for Facebook pages, messenger automation, and smart customer management.",
    sameAs: [
      "https://facebook.com/newsmartagent",
      "https://youtube.com/@newsmartagent",
    ],
  };

  return (
    <div className="bg-slate-50 relative overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />

      {/* Dynamic Animated Orbs */}
      <div className="absolute top-0 left-0 w-full h-[800px] overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/20 blur-[120px] rounded-full mix-blend-multiply" 
        />
        <motion.div
          animate={{ x: [0, -100, 0], y: [0, 50, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-20 -right-20 w-[500px] h-[500px] bg-rose-500/20 blur-[120px] rounded-full mix-blend-multiply" 
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/3 w-[700px] h-[500px] bg-amber-500/15 blur-[120px] rounded-full mix-blend-multiply" 
        />
      </div>

      <section className="relative z-10 min-h-screen px-6 py-24">
        
        {/* Header Titles */}
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow-xl shadow-indigo-500/10 border border-indigo-100 text-indigo-600 text-xs font-black tracking-widest uppercase mb-8 transform transition-transform hover:scale-105 cursor-default">
            <SparklesIcon className="h-4 w-4 text-amber-500" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">About Us</span>
            <SparklesIcon className="h-4 w-4 text-amber-500" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
            {tr("The Future of", "ভবিষ্যতের")} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
              {tr("Automation", "অটোমেশন")}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-medium">
            {tr(
              "New Smart Agent is an AI automation platform built for modern businesses. We remove engineering overhead so you can focus on growth.",
              "নিউ স্মার্ট এজেন্ট হলো আধুনিক ব্যবসার জন্য এআই অটোমেশন প্ল্যাটফর্ম। ইঞ্জিনিয়ারিং ঝামেলা ছাড়াই আপনার ব্যবসাকে এগিয়ে নিন।"
            )}
          </p>
        </motion.div>

        <div className="mx-auto max-w-7xl">
          
          {/* Top Features */}
          <div className="mb-24 grid grid-cols-1 gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Feature Icon={RocketLaunchIcon} color="indigo" tag={tr("Setup", "সেটআপ")} title="Instant Setup" text={tr("Go live in 5 minutes with just Page ID + Access Token.", "শুধু Page ID + Access Token দিলেই ৫ মিনিটে সার্ভিস চালু।")} />
            <Feature Icon={ShieldCheckIcon} color="rose" tag={tr("Savings", "সাশ্রয়")} title="No Engineer Cost" text={tr("No hiring, maintenance, or bug-fix overhead.", "ইঞ্জিনিয়ার বা মেইনটেনেন্স খরচ—কিছুই দিতে হবে না।")} />
            <Feature Icon={CpuChipIcon} color="amber" tag={tr("AI", "এআই")} title="AI Hyper Performance" text={tr("Fast replies with fewer tokens. Smart automation.", "কম টোকেনে দ্রুত রিপ্লাই। স্মার্ট অটোমেশন।")} />
            <Feature Icon={ChartBarIcon} color="emerald" tag={tr("Analytics", "অ্যানালিটিক্স")} title="Smart Analytics" text={tr("Real-time data for comments, messages with clear dashboards.", "রিয়েল-টাইম ডাটা, সব ড্যাশবোর্ডে ক্লিয়ার রিপোর্ট।")} />
          </div>

          {/* Middle Story Section */}
          <div className="grid grid-cols-1 items-center gap-16 py-12 lg:grid-cols-2">
            
            {/* Story Text */}
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="space-y-8">
              <h2 className="text-4xl font-black leading-tight text-slate-900 md:text-5xl tracking-tight">
                Automate for everyone
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mt-2">from small business to big agencies.</span>
              </h2>

              <div className="relative p-8 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-indigo-900/5">
                <div className="absolute -left-3 -top-3 text-6xl text-indigo-200 font-serif leading-none">"</div>
                <p className="text-slate-600 leading-relaxed font-medium text-lg relative z-10">
                  {tr(
                    "Let’s be honest—traditional Facebook automation needs developers, servers, maintenance, and recurring costs. Issues keep showing up.",
                    "সত্য কথা বলি — আজকাল ফেসবুক অটোমেশন করতে গেলে ডেভেলপার লাগে, সার্ভার লাগে, মেইনটেনেন্স লাগে, খরচ লাগে। কয়েকদিন পরপর সমস্যা আসেই।"
                  )}
                </p>
                <p className="text-slate-600 leading-relaxed font-medium text-lg mt-4 relative z-10">
                  {tr(
                    "We removed that entire hassle. Plug & Play system—you just use it, we handle the rest.",
                    "আমরা ওই পুরা ঝামেলাটা কেটে দিছি। Plug & Play সিস্টেম। আপনি শুধু ব্যবহার করবেন। বাকিটা আমরা দেখবো।"
                  )}
                </p>
              </div>
            </motion.div>

            {/* Why Choose Us List */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-[3rem] transform -rotate-2 scale-105 z-0" />
              <div className="relative z-10 bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-10 border border-white shadow-2xl shadow-indigo-900/10">
                <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                  <SparklesIcon className="h-7 w-7 text-white" />
                </div>
                <h4 className="mb-8 text-3xl font-black tracking-tight text-slate-900">Why Choose Us?</h4>

                <ul className="space-y-4">
                  {[
                    { en: "No Engineering Cost", bn: "এক্সট্রা ইঞ্জিনিয়ার বা ডেভেলপার খরচ নেই" },
                    { en: "Instant Deployment", bn: "মাত্র ৫ মিনিটে আপনার এআই এজেন্ট লাইভ হবে" },
                    { en: "Smart AI Auto-Reply", bn: "মানুষের মতো নিখুঁত অটো রিপ্লাই সিস্টেম" },
                    { en: "Token Optimized", bn: "অত্যাধুনিক প্রযুক্তিতে খরচ কমিয়ে আনুন" },
                    { en: "Advanced Analytics", bn: "ফুল ড্যাশবোর্ড এবং ডিটেইলড রিপোর্ট" },
                    { en: "24/7 Support", bn: "যেকোনো সমস্যায় আমরা আছি আপনার পাশে" },
                  ].map((item, index) => (
                    <motion.li whileHover={{ x: 5 }} key={index} className="flex items-center gap-4 group cursor-default p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                        <CheckBadgeIcon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        {tr(item.en, item.bn)}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>

          {/* Bottom Features */}
          <div className="mt-24 grid grid-cols-1 gap-6 md:gap-8 md:grid-cols-3">
            <Feature Icon={BoltIcon} color="purple" tag={tr("Speed", "গতি")} title="Lightning Fast" text={tr("Instant replies the moment a message or comment arrives.", "মেসেজ বা কমেন্ট আসার সাথে সাথে ইনস্ট্যান্ট রিপ্লাই।")} />
            <Feature Icon={UserGroupIcon} color="cyan" tag={tr("Teams", "টিম")} title="Built for Teams" text={tr("Made for marketers, agencies, and founders—everyone can use it easily.", "মার্কেটার, এজেন্সি, উদ্যোক্তা—সবাই সহজে ব্যবহার করতে পারবে।")} />
            <Feature Icon={LifebuoyIcon} color="rose" tag={tr("Support", "সাপোর্ট")} title="24/7 Support" text={tr("Any issue? We are here 24/7—real humans, real help.", "যেকোন সমস্যা? আমরা আছি সবসময়। রিয়েল মানুষ, রিয়েল হেল্প।")} />
          </div>

        </div>
      </section>
    </div>
  );
}

function Feature({ Icon, title, text, color = "indigo", tag }) {
  const { lang } = useLanguage();
  const tr = (en, bn) => (lang === "bn" ? bn : en);

  const featureColors = {
    indigo: {
      color: '#4f46e5',
      bg: 'rgba(79,70,229,0.06)',
      border: 'rgba(79,70,229,0.15)',
    },
    rose: {
      color: '#f43f5e',
      bg: 'rgba(244,63,94,0.06)',
      border: 'rgba(244,63,94,0.15)',
    },
    amber: {
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.06)',
      border: 'rgba(245,158,11,0.15)',
    },
    emerald: {
      color: '#10b981',
      bg: 'rgba(16,185,129,0.06)',
      border: 'rgba(16,185,129,0.15)',
    },
    purple: {
      color: '#a855f7',
      bg: 'rgba(168,85,247,0.06)',
      border: 'rgba(168,85,247,0.15)',
    },
    cyan: {
      color: '#06b6d4',
      bg: 'rgba(6,182,212,0.06)',
      border: 'rgba(6,182,212,0.15)',
    },
  };

  const theme = featureColors[color] || featureColors.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
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
              <Icon className="h-9 w-9 text-white stroke-[1.8]" style={{ color: theme.color }} />
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
              {text}
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
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
          
        </div>
      </div>
    </motion.div>
  );
}
