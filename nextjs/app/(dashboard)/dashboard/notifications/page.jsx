"use client";

import { useState } from "react";
import { 
  FaBell, FaCheckCircle, FaInfoCircle, FaExclamationTriangle, 
  FaCreditCard, FaTrashAlt, FaEllipsisH, FaCircle, FaSearch, FaFilter 
} from "react-icons/fa";

const initialNotifications = [
  { id: 1, type: "success", title: "Integration Active", message: "Facebook connected successfully with Page ID: 109283", time: "2m ago", unread: true },
  { id: 2, type: "info", title: "Automation Triggered", message: "New comment automation triggered for Post #452", time: "1h ago", unread: true },
  { id: 3, type: "payment", title: "Payment Successful", message: "Pro Plan subscription renewed for Feb 2026", time: "5h ago", unread: false },
  { id: 4, type: "warning", title: "Token Expiring", message: "WhatsApp API token expiring in 2 days. Refresh now.", time: "Yesterday", unread: false },
];

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(initialNotifications);
  const [activeTab, setActiveTab] = useState("All");

  const getIcon = (type) => {
    switch (type) {
      case "success": return <div className="p-3 bg-green-50 text-green-500 rounded-2xl"><FaCheckCircle /></div>;
      case "info": return <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl"><FaInfoCircle /></div>;
      case "payment": return <div className="p-3 bg-purple-50 text-purple-500 rounded-2xl"><FaCreditCard /></div>;
      case "warning": return <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl"><FaExclamationTriangle /></div>;
      default: return <div className="p-3 bg-gray-50 text-gray-500 rounded-2xl"><FaBell /></div>;
    }
  };

  const deleteNotif = (id) => setNotifs(notifs.filter(n => n.id !== id));

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 lg:p-12">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Activity Feed</h2>
            <p className="text-gray-500 font-medium">Keep track of your system events and automations.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-64">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm"
              />
            </div>
            <button className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all">
              <FaFilter size={14} />
            </button>
          </div>
        </div>

        {/* Filter Tabs (Horizontal Scroll on Mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar border-b border-gray-100">
          {["All", "Unread", "Payments", "System"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                : "bg-transparent text-gray-500 hover:text-indigo-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Notifications Container */}
        <div className="grid gap-4">
          {notifs.length > 0 ? (
            notifs.map((n) => (
              <div 
                key={n.id} 
                className={`relative group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 md:p-6 rounded-[2rem] border transition-all duration-300 ${
                  n.unread 
                  ? "bg-white border-indigo-100 shadow-[0_10px_30px_rgba(79,70,229,0.05)]" 
                  : "bg-white/60 border-gray-100 hover:bg-white hover:shadow-md"
                }`}
              >
                {/* Left Side: Icon & Unread Indicator */}
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative">
                    {getIcon(n.type)}
                    {n.unread && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 border-4 border-white rounded-full animate-pulse"></span>
                    )}
                  </div>
                  <div className="sm:hidden flex-1">
                    <h4 className={`text-base ${n.unread ? "font-black text-gray-900" : "font-bold text-gray-700"}`}>{n.title}</h4>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{n.time}</span>
                  </div>
                </div>

                {/* Center Content */}
                <div className="flex-1 space-y-1">
                  <h4 className="hidden sm:block text-lg font-black text-gray-900 leading-none">{n.title}</h4>
                  <p className="text-sm md:text-base text-gray-500 font-medium leading-relaxed">{n.message}</p>
                </div>

                {/* Right Side: Desktop Time & Actions */}
                <div className="flex items-center justify-between w-full sm:w-auto gap-6 sm:pl-4 border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0">
                  <span className="hidden sm:block text-xs font-bold text-gray-400 uppercase tracking-widest">{n.time}</span>
                  
                  <div className="flex items-center gap-2 ml-auto">
                    <button className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                      <FaEllipsisH size={14} />
                    </button>
                    <button 
                      onClick={() => deleteNotif(n.id)}
                      className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <FaTrashAlt size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-[3rem] p-20 text-center border border-dashed border-gray-200">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaBell size={32} />
              </div>
              <h3 className="text-2xl font-black text-gray-800">No New Updates</h3>
              <p className="text-gray-500 mt-2 font-medium">We&apos;ll notify you when something happens.</p>
            </div>
          )}
        </div>

        {/* Load More Button */}
        {notifs.length > 0 && (
          <div className="mt-12 text-center">
            <button className="px-8 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-sm">
              Load Older Notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
