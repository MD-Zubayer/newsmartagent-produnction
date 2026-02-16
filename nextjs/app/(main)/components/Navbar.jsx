'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
// FaBars (Menu-র জন্য) এবং FaTimes (Close-এর জন্য) ব্যবহার করা হয়েছে
import { FaBars, FaTimes, FaChevronRight } from 'react-icons/fa';
import Image from 'next/image';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Doc', path: '/doc' },
    { name: 'Services', path: '/services' },
    { name: 'Contact', path: '/contact' },
    { name: 'About', path: '/about' },
  ];

  return (
    <>
      <nav 
        className={`fixed top-0 w-full z-[100] transition-all duration-300 ${
          scrolled 
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
                src="/new-smart-agent.png"
                alt="Logo"
                className="h-20w-20 object-contain rounded-lg"
              />
            </div>
            <span className="text-xl font-black tracking-tighter flex items-center">
              <span className="text-indigo-600">New</span>
              <span className="text-gray-900 ml-1">Smart</span>
              <span className="text-indigo-600 ml-1">Agent</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.path}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-indigo-600 transition-all relative group"
                >
                  {item.name}
                  <span className="absolute bottom-1 left-1/2 w-0 h-[2px] bg-indigo-600 transition-all group-hover:w-1/3 group-hover:left-1/3"></span>
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-4 border-l border-gray-100 pl-8">
              <Link
                href="/signup"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 active:scale-95"
              >
                Sign Up
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 rounded-xl text-gray-900 hover:bg-gray-100 transition-colors"
            onClick={() => setOpen(true)}
          >
            <FaBars size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-[280px] bg-white z-[120] shadow-2xl transition-transform duration-500 transform md:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-10 border-b pb-4">
            <span className="font-black text-indigo-600 tracking-tighter">New Smart Agent</span>
            <button 
              className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
              onClick={() => setOpen(false)}
            >
              <FaTimes size={20} />
            </button>
          </div>

          <div className="space-y-2 flex-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.path}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between p-4 rounded-2xl text-gray-700 font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                {item.name}
                <FaChevronRight size={12} className="opacity-30" />
              </Link>
            ))}
          </div>

          <div className="pt-6 space-y-3">
            <Link
              href="/signup"
              className="block text-center py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100"
              onClick={() => setOpen(false)}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}