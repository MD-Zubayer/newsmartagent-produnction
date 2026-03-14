"use client";

import React from 'react';
import { HiOutlineShare } from 'react-icons/hi';
import { FaFacebookF, FaWhatsapp, FaLinkedinIn, FaLink } from 'react-icons/fa';

const getIcon = (name) => {
  switch (name) {
    case 'Facebook': return <FaFacebookF />;
    case 'WhatsApp': return <FaWhatsapp />;
    case 'LinkedIn': return <FaLinkedinIn />;
    default: return null;
  }
};

export default function BlogContent({ content, shareUrl, shareTitle, socialLinks }) {
  return (
    <div className="lg:col-span-11 bg-white p-10 md:p-24 rounded-[4rem] shadow-[0_100px_200px_-50px_rgba(0,0,0,0.06)] border border-slate-50 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
        <HiOutlineShare className="text-[200px] -rotate-12" />
      </div>
      
      <article className="prose prose-slate prose-xl max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-headings:uppercase prose-headings:text-slate-900 prose-p:leading-relaxed prose-a:text-purple-600 prose-strong:text-slate-950 prose-img:rounded-3xl prose-img:shadow-2xl">
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </article>

      {/* Mobile/Bottom Share Section */}
      <div className="mt-24 pt-16 border-t border-slate-50 space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4 text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
            <HiOutlineShare className="text-2xl text-purple-600" /> Amplify the Insight
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {socialLinks.map((social) => (
              <a 
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 px-6 py-3 ${social.color} text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md`}
              >
                {getIcon(social.name)} {social.name}
              </a>
            ))}
            <button 
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                alert('Link copied to clipboard!');
              }}
              className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-600 transition-all shadow-md"
            >
              <FaLink /> Copy Link
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
