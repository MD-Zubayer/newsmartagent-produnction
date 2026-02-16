'use client'
import {

  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  GiftIcon,
  ArrowRightIcon,
  BoltIcon,
  LifebuoyIcon,
  CodeBracketIcon, // নতুন আইকন
  RocketLaunchIcon // নতুন আইকন
} from "@heroicons/react/24/outline";
import { 
  FaPhoneAlt, 
  FaEnvelope, 
  FaMapMarkerAlt, 
  FaPaperPlane, 
  FaWhatsapp,
  FaArrowRight, 
  FaRocket, 
  FaShieldAlt, 
  FaLightbulb,
  FaRobot, 
  FaChartBar,
  FaFacebook, 
  FaYoutube, 
  FaCheckCircle 
} from "react-icons/fa";
import React, { useState } from "react";
import Navbar from "@/(main)/components/Navbar";
import Link from "next/link";
import api from "@/lib/api";


export default function ServicesPage() {
  return (
    <section className="min-h-screen py-24 bg-[#fcfcfd] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">

        {/* --- Header Section (Fade In Animation) --- */}
        <div className="text-center max-w-3xl mx-auto mb-20 animate-[fadeIn_1s_ease-out]">
          <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tighter mb-6">
            Everything you need to{" "}
            <span className="text-indigo-600 underline decoration-indigo-100 italic">
              Scale
            </span>
          </h2>

          <p className="text-gray-500 font-medium text-lg leading-relaxed">
            শুধু অটোমেশন না — পুরো বিজনেস গ্রোথ সিস্টেম।
            কমেন্ট, মেসেঞ্জার, অ্যানালিটিক্স, AI রিপ্লাই — সব এক প্ল্যাটফর্মে।
          </p>
        </div>


        {/* --- Services Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          <ServiceCard
            icon={<ChatBubbleLeftRightIcon className="h-7 w-7" />}
            title="Comment Automation"
            desc="প্রতিটি কমেন্টে অটো রিপ্লাই দিন, কাস্টমারকে ইনবক্সে আনুন এবং সেল কনভার্ট করুন অটোভাবে।"
            color="bg-indigo-600"
          />

          <ServiceCard
            icon={<CpuChipIcon className="h-7 w-7" />}
            title="Messenger Bot"
            desc="২৪/৭ AI চ্যাটবট। FAQ, অর্ডার, লিড কালেকশন — সবকিছু নিজে নিজে হ্যান্ডেল করবে।"
            color="bg-purple-600"
          />

          <ServiceCard
            icon={<ChartBarIcon className="h-7 w-7" />}
            title="Analytics Dashboard"
            desc="কতজন রিপ্লাই দিলো, কত লিড এলো, কত সেল হলো — লাইভ ডেটা দেখুন এক ক্লিকে।"
            color="bg-emerald-600"
          />

          {/* নতুন সার্ভিস: কাস্টম সলিউশন */}
          <ServiceCard
            icon={<CpuChipIcon className="h-7 w-7" />}
            title="Custom Auto Machine"
            desc="আপনার বিজনেসের জন্য স্পেশাল অটোমেশন বা মেশিন লার্নিং সলিউশন লাগবে? আমরা আছি আপনার পাশে।"
            color="bg-blue-700"
          />

          {/* নতুন সার্ভিস: ওয়েবসাইট ডেভেলপমেন্ট */}
          <ServiceCard
            icon={<CodeBracketIcon className="h-7 w-7" />}
            title="Web Development"
            desc="আপনার বিজনেসের জন্য প্রিমিয়াম এবং ফাস্ট ওয়েবসাইট তৈরি করে দিচ্ছি লেটেস্ট টেকনোলজি দিয়ে।"
            color="bg-slate-800"
          />

          <ServiceCard
            icon={<BoltIcon className="h-7 w-7" />}
            title="Instant Setup"
            desc="শুধু Page ID + Token দিলেই ৫ মিনিটে লাইভ। কোন কোডিং বা ডেভেলপার লাগবে না।"
            color="bg-amber-500"
          />
        </div>

        {/* --- Agent/Commission Banner (New Section with Animation) --- */}
        <div className="mb-24 relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[3rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-white border border-indigo-50 p-10 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="bg-indigo-100 p-4 rounded-2xl animate-bounce">
                        <RocketLaunchIcon className="h-10 w-10 text-indigo-600" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-gray-900">এজেন্ট হতে চান?</h4>
                        <p className="text-gray-500 font-medium mt-1">আমাদের agent হিসেবে জয়েন করুন আর আয় শুরু করুন আজই।</p>
                    </div>
                </div>
                <div className="bg-indigo-600 text-white px-8 py-6 rounded-[2rem] text-center transform group-hover:scale-105 transition-all">
                    <span className="block text-sm font-bold uppercase tracking-widest opacity-80">ধামাকা অফার</span>
                    <span className="text-3xl font-black italic underline decoration-amber-400">২০% কমিশন</span>
                    <span className="block text-xs font-medium mt-1 leading-tight">প্রথম ৫ মাস পর্যন্ত!</span>
                </div>
            </div>
        </div>

{/* --- Benefits Section --- */}
        <div className="bg-white rounded-[4rem] shadow-2xl border border-gray-100 p-10 md:p-16 mb-24 hover:shadow-indigo-100/50 transition-all duration-500 relative overflow-hidden group">
          
          {/* Decorative Glow */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-50 rounded-full blur-[100px] opacity-60 -translate-x-1/2 -translate-y-1/2"></div>

          <div className="relative z-10 text-center mb-16 space-y-3">
            <span className="text-indigo-600 font-black uppercase tracking-[0.2em] text-xs">Unmatched Advantages</span>
            <h3 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight">
              কেন আমাদের <span className="text-indigo-600">সার্ভিস নেবেন?</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 relative z-10">
            
            <Benefit 
              icon={<FaShieldAlt className="text-indigo-600" />}
              title="Full Control" 
              text="আপনার ব্যবসার প্রতিটি সেটিংসের ওপর থাকবে আপনার পূর্ণ নিয়ন্ত্রণ।" 
            />
            <Benefit 
              icon={<FaRocket className="text-rose-500" />}
              title="Instant Deployment" 
              text="কোনো টেকনিক্যাল নলেজ ছাড়াই মাত্র ৫ মিনিটে লাইভ সেটআপ।" 
            />
            <Benefit 
              icon={<FaRobot className="text-blue-500" />}
              title="AI Auto-Reply" 
              text="মানুষের মতো নিখুঁত এবং স্মার্ট এআই অটো রিপ্লাই সিস্টেম।" 
            />
            <Benefit 
              icon={<FaChartBar className="text-emerald-500" />}
              title="Token Optimized" 
              text="অত্যাধুনিক প্রযুক্তিতে আপনার টোকেন খরচ কমিয়ে আনুন।" 
            />
            <Benefit 
              icon={<FaLightbulb className="text-amber-500" />}
              title="Advanced Analytics" 
              text="ফুল ড্যাশবোর্ড এবং ডিটেইলড রিপোর্ট পাবেন এক জায়গায়।" 
            />
            <Benefit 
              icon={<FaPhoneAlt className="text-indigo-500" />}
              title="24/7 Priority Support" 
              text="যেকোনো সমস্যায় আমরা আছি ২৪ ঘণ্টা আপনার পাশে।" 
            />
            <Benefit 
              icon={<FaArrowRight className="text-purple-600" />}
              title="Guided Tutorials" 
              text="সিস্টেম বুঝতে আমাদের রয়েছে সহজ ভিডিও গাইড ও ডকুমেন্টেশন।" 
            />
            <Benefit 
              icon={<FaCheckCircle className="text-green-500" />}
              title="Affordable Pricing" 
              text="মার্কেটে সবচেয়ে সাশ্রয়ী প্রাইস এবং সেরা ডিল আমরাই দিচ্ছি।" 
            />

          </div>
        </div>

        {/* --- CTA Section --- */}
        <div className="text-center bg-indigo-600 text-white py-16 rounded-[3rem] shadow-xl relative overflow-hidden group">
          {/* Background Decor */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-16 -translate-y-16 group-hover:scale-150 transition-all duration-700"></div>
          
          <h3 className="text-3xl md:text-4xl font-black mb-4 relative z-10">
            Ready to Automate Your Business?
          </h3>

          <p className="opacity-90 mb-8 relative z-10 font-medium">
            আজই শুরু করুন। ৫ মিনিটে লাইভ হয়ে যান।
          </p>

<Link href="/signup">
            <button className="bg-white text-indigo-600 font-black px-10 py-4 rounded-2xl hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-2 mx-auto relative z-10 shadow-lg group">
              Get Started 
              <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>

      </div>

      {/* Tailwind Custom Animation (Standard CSS in Tailwind) */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}


function ServiceCard({ icon, title, desc, color }) {
  return (
    <div className="group bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 hover:border-indigo-100 hover:-translate-y-3 transition-all duration-500 ease-out cursor-default">
      <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center text-white mb-8 transition-all duration-500 group-hover:rotate-[360deg] group-hover:scale-110`}>
        {icon}
      </div>

      <h3 className="text-2xl font-black text-gray-900 mb-4 tracking-tight group-hover:text-indigo-600 transition-colors">
        {title}
      </h3>

      <p className="text-gray-500 leading-relaxed font-medium">
        {desc}
      </p>

      <div className="mt-8 flex items-center gap-2 text-indigo-600 font-black text-sm group-hover:gap-4 transition-all">
        Learn More <ArrowRightIcon className="h-4 w-4" />
      </div>
    </div>
  );
}


function Benefit({ text }) {
  return (
    <div className="flex items-center gap-3 group">
      <div className="bg-indigo-50 p-2 rounded-lg group-hover:bg-indigo-600 transition-colors">
        <GiftIcon className="h-5 w-5 text-indigo-600 group-hover:text-white transition-colors" />
      </div>
      <span className="group-hover:translate-x-1 transition-transform">{text}</span>
    </div>
  );
}