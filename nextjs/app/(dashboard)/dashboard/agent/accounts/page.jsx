"use client";

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
    Wallet, DollarSign, TrendingUp, TrendingDown,
    Plus, Trash2, CheckCircle2, Clock, XCircle, CreditCard, MoveRight, Banknote, Layers
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AgentFinancialDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Data States
    const [summary, setSummary] = useState({
        commission_balance: "0.00",
        commission_success: "0.00",
        commission_pending: "0.00",
        commission_failed: "0.00",
        account_balance: "0.00",
        account_success: "0.00",
        account_pending: "0.00",
        account_failed: "0.00"
    });
    const [methods, setMethods] = useState([]);
    const [history, setHistory] = useState([]);

    // UI States
    const [showAddMethod, setShowAddMethod] = useState(false);
    const [showCashout, setShowCashout] = useState(false);
    const [activeTab, setActiveTab] = useState('commission'); // 'commission' or 'account'
    
    // Form States
    const [newMethod, setNewMethod] = useState({
        method: 'bkash', account_number: '', account_name: '', bank_name: '', branch_name: '', routing_number: ''
    });
    const [cashoutForm, setCashoutForm] = useState({
        withdraw_method: '', amount: '', balance_type: 'commission'
    });

    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [summaryRes, methodsRes, historyRes] = await Promise.all([
                api.get('financial-summary/'),
                api.get('withdraw-methods/'),
                api.get('cashout-requests/')
            ]);
            setSummary(summaryRes.data);
            setMethods(methodsRes.data);
            setHistory(historyRes.data);
        } catch (error) {
            console.error("Dashboard Error:", error);
            toast.error("Failed to load financial data");
        } finally {
            setLoading(false);
        }
    };

    const handleAddMethod = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            await api.post('withdraw-methods/', newMethod);
            toast.success("Withdraw method added successfully!");
            setShowAddMethod(false);
            setNewMethod({ method: 'bkash', account_number: '', account_name: '', bank_name: '', branch_name: '', routing_number: '' });
            fetchDashboardData();
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to add method");
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteMethod = async (id) => {
        if (!window.confirm("Are you sure you want to delete this payment method?")) return;
        try {
            await api.delete(`withdraw-methods/${id}/`);
            toast.success("Method removed");
            fetchDashboardData();
        } catch (error) {
            toast.error("Failed to remove method");
        }
    };

    const handleCashoutRequest = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            await api.post('cashout-requests/', cashoutForm);
            toast.success("Cashout request submitted!");
            setShowCashout(false);
            setCashoutForm({ withdraw_method: '', amount: '', balance_type: 'commission' });
            fetchDashboardData();
        } catch (error) {
            const errorMsg = error.response?.data?.non_field_errors?.[0] || error.response?.data?.amount?.[0] || "Failed to submit request";
            toast.error(errorMsg);
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 text-sm font-medium animate-pulse">Loading Financial Data...</p>
            </div>
        </div>
    );

    const currentBalanceMax = activeTab === 'commission' ? summary.commission_balance : summary.account_balance;

    return (
        <div className="p-4 md:p-8 lg:p-12 bg-[#f8fafc] min-h-screen font-sans text-slate-900">
            <div className="max-w-7xl mx-auto space-y-10">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">Financial Hub</h1>
                        <p className="text-slate-500 text-sm mt-1 font-medium">Manage your earnings, cashouts, and payment methods</p>
                    </div>
                    <button 
                        onClick={() => {
                            setCashoutForm(prev => ({ ...prev, balance_type: activeTab }));
                            setShowCashout(true);
                        }}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all font-bold text-sm shadow-md"
                    >
                        <Banknote size={18} />
                        Request Cashout
                    </button>
                </div>

                {/* Balance Tabs Toggle */}
                <div className="bg-white p-1.5 inline-flex rounded-2xl shadow-sm border border-slate-100">
                    <button
                        onClick={() => setActiveTab('commission')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                            activeTab === 'commission' 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                    >
                        <Layers size={16} /> Commission Balance
                    </button>
                    <button
                        onClick={() => setActiveTab('account')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                            activeTab === 'account' 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                    >
                        <Wallet size={16} /> Account Balance
                    </button>
                </div>

                {/* Balance Cards Group */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <BalanceCard 
                        title="Available Balance" 
                        amount={activeTab === 'commission' ? summary.commission_balance : summary.account_balance} 
                        icon={<Wallet size={24} />} 
                        color="indigo" 
                        key={`avail-${activeTab}`}
                    />
                    <BalanceCard 
                        title="Success Cashout" 
                        amount={activeTab === 'commission' ? summary.commission_success : summary.account_success} 
                        icon={<TrendingUp size={24} />} 
                        color="emerald" 
                        key={`succ-${activeTab}`}
                    />
                    <BalanceCard 
                        title="Pending Cashout" 
                        amount={activeTab === 'commission' ? summary.commission_pending : summary.account_pending} 
                        icon={<Clock size={24} />} 
                        color="amber" 
                        key={`pend-${activeTab}`}
                    />
                    <BalanceCard 
                        title="Failed Cashout" 
                        amount={activeTab === 'commission' ? summary.commission_failed : summary.account_failed} 
                        icon={<TrendingDown size={24} />} 
                        color="rose" 
                        key={`fail-${activeTab}`}
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Management */}
                    <div className="lg:col-span-1 space-y-8">
                        
                        {/* Withdraw Methods */}
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <CreditCard size={18} className="text-indigo-500"/> Saved Methods
                                </h2>
                                <button 
                                    onClick={() => setShowAddMethod(!showAddMethod)}
                                    className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                                    title="Add New Method"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            {/* Add Method Form / Existing Methods List */}
                            {showAddMethod ? (
                                <form onSubmit={handleAddMethod} className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Provider</label>
                                        <select 
                                            value={newMethod.method}
                                            onChange={e => setNewMethod({...newMethod, method: e.target.value})}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        >
                                            <option value="bkash">bKash</option>
                                            <option value="nagad">Nagad</option>
                                            <option value="rocket">Rocket</option>
                                            <option value="bank">Bank Transfer</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Account Number</label>
                                        <input 
                                            required
                                            type="text"
                                            value={newMethod.account_number}
                                            onChange={e => setNewMethod({...newMethod, account_number: e.target.value})}
                                            placeholder="e.g. 017xxxxxxxx"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        />
                                    </div>

                                    {newMethod.method === 'bank' && (
                                        <>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Account Name</label>
                                                <input 
                                                    required
                                                    type="text"
                                                    value={newMethod.account_name}
                                                    onChange={e => setNewMethod({...newMethod, account_name: e.target.value})}
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Bank Name</label>
                                                <input 
                                                    required
                                                    type="text"
                                                    value={newMethod.bank_name}
                                                    onChange={e => setNewMethod({...newMethod, bank_name: e.target.value})}
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Branch Name</label>
                                                <input 
                                                    type="text"
                                                    value={newMethod.branch_name}
                                                    onChange={e => setNewMethod({...newMethod, branch_name: e.target.value})}
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Routing Number</label>
                                                <input 
                                                    type="text"
                                                    value={newMethod.routing_number}
                                                    onChange={e => setNewMethod({...newMethod, routing_number: e.target.value})}
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="flex gap-2 pt-2">
                                        <button type="submit" disabled={processing} className="flex-1 bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold shadow-md hover:bg-indigo-700 transition">Save Method</button>
                                        <button type="button" onClick={() => setShowAddMethod(false)} className="px-4 bg-slate-100 text-slate-600 rounded-xl py-3 text-sm font-bold hover:bg-slate-200 transition">Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-3">
                                    {methods.length === 0 ? (
                                        <div className="text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                            <p className="text-sm text-slate-400 font-medium">No withdrawal methods found.</p>
                                        </div>
                                    ) : (
                                        methods.map((m) => (
                                            <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors group">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                                        {m.method}
                                                        {m.is_default && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[9px]">DEFAULT</span>}
                                                    </p>
                                                    <p className="text-sm font-mono text-slate-500 mt-1">{m.account_number}</p>
                                                    {m.method === 'bank' && <p className="text-[10px] text-slate-400 mt-0.5">{m.bank_name}</p>}
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteMethod(m.id)}
                                                    className="text-slate-300 hover:text-rose-500 p-2 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-rose-50"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: History */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-3xl pb-2 shadow-sm border border-slate-100 relative overflow-hidden h-full">
                            <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-50">
                                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <MoveRight size={18} className="text-indigo-500"/> Cashout History
                                </h2>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[600px]">
                                    <thead>
                                        <tr className="text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-50 bg-slate-50/50">
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Method & Type</th>
                                            <th className="px-6 py-4 text-right">Amount (BDT)</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {history.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-20 text-center text-slate-400 text-sm font-medium">
                                                    No transactions found matching your criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            history.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="text-xs font-bold text-slate-700">{new Date(item.requested_at).toLocaleDateString()}</p>
                                                        <p className="text-[10px] text-slate-400">{new Date(item.requested_at).toLocaleTimeString()}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {item.withdraw_method_details ? (
                                                            <>
                                                                <p className="text-xs font-bold text-slate-700 uppercase">{item.withdraw_method_details.method}</p>
                                                                <p className="text-[10px] font-mono text-slate-500">{item.withdraw_method_details.account_number}</p>
                                                            </>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 italic">Method Removed</p>
                                                        )}
                                                        <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] uppercase font-bold tracking-wider">
                                                            {item.balance_type} Balance
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <p className="text-sm font-mono font-black text-slate-900">{parseFloat(item.amount).toFixed(2)}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <StatusBadge status={item.status} />
                                                        {item.admin_note && <p className="text-[10px] text-rose-500 mt-1 max-w-[150px] mx-auto truncate" title={item.admin_note}>Note: {item.admin_note}</p>}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cashout Modal */}
                {showCashout && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-black text-slate-900 uppercase">Request Cashout</h3>
                                <button onClick={() => setShowCashout(false)} className="text-slate-400 hover:text-slate-700 p-1 bg-slate-100 rounded-lg">
                                    <XCircle size={24} />
                                </button>
                            </div>
                            
                            <form onSubmit={handleCashoutRequest} className="space-y-6">
                                
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Balance Source</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => setCashoutForm({...cashoutForm, balance_type: 'commission'})}
                                            className={`p-3 rounded-2xl border text-sm font-bold flex flex-col items-center gap-1 transition-all ${
                                                cashoutForm.balance_type === 'commission'
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Layers size={18} />
                                            Commission
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setCashoutForm({...cashoutForm, balance_type: 'account'})}
                                            className={`p-3 rounded-2xl border text-sm font-bold flex flex-col items-center gap-1 transition-all ${
                                                cashoutForm.balance_type === 'account'
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Wallet size={18} />
                                            Account
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Method</label>
                                    <select 
                                        required
                                        value={cashoutForm.withdraw_method}
                                        onChange={e => setCashoutForm({...cashoutForm, withdraw_method: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                                    >
                                        <option value="" disabled>Choose a destination...</option>
                                        {methods.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.method.toUpperCase()} - {m.account_number}
                                            </option>
                                        ))}
                                    </select>
                                    {methods.length === 0 && (
                                        <p className="text-[10px] text-rose-500 font-medium">Please add a withdrawal method first.</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                                        <span>Amount (BDT)</span>
                                        <span className="text-indigo-600">
                                            Max: ৳{parseFloat(cashoutForm.balance_type === 'commission' ? summary.commission_balance : summary.account_balance).toFixed(2)}
                                        </span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                            <span className="text-slate-400 font-bold text-xl leading-none">৳</span>
                                        </div>
                                        <input 
                                            required
                                            type="number"
                                            min="500"
                                            step="0.01"
                                            max={cashoutForm.balance_type === 'commission' ? summary.commission_balance : summary.account_balance}
                                            value={cashoutForm.amount}
                                            onChange={e => setCashoutForm({...cashoutForm, amount: e.target.value})}
                                            className="w-full pl-10 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium">Minimum withdrawal limit: 500 BDT</p>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={processing || methods.length === 0} 
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-900/10 hover:bg-slate-800 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {processing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <DollarSign size={18} />}
                                    {processing ? 'Processing...' : 'Confirm Cashout'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-components
const BalanceCard = ({ title, amount, icon, color }) => {
    const colorStyles = {
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100"
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
            <div className={`absolute -right-6 -top-6 p-8 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700 ${colorStyles[color].split(' ')[0]}`}>
                {icon}
            </div>
            <div className="relative z-10">
                <div className={`inline-flex p-3 rounded-2xl mb-6 ${colorStyles[color]} shadow-sm`}>
                    {icon}
                </div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{title}</h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-300">৳</span>
                    <span className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter font-mono">
                        {parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const statusMap = {
        pending: { icon: <Clock size={12} />, bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
        approved: { icon: <CheckCircle2 size={12} />, bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
        rejected: { icon: <XCircle size={12} />, bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
    };
    
    const config = statusMap[status.toLowerCase()] || statusMap.pending;

    return (
        <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.bg} ${config.text} ${config.border} mx-auto w-fit`}>
            {config.icon}
            {status}
        </span>
    );
};
