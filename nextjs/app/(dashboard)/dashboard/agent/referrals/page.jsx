"use client";
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { 
    Users, Search, Calendar, ChevronRight, 
    UserCheck, UserMinus, ArrowLeft 
} from 'lucide-react';
import Link from 'next/link';

export default function MyReferrals() {
    const [referrals, setReferrals] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('agent-state/')
            .then(res => {
                // Now using the updated list from your backend
                setReferrals(res.data.recent_users || []);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    // Filter logic for search by name or email
    const filteredUsers = referrals.filter(user => 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-indigo-600 border-solid"></div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 bg-[#f8fafc] min-h-screen">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header Area */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/agent" className="p-2 bg-white rounded-full border shadow-sm hover:bg-gray-50 transition-all">
                            <ArrowLeft size={20} className="text-slate-600" />
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">My Referrals</h1>
                            <p className="text-slate-500 text-sm font-medium">Network Overview: {referrals.length} Users</p>
                        </div>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by name or email..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Main List Container */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    
                    {/* Desktop View (Table) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr className="text-slate-400 text-[10px] uppercase tracking-[0.15em] font-black">
                                    <th className="px-8 py-5">User Profile</th>
                                    <th className="px-8 py-5">Date Joined</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{user.name || 'Anonymous User'}</p>
                                                    <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-slate-600 text-sm font-semibold">
                                                <Calendar size={14} className="text-slate-400" />
                                                {new Date(user.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${user.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                {user.is_active ? <UserCheck size={12}/> : <UserMinus size={12}/>}
                                                {user.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button className="p-2 text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 rounded-lg transition-all">
                                                <ChevronRight size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View (Sleek Cards) */}
                    <div className="md:hidden divide-y divide-slate-50">
                        {filteredUsers.map((user) => (
                            <div key={user.id} className="p-5 flex items-center justify-between active:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-black shadow-inner">
                                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-slate-800 leading-tight">{user.name || 'Anonymous'}</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full animate-pulse ${user.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                {user.is_active ? 'Active' : 'Inactive'} • {new Date(user.joined_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-slate-300" />
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {filteredUsers.length === 0 && (
                        <div className="p-20 text-center">
                            <div className="bg-slate-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                                <Users size={40} />
                            </div>
                            <h3 className="text-slate-800 font-bold text-lg">No Results Found</h3>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto">We couldn't find any referral matching "{searchTerm}". Try a different name or email.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}