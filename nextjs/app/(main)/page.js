"use client";

import Navbar from "@/(main)/components/Navbar";
import Footer from "@/(main)/components/Footer";
import Link from "next/link";
import { 
  FaPhoneAlt, FaEnvelope, FaPaperPlane, FaWhatsapp, 
  FaArrowRight, FaRocket, FaShieldAlt, FaLightbulb,
  FaRobot, FaShareAlt, FaChartBar, FaFacebook, FaYoutube, FaCheckCircle 
} from "react-icons/fa";
import React, { useState } from "react";
import { motion } from "framer-motion";
import api from "@/lib/api";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const features = [
  {
    title: "Facebook Automation",
    desc: "আপনার Facebook পোস্ট, পেজ ও অ্যাডের কমেন্টে স্বয়ংক্রিয়ভাবে উত্তর দেবে। এনগেজমেন্ট বাড়বে বহুগুণ।",
    icon: <FaFacebook />,
    gradient: "from-blue-600 to-indigo-600",
    lightBg: "bg-blue-50",
    textColor: "text-blue-600"
  },
  {
    title: "Messenger & WhatsApp",
    desc: "মেসেঞ্জার এবং হোয়াটসঅ্যাপ মেসেজ এক জায়গায় ম্যানেজ করুন এবং স্মার্টলি রিপ্লাই সেট করুন।",
    icon: <FaWhatsapp />,
    gradient: "from-green-500 to-teal-600",
    lightBg: "bg-green-50",
    textColor: "text-green-600"
  },
  {
    title: "YouTube Automation",
    desc: "YouTube কমেন্টগুলো স্বয়ংক্রিয়ভাবে ম্যানেজ করুন এবং উত্তর দিন, যা আপনার চ্যানেলের গ্রোথ নিশ্চিত করবে।",
    icon: <FaYoutube />,
    gradient: "from-red-500 to-rose-600",
    lightBg: "bg-red-50",
    textColor: "text-red-600"
  },
];

const services = [
  {
    title: "Comment & Message Automation",
    desc: "কোনো সোশ্যাল প্ল্যাটফর্মে লিড বা এনগেজমেন্ট মিস হবে না। সব কমেন্ট ও মেসেজ স্বয়ংক্রিয়ভাবে হ্যান্ডেল করুন।",
    icon: <FaRobot />,
    gradient: "from-indigo-600 via-purple-600 to-pink-500",
  },
  {
    title: "Multi-platform Integration",
    desc: "Facebook, Messenger, WhatsApp, YouTube এবং আরও অনেক প্ল্যাটফর্মকে এক ড্যাশবোর্ডে সংযুক্ত করুন।",
    icon: <FaShareAlt />,
    gradient: "from-teal-400 via-cyan-500 to-blue-600",
  },
  {
    title: "Analytics & Insights",
    desc: "এনগেজমেন্ট, লিড এবং কনভার্শন ট্র্যাক করুন শক্তিশালী রিপোর্টিং টুলসের মাধ্যমে এবং ব্যবসা বৃদ্ধি করুন।",
    icon: <FaChartBar />,
    gradient: "from-orange-400 via-rose-500 to-red-600",
  },
];

export default function HomePage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subjects: "",
    messages: "",
  });

  const [status, setStatus] = useState({ loading: false, success: null, error: null });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: null, error: null });

    try {
      await api.post("/contact/create/", formData);
      setStatus({ 
        loading: false, 
        success: "ধন্যবাদ! আপনার বার্তাটি সফলভাবে গৃহীত হয়েছে।", 
        error: null 
      });
      setFormData({ name: "", email: "", subjects: "", messages: "" });
    } catch (err) {
      console.error(err);
      setStatus({ 
        loading: false, 
        success: null, 
        error: "দুঃখিত, প্রযুক্তিগত সমস্যার কারণে বার্তাটি পাঠানো সম্ভব হয়নি।" 
      });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#fafafa] overflow-x-hidden text-gray-950 font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden pt-20">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 z-0">
          <motion.div 
            animate={{ 
              x: [0, 50, 0],
              y: [0, 30, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-indigo-200/30 rounded-full blur-[120px]"
          />
          <motion.div 
            animate={{ 
              x: [0, -40, 0],
              y: [0, 50, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-200/20 rounded-full blur-[120px]"
          />
          <div className="absolute inset-0 bg-grid opacity-[0.4]"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center text-center"
          >
            <motion.div 
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/80 glass border border-indigo-100/50 text-indigo-600 text-xs md:text-sm font-black mb-8 shadow-xl shadow-indigo-500/5"
            >
              <FaRocket className="animate-bounce" /> 
              <span className="uppercase tracking-[0.2em]">Bangladesh's Top AI-Powered Agent</span>
            </motion.div>

            <motion.h1 
              variants={fadeInUp}
              className="text-5xl md:text-8xl font-black mb-10 leading-[1] tracking-tight max-w-5xl"
            >
              Transform Your <br />
              <span className="text-gradient">Social Business</span> <br />
              <span className="text-gray-400">With Real AI</span>
            </motion.h1>

            <motion.p 
              variants={fadeInUp}
              className="text-gray-500 text-lg md:text-2xl max-w-3xl mb-14 leading-relaxed font-medium"
            >
              আপনার সোশ্যাল মিডিয়া হ্যান্ডেল করুন স্মার্টলি। <span className="text-indigo-600 font-bold">New Smart Agent</span>-এর AI চালিত অটোমেশন দিয়ে রেসপন্স টাইম কমান এবং সেলস বাড়ান ২ গুণ।
            </motion.p>

            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center gap-6 mb-24"
            >
              <Link href="/signup" className="btn-premium px-12 py-5 text-xl group relative overflow-hidden">
                <span className="relative z-10 flex items-center gap-3">
                  Get Started Free
                  <FaArrowRight className="group-hover:translate-x-2 transition-transform duration-300" />
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </Link>

              <Link
                href="/about"
                className="px-12 py-5 rounded-2xl bg-white text-gray-800 font-bold text-xl hover:bg-gray-50 active:scale-95 transition-all shadow-xl shadow-gray-200/20 border border-gray-100"
              >
                Learn More
              </Link>
            </motion.div>

            {/* Trusted Platforms */}
            <motion.div 
              variants={fadeInUp}
              className="w-full max-w-4xl py-12 glass rounded-[3rem] p-10 flex flex-col items-center gap-8"
            >
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Integrates Seamlessly With</p>
              <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                <div className="flex items-center gap-3 text-gray-900 font-black text-xl">
                   <FaFacebook className="text-[#1877F2]" /> Facebook
                </div>
                <div className="flex items-center gap-3 text-gray-900 font-black text-xl">
                   <FaWhatsapp className="text-[#25D366]" /> WhatsApp
                </div>
                <div className="flex items-center gap-3 text-gray-900 font-black text-xl">
                   <FaYoutube className="text-[#FF0000]" /> YouTube
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-6 bg-white relative">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="max-w-2xl space-y-6"
            >
              <span className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-[0.2em]">Core Features</span>
              <h2 className="text-4xl md:text-6xl font-black leading-[1.1] tracking-tight text-gray-900">
                স্মার্ট অটোমেশন <br />
                <span className="text-gradient">আপনার বিজনেসের জন্য</span>
              </h2>
            </motion.div>
            <motion.p 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-gray-500 font-medium text-lg max-w-md pb-2"
            >
              আমাদের অল-ইন-ওয়ান ড্যাশবোর্ডের মাধ্যমে আপনার সব সোশ্যাল মিডিয়ার কমেন্ট এবং মেসেজ অটো পাইলটে চলবে।
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="card-premium group relative overflow-hidden"
              >
                <div className={`w-20 h-20 rounded-3xl ${feature.lightBg} ${feature.textColor} flex items-center justify-center text-4xl mb-10 group-hover:scale-110 transition-transform duration-500`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-6 group-hover:text-indigo-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-500 font-medium leading-relaxed mb-10 text-lg">
                  {feature.desc}
                </p>
                <Link href="/about" className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-indigo-600 group-hover:gap-5 transition-all">
                  Details <FaArrowRight />
                </Link>
                
                {/* Decorative Elements */}
                <div className={`absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br ${feature.gradient} opacity-[0.03] rounded-full group-hover:opacity-10 transition-opacity`}></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid Section */}
      <section className="py-32 px-6 bg-[#f8faff] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-[120px]"></div>
        <div className="container mx-auto max-w-7xl relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20 flex flex-col items-center gap-6"
          >
            <span className="px-5 py-2 bg-white glass rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 shadow-sm border border-indigo-100">Smart Solutions</span>
            <h2 className="text-4xl md:text-7xl font-black text-gray-900 tracking-tight leading-[1.1]">
              সব সলিউশন <span className="text-indigo-600 italic">এক জায়গায়</span>
            </h2>
            <p className="text-gray-500 max-w-2xl font-medium text-xl leading-relaxed">
              মডার্ন টুলস যা আপনার ব্যবসাকে করে তুলবে আরও গতিশীল এবং নির্ভুল।
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {services.map((service, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -15 }}
                className="bg-white/80 glass border border-white p-10 rounded-[3rem] shadow-2xl shadow-indigo-500/5 group"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${service.gradient} flex items-center justify-center text-white text-3xl mb-8 shadow-xl group-hover:rotate-6 transition-transform`}>
                  {service.icon}
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-5 group-hover:text-indigo-600 transition-colors">
                  {service.title}
                </h3>
                <p className="text-gray-500 font-medium text-lg leading-relaxed">
                  {service.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* CTA Banner */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-32 p-12 md:p-20 rounded-[4rem] bg-indigo-950 text-white relative overflow-hidden shadow-[0_40px_80px_-15px_rgba(79,70,229,0.3)]"
          >
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="max-w-2xl text-center md:text-left space-y-6">
                <h4 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                  কাস্টম অটোমেশন দরকার? <br />
                  <span className="text-indigo-400 italic">আমাদের জানান</span>
                </h4>
                <p className="text-indigo-200/80 font-medium text-xl">
                  আপনার নির্দিষ্ট প্রয়োজন অনুযায়ী আমরা সেরা এআই সলিউশন তৈরি করে দেব।
                </p>
              </div>
              <Link href="/contact" className="btn-premium px-14 py-6 text-xl bg-white text-indigo-950 hover:bg-white/90">
                ফ্রি কনসালটেশন নিন
              </Link>
            </div>
            {/* Shapes */}
            <div className="absolute top-0 right-0 w-80 h-full bg-indigo-900/40 -skew-x-12 translate-x-20"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] animate-float"></div>
          </motion.div>
        </div>
      </section>

      {/* About Highlights */}
      <section className="py-32 px-6 bg-white">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-6"
            >
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-10 rounded-[2.5rem] shadow-2xl text-white">
                  <FaRocket size={40} className="mb-6 opacity-80" />
                  <h4 className="font-black text-2xl tracking-tight uppercase mb-3">Velocity</h4>
                  <p className="text-indigo-100 font-medium text-sm leading-relaxed">সব কাজ হবে চোখের পলকে এবং নির্ভুলভাবে।</p>
                </div>
                <div className="bg-gray-50 p-10 rounded-[2.5rem] border border-gray-100 flex flex-col items-center text-center shadow-lg group hover:bg-white transition-all">
                  <FaShieldAlt size={40} className="mb-6 text-indigo-600 opacity-80" />
                  <h4 className="font-black text-2xl text-gray-800 tracking-tight uppercase">Security</h4>
                  <p className="text-gray-400 font-medium text-sm leading-relaxed">১০০% ডাটা নিরাপত্তা নিশ্চিতে আমরা আপোষহীন।</p>
                </div>
              </div>
              <div className="pt-16 space-y-6">
                <div className="bg-gray-50 p-10 rounded-[2.5rem] border border-gray-100 flex flex-col items-center text-center shadow-lg group hover:bg-white transition-all">
                  <FaLightbulb size={40} className="mb-6 text-amber-500 opacity-80" />
                  <h4 className="font-black text-2xl text-gray-800 tracking-tight uppercase">AI Magic</h4>
                  <p className="text-gray-400 font-medium text-sm leading-relaxed">স্মার্ট লার্নিং যা সময়ের সাথে আরও নির্ভুল হয়।</p>
                </div>
                <div className="bg-indigo-50 p-10 rounded-[2.5rem] border border-indigo-100 flex flex-col items-center justify-center text-center">
                  <h3 className="text-5xl font-black text-indigo-600 mb-2">10X</h3>
                  <p className="text-indigo-900 font-black text-xs uppercase tracking-[0.3em]">Growth Power</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-10"
            >
              <div className="space-y-6">
                <span className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-[0.2em] border border-indigo-100">The Mission</span>
                <h2 className="text-5xl md:text-7xl font-black text-gray-900 leading-[1] tracking-tight">
                  আমরা কেন <br />
                  <span className="text-indigo-600 italic">ব্যতিক্রম?</span>
                </h2>
              </div>
              <div className="space-y-8">
                <p className="text-gray-600 text-xl md:text-2xl leading-relaxed font-medium border-l-8 border-indigo-600 pl-8">
                   <strong className="text-indigo-600 font-black">New Smart Agent</strong> স্রেফ একটি টুল নয়, এটি আপনার ডিজিটাল ব্যবসার সার্বক্ষণিক সহযোগী।
                </p>
                <p className="text-gray-500 text-lg leading-relaxed font-medium">
                  আমাদের এআই সিস্টেম কাস্টমারদের সাথে স্বাভাবিকভাবে কথা বলতে পারে, যা আপনার ব্যবসার বিশ্বস্ততা বাড়ায় এবং কাস্টমার রিটেনশন নিশ্চিত করে।
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {["24/7 Smart Reply", "Auto Lead Engine", "Advanced Reports", "Privacy Shield"].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <FaCheckCircle className="text-green-500 text-xl" />
                    <span className="font-bold text-gray-700 text-sm italic">{item}</span>
                  </div>
                ))}
              </div>
              <div className="pt-6">
                <Link href="/about" className="btn-premium inline-flex px-14">
                  বিস্তারিত জানুন
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Modern Contact Form Section */}
      <section className="py-32 px-6 bg-gray-50 relative overflow-hidden">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-5 space-y-10"
            >
              <div className="space-y-6">
                <h3 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight leading-[1.1]">
                  সরাসরি <br />
                  <span className="text-indigo-600 italic">কথা বলুন</span>
                </h3>
                <p className="text-gray-500 font-medium text-lg leading-relaxed">
                  আপনার ব্যবসা অটোমেট করতে আমাদের অভিজ্ঞ টিমের সাথে আজই যোগাযোগ করুন।
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { icon: <FaPhoneAlt />, title: "সরাসরি কল", value: "01727358743", color: "bg-indigo-600" },
                  { icon: <FaEnvelope />, title: "ইমেইল", value: "newsmartagentbd@gmail.com", color: "bg-blue-600" },
                  { icon: <FaWhatsapp />, title: "হোয়াটসঅ্যাপ", value: "Available 24/7", color: "bg-green-600" }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-6 p-6 rounded-[2rem] glass hover:bg-white transition-all group">
                    <div className={`w-14 h-14 ${item.color} text-white rounded-2xl flex items-center justify-center text-xl`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.title}</p>
                      <p className="text-xl font-bold text-gray-800 tracking-tight">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-7"
            >
              <div className="p-8 md:p-14 rounded-[3.5rem] bg-white glass-shadow border border-white relative overflow-hidden">
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">পূর্ণ নাম</label>
                      <input 
                        type="text" name="name" required value={formData.name} onChange={handleChange}
                        placeholder="আপনার নাম" 
                        className="input-premium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ইমেইল এড্রেস</label>
                      <input 
                        type="email" name="email" required value={formData.email} onChange={handleChange}
                        placeholder="example@mail.com" 
                        className="input-premium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">বিষয়</label>
                    <input 
                      type="text" name="subjects" required value={formData.subjects} onChange={handleChange}
                      placeholder="কী বিষয়ে কথা বলতে চান?" 
                      className="input-premium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">আপনার বার্তা</label>
                    <textarea 
                      name="messages" required value={formData.messages} onChange={handleChange}
                      placeholder="বিস্তারিত এখানে লিখুন..." rows={5}
                      className="input-premium resize-none"
                    ></textarea>
                  </div>
                  
                  {status.success && <p className="text-emerald-500 font-bold text-center">{status.success}</p>}
                  {status.error && <p className="text-rose-500 font-bold text-center">{status.error}</p>}
                  
                  <button 
                    disabled={status.loading}
                    className="btn-premium w-full py-5 text-xl"
                  >
                    <FaPaperPlane className={status.loading ? 'animate-ping' : ''} />
                    {status.loading ? "পাঠানো হচ্ছে..." : "বার্তা পাঠান"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
      {/* Dynamic Background Circles */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 bg-[#fafafa]"></div>
    </div>
  );
}