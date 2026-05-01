"use client";

import Navbar from "@/(main)/components/Navbar";
import Link from "next/link";
import { FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaPaperPlane, FaWhatsapp } from "react-icons/fa";
import { FaArrowRight, FaRocket, FaShieldAlt, FaLightbulb } from "react-icons/fa";
import { FaRobot, FaShareAlt, FaChartBar } from "react-icons/fa";
import { FaFacebook, FaYoutube, FaCheckCircle, FaInstagram, FaTelegram, FaTiktok, FaCode, FaBug, FaRegCommentDots, FaStar } from "react-icons/fa";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

const translations = {
  en: {
    badge: "The Most Trusted AI Automation in BD",
    heroTitle1: "Automate Your",
    heroTitle2: "Social Media",
    heroTitle3: "& Grow Faster",
    heroDesc: " brings an all-in-one platform. Connect your Facebook, WhatsApp & YouTube and save time with our smart AI tools.",
    getStarted: "Get Started Free",
    learnMore: "Learn More",
    noCard: "No Card Required",
    secured: "Secured by SSL",
    integrationsBadge: "Platform Integrations",
    integrationsTitle1: "Connect Every",
    integrationsTitle2: "Customer Channel",
    integrationsDesc: "New Smart Agent works as an AI automation SaaS software for Facebook, WhatsApp, Instagram, Telegram, YouTube, Google Business and TikTok. One dashboard, faster response, better conversion.",
    integrationsList: [
      { title: "Facebook Automation", desc: "Auto-reply to comments and inbox messages with human-like AI conversation flows.", cta: "Connect Facebook" },
      { title: "WhatsApp Business", desc: "Handle customer support and sales chats from one AI-driven WhatsApp workspace.", cta: "Connect WhatsApp" },
      { title: "Instagram Automation", desc: "Respond to DM and engagement signals quickly to improve lead quality and response time.", cta: "Connect Instagram" },
      { title: "Telegram Bot", desc: "Deploy a secure Telegram bot for instant Q&A, support routing, and smart follow-up.", cta: "Connect Telegram" },
      { title: "YouTube Engagement", desc: "Moderate and reply to video comments automatically to keep your audience active.", cta: "Connect YouTube" },
      { title: "Google Business Profile", desc: "Automate review responses and local customer queries to strengthen business trust.", cta: "Connect GBP" },
      { title: "TikTok Automation", desc: "Capture social engagement and streamline profile interactions with AI-powered replies.", cta: "Connect TikTok" },
      { title: "Website AI Widget", desc: "Embed an AI chat widget on your site to convert visitors into qualified conversations.", cta: "Connect Widget" },
    ],
    featuresBadge: "Platform Core Features",
    featuresTitle1: "Business Automation with",
    featuresTitle2: "Smart AI",
    featuresTitle3: "is now easy",
    featuresDesc: "All the modern tools you need to grow your Facebook, WhatsApp & YouTube engagement in one dashboard.",
    featuresList: [
      { title: "Facebook Automation", desc: "Automatically reply to comments on your Facebook posts, pages & ads. Multiply engagement many times over." },
      { title: "Messenger & WhatsApp", desc: "Manage Messenger and WhatsApp messages in one place and set smart auto-replies." },
      { title: "YouTube Automation", desc: "Automatically manage and reply to YouTube comments, ensuring the growth of your channel." },
    ],
    servicesBadge: "Everything You Need",
    servicesTitle1: "The Best Solution for",
    servicesTitle2: "Smart Business",
    servicesDesc: "We offer modern AI-powered all-in-one automation services to ensure business growth and build close relationships with customers.",
    servicesList: [
      { title: "Comment & Message Automation", desc: "Never miss a lead or engagement on any social platform. Handle all comments and messages automatically." },
      { title: "Multi-platform Integration", desc: "Connect Facebook, Messenger, WhatsApp, YouTube and many more platforms in one dashboard." },
      { title: "Analytics & Insights", desc: "Track engagement, leads and conversions through powerful reporting tools and grow your business." },
    ],
    ctaTitle1: "Does your business need",
    ctaTitle2: "Custom Automation?",
    ctaDesc: "Tell our team about your specific challenge. We will create the best AI solution tailored to your needs.",
    ctaBtn: "Get Free Consultation",
    aboutBadge: "Who We Are",
    aboutTitle1: "Get to know",
    aboutTitle2: "about us",
    aboutP1: " is a complete smart platform that helps make your business and personal life easier through Facebook, WhatsApp and Messenger.",
    aboutP2: "It automatically replies to comments and messages, tracks leads and provides secure work reports. It saves your valuable time.",
    aboutFeatures: ["24/7 Auto Reply", "Lead Tracking", "Performance Reports", "Safe & Secure"],
    contactBadge: "Get In Touch",
    contactTitle1: "Contact",
    contactTitle2: "Us",
    contactItems: [
      { title: "Call Us", value: "01727358743" },
      { title: "Email Us", value: "newsmartagentbd@gmail.com" },
      { title: "WhatsApp Support", value: "Available 24/7 for help" },
    ],
    formName: "Your Name", formNamePlaceholder: "Md Hamid",
    formEmail: "Email Address", formEmailPlaceholder: "example@mail.com",
    formSubject: "Subject", formSubjectPlaceholder: "What do you want to talk about?",
    formMessage: "Message", formMessagePlaceholder: "Write your detailed message here...",
    formSending: "Sending...",
    formSend: "Send Message",
    formSuccess: "Thank you! Your message has been successfully received.",
    formError: "Sorry, the message could not be sent due to a technical issue.",
    smartVelocityDesc: "Your work will be done in the blink of an eye through automation.",
    ironcladDesc: "Your data and privacy are our highest priority.",
    adaptiveDesc: "Smart tools that adapt to your business over time.",
    communityBadge: "Community Actions",
    communityTitle1: "From Home, Open",
    communityTitle2: "Any Request Instantly",
    communityDesc: "Send feedback, report bugs, request features, check roadmap, and write reviews directly from the home page.",
    communityViewAll: "Open Community Hub",
    communityActions: [
      { title: "Feedback", desc: "Share your opinion to help improve product quality and usability.", cta: "Give Feedback", href: "/community/feedback" },
      { title: "Bug Report", desc: "Found an issue? Report it with details so our team can fix it quickly.", cta: "Report Bug", href: "/community/bug-report" },
      { title: "Feature Request", desc: "Suggest new features that can improve automation, growth, and workflow.", cta: "Suggest Feature", href: "/community/feature-request" },
      { title: "Roadmap", desc: "Check upcoming features and priorities planned for New Smart Agent.", cta: "View Roadmap", href: "/community/roadmap" },
      { title: "Write a Review", desc: "Rate your experience and help other businesses choose with confidence.", cta: "Write Review", href: "/community/review" },
    ],
  },
  bn: {
    badge: "The Most Trusted AI Automation in BD",
    heroTitle1: "Automate Your",
    heroTitle2: "Social Media",
    heroTitle3: "& Grow Faster",
    heroDesc: " নিয়ে এসেছে একটি অল-ইন-ওয়ান প্লাটফর্ম। আপনার ফেসবুক, হোয়াটসঅ্যাপ ও ইউটিউব সংযোগ করুন এবং সময় বাঁচান আমাদের স্মার্ট এআই টুলস দিয়ে।",
    getStarted: "বিনামূল্যে শুরু করুন",
    learnMore: "আরও জানুন",
    noCard: "কার্ড লাগবে না",
    secured: "SSL সুরক্ষিত",
    integrationsBadge: "প্ল্যাটফর্ম ইন্টিগ্রেশন",
    integrationsTitle1: "সব কাস্টমার",
    integrationsTitle2: "চ্যানেল এক জায়গায়",
    integrationsDesc: "New Smart Agent একটি AI automation SaaS software, যা Facebook, WhatsApp, Instagram, Telegram, YouTube, Google Business ও TikTok এক ড্যাশবোর্ডে যুক্ত করে দ্রুত রিপ্লাই, ভালো সার্ভিস এবং বেশি কনভার্শন নিশ্চিত করে।",
    integrationsList: [
      { title: "Facebook Automation", desc: "কমেন্ট ও ইনবক্সে AI দিয়ে দ্রুত, মানবসুলভ অটো-রিপ্লাই দিন।", cta: "Facebook Connect" },
      { title: "WhatsApp Business", desc: "একটি AI-চালিত ওয়ার্কস্পেস থেকে সাপোর্ট ও সেলস চ্যাট ম্যানেজ করুন।", cta: "WhatsApp Connect" },
      { title: "Instagram Automation", desc: "DM ও এনগেজমেন্টে দ্রুত সাড়া দিয়ে লিড কোয়ালিটি উন্নত করুন।", cta: "Instagram Connect" },
      { title: "Telegram Bot", desc: "ইনস্ট্যান্ট Q&A, সাপোর্ট রাউটিং ও ফলো-আপের জন্য বট ডিপ্লয় করুন।", cta: "Telegram Connect" },
      { title: "YouTube Engagement", desc: "ভিডিও কমেন্ট অটো-ম্যানেজ ও রিপ্লাই দিয়ে অডিয়েন্স একটিভ রাখুন।", cta: "YouTube Connect" },
      { title: "Google Business Profile", desc: "রিভিউ ও লোকাল কাস্টমার প্রশ্নে অটোমেশন দিয়ে বিশ্বাসযোগ্যতা বাড়ান।", cta: "GBP Connect" },
      { title: "TikTok Automation", desc: "সামাজিক এনগেজমেন্ট দ্রুত ধরুন এবং AI দিয়ে প্রোফাইল ইন্টারঅ্যাকশন পরিচালনা করুন।", cta: "TikTok Connect" },
      { title: "Website AI Widget", desc: "ওয়েবসাইটে AI চ্যাট উইজেট যুক্ত করে ভিজিটরকে লিডে কনভার্ট করুন।", cta: "Widget Connect" },
    ],
    featuresBadge: "Platform Core Features",
    featuresTitle1: "Business Automation with",
    featuresTitle2: "Smart AI",
    featuresTitle3: "is now easy",
    featuresDesc: "আপনার ফেসবুক, হোয়াটসঅ্যাপ ও ইউটিউবের এনগেজমেন্ট বাড়াতে প্রয়োজনীয় সব আধুনিক টুলস এখন এক ড্যাশবোর্ডে।",
    featuresList: [
      { title: "ফেসবুক অটোমেশন", desc: "আপনার Facebook পোস্ট, পেজ ও অ্যাডের কমেন্টে স্বয়ংক্রিয়ভাবে উত্তর দেবে। এনগেজমেন্ট বাড়বে বহুগুণ।" },
      { title: "মেসেঞ্জার ও হোয়াটসঅ্যাপ", desc: "মেসেঞ্জার এবং হোয়াটসঅ্যাপ মেসেজ এক জায়গায় ম্যানেজ করুন এবং স্মার্টলি রিপ্লাই সেট করুন।" },
      { title: "ইউটিউব অটোমেশন", desc: "YouTube কমেন্টগুলো স্বয়ংক্রিয়ভাবে ম্যানেজ করুন এবং উত্তর দিন, যা আপনার চ্যানেলের গ্রোথ নিশ্চিত করবে।" },
    ],
    servicesBadge: "Everything You Need",
    servicesTitle1: "The Best Solution for",
    servicesTitle2: "Smart Business",
    servicesDesc: "ব্যবসায়িক প্রবৃদ্ধি নিশ্চিত করতে এবং কাস্টমারদের সাথে নিবিড় সম্পর্ক গড়তে আমরা দিচ্ছি আধুনিক এআই চালিত অল-ইন-ওয়ান অটোমেশন সার্ভিস।",
    servicesList: [
      { title: "কমেন্ট ও মেসেজ অটোমেশন", desc: "কোনো সোশ্যাল প্ল্যাটফর্মে লিড বা এনগেজমেন্ট মিস হবে না। সব কমেন্ট ও মেসেজ স্বয়ংক্রিয়ভাবে হ্যান্ডেল করুন।" },
      { title: "মাল্টি-প্ল্যাটফর্ম ইন্টিগ্রেশন", desc: "Facebook, Messenger, WhatsApp, YouTube এবং আরও অনেক প্ল্যাটফর্মকে এক ড্যাশবোর্ডে সংযুক্ত করুন।" },
      { title: "অ্যানালিটিক্স ও ইনসাইটস", desc: "এনগেজমেন্ট, লিড এবং কনভার্শন ট্র্যাক করুন শক্তিশালী রিপোর্টিং টুলসের মাধ্যমে এবং ব্যবসা বৃদ্ধি করুন।" },
    ],
    ctaTitle1: "Does your business need",
    ctaTitle2: "Custom Automation?",
    ctaDesc: "আমাদের টিমকে জানান আপনার সুনির্দিষ্ট চ্যালেঞ্জের কথা। আমরা আপনার প্রয়োজন অনুযায়ী তৈরি করে দেব সেরা এআই সলিউশন।",
    ctaBtn: "ফ্রি কনসালটেশন নিন",
    aboutBadge: "Who We Are",
    aboutTitle1: "Get to know",
    aboutTitle2: "about us",
    aboutP1: " একটি সম্পূর্ণ স্মার্ট প্ল্যাটফর্ম, যা Facebook, WhatsApp এবং Messenger-এর মাধ্যমে আপনার ব্যবসায়িক ও ব্যক্তিগত জীবন আরও সহজ করতে সাহায্য করে।",
    aboutP2: "এটি স্বয়ংক্রিয়ভাবে কমেন্ট এবং মেসেজের উত্তর দেয়, লিড ট্র্যাক করে এবং নিরাপদভাবে কাজের রিপোর্ট প্রদান করে। এর মাধ্যমে আপনার মূল্যবান সময় বাঁচে।",
    aboutFeatures: ["২৪/৭ অটো রিপ্লাই", "লিড ট্র্যাকিং", "পারফরম্যান্স রিপোর্ট", "নিরাপদ ও সুরক্ষিত"],
    contactBadge: "Get In Touch",
    contactTitle1: "Contact",
    contactTitle2: "Us",
    contactItems: [
      { title: "সরাসরি কল", value: "01727358743" },
      { title: "ইমেইল করুন", value: "newsmartagentbd@gmail.com" },
      { title: "WhatsApp সাপোর্ট", value: "২৪/৭ সহায়তা পাওয়া যায়" },
    ],
    formName: "আপনার নাম", formNamePlaceholder: "মো. হামিদ",
    formEmail: "ইমেইল ঠিকানা", formEmailPlaceholder: "example@mail.com",
    formSubject: "বিষয়", formSubjectPlaceholder: "কী বিষয়ে কথা বলতে চান?",
    formMessage: "বার্তা", formMessagePlaceholder: "আপনার বিস্তারিত বার্তাটি এখানে লিখুন...",
    formSending: "পাঠানো হচ্ছে...",
    formSend: "বার্তা পাঠান",
    formSuccess: "ধন্যবাদ! আপনার বার্তা সফলভাবে পাঠানো হয়েছে।",
    formError: "দুঃখিত, প্রযুক্তিগত সমস্যার কারণে বার্তা পাঠানো সম্ভব হয়নি।",
    smartVelocityDesc: "অটোমেশনের মাধ্যমে আপনার কাজ হবে চোখের পলকে।",
    ironcladDesc: "আপনার ডাটা এবং প্রাইভেসি আমাদের সর্বোচ্চ অগ্রাধিকার।",
    adaptiveDesc: "স্মার্ট টুলস যা সময়ের সাথে আপনার ব্যবসার সাথে মানিয়ে নেয়।",
    communityBadge: "কমিউনিটি অ্যাকশন",
    communityTitle1: "হোম পেজ থেকেই",
    communityTitle2: "সব রিকোয়েস্ট করুন",
    communityDesc: "সরাসরি হোম পেজ থেকেই feedback দিন, bug report করুন, feature request দিন, roadmap দেখুন এবং review লিখুন।",
    communityViewAll: "Community Hub দেখুন",
    communityActions: [
      { title: "Feedback", desc: "প্ল্যাটফর্ম উন্নত করতে আপনার মতামত জানান।", cta: "মতামত দিন", href: "/community/feedback" },
      { title: "Bug Report", desc: "কোনো সমস্যা পেলে বিস্তারিত জানিয়ে দ্রুত সমাধান পেতে রিপোর্ট করুন।", cta: "বাগ রিপোর্ট", href: "/community/bug-report" },
      { title: "Feature Request", desc: "অটোমেশন ও গ্রোথের জন্য দরকারি নতুন ফিচারের প্রস্তাব দিন।", cta: "ফিচার রিকোয়েস্ট", href: "/community/feature-request" },
      { title: "Roadmap", desc: "আগামীতে কোন ফিচার আসছে, কী প্রায়োরিটি চলছে তা দেখুন।", cta: "রোডম্যাপ দেখুন", href: "/community/roadmap" },
      { title: "Write a Review", desc: "আপনার অভিজ্ঞতা রিভিউ দিন, অন্যদের সঠিক সিদ্ধান্ত নিতে সাহায্য করুন।", cta: "রিভিউ লিখুন", href: "/community/review" },
    ],
  },
};

const serviceIcons = [<FaRobot key="robot" />, <FaShareAlt key="share" />, <FaChartBar key="chart" />];
const serviceGradients = [
  { gradient: "from-indigo-600 via-purple-600 to-pink-500", shadow: "shadow-purple-200" },
  { gradient: "from-teal-400 via-cyan-500 to-blue-600", shadow: "shadow-cyan-200" },
  { gradient: "from-orange-400 via-rose-500 to-red-600", shadow: "shadow-rose-200" },
];
const contactIcons = [<FaPhoneAlt key="ph" />, <FaEnvelope key="env" />, <FaWhatsapp key="wp" />];
const contactColors = [
  { bg: "bg-indigo-50", color: "text-indigo-600" },
  { bg: "bg-pink-50", color: "text-pink-600" },
  { bg: "bg-green-50", color: "text-green-600" },
];
const integrationIcons = [FaFacebook, FaWhatsapp, FaInstagram, FaTelegram, FaYoutube, FaShieldAlt, FaTiktok, FaCode];
const integrationAccents = ["text-blue-600", "text-green-600", "text-pink-600", "text-sky-600", "text-red-600", "text-indigo-600", "text-black", "text-amber-600"];
const communityActionIcons = [FaRegCommentDots, FaBug, FaLightbulb, FaRocket, FaStar];
const communityActionColors = ["from-indigo-600 to-violet-600", "from-rose-600 to-orange-500", "from-amber-500 to-yellow-500", "from-purple-600 to-indigo-600", "from-yellow-500 to-orange-500"];

export default function HomePage() {
  const { lang } = useLanguage();
  const t = translations[lang];

  const [formData, setFormData] = useState({ name: "", email: "", subjects: "", messages: "" });
  const [status, setStatus] = useState({ loading: false, success: null, error: null });
  const [activeCommunityCard, setActiveCommunityCard] = useState(0);

  useEffect(() => {
    if (!t?.communityActions?.length) return;
    const timer = setInterval(() => {
      setActiveCommunityCard((prev) => (prev + 1) % t.communityActions.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [t]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: null, error: null });
    try {
      await api.post("/contact/create/", formData);
      setStatus({ loading: false, success: t.formSuccess, error: null });
      setFormData({ name: "", email: "", subjects: "", messages: "" });
    } catch {
      setStatus({ loading: false, success: null, error: t.formError });
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 overflow-x-hidden text-gray-900 [--h1:clamp(2.4rem,6vw,5rem)] [--h2:clamp(1.9rem,4.5vw,3.2rem)] [--h3:clamp(1.25rem,2.2vw,1.8rem)] [--body:clamp(1rem,1.2vw,1.12rem)] [--muted:clamp(0.95rem,1.1vw,1.02rem)]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] md:min-h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-b from-white via-slate-50 to-indigo-50/40">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.6, 0.4, 0.6] }} transition={{ duration: 15, repeat: Infinity }} className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[100px]" />
          <motion.div animate={{ scale: [1, 1.3, 1], x: [0, -30, 0], opacity: [0.5, 0.7, 0.5] }} transition={{ duration: 20, repeat: Infinity }} className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[100px]" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e505_1px,transparent_1px),linear-gradient(to_bottom,#4f46e505_1px,transparent_1px)] bg-[size:60px_60px]"></div>

        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="relative z-10 container mx-auto px-6 py-16 md:py-20 lg:py-24 flex flex-col items-center">
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-5 py-2 mt-8 rounded-full bg-white/80 backdrop-blur-md border border-indigo-100 text-indigo-700 text-xs md:text-sm font-black mb-10 shadow-sm">
            <FaRocket className="animate-bounce" />
            <span className="uppercase tracking-widest text-[10px] md:text-xs">{t.badge}</span>
          </motion.div>

          <motion.h1 variants={fadeInUp} className="text-[length:var(--h1)] font-black text-center text-slate-900 mb-8 leading-[1.05] tracking-[-0.03em] max-w-5xl">
            {t.heroTitle1} <span className="text-indigo-600">{t.heroTitle2}</span> <br className="hidden md:block" />
            <span className="italic text-cyan-700">{t.heroTitle3}</span>
          </motion.h1>

          <motion.p variants={fadeInUp} className="text-gray-600 text-[length:var(--body)] text-center max-w-3xl mb-12 leading-relaxed font-medium px-4">
            <span className="text-indigo-700 font-bold">New Smart Agent</span> {t.heroDesc}
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 mb-14 md:mb-18 lg:mb-20">
            <Link href="/signup" className="group relative px-10 py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-black text-lg shadow-xl shadow-indigo-300/40 hover:from-indigo-700 hover:to-cyan-700 active:from-indigo-800 active:to-cyan-800 transition-all flex items-center gap-3 active:scale-95 overflow-hidden">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative z-10 flex items-center gap-3">{t.getStarted} <FaArrowRight className="group-hover:translate-x-2 transition-transform" /></span>
            </Link>
            <Link href="/about" className="px-10 py-5 rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-md text-slate-700 font-bold text-lg hover:bg-white hover:border-slate-300 transition-all shadow-sm active:scale-95">
              {t.learnMore}
            </Link>
          </motion.div>

          <motion.div variants={fadeInUp} className="w-full max-w-4xl py-8 md:py-10 border-t border-slate-200/70 flex flex-col items-center gap-6 md:gap-8">
            <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 lg:gap-16 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
              <div className="flex items-center gap-2 text-gray-800 font-black text-xl"><FaFacebook className="text-[#1877F2]" /> <span className="text-sm">Facebook</span></div>
              <div className="flex items-center gap-2 text-gray-800 font-black text-xl"><FaWhatsapp className="text-[#25D366]" /> <span className="text-sm">WhatsApp</span></div>
              <div className="flex items-center gap-2 text-gray-800 font-black text-xl"><FaYoutube className="text-[#FF0000]" /> <span className="text-sm">YouTube</span></div>
            </div>
            <div className="flex items-center gap-6 text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">
              <span className="flex items-center gap-1"><FaCheckCircle className="text-green-500" /> {t.noCard}</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
              <span className="flex items-center gap-1"><FaShieldAlt className="text-indigo-500" /> {t.secured}</span>
            </div>
          </motion.div>
        </motion.div>
        <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-gray-50 to-transparent"></div>
      </section>

      {/* Integrations Section */}
      <section className="py-16 md:py-20 lg:py-24 px-4 md:px-8 lg:px-10 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.25),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.2),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.15),transparent_35%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:42px_42px]"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="max-w-4xl mx-auto text-center mb-10 md:mb-12 lg:mb-14 space-y-3 md:space-y-4">
            <h2 className="text-cyan-300 font-black uppercase tracking-[0.2em] text-xs">{t.integrationsBadge}</h2>
            <h3 className="text-[length:var(--h2)] font-black text-white tracking-[-0.02em] leading-[1.1]">
              {t.integrationsTitle1} <span className="text-indigo-300">{t.integrationsTitle2}</span>
            </h3>
            <p className="text-slate-300 font-medium text-[length:var(--body)] leading-relaxed">{t.integrationsDesc}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-10">
            {["AI-first SaaS", "Multi-platform Hub", "Automation Ready", "SEO-friendly Content"].map((pill) => (
              <div key={pill} className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md px-4 py-3 text-center text-[11px] md:text-xs font-black tracking-wider uppercase text-slate-200">
                {pill}
              </div>
            ))}
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {t.integrationsList.map((item, index) => {
              const Icon = integrationIcons[index];
              return (
                <motion.article key={item.title} variants={fadeInUp} whileHover={{ y: -10, scale: 1.01 }} whileTap={{ y: -4, scale: 0.99 }} className="group rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl p-6 flex flex-col h-full shadow-[0_24px_80px_-24px_rgba(15,23,42,0.85)] transition-all duration-500 hover:border-cyan-300/60 hover:bg-white/15 hover:shadow-[0_32px_90px_-28px_rgba(34,211,238,0.45)] active:scale-[0.985] active:bg-white/20">
                  <div className={`w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center text-2xl mb-5 ${integrationAccents[index]}`}>
                    <Icon />
                  </div>
                  <h4 className="text-[length:var(--h3)] font-black text-white mb-3 tracking-tight leading-tight">{item.title}</h4>
                  <p className="text-slate-200/90 font-medium text-[length:var(--muted)] leading-relaxed flex-1">{item.desc}</p>
                  <Link href="/dashboard/connect" className="mt-6 inline-flex items-center gap-2 text-cyan-300 group-hover:text-white font-black text-xs uppercase tracking-widest transition-colors">
                    {item.cta} <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 md:py-20 lg:py-24 px-4 md:px-8 lg:px-10 bg-gradient-to-b from-[#f8fafc] via-[#f6f8ff] to-[#fdfdff] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/40 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-100/40 rounded-full blur-[120px]"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="text-center mb-12 md:mb-16 lg:mb-20 space-y-4 md:space-y-5">
            <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100 shadow-sm">{t.servicesBadge}</span>
            <h2 className="text-[length:var(--h2)] font-black text-gray-900 tracking-[-0.02em] leading-[1.1]">
              {t.servicesTitle1} <span className="text-indigo-600">{t.servicesTitle2}</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto font-medium text-[length:var(--body)] leading-relaxed px-4">{t.servicesDesc}</p>
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7 lg:gap-9 relative">
            {t.servicesList.map((service, index) => {
              const sg = serviceGradients[index];
              return (
                <motion.div key={index} variants={fadeInUp} whileHover={{ y: -12 }} whileTap={{ y: -6, scale: 0.98 }} className="relative group h-full rounded-[2.5rem] bg-white/90 backdrop-blur-md border border-white/60 p-8 md:p-10 shadow-[0_24px_70px_-28px_rgba(30,41,59,0.35)] flex flex-col transition-all duration-500 hover:border-indigo-200 hover:shadow-[0_30px_80px_-30px_rgba(79,70,229,0.45)] active:scale-[0.985]">
                  <div className={`service-overlay absolute inset-0 bg-gradient-to-br ${sg.gradient} opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 rounded-[2.5rem] -z-10`}></div>
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${sg.gradient} flex items-center justify-center text-white text-3xl mb-8 shadow-lg ${sg.shadow}`}>{serviceIcons[index]}</div>
                  <h3 className="text-[length:var(--h3)] font-black text-gray-900 mb-4 group-hover:text-white transition-colors duration-300 leading-tight">{service.title}</h3>
                  <p className="text-gray-600 font-medium text-[length:var(--muted)] leading-relaxed mb-8 group-hover:text-indigo-50 group-active:text-indigo-50 transition-colors duration-300 flex-1">{service.desc}</p>
                  <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-indigo-600 group-hover:text-white group-active:text-white transition-all duration-300">
                    <span>{t.learnMore}</span><FaArrowRight className="group-hover:translate-x-2 transition-transform" />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-12 md:mt-16 lg:mt-20 p-6 md:p-10 lg:p-14 rounded-[2rem] md:rounded-[2.75rem] lg:rounded-[3.5rem] bg-gradient-to-r from-slate-900 via-indigo-900 to-cyan-900 text-white flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 relative overflow-hidden shadow-2xl shadow-indigo-300/30">
            <div className="relative z-10 text-center md:text-left space-y-4">
              <h4 className="text-[clamp(1.6rem,3vw,2.4rem)] font-black tracking-tight leading-tight">
                {t.ctaTitle1} <br /><span className="text-indigo-400 italic">{t.ctaTitle2}</span>
              </h4>
              <p className="text-indigo-200 font-medium max-w-lg text-[length:var(--body)] leading-relaxed">{t.ctaDesc}</p>
            </div>
            <Link href="/contact" className="relative z-20">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-12 py-5 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-xl hover:bg-cyan-50 transition-all whitespace-nowrap">
                {t.ctaBtn}
              </motion.button>
            </Link>
            <div className="absolute top-0 right-0 w-64 h-full bg-white/5 skew-x-12 translate-x-20"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 md:py-20 lg:py-24 px-4 md:px-8 lg:px-10 bg-gradient-to-b from-white to-slate-50/70 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12 lg:gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="grid grid-cols-2 gap-4 md:gap-6 order-2 lg:order-1">
              <div className="space-y-4 md:space-y-6">
                <div className="bg-gradient-to-br from-indigo-600 to-cyan-600 p-8 rounded-[2rem] shadow-xl text-white transition-all duration-500 hover:shadow-[0_22px_50px_-20px_rgba(34,211,238,0.65)] hover:-translate-y-1 active:scale-[0.985]">
                  <FaRocket size={32} className="mb-4" />
                  <h4 className="font-black text-xl tracking-tight uppercase">Smart Velocity</h4>
                  <p className="text-indigo-100 text-[11px] leading-relaxed mt-2 font-bold italic">{t.smartVelocityDesc}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-md p-8 rounded-[2rem] border border-slate-200 flex flex-col items-center text-center group hover:bg-white hover:shadow-xl hover:border-indigo-200 transition-all duration-500 active:scale-[0.985]">
                  <FaShieldAlt size={32} className="mb-4 text-indigo-600" />
                  <h4 className="font-black text-xl text-gray-800 tracking-tight uppercase">Ironclad Security</h4>
                  <p className="text-gray-400 text-[11px] leading-relaxed mt-2 font-bold">{t.ironcladDesc}</p>
                </div>
              </div>
              <div className="pt-8 md:pt-12 space-y-4 md:space-y-6">
                <div className="bg-white/80 backdrop-blur-md p-8 rounded-[2rem] border border-slate-200 flex flex-col items-center text-center group hover:bg-white hover:shadow-xl hover:border-cyan-200 transition-all duration-500 active:scale-[0.985]">
                  <FaLightbulb size={32} className="mb-4 text-amber-500" />
                  <h4 className="font-black text-xl text-gray-800 tracking-tight uppercase">Adaptive AI</h4>
                  <p className="text-gray-400 text-[11px] leading-relaxed mt-2 font-bold">{t.adaptiveDesc}</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-cyan-50 p-8 rounded-[2rem] border border-indigo-100 flex flex-col items-center text-center transition-all duration-500 hover:from-indigo-100 hover:to-cyan-100 hover:shadow-lg active:scale-[0.985]">
                  <h3 className="text-4xl font-black text-indigo-600">10X</h3>
                  <p className="text-indigo-900 font-bold text-sm mt-2 uppercase tracking-[0.2em]">Efficiency</p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-6 md:space-y-7 lg:space-y-8 order-1 lg:order-2">
              <div className="space-y-4">
                <span className="inline-block px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100">{t.aboutBadge}</span>
                <h2 className="text-[length:var(--h2)] font-black text-gray-900 leading-[1.1] tracking-[-0.02em]">
                  {t.aboutTitle1} <span className="text-indigo-600 italic">{t.aboutTitle2}</span>
                </h2>
              </div>
              <div className="space-y-6">
                <p className="text-gray-700 text-[length:var(--body)] leading-relaxed font-medium border-l-4 border-indigo-600 pl-6">
                  <strong className="text-gray-900">New Smart Agent</strong> {t.aboutP1}
                </p>
                <p className="text-gray-600 text-[length:var(--muted)] leading-relaxed font-medium">{t.aboutP2}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {t.aboutFeatures.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-green-500"></div></div>
                    <span className="text-sm font-bold text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4">
                <Link href="/about" className="group inline-flex items-center gap-3 px-10 py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-600 transition-all duration-300">
                  {t.learnMore} <FaArrowRight className="text-sm group-hover:translate-x-2 transition-transform" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Community Quick Actions */}
      <section className="py-16 md:py-20 lg:py-24 px-4 md:px-8 lg:px-10 bg-white relative overflow-hidden">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[85%] h-44 bg-violet-100/50 blur-[100px] rounded-full"></div>
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 md:mb-12">
            <p className="text-indigo-600 font-black uppercase tracking-[0.2em] text-xs mb-3">{t.communityBadge}</p>
            <h3 className="text-[length:var(--h2)] font-black text-slate-900 tracking-[-0.02em] leading-[1.1]">
              {t.communityTitle1} <span className="text-indigo-600">{t.communityTitle2}</span>
            </h3>
            <p className="text-slate-600 text-[length:var(--body)] font-medium leading-relaxed max-w-3xl mx-auto mt-4">{t.communityDesc}</p>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              {t.communityActions.map((item, index) => {
                if (index !== activeCommunityCard) return null;
                const Icon = communityActionIcons[index];
                const grad = communityActionColors[index];
                return (
                  <motion.div
                    key={`${item.title}-${index}`}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.98 }}
                    transition={{ duration: 0.35 }}
                    className="group rounded-[2rem] border border-slate-200 bg-white p-7 md:p-8 shadow-[0_18px_60px_-30px_rgba(30,41,59,0.35)] transition-all duration-500 hover:border-indigo-200 hover:shadow-[0_24px_70px_-30px_rgba(79,70,229,0.45)] active:scale-[0.985]"
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${grad} text-white text-2xl flex items-center justify-center mb-5 transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_16px_34px_-14px_rgba(79,70,229,0.7)] group-active:scale-105`}>
                      <Icon />
                    </div>
                    <h4 className="text-[length:var(--h3)] text-slate-900 font-black mb-3">{item.title}</h4>
                    <p className="text-slate-600 text-[length:var(--muted)] leading-relaxed font-medium mb-7">{item.desc}</p>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <Link href={item.href} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-900 text-white font-black text-sm hover:from-indigo-700 hover:to-cyan-700 active:from-indigo-800 active:to-cyan-800 transition-all duration-300">
                        {item.cta} <FaArrowRight />
                      </Link>
                      <Link href="/community" className="inline-flex items-center gap-2 text-indigo-600 font-black text-sm">
                        {t.communityViewAll} <FaArrowRight />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <div className="flex items-center justify-center gap-2 mt-6">
              {t.communityActions.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveCommunityCard(i)}
                  className={`h-2.5 rounded-full transition-all ${activeCommunityCard === i ? "w-7 bg-indigo-600" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
                  aria-label={`Community card ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 md:py-20 lg:py-24 px-4 md:px-6 bg-gradient-to-b from-[#FDFDFF] to-[#f6f9ff] relative overflow-hidden">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[80%] h-40 bg-cyan-100/30 blur-[120px] rounded-full"></div>
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 md:mb-14 lg:mb-16 space-y-3 md:space-y-4">
            <h2 className="text-indigo-600 font-black uppercase tracking-widest text-sm italic">{t.contactBadge}</h2>
            <h3 className="text-[length:var(--h2)] font-black text-gray-900 tracking-[-0.02em]">
              {t.contactTitle1} <span className="text-indigo-600">{t.contactTitle2}</span>
            </h3>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 lg:gap-12 items-start">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:col-span-5 space-y-6">
              {t.contactItems.map((card, idx) => (
                <motion.div key={idx} whileHover={{ x: 10 }} whileTap={{ x: 6, scale: 0.98 }} className="bg-white/90 backdrop-blur-md py-6 px-4 rounded-[2.5rem] shadow-lg shadow-slate-200/40 border border-slate-100 flex items-start gap-6 group cursor-default active:shadow-md transition-all duration-500 hover:border-indigo-200 hover:shadow-[0_24px_60px_-28px_rgba(79,70,229,0.45)] active:scale-[0.985]">
                  <div className={`w-14 h-14 ${contactColors[idx].bg} rounded-2xl flex items-center justify-center ${contactColors[idx].color} text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300`}>{contactIcons[idx]}</div>
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{card.title}</p>
                    <p className="text-[clamp(1rem,1.8vw,1.25rem)] font-black text-gray-800 tracking-tight truncate max-w-[200px] md:max-w-none">{card.value}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:col-span-7">
              <div className="bg-white/90 backdrop-blur-xl p-8 md:p-12 rounded-[3rem] shadow-2xl shadow-slate-300/30 border border-slate-100 relative overflow-hidden group">
                <div className="absolute -top-20 -right-20 w-52 h-52 bg-indigo-100/50 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -left-20 w-52 h-52 bg-cyan-100/50 rounded-full blur-3xl"></div>
                <form className="space-y-5 relative z-10" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{t.formName}</label>
                      <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder={t.formNamePlaceholder} className="w-full p-4 bg-white/70 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{t.formEmail}</label>
                      <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder={t.formEmailPlaceholder} className="w-full p-4 bg-white/70 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all font-medium" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{t.formSubject}</label>
                    <input type="text" name="subjects" required value={formData.subjects} onChange={handleChange} placeholder={t.formSubjectPlaceholder} className="w-full p-4 bg-white/70 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all font-medium" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{t.formMessage}</label>
                    <textarea name="messages" required value={formData.messages} onChange={handleChange} placeholder={t.formMessagePlaceholder} rows={5} className="w-full p-4 bg-white/70 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all font-medium resize-none"></textarea>
                  </div>
                  {status.success && <p className="text-emerald-500 font-bold text-sm">{status.success}</p>}
                  {status.error && <p className="text-rose-500 font-bold text-sm">{status.error}</p>}
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} disabled={status.loading} className={`w-full py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-2xl font-black text-lg shadow-xl hover:from-indigo-700 hover:to-cyan-700 transition-all flex items-center justify-center gap-3 ${status.loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    <FaPaperPlane className={status.loading ? 'animate-ping' : ''} />
                    {status.loading ? t.formSending : t.formSend}
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
