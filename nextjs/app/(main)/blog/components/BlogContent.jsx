"use client";

import React from 'react';
import { HiOutlineShare } from 'react-icons/hi';
import { FaFacebookF, FaWhatsapp, FaLinkedinIn, FaLink } from 'react-icons/fa';

import { useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const getIcon = (name) => {
  switch (name) {
    case 'Facebook': return <FaFacebookF />;
    case 'WhatsApp': return <FaWhatsapp />;
    case 'LinkedIn': return <FaLinkedinIn />;
    default: return null;
  }
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function BlogContent({ content, shareUrl, shareTitle, socialLinks, postSlug }) {

  useEffect(() => {
    if (postSlug) {
      const viewed = localStorage.getItem(`viewed_post_${postSlug}`);
      if (!viewed) {
        axios.post(`${API_BASE_URL}/blog/posts/${postSlug}/increment_view/`)
          .then(() => {
            localStorage.setItem(`viewed_post_${postSlug}`, 'true');
          })
          .catch(e => console.error('Error tracking view:', e));
      }
    }
  }, [postSlug]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link Copied to Clipboard', {
      position: 'bottom-center',
      style: {
        borderRadius: '100px',
        background: '#0f172a',
        color: '#fff',
        fontSize: '12px',
        fontWeight: 'bold',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '16px 24px'
      },
      iconTheme: {
        primary: '#9333ea',
        secondary: '#fff',
      },
    });
  };

  return (
    <div className="lg:col-span-11 bg-white p-6 md:p-12 lg:p-24 rounded-[2rem] md:rounded-[4rem] shadow-[0_100px_200px_-50px_rgba(0,0,0,0.06)] border border-slate-50 relative overflow-hidden">
      <Toaster />
      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none hidden md:block">
        <HiOutlineShare className="text-[120px] -rotate-12" />
      </div>
      
      <article className="prose prose-slate prose-lg md:prose-xl max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-headings:uppercase prose-headings:text-slate-900 prose-p:leading-relaxed prose-a:text-purple-600 prose-strong:text-slate-950 prose-img:rounded-3xl prose-img:shadow-2xl overflow-x-hidden">
        <div dangerouslySetInnerHTML={{ __html: content }} className="break-words" />
      </article>

      {/* Mobile/Bottom Share Section */}
      <div className="mt-16 md:mt-24 pt-12 md:pt-16 border-t border-slate-50 space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 text-center md:text-left">
          <div className="flex items-center gap-4 text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
            <HiOutlineShare className="text-2xl text-purple-600" /> Amplify Insight
          </div>
          <div className="flex flex-wrap justify-center gap-3 w-full md:w-auto">
            {socialLinks.map((social) => (
              <a 
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-3 md:py-4 ${social.color} text-white rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md`}
              >
                {getIcon(social.name)} <span className="hidden sm:inline">{social.name}</span>
              </a>
            ))}
            <button 
              onClick={handleCopy}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-3 md:py-4 bg-slate-900 text-white rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest hover:bg-purple-600 active:scale-95 transition-all shadow-md"
            >
              <FaLink /> Copy
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
        }

        .prose h1, .prose h2, .prose h3, .prose h4 {
          margin-top: 2.5em;
          margin-bottom: 0.8em;
          color: #0f172a !important;
        }

        .prose p {
          margin-bottom: 1.8em;
          line-height: 1.8;
          color: #334155;
        }

        .prose blockquote {
          border-left: 8px solid #9333ea;
          padding-left: 2rem;
          font-style: italic;
          color: #475569;
          font-weight: 500;
          background: #f8fafc !important;
          padding: 2rem;
          border-radius: 2rem;
        }
      `}</style>
    </div>
  );
}
