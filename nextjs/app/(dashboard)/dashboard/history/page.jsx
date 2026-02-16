"use client";
import { useState } from "react";
import { 
  ClockIcon, 
  CreditCardIcon, 
  CpuChipIcon, 
  ExclamationTriangleIcon 
} from "@heroicons/react/24/outline";

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState("payment");

  // ডামি ডাটা (এগুলো পরে আপনার এপিআই থেকে আসবে)
  const paymentHistory = [
    { id: "TXN1024", date: "Jan 15, 2026", amount: 1500, status: "Success" },
    { id: "TXN1025", date: "Dec 12, 2025", amount: 500, status: "Failed" },
  ];

  const usageHistory = [
    { id: "USE452", date: "Feb 10, 2026", tokens: 250, task: "Image Generation" },
    { id: "USE453", date: "Feb 09, 2026", tokens: 50, task: "Text Completion" },
  ];

  const errorLogs = [
    { id: "ERR-01", date: "Feb 08, 2026", msg: "Invalid API Key", severity: "High" },
  ];

  return (
    <div className="py-6 px-2 md:p-10 bg-[#fbfcfd] min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <div className="p-2 md:p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-100">
          <ClockIcon className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 italic uppercase">History Log</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Track your activity & billing</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="md:flex flex-col gap-2 p-1.5 bg-slate-100 rounded-[2rem] mb-8 w-fit border border-slate-200 ">
        <TabButton 
          active={activeTab === "payment"} 
          onClick={() => setActiveTab("payment")}
          icon={<CreditCardIcon className="h-4 w-4" />}
          label="Payments"
          
        />
        <TabButton 
          active={activeTab === "usage"} 
          onClick={() => setActiveTab("usage")}
          icon={<CpuChipIcon className="h-4 w-4" />}
          label="Token Usage"
        />
        <TabButton 
          active={activeTab === "error"} 
          onClick={() => setActiveTab("error")}
          icon={<ExclamationTriangleIcon className="h-4 w-4" />}
          label="Errors"
        />
      </div>

      {/* Content Area */}
      <div className="grid gap-4 max-w-4xl">
        
        {/* --- Payment History --- */}
        {activeTab === "payment" && paymentHistory.map((txn) => (
          <div key={txn.id} className="flex justify-between items-center bg-white p-5 ounded-[2rem] border border-white shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${txn.status === 'Success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                <CreditCardIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-black text-slate-800 italic uppercase">{txn.id}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{txn.date}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-xl text-slate-900 italic">৳{txn.amount}</p>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${txn.status === 'Success' ? 'border-emerald-100 text-emerald-500 bg-emerald-50' : 'border-red-100 text-red-500 bg-red-50'}`}>
                {txn.status}
              </span>
            </div>
          </div>
        ))}

        {/* --- Token Usage History --- */}
        {activeTab === "usage" && usageHistory.map((log) => (
          <div key={log.id} className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-white shadow-sm hover:border-blue-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <CpuChipIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-black text-slate-800 italic uppercase">{log.task}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{log.date} • ID: {log.id}</p>
              </div>
            </div>
            <div className="text-right font-black text-slate-900 italic">
              <span className="text-blue-600">-{log.tokens}</span> Tokens
            </div>
          </div>
        ))}

        {/* --- Error Logs --- */}
        {activeTab === "error" && errorLogs.map((err) => (
          <div key={err.id} className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-red-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                <ExclamationTriangleIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-red-800 uppercase text-xs tracking-tighter">{err.msg}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{err.date} • {err.id}</p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase px-3 py-1 bg-red-600 text-white rounded-full">
              {err.severity}
            </span>
          </div>
        ))}

        {/* Empty State */}
        {((activeTab === "payment" && paymentHistory.length === 0) || 
          (activeTab === "usage" && usageHistory.length === 0) || 
          (activeTab === "error" && errorLogs.length === 0)) && (
          <p className="text-center p-20 text-slate-300 font-black uppercase italic tracking-widest">No Records Found</p>
        )}
      </div>
    </div>
  );
}

// ট্যাব বাটনের জন্য ছোট হেল্পার কম্পোনেন্ট
function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
        active 
        ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
        : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}