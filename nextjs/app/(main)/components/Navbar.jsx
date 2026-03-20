'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { FaBars, FaTimes, FaChevronRight } from 'react-icons/fa';
import Image from 'next/image';
import { ChevronDown, Package, Wrench } from 'lucide-react';

const toolsItems = [
  {
    name: 'অর্ডার ট্র্যাকিং',
    path: '/tools/orders',
    icon: <Package className="w-4 h-4" />,
    desc: 'ফোন নম্বর দিয়ে অর্ডার দেখুন'
  },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Docs', path: '/docs' },
    { name: 'Services', path: '/services' },
    { name: 'Contact', path: '/contact' },
    { name: 'About', path: '/about' },
    { name: 'Blog', path: '/blog' },
  ];

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
            <span className="text-xl font-black tracking-tighter flex items-center">
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
                  key={item.name}
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
                  Tools
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${toolsOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Panel */}
                {toolsOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1">Tools & Utilities</p>
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
            </div>

            <div className="flex items-center gap-4 border-l border-gray-100 pl-8">
              <Link
                href="/login"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 active:scale-95"
              >
                Sign In
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
                key={item.name}
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
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 py-2">Tools</p>
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
          </div>

          <div className="pt-6 space-y-3">
            <Link
              href="/login"
              className="block text-center py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100"
              onClick={() => setOpen(false)}
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}