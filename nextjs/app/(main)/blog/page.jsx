"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { HiOutlineArrowRight, HiOutlineCalendar, HiOutlineUser, HiOutlineTag, HiOutlineSearch, HiOutlineEye } from 'react-icons/hi';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

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
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-700 selection:bg-purple-100 selection:text-purple-600">
      
      {/* Dynamic Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-100/30 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/20 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02]"></div>
      </div>

      <div className="max-w-[1300px] mx-auto px-6 py-24 relative z-10">
        
        {/* Header Section */}
        <header className="text-center mb-24 md:mb-40 space-y-10">
          <div className="inline-flex items-center gap-2 px-6 py-2 bg-white border border-slate-100 rounded-full shadow-sm text-[10px] font-black text-purple-600 uppercase tracking-[0.4em] mx-auto bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-60">
            Protocols & Insights
          </div>
          <h1 className="text-6xl md:text-9xl font-black text-slate-950 tracking-tighter leading-[0.85] uppercase">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">Intelligence</span> <br/> Hub
          </h1>
          <p className="max-w-2xl mx-auto text-slate-500 font-medium text-base md:text-lg leading-relaxed opacity-70">
            Strategic briefings on AI automation, business workflow orchestration, and the future of intelligent systems.
          </p>

          {/* Search Bar - Premium Design */}
          <div className="max-w-2xl mx-auto relative group mt-16">
            <div className="absolute inset-0 bg-purple-500/10 rounded-3xl blur-2xl group-hover:bg-purple-500/15 transition-all duration-700"></div>
            <div className="relative bg-white border border-slate-100 rounded-[2rem] p-2 shadow-xl shadow-slate-200/50 flex items-center gap-6 group-focus-within:border-purple-400 group-focus-within:ring-8 group-focus-within:ring-purple-50/50 transition-all duration-500">
              <div className="pl-6 text-slate-400 text-2xl">
                <HiOutlineSearch />
              </div>
              <input 
                type="text" 
                placeholder="Search intelligence cache..." 
                className="w-full py-5 bg-transparent outline-none text-slate-900 font-bold text-lg placeholder:text-slate-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Blog Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-8">
            <div className="relative">
               <div className="w-20 h-20 border-2 border-slate-100 rounded-full"></div>
               <div className="absolute inset-0 w-20 h-20 border-t-2 border-purple-600 rounded-full animate-spin"></div>
            </div>
            <p className="font-black text-[10px] uppercase tracking-[0.5em] text-slate-400 animate-pulse">Decrypting Content...</p>
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-16">
            {filteredPosts.map((post) => (
              <Link href={`/blog/${post.slug}`} key={post.id} className="group flex">
                <article className="relative w-full bg-white rounded-[3.5rem] border border-slate-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_60px_120px_-30px_rgba(139,92,246,0.15)] transition-all duration-700 hover:-translate-y-4 overflow-hidden flex flex-col group/card">
                  
                  {/* Image Container with Parallax Effect */}
                  <div className="relative h-72 overflow-hidden bg-slate-950">
                    {post.thumbnail ? (
                      <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover opacity-90 group-hover:scale-110 group-hover:opacity-100 transition-all duration-1000 ease-out" />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-indigo-600/20"></div>
                        <HiOutlineTag className="text-7xl text-white/10 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-700" />
                      </div>
                    )}
                    
                    {/* Floating Category Badge */}
                    {post.category && (
                      <div className="absolute top-8 left-8 px-5 py-2 bg-white/90 backdrop-blur-xl shadow-2xl rounded-2xl text-[10px] font-black text-slate-950 uppercase tracking-widest z-10 border border-white">
                        {post.category.name}
                      </div>
                    )}

                    {/* Overlay Details */}
                    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/60 to-transparent translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                        <div className="flex items-center gap-4 text-white text-[10px] font-black uppercase tracking-widest">
                           <div className="flex items-center gap-1.5"><HiOutlineCalendar /> {new Date(post.created_at).getFullYear()}</div>
                           <div className="flex items-center gap-1.5"><HiOutlineEye /> {post.views_count || 0}</div>
                        </div>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-10 md:p-12 flex flex-col flex-grow relative">
                    <div className="flex items-center justify-between mb-8">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-[10px] font-black">
                             {post.author && post.author.username ? post.author.username[0].toUpperCase() : 'A'}
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                             {post.author && post.author.username ? post.author.username : 'Systems'}
                          </p>
                       </div>
                       <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                          <HiOutlineEye className="text-sm" /> {post.views_count || 0}
                       </div>
                    </div>
                    
                    <h2 className="text-3xl font-black text-slate-950 tracking-tight leading-[1.1] mb-6 group-hover:text-purple-600 transition-colors duration-500 uppercase">
                      {post.title}
                    </h2>
                    
                    <div className="mt-auto pt-10 flex items-center gap-3 text-[10px] font-black text-purple-600 uppercase tracking-[0.3em] group-hover:gap-6 bg-transparent border-none p-0 transition-all duration-500 ease-in-out">
                      Access Briefing <HiOutlineArrowRight className="text-xl group-hover:translate-x-2 transition-transform duration-500" />
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-[4rem] border border-slate-100 shadow-2xl space-y-10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-50/50 to-transparent opacity-50"></div>
            <div className="relative z-10 space-y-6">
              <h3 className="text-4xl font-black text-slate-950 uppercase tracking-tighter">Cipher Not Found.</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em]">Initialising fresh intelligence streams shortly...</p>
              <button onClick={() => setSearchTerm('')} className="px-12 py-5 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-purple-600 transition-all transform hover:scale-105 active:scale-95 shadow-2xl shadow-purple-900/20">
                Reset Cache
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Futuristic Footer Decoration */}
      <footer className="py-24 text-center relative pointer-events-none">
        <div className="w-px h-24 bg-gradient-to-b from-transparent via-slate-200 to-transparent mx-auto mb-10"></div>
        <p className="text-[11px] font-black text-slate-300 uppercase tracking-[1em] opacity-40">
          Neural Knowledge Sync • NewSmartAgent Protocol
        </p>
      </footer>
    </div>
  );
}
