"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { HiOutlineArrowRight, HiOutlineCalendar, HiOutlineUser, HiOutlineTag, HiOutlineSearch } from 'react-icons/hi';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://newsmartagent.com/api';

export default function BlogIndex() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/blog/posts/`);
        setPosts(response.data);
      } catch (error) {
        console.error('Error fetching blog posts:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (post.category && post.category.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-600 selection:bg-indigo-100 selection:text-indigo-600">
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-100/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-100/20 rounded-full blur-[100px] animate-delay-2000"></div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-20 relative z-10">
        
        {/* Header Section */}
        <header className="text-center mb-20 md:mb-32 space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-100 rounded-full shadow-sm text-[10px] font-black text-purple-600 uppercase tracking-[0.3em] mx-auto">
            Our Insights & Updates
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter italic leading-none">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 text-shadow-sm">Intelligence</span> <br/> Hub
          </h1>
          <p className="max-w-2xl mx-auto text-slate-500 font-medium text-sm md:text-base leading-relaxed opacity-80">
            Explore the latest in AI automation, Meta integrations, and business workflow orchestration. 
            Stay ahead with NewSmartAgent.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative group mt-12">
            <div className="absolute inset-0 bg-purple-500/5 rounded-2xl blur-xl group-hover:bg-purple-500/10 transition-all duration-500"></div>
            <div className="relative bg-white border border-slate-100 rounded-2xl p-1 shadow-sm flex items-center gap-4 group-focus-within:border-purple-400 group-focus-within:ring-4 group-focus-within:ring-purple-100 transition-all duration-300">
              <div className="pl-4 text-slate-400 text-xl">
                <HiOutlineSearch />
              </div>
              <input 
                type="text" 
                placeholder="Search articles, categories..." 
                className="w-full py-3 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Blog Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="font-black text-[10px] uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Library...</p>
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
            {filteredPosts.map((post) => (
              <Link href={`/blog/${post.slug}`} key={post.id} className="group">
                <article className="h-full bg-white rounded-[2.5rem] border border-slate-50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.04)] hover:shadow-[0_48px_96px_-24px_rgba(139,92,246,0.12)] transition-all duration-700 hover:-translate-y-3 overflow-hidden flex flex-col">
                  
                  {/* Image Container */}
                  <div className="relative h-64 overflow-hidden">
                    {post.thumbnail ? (
                      <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                    ) : (
                      <div className="w-full h-full bg-slate-50 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-indigo-500/5"></div>
                        <HiOutlineTag className="text-6xl text-slate-200 group-hover:rotate-12 transition-transform duration-500" />
                      </div>
                    )}
                    {post.category && (
                      <div className="absolute top-6 left-6 px-4 py-1.5 bg-white shadow-xl rounded-full text-[10px] font-black text-purple-600 uppercase tracking-widest z-10">
                        {post.category.name}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-8 md:p-10 flex flex-col flex-grow">
                    <div className="flex items-center gap-6 mb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <div className="flex items-center gap-2">
                          <HiOutlineCalendar className="text-lg text-slate-300" />
                          {new Date(post.created_at).toLocaleDateString()}
                       </div>
                       <div className="hidden sm:block w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
                       <div className="flex items-center gap-2">
                          <HiOutlineUser className="text-lg text-slate-300" />
                          {post.author ? post.author.username : 'Admin'}
                       </div>
                    </div>
                    
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-4 group-hover:text-purple-600 transition-colors">
                      {post.title}
                    </h2>
                    
                    <div className="mt-auto pt-8 flex items-center gap-2 text-xs font-black text-purple-600 uppercase tracking-[0.2em] group-hover:gap-4 transition-all duration-500">
                      Read Protocol <HiOutlineArrowRight className="text-lg" />
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-[3rem] border border-slate-50 shadow-sm space-y-6">
            <h3 className="text-2xl font-black text-slate-900 italic">No modules found.</h3>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Initialising new content shortly...</p>
            <button onClick={() => setSearchTerm('')} className="px-8 py-4 bg-slate-950 text-white rounded-full font-black text-xs uppercase tracking-widest hover:bg-purple-600 transition-all active:scale-95 shadow-xl shadow-purple-900/10">
              Clear Filter
            </button>
          </div>
        )}

      </div>

      {/* Footer Decoration */}
      <div className="py-20 text-center opacity-30 select-none">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.8em]">
          Knowledge Base • NewSmartAgent Systems
        </p>
      </div>
    </div>
  );
}
