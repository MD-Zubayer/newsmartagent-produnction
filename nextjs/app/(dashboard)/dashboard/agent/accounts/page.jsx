

"use client";
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
    Key, ShieldCheck, ShieldAlert, RefreshCw, 
    Fingerprint, Save, CheckCircle2, XCircle, Copy, Check, Link as LinkIcon
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function OTPSettings() {
    const { user } = useAuth();
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const [copied, setCopied] = useState(false); // Copy status state
    const [linkCopied, setLinkCopied] = useState(false); // Link copy status

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await api.get('man-agent-config/');
            if (res.data.length > 0) {
                setConfig(res.data[0]);
            } else {
                setConfig({ otp_key: '', is_active: false });
            }
        } catch (err) {
            console.error("Error fetching config:", err);
            toast.error("Failed to load security settings");
        } finally {
            setLoading(false);
        }
    };

    const generateKey = () => {
        setIsSpinning(true);
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = 'KEY-';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        setTimeout(() => {
        // নতুন কী সেট করা
        setConfig({ ...config, otp_key: result });
        setIsSpinning(false);
        
        // কাস্টম টোস্ট (আইকনসহ)
        toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5">
                            <Fingerprint className="h-10 w-10 text-indigo-600 bg-indigo-50 p-2 rounded-xl" />
                        </div>
                        <div className="ml-3 flex-1">
                            <p className="text-sm font-bold text-gray-900">New Key Ready!</p>
                            <p className="mt-1 text-sm text-gray-500">
                                আপনার নতুন সিকিউর কি এখন ব্যবহারের জন্য তৈরি। এটি সেভ করতে ভুলবেন না।
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex border-l border-gray-200">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                        ঠিক আছে
                    </button>
                </div>
            </div>
        ));
    }, 600);
};

    // --- Fixed Copy Function ---
    const handleCopy = () => {
        if (!config?.otp_key) return;
        
        navigator.clipboard.writeText(config.otp_key)
            .then(() => {
                setCopied(true);
                toast.success("Key copied to clipboard!");
                setTimeout(() => setCopied(false), 2000); // Revert icon after 2s
            })
            .catch((err) => {
                console.error('Failed to copy: ', err);
                toast.error("Failed to copy key");
            });
    };

    // ✅ নতুন ফাংশন: ইনভাইট লিঙ্ক জেনারেট এবং কপি
    const generateAndCopyLink = () => {
        if (!config?.otp_key || !user?.profile?.unique_id) {
            toast.error("Save your OTP key first!");
            return;
        }
        
        // আপনার সাইনআপ ইউআরএল (প্রোডাকশনে ডোমেইন পাল্টে নিবেন)
        const baseUrl = window.location.origin; 
        const inviteLink = `${baseUrl}/auth?ref=${config.otp_key}&uid=${user.profile.unique_id}`;
        
        navigator.clipboard.writeText(inviteLink)
            .then(() => {
                setLinkCopied(true);
                toast.success("Referral link copied!");
                setTimeout(() => setLinkCopied(false), 2000);
            })
            .catch(() => toast.error("Failed to copy link"));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (config?.id) {
                await api.put(`man-agent-config/${config.id}/`, config);
                toast.success("Settings updated successfully");
            } else {
                const res = await api.post('man-agent-config/', config);
                setConfig(res.data);
                toast.success("Configuration created");
            }
        } catch (err) {
            toast.error("Update failed. Check connection.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 text-sm font-medium animate-pulse">Loading Security...</p>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 lg:p-12 bg-[#f8fafc] min-h-screen font-sans text-slate-900">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Security Ops</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage agent credentials & access</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm w-fit">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">System Online</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                    
                    {/* Unique Identifier Card (Mobile Responsive) */}
                    <div className="lg:col-span-4 w-full">
                        <div className="bg-slate-900 p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-full min-h-[280px]">
                            {/* Background Decoration */}
                            <div className="absolute -right-10 -top-10 opacity-10 rotate-12 pointer-events-none">
                                <Fingerprint size={180} className="text-white" />
                            </div>
                            
                            <div>
                                <div className="h-12 w-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-6 backdrop-blur-sm">
                                    <Fingerprint size={24} className="text-indigo-400" />
                                </div>
                                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-2">Agent Identity</p>
                                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-all">
                                    {user?.profile?.unique_id || 'ID_PENDING'}
                                </h2>
                            </div>
                            
                            <div className="mt-8 pt-6 border-t border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${config?.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    <span className="text-xs font-medium text-slate-400">
                                        Encryption: <span className={config?.is_active ? 'text-emerald-400' : 'text-rose-400'}>{config?.is_active ? 'Active' : 'Inactive'}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Configuration Card */}
                    <div className="lg:col-span-8 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
                        
                        {/* OTP Key Input Section */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Key size={14} /> Secret OTP Key
                            </label>
                            
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="relative flex-1 group">
                                    <input 
                                        type="text" 
                                        readOnly
                                        value={config?.otp_key || ''} 
                                        className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-mono font-bold text-lg text-slate-700"
                                        placeholder="Generate a key..."
                                    />
                                    {/* Copy Button - Fixed Z-Index & Type */}
                                    <button 
                                        type="button"
                                        onClick={handleCopy}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all z-10"
                                        title="Copy to clipboard"
                                    >
                                        {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                                    </button>
                                </div>
                                
                                <button 
                                    type="button"
                                    onClick={generateKey}
                                    className="py-4 px-6 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 font-bold text-sm shadow-lg shadow-slate-200"
                                >
                                    <RefreshCw size={18} className={isSpinning ? 'animate-spin' : ''} />
                                    <span className="md:hidden lg:inline">Generate</span>
                                </button>
                            </div>
                        </div>

                        {/* ✅ নতুন লিঙ্ক জেনারেটর কার্ড (Referral Link) */}
                        <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm">
                                    <LinkIcon size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Quick Invite Link</h3>
                                    <p className="text-[11px] text-slate-500">Auto-fills your ID and Key for users</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={generateAndCopyLink}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                            >
                                {linkCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                                {linkCopied ? 'Copied Link!' : 'Copy Invite Link'}
                            </button>
                        </div>

                        {/* Status Toggle Switch */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 md:p-5 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl transition-colors ${config?.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                                    {config?.is_active ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Validation Status</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Allow system access via key</p>
                                </div>
                            </div>
                            
                            <button 
                                type="button"
                                onClick={() => setConfig({...config, is_active: !config?.is_active})}
                                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${config?.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <div className={`bg-white w-6 h-6 rounded-full shadow-md transition-transform duration-300 transform ${config?.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <button 
                            disabled={saving}
                            onClick={handleSave}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {saving ? <RefreshCw className="animate-spin h-4 w-4" /> : <Save size={18} />}
                            {saving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>

                {/* Logs Table (Responsive Scroll) */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-4 md:px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                        <h2 className="font-bold text-slate-700 text-xs  uppercase tracking-wider">Current Configuration Log</h2>
                    </div>
                    
                    {/* Scrollable Container for Mobile */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[500px]">
                            <thead>
                                <tr className="text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-50">
                                    <th className="px-6 py-4">Active Key</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Last Updated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit text-sm">
                                            {config?.otp_key || '---'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${config?.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                            {config?.is_active ? <CheckCircle2 size={10}/> : <XCircle size={10}/>}
                                            {config?.is_active ? 'ACTIVE' : 'DISABLED'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-xs font-medium text-slate-500">
                                        {config?.updated_at || config?.created_at 
                                            ? new Date(config.updated_at || config.created_at).toLocaleDateString('en-GB') 
                                            : 'Not synced'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}