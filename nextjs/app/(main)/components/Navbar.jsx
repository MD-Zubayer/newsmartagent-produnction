'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { FaBars, FaTimes, FaChevronRight } from 'react-icons/fa';
import Image from 'next/image';
import { ChevronDown, Package, Wrench, Megaphone, Bug, Star, Rocket, Lightbulb, MessageCircle, BookOpen, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Navbar copy stays English even when the site language is Bengali
const navLabels = { home: 'Home', docs: 'Docs', services: 'Services', contact: 'Contact', about: 'About', blog: 'Blog', signin: 'Sign In', tools: 'Tools' };
const toolsLabels = { name: 'Order Tracking', desc: 'Track orders by phone number' };

export default function Navbar() {
  const { lang, setLang } = useLanguage();
  const l = navLabels;
  const tl = toolsLabels;

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const toolsRef = useRef(null);
  const communityRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
      if (communityRef.current && !communityRef.current.contains(e.target)) {
        setCommunityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { name: l.home, path: '/' },
    { name: l.docs, path: '/docs' },
    { name: l.services, path: '/services' },
    { name: l.contact, path: '/contact' },
    { name: l.about, path: '/about' },
    { name: l.blog, path: '/blog' },
  ];

  const toolsItems = [
    {
      name: tl.name,
      path: '/tools/orders',
      icon: <Package className="w-4 h-4" />,
      desc: tl.desc,
    },
  ];

  const communityItems = [
    { name: '📢 Feedback', desc: 'আমাদের আরও ভালো হতে সাহায্য করুন', path: '/contact', icon: <MessageSquare className="w-4 h-4" /> },
    { name: '🐞 Report a Bug', desc: 'কোনো সমস্যা হচ্ছে? আমাদের জানান', path: '/contact', icon: <Bug className="w-4 h-4" /> },
    { name: '⭐ Write a Review', desc: 'আপনার অভিজ্ঞতা শেয়ার করুন', path: '/about', icon: <Star className="w-4 h-4" /> },
    { name: '🚀 Product Roadmap', desc: 'আমরা কী বানাচ্ছি দেখুন', path: '/blog', icon: <Rocket className="w-4 h-4" /> },
    { name: '💡 Suggest a Feature', desc: 'আইডিয়া দিন', path: '/contact', icon: <Lightbulb className="w-4 h-4" /> },
    { name: '💬 Join WhatsApp Group', desc: 'সরাসরি আলাপ', path: '#', icon: <MessageCircle className="w-4 h-4" /> },
    { name: '📖 User Guide & Templates', desc: 'কিভাবে ব্যবহার করবেন', path: '/docs', icon: <BookOpen className="w-4 h-4" /> },
  ];

  // Language toggle button (reusable)
  const LangToggle = () => (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setLang('en')}
        className={`text-xs font-black px-2.5 py-1 rounded-md transition-all ${lang === 'en' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
      >
        EN
      </button>
      <button
        onClick={() => setLang('bn')}
        className={`text-xs font-black px-2.5 py-1 rounded-md transition-all ${lang === 'bn' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
      >
        বাং
      </button>
    </div>
  );

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-[100] transition-all duration-300 ${scrolled
            ? 'bg-white/90 backdrop-blur-md border-b border-gray-100 py-3 shadow-sm'
            : 'bg-transparent py-5'
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">

          {/* Brand Logo */}
          <Link href="/" className="flex items-center group">
            <div className="relative overflow-hidden rounded-xl">
              <Image
                width={65}
                height={65}
                src="/newsmartagent.png"
                alt="Logo"
                className="h-20w-20 object-contain rounded-lg"
              />
            </div>
            <span className="text-xl md:block hidden font-black tracking-tighter flex items-center">
              <span className="text-indigo-600">New</span>
              <span className="text-gray-900 ml-1">Smart</span>
              <span className="text-indigo-600 ml-1">Agent</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-indigo-600 transition-all relative group"
                >
                  {item.name}
                  <span className="absolute bottom-1 left-1/2 w-0 h-[2px] bg-indigo-600 transition-all group-hover:w-1/3 group-hover:left-1/3"></span>
                </Link>
              ))}

              {/* Tools Dropdown */}
              <div className="relative" ref={toolsRef}>
                <button
                  onClick={() => setToolsOpen(!toolsOpen)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold transition-all relative group rounded-lg ${toolsOpen ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-indigo-600'}`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {l.tools}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${toolsOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Panel */}
                {toolsOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1">Tools &amp; Utilities</p>
                    {toolsItems.map((item) => (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setToolsOpen(false)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
                      >
                        <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                          {item.icon}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Community Dropdown */}
              <div className="relative" ref={communityRef}>
                <button
                  onClick={() => setCommunityOpen(!communityOpen)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold transition-all relative group rounded-lg ${communityOpen ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-indigo-600'}`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  Community
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${communityOpen ? 'rotate-180' : ''}`} />
                </button>

                {communityOpen && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1">Community</p>
                    <div className="max-h-96 overflow-y-auto pr-1">
                      {communityItems.map((item) => (
                        <Link
                          key={item.name}
                          href={item.path}
                          onClick={() => setCommunityOpen(false)}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
                        >
                          <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                            {item.icon}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 leading-tight">{item.name}</p>
                            <p className="text-xs text-gray-400 leading-tight">{item.desc}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 border-l border-gray-100 pl-6">
              <LangToggle />
              <Link
                href="/login"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 active:scale-95"
              >
                {l.signin}
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <LangToggle />
            <button
              className="p-2 rounded-xl text-gray-900 hover:bg-gray-100 transition-colors"
              onClick={() => setOpen(true)}
            >
              <FaBars size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] transition-opacity duration-300 md:hidden ${open ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
        onClick={() => setOpen(false)}
      />

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-[280px] bg-white z-[120] shadow-2xl transition-transform duration-500 transform md:hidden ${open ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="p-6 flex flex-col h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <span className="font-black text-indigo-600 tracking-tighter">New Smart Agent</span>
            <button
              className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
              onClick={() => setOpen(false)}
            >
              <FaTimes size={20} />
            </button>
          </div>

          <div className="space-y-1 flex-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between p-4 rounded-2xl text-gray-700 font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                {item.name}
                <FaChevronRight size={12} className="opacity-30" />
              </Link>
            ))}

            {/* Mobile Tools Section */}
            <div className="pt-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 py-2">{l.tools}</p>
              {toolsItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 p-4 rounded-2xl text-gray-700 font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                >
                  <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-gray-400 font-normal">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Mobile Community Section */}
            <div className="pt-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 py-2">Community</p>
              {communityItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 p-4 rounded-2xl text-gray-700 font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                >
                  <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-gray-400 font-normal">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-6 space-y-3">
            <Link
              href="/login"
              className="block text-center py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100"
              onClick={() => setOpen(false)}
            >
              {l.signin}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
