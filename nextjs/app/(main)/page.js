"use client";

import Navbar from "@/(main)/components/Navbar";
import Link from "next/link";
import { FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaPaperPlane, FaWhatsapp } from "react-icons/fa";
import { FaArrowRight, FaRocket, FaShieldAlt, FaLightbulb } from "react-icons/fa";
import { FaRobot, FaShareAlt, FaChartBar } from "react-icons/fa";
import { FaFacebook, FaYoutube, FaCheckCircle  } from "react-icons/fa";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    desc: "আপনার Facebook পোস্ট, পেজ ও অ্যাডের কমেন্টে স্বয়ংক্রিয়ভাবে উত্তর দেবে। এনগেজমেন্ট বাড়বে বহুগুণ।",
    icon: <FaFacebook />,
    gradient: "from-blue-600 to-indigo-600",
    hoverBg: "group-hover:bg-blue-600",
    lightBg: "bg-blue-50",
    textColor: "text-blue-600"
  },
  {
    title: "Messenger & WhatsApp",
    desc: "মেসেঞ্জার এবং হোয়াটসঅ্যাপ মেসেজ এক জায়গায় ম্যানেজ করুন এবং স্মার্টলি রিপ্লাই সেট করুন।",
    icon: <FaWhatsapp />,
    gradient: "from-green-500 to-teal-600",
    hoverBg: "group-hover:bg-green-600",
    lightBg: "bg-green-50",
    textColor: "text-green-600"
  },
  {
    title: "YouTube Automation",
    desc: "YouTube কমেন্টগুলো স্বয়ংক্রিয়ভাবে ম্যানেজ করুন এবং উত্তর দিন, যা আপনার চ্যানেলের গ্রোথ নিশ্চিত করবে।",
    icon: <FaYoutube />,
    gradient: "from-red-500 to-rose-600",
    hoverBg: "group-hover:bg-red-600",
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
    shadow: "shadow-purple-200",
  },
  {
    title: "Multi-platform Integration",
    desc: "Facebook, Messenger, WhatsApp, YouTube এবং আরও অনেক প্ল্যাটফর্মকে এক ড্যাশবোর্ডে সংযুক্ত করুন।",
    icon: <FaShareAlt />,
    gradient: "from-teal-400 via-cyan-500 to-blue-600",
    shadow: "shadow-cyan-200",
  },
  {
    title: "Analytics & Insights",
    desc: "এনগেজমেন্ট, লিড এবং কনভার্শন ট্র্যাক করুন শক্তিশালী রিপোর্টিং টুলসের মাধ্যমে এবং ব্যবসা বৃদ্ধি করুন।",
    icon: <FaChartBar />,
    gradient: "from-orange-400 via-rose-500 to-red-600",
    shadow: "shadow-rose-200",
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
        success: "Thank you! Your message has been successfully received.", 
        error: null 
      });
      setFormData({ name: "", email: "", subjects: "", messages: "" });
    } catch (err) {
      console.error(err);
      setStatus({ 
        loading: false, 
        success: null, 
        error: "Sorry, the message could not be sent due to a technical issue." 
      });
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-50 overflow-x-hidden text-gray-900">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] md:min-h-screen w-full flex items-center justify-center overflow-hidden bg-white">
        {/* Animated Background Blobs */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.6, 0.4, 0.6]
            }}
            transition={{ duration: 15, repeat: Infinity }}
            className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[100px]"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1],
              x: [0, -30, 0],
              opacity: [0.5, 0.7, 0.5]
            }}
            transition={{ duration: 20, repeat: Infinity }}
            className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[100px]"
          />
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e505_1px,transparent_1px),linear-gradient(to_bottom,#4f46e505_1px,transparent_1px)] bg-[size:60px_60px]"></div>



        <div className="absolute inset-0 z-0 opacity-20 md:opacity-40 pointer-events-none overflow-hidden">
          <ThreeScene>

            
            {/* Desktop Only: Decorative side images */}
            <group className="hidden md:block">
              <FloatingImage 
                imgUrl="/3d_imge/IMG_20260310_221124_720.png" 
                position={[-4, -2, -2]} 
                scale={[1, 1, 1]} 
                rotation={[0, 0.5, 0]}
                speed={0.8}
              />
              <FloatingImage 
                imgUrl="/3d_imge/IMG_20260310_221309_887.png" 
                position={[5, -3, -1]} 
                scale={[0.8, 0.8, 1]} 
                rotation={[0.2, -0.2, 0]}
                speed={1.2}
              />
            </group>
          </ThreeScene>
        </div>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10 container mx-auto px-6 py-20 flex flex-col items-center"
        >
          <motion.div 
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-5 py-2 mt-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs md:text-sm font-black mb-10 shadow-sm"
          >
            <FaRocket className="animate-bounce" /> 
            <span className="uppercase tracking-widest text-[10px] md:text-xs">The Most Trusted AI Automation in BD</span>
          </motion.div>

          <motion.h1 
            variants={fadeInUp}
            className="text-4xl md:text-7xl font-black text-center text-gray-900 mb-8 leading-[1.1] tracking-tighter max-w-5xl"
          >
            Automate Your <span className="text-indigo-600">Social Media</span> <br className="hidden md:block" /> 
            <span className="italic text-purple-600">& Grow Faster</span>
          </motion.h1>

          <motion.p 
            variants={fadeInUp}
            className="text-gray-500 text-lg md:text-xl text-center max-w-3xl mb-12 leading-relaxed font-medium px-4"
          >
            <span className="text-indigo-700 font-bold">New Smart Agent</span> নিয়ে এসেছে একটি অল-ইন-ওয়ান প্লাটফর্ম। আপনার ফেসবুক, হোয়াটসঅ্যাপ ও ইউটিউব সংযোগ করুন এবং সময় বাঁচান আমাদের স্মার্ট এআই টুলস দিয়ে।
          </motion.p>

          <motion.div 
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center gap-6 mb-20"
          >
            <Link
              href="/signup"
              className="group relative px-10 py-5 rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative z-10 flex items-center gap-3">
                Get Started Free
                <FaArrowRight className="group-hover:translate-x-2 transition-transform" />
              </span>
            </Link>

            <Link
              href="/about"
              className="px-10 py-5 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-md text-gray-700 font-bold text-lg hover:bg-white hover:border-gray-300 transition-all shadow-sm active:scale-95"
            >
              Learn More
            </Link>
          </motion.div>

          <motion.div 
            variants={fadeInUp}
            className="w-full max-w-4xl py-10 border-t border-gray-100 flex flex-col items-center gap-8"
          >
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
              <div className="flex items-center gap-2 text-gray-800 font-black text-xl cursor-default">
                 <FaFacebook className="text-[#1877F2]" /> <span className="text-sm">Facebook</span>
              </div>
              <div className="flex items-center gap-2 text-gray-800 font-black text-xl cursor-default">
                 <FaWhatsapp className="text-[#25D366]" /> <span className="text-sm">WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 text-gray-800 font-black text-xl cursor-default">
                 <FaYoutube className="text-[#FF0000]" /> <span className="text-sm">YouTube</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">
              <span className="flex items-center gap-1"><FaCheckCircle className="text-green-500" /> No Card Required</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
              <span className="flex items-center gap-1"><FaShieldAlt className="text-indigo-500" /> Secured by SSL</span>
            </div>
          </motion.div>
        </motion.div>
        <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-gray-50 to-transparent"></div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 md:px-10 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto text-center mb-16 space-y-4"
          >
            <h2 className="text-indigo-600 font-black uppercase tracking-[0.2em] text-xs">Platform Core Features</h2>
            <h3 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">
              স্মার্ট এআই দিয়ে <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">বিজনেস অটোমেশন</span> এখন সহজ
            </h3>
            <p className="text-gray-500 font-medium text-lg leading-relaxed">
              আপনার ফেসবুক, হোয়াটসঅ্যাপ ও ইউটিউবের এনগেজমেন্ট বাড়াতে প্রয়োজনীয় সব আধুনিক টুলস এখন এক ড্যাশবোর্ডে।
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute top-0 right-0 w-48 h-48 -mr-10 -mt-10 opacity-10 pointer-events-none select-none">
              <img src="/3d_imge/IMG_20260310_223341_710.png" alt="" className="w-full h-full object-contain" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div 
                  key={index}
                  variants={fadeInUp}
                  whileHover={{ y: -10 }}
                  className="group relative p-8 rounded-[2.5rem] bg-white border border-gray-100 shadow-xl shadow-gray-200/30 transition-all duration-300 overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                  <div className="relative z-10">
                    <div className={`w-16 h-16 rounded-2xl ${feature.lightBg} ${feature.textColor} flex items-center justify-center text-3xl mb-8 group-hover:bg-white transition-all duration-500 shadow-sm`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mb-4 group-hover:text-white transition-colors duration-500">
                      {feature.title}
                    </h3>
                    <p className="text-gray-500 font-medium leading-relaxed mb-8 group-hover:text-white/90 transition-colors duration-500">
                      {feature.desc}
                    </p>
                    <button className={`flex items-center gap-3 text-sm font-black uppercase tracking-widest ${feature.textColor} group-hover:text-white transition-colors duration-500`}>
                      Learn More 
                      <FaArrowRight className="group-hover:translate-x-2 transition-transform" />
                    </button>
                  </div>
                  <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-gray-50 rounded-full group-hover:bg-white/10 transition-colors"></div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section with D3-style Glassmorphism */}
      <section className="py-24 px-4 md:px-10 bg-[#fbfbfc] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/30 rounded-full blur-[120px]"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center mb-20 space-y-4"
          >
            <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100 shadow-sm">
              Everything You Need
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
              স্মার্ট ব্যবসার জন্য <span className="text-indigo-600">সেরা সলিউশন</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto font-medium text-lg leading-relaxed px-4">
              ব্যবসায়িক প্রবৃদ্ধি নিশ্চিত করতে এবং কাস্টমারদের সাথে নিবিড় সম্পর্ক গড়তে আমরা দিচ্ছি আধুনিক এআই চালিত অল-ইন-ওয়ান অটোমেশন সার্ভিস।
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10 relative"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5 pointer-events-none hidden lg:flex justify-between items-center px-10">
              <img src="/3d_imge/IMG_20260310_221431_617.png" alt="" className="w-40 h-auto" />
              <img src="/3d_imge/IMG_20260310_221340_589.png" alt="" className="w-40 h-auto" />
            </div>
            {services.map((service, index) => (
              <motion.div 
                key={index}
                variants={fadeInUp}
                whileHover={{ y: -12 }}
                className="relative group h-full rounded-[2.5rem] bg-white/80 backdrop-blur-md border border-white/50 p-8 md:p-10 shadow-xl shadow-gray-200/40 flex flex-col transition-all duration-300"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2.5rem] -z-10`}></div>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${service.gradient} flex items-center justify-center text-white text-3xl mb-8 shadow-lg ${service.shadow} group-hover:bg-white group-hover:from-white group-hover:to-white group-hover:text-gray-900 transition-all duration-300`}>
                  {service.icon}
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4 group-hover:text-white transition-colors duration-300">
                  {service.title}
                </h3>
                <p className="text-gray-500 font-medium leading-relaxed mb-8 group-hover:text-indigo-50 transition-colors duration-300 flex-1">
                  {service.desc}
                </p>
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-indigo-600 group-hover:text-white transition-all duration-300">
                  <span>Learn More</span>
                  <FaArrowRight className="group-hover:translate-x-2 transition-transform" />
                </div>
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700"></div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 p-8 md:p-14 rounded-[3.5rem] bg-indigo-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl shadow-indigo-200"
          >
            <div className="relative z-10 text-center md:text-left space-y-4">
              <h4 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
                আপনার ব্যবসার জন্য কি <br />
                <span className="text-indigo-400 italic">কাস্টম অটোমেশন</span> প্রয়োজন?
              </h4>
              <p className="text-indigo-200 font-medium max-w-lg text-lg">
                আমাদের টিমকে জানান আপনার সুনির্দিষ্ট চ্যালেঞ্জের কথা। আমরা আপনার প্রয়োজন অনুযায়ী তৈরি করে দেব সেরা এআই সলিউশন।
              </p>
            </div>
            <Link href="/contact" className="relative z-20">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-12 py-5 bg-white text-indigo-900 rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-50 transition-all whitespace-nowrap"
              >
                ফ্রি কনসালটেশন নিন
              </motion.button>
            </Link>
            <div className="absolute top-0 right-0 w-64 h-full bg-white/5 skew-x-12 translate-x-20"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-24 px-4 md:px-10 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-4 md:gap-6 order-2 lg:order-1"
            >
              <div className="space-y-4 md:space-y-6">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 rounded-[2rem] shadow-xl text-white">
                  <FaRocket size={32} className="mb-4" />
                  <h4 className="font-black text-xl tracking-tight uppercase">Smart Velocity</h4>
                  <p className="text-indigo-100 text-[11px] leading-relaxed mt-2 font-bold italic">অটোমেশনের মাধ্যমে আপনার কাজ হবে চোখের পলকে।</p>
                </div>
                <div className="bg-gray-50/80 backdrop-blur-sm p-8 rounded-[2rem] border border-gray-100 flex flex-col items-center text-center group hover:bg-white hover:shadow-xl transition-all duration-300">
                  <FaShieldAlt size={32} className="mb-4 text-indigo-600" />
                  <h4 className="font-black text-xl text-gray-800 tracking-tight uppercase">Ironclad Security</h4>
                  <p className="text-gray-400 text-[11px] leading-relaxed mt-2 font-bold">আপনার ডাটা এবং প্রাইভেসি আমাদের সর্বোচ্চ অগ্রাধিকার।</p>
                </div>
              </div>
              <div className="pt-8 md:pt-12 space-y-4 md:space-y-6">
                <div className="bg-gray-50/80 backdrop-blur-sm p-8 rounded-[2rem] border border-gray-100 flex flex-col items-center text-center group hover:bg-white hover:shadow-xl transition-all duration-300">
                  <FaLightbulb size={32} className="mb-4 text-amber-500" />
                  <h4 className="font-black text-xl text-gray-800 tracking-tight uppercase">Adaptive AI</h4>
                  <p className="text-gray-400 text-[11px] leading-relaxed mt-2 font-bold">স্মার্ট টুলস যা সময়ের সাথে আপনার ব্যবসার সাথে মানিয়ে নেয়।</p>
                </div>
                <div className="bg-indigo-50 p-8 rounded-[2rem] border border-indigo-100 flex flex-col items-center text-center">
                  <h3 className="text-4xl font-black text-indigo-600">10X</h3>
                  <p className="text-indigo-900 font-bold text-sm mt-2 uppercase tracking-[0.2em]">Efficiency</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8 order-1 lg:order-2"
            >
              <div className="space-y-4">
                <span className="inline-block px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100">
                  Who We Are
                </span>
                <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-[1.1]">
                  আমাদের সম্পর্কে <span className="text-indigo-600 italic">জেনে নিন</span>
                </h2>
              </div>
              <div className="space-y-6">
                <p className="text-gray-600 text-lg leading-relaxed font-medium border-l-4 border-indigo-600 pl-6">
                  <strong className="text-gray-900">New Smart Agent</strong> একটি সম্পূর্ণ স্মার্ট প্ল্যাটফর্ম, যা Facebook, WhatsApp এবং Messenger-এর মাধ্যমে আপনার ব্যবসায়িক ও ব্যক্তিগত জীবন আরও সহজ করতে সাহায্য করে।
                </p>
                <p className="text-gray-500 leading-relaxed font-medium">
                  এটি স্বয়ংক্রিয়ভাবে কমেন্ট এবং মেসেজের উত্তর দেয়, লিড ট্র্যাক করে এবং নিরাপদভাবে কাজের রিপোর্ট প্রদান করে। এর মাধ্যমে আপনার মূল্যবান সময় বাঁচে।
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {["24/7 Auto Reply", "Lead Tracking", "Performance Reports", "Safe & Secure"].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 relative">
                <div className="absolute -right-10 -top-10 w-24 h-24 opacity-20 pointer-events-none hidden lg:block">
                  <img src="/3d_imge/IMG_20260310_221231_508.png" alt="" className="w-full h-full object-contain" />
                </div>
                <Link
                  href="/about"
                  className="group inline-flex items-center gap-3 px-10 py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-600 transition-all duration-300"
                >
                  Learn More 
                  <FaArrowRight className="text-sm group-hover:translate-x-2 transition-transform" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-24 px-6 bg-[#FDFDFF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 space-y-4"
          >
            <h2 className="text-indigo-600 font-black uppercase tracking-widest text-sm italic">Get In Touch</h2>
            <h3 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
              যোগাযোগ করুন <span className="text-indigo-600">আমাদের সাথে</span>
            </h3>
            <div className="absolute top-0 left-0 w-24 h-24 opacity-10 pointer-events-none hidden sm:block">
              <img src="/3d_imge/IMG_20260310_215541_854.png" alt="" className="w-full h-full object-contain" />
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-5 space-y-6"
            >
              {[
                { icon: <FaPhoneAlt />, title: "সরাসরি কল", value: "01727358743", bg: "bg-indigo-50", color: "text-indigo-600" },
                { icon: <FaEnvelope />, title: "ইমেইল করুন", value: "newsmartagentbd@gmail.com", bg: "bg-pink-50", color: "text-pink-600" },
                { icon: <FaWhatsapp />, title: "WhatsApp Support", value: "Available 24/7 for help", bg: "bg-green-50", color: "text-green-600" }
              ].map((card, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ x: 10 }}
                  className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-start gap-6 group cursor-default"
                >
                  <div className={`w-14 h-14 ${card.bg} rounded-2xl flex items-center justify-center ${card.color} text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300`}>
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{card.title}</p>
                    <p className="text-xl font-black text-gray-800 tracking-tighter truncate max-w-[200px] md:max-w-none">{card.value}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-7"
            >
              <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl shadow-gray-200/50 border border-gray-50 relative overflow-hidden group">
                <form className="space-y-5 relative z-10" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Your Name</label>
                      <input 
                        type="text" name="name" required value={formData.name} onChange={handleChange}
                        placeholder="যেমন: আবরার রহমান" 
                        className="w-full p-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                      <input 
                        type="email" name="email" required value={formData.email} onChange={handleChange}
                        placeholder="example@mail.com" 
                        className="w-full p-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium"
                      />
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 opacity-5 pointer-events-none hidden sm:block">
                    <img src="/3d_imge/IMG_20260310_215834_398.png" alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Subject</label>
                    <input 
                      type="text" name="subjects" required value={formData.subjects} onChange={handleChange}
                      placeholder="কী বিষয়ে কথা বলতে চান?" 
                      className="w-full p-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Message</label>
                    <textarea 
                      name="messages" required value={formData.messages} onChange={handleChange}
                      placeholder="আপনার বিস্তারিত বার্তাটি এখানে লিখুন..." rows={5}
                      className="w-full p-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium resize-none"
                    ></textarea>
                  </div>
                  {status.success && <p className="text-emerald-500 font-bold text-sm">{status.success}</p>}
                  {status.error && <p className="text-rose-500 font-bold text-sm">{status.error}</p>}
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={status.loading}
                    className={`w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 ${status.loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <FaPaperPlane className={status.loading ? 'animate-ping' : ''} />
                    {status.loading ? "পাঠানো হচ্ছে..." : "বার্তা পাঠান"}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}