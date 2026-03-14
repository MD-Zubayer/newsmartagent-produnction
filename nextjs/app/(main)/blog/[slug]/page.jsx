import React from 'react';
import axios from 'axios';
import { HiOutlineArrowLeft, HiOutlineCalendar, HiOutlineUser, HiOutlineTag, HiOutlineShare, HiOutlineEye } from 'react-icons/hi';
import { FaFacebookF, FaWhatsapp, FaLinkedinIn, FaLink } from 'react-icons/fa';
import Link from 'next/link';

import BlogContent from '../components/BlogContent';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://newsmartagent.com/api';
const DOMAIN = 'https://newsmartagent.com';

async function getPost(slug) {
  try {
    const response = await axios.get(`${API_BASE_URL}/blog/posts/${slug}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching post:', error);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const post = await getPost(resolvedParams.slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.title} | NewSmartAgent Blog`,
    description: post.meta_description,
    openGraph: {
      title: post.title,
      description: post.meta_description,
      images: post.thumbnail ? [post.thumbnail] : [],
      type: 'article',
      url: `${DOMAIN}/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const resolvedParams = await params;
  const post = await getPost(resolvedParams.slug);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Module Not Found.</h1>
          <Link href="/blog" className="inline-block px-8 py-4 bg-slate-950 text-white rounded-full font-black text-xs uppercase tracking-widest hover:bg-purple-600 transition-colors">
            Back to Hub
          </Link>
        </div>
      </div>
    );
  }

  const shareUrl = `${DOMAIN}/blog/${post.slug}`;
  const shareTitle = encodeURIComponent(post.title);

  const socialLinks = [
    { name: 'Facebook', icon: <FaFacebookF />, url: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, color: 'bg-[#1877F2]' },
    { name: 'WhatsApp', icon: <FaWhatsapp />, url: `https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}`, color: 'bg-[#25D366]' },
    { name: 'LinkedIn', icon: <FaLinkedinIn />, url: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`, color: 'bg-[#0A66C2]' },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-700 selection:bg-purple-100 selection:text-purple-600">
      
      {/* Premium Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-100/40 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/30 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
      </div>

      <div className="max-w-[1000px] mx-auto px-6 py-20 relative z-10">
        
        {/* Breadcrumb Navigation */}
        <Link href="/blog" className="inline-flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] hover:text-purple-600 transition-all mb-16 group">
          <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-hover:-translate-x-2 transition-transform duration-500 bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-60">
            <HiOutlineArrowLeft className="text-xl" />
          </div>
          Return to Intelligence Hub
        </Link>

        {/* Article Header */}
        <header className="space-y-10 mb-20 text-center md:text-left">
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            {post.category && (
              <div className="px-6 py-2 bg-slate-900 text-white rounded-full shadow-xl shadow-slate-900/10">
                {post.category.name}
              </div>
            )}
            <div className="flex items-center gap-2">
              <HiOutlineCalendar className="text-lg text-purple-600" />
              {new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="hidden sm:block w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
            <div className="flex items-center gap-2">
              <HiOutlineEye className="text-lg text-purple-600" />
              {post.views_count || 0} Readers
            </div>
          </div>

          <h1 className="text-5xl md:text-8xl font-black text-slate-950 tracking-tighter leading-[0.85] uppercase">
            {post.title}
          </h1>
          
          <div className="flex items-center justify-center md:justify-start gap-4">
             <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg">
                {post.author ? post.author.username[0].toUpperCase() : 'A'}
             </div>
             <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authored by</p>
                <p className="font-bold text-slate-900">{post.author ? (post.author.first_name + ' ' + (post.author.last_name || '')) : 'NewSmartAgent Team'}</p>
             </div>
          </div>
        </header>

        {/* Featured Image */}
        {post.thumbnail && (
          <div className="relative h-[400px] md:h-[650px] rounded-[4rem] overflow-hidden shadow-[0_80px_160px_-40px_rgba(0,0,0,0.15)] mb-28 border-[12px] border-white bg-white">
            <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover scale-105 hover:scale-100 transition-transform duration-1000" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          </div>
        )}

        {/* Global Article Wrapper */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 relative">
          
          {/* Social Sticky Sidebar */}
          <aside className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-32 flex flex-col gap-4">
              {socialLinks.map((social) => (
                <a 
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-12 h-12 ${social.color} text-white rounded-2xl flex items-center justify-center text-lg hover:scale-110 hover:-translate-y-1 transition-all duration-300 shadow-lg`}
                  title={`Share on ${social.name}`}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </aside>

          {/* Main Content Body (Now a Client Component) */}
          <BlogContent 
            content={post.content} 
            shareUrl={shareUrl} 
            shareTitle={shareTitle} 
            socialLinks={socialLinks} 
          />
        </div>

        {/* Author Bio/Footer Action */}
        <section className="mt-40 p-12 md:p-20 bg-slate-950 rounded-[4rem] text-white flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          <div className="text-center md:text-left space-y-6 relative z-10">
            <h3 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none">Ready to automate your future?</h3>
            <p className="text-slate-400 text-sm md:text-base font-medium max-w-[500px]">Join 500+ businesses using NewSmartAgent to orchestrate their growth with AI accuracy.</p>
          </div>
          <Link href="/dashboard/connect" className="relative z-10 px-14 py-7 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.4em] hover:bg-purple-600 hover:text-white hover:scale-105 transition-all duration-500 shadow-2xl active:scale-95 shadow-white/10">
            Initialise Now
          </Link>
        </section>

      </div>
    </div>
  );
}
