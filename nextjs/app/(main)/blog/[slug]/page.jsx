import React from 'react';
import axios from 'axios';
import { HiOutlineArrowLeft, HiOutlineCalendar, HiOutlineUser, HiOutlineTag, HiOutlineShare } from 'react-icons/hi';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://newsmartagent.com/api';

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
  const post = await getPost(params.slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.title} | NewSmartAgent Blog`,
    description: post.meta_description,
    openGraph: {
      title: post.title,
      description: post.meta_description,
      images: post.thumbnail ? [post.thumbnail] : [],
    },
  };
}

export default async function BlogPostPage({ params }) {
  const post = await getPost(params.slug);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Module Not Found.</h1>
          <Link href="/blog" className="inline-block px-8 py-4 bg-slate-950 text-white rounded-full font-black text-xs uppercase tracking-widest">
            Back to Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-600 selection:bg-indigo-100 selection:text-indigo-600">
      
      {/* Dynamic Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-100/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-100/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-20 relative z-10">
        
        {/* Navigation */}
        <Link href="/blog" className="inline-flex items-center gap-4 text-xs font-black text-slate-400 uppercase tracking-[0.3em] hover:text-purple-600 transition-all mb-16 group">
          <div className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-sm group-hover:-translate-x-2 transition-transform">
            <HiOutlineArrowLeft className="text-lg" />
          </div>
          Return to Hub
        </Link>

        {/* Article Header */}
        <header className="space-y-8 mb-16">
          <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {post.category && (
              <div className="px-4 py-1.5 bg-purple-600 text-white rounded-full">
                {post.category.name}
              </div>
            )}
            <div className="flex items-center gap-2">
              <HiOutlineCalendar className="text-lg" />
              {new Date(post.created_at).toLocaleDateString()}
            </div>
            <div className="hidden sm:block w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
            <div className="flex items-center gap-2">
              <HiOutlineUser className="text-lg" />
              {post.author ? post.author.username : 'Admin'}
            </div>
          </div>

          <h1 className="text-4xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[0.9] italic">
            {post.title}
          </h1>
        </header>

        {/* Featured Image */}
        {post.thumbnail && (
          <div className="relative h-[300px] md:h-[500px] rounded-[3rem] overflow-hidden shadow-2xl mb-20 border-8 border-white">
            <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Main Content Card */}
        <div className="relative group">
          <div className="absolute inset-0 bg-white shadow-[0_64px_128px_-32px_rgba(0,0,0,0.08)] rounded-[3rem] -z-10 group-hover:scale-[1.01] transition-transform duration-700"></div>
          
          <article className="p-8 md:p-20 prose prose-slate prose-lg max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-headings:italic prose-a:text-purple-600 prose-strong:text-slate-900">
            {/* The actual markdown/HTML content */}
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          </article>

          {/* Share Section */}
          <div className="p-8 md:p-12 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-4 text-xs font-black text-slate-400 uppercase tracking-widest">
              <HiOutlineShare className="text-xl text-purple-600" /> Share Insights
            </div>
            <div className="flex gap-4">
              <button className="px-6 py-3 bg-slate-50 hover:bg-purple-600 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                Facebook
              </button>
              <button className="px-6 py-3 bg-slate-50 hover:bg-purple-600 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                Twitter
              </button>
              <button className="px-6 py-3 bg-slate-50 hover:bg-purple-600 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                LinkedIn
              </button>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <footer className="mt-32 pt-20 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-12 group/footer">
          <div className="text-center md:text-left space-y-4">
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter italic">Transform your communication.</h3>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Connect with NewSmartAgent today.</p>
          </div>
          <Link href="/dashboard/connect" className="px-12 py-6 bg-slate-950 text-white rounded-full font-black text-xs uppercase tracking-[0.3em] hover:bg-purple-600 hover:scale-105 transition-all shadow-2xl shadow-purple-900/10 active:scale-95">
            Initialise Bot
          </Link>
        </footer>

      </div>
    </div>
  );
}
