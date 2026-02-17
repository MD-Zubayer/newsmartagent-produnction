"use client";

import { useState, useMemo } from "react";
import { 
  FaBell, FaCheckCircle, FaInfoCircle, FaExclamationTriangle, 
  FaCreditCard, FaTrashAlt, FaSearch, FaChevronRight, FaTimes, 
  FaEnvelopeOpen 
} from "react-icons/fa";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, setNotifications, loading } = useNotifications(user);
  
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  
  // ডিলিট লোডিং স্টেট (কোন আইডি ডিলিট হচ্ছে তা ট্র্যাক করবে)
  const [isDeleting, setIsDeleting] = useState(null);

  // --- ১. মার্ক অ্যাজ রিড ---
  const handleMarkAsRead = async (notification) => {
    if (notification.is_read) return;

    // অপ্টিমিস্টিক আপডেট (আগে UI চেঞ্জ করি)
    setNotifications(prev => prev.map(n => 
      n.id === notification.id ? { ...n, is_read: true } : n
    ));

    try {
      await api.post(`/notifications/mark-read/${notification.id}/`);
    } catch (err) {
      console.error("Read Error:", err);
    }
  };

  // --- ২. ডিলিট নোটিফিকেশন (FIXED & SYNCED) ---
  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    
    setIsDeleting(id); // লোডিং শুরু

    try {
      // ব্যাকএন্ড কল (Trailing slash নিশ্চিত করা হয়েছে)
      const response = await api.delete(`/notifications/delete/${id}/`);

      if (response.status >= 200 && response.status < 300) {
        // ১. মোডাল বন্ধ করি
        if (selectedNotification?.id === id) {
          setSelectedNotification(null);
        }

        // ২. স্টেট থেকে ডাটা রিমুভ (Spread operator দিয়ে নতুন রেফারেন্স নিশ্চিত)
        setNotifications(prev => {
          const updatedList = prev.filter(n => String(n.id) !== String(id));
          return [...updatedList]; 
        });
        
        console.log(`✅ ID ${id} deleted successfully`);
      }
    } catch (err) {
      console.error("Delete Error:", err);
      // যদি সার্ভারে আগে থেকেই না থাকে (404), তবে UI থেকে সরিয়ে দাও
      if (err.response?.status === 404) {
        setNotifications(prev => [...prev.filter(n => String(n.id) !== String(id))]);
      } else {
        alert("Server error! Could not delete.");
      }
    } finally {
      setIsDeleting(null); // লোডিং শেষ
    }
  };

  // --- আইকন হেল্পার (Normalized) ---
  const getIcon = (type) => {
    const normalizedType = type?.toLowerCase() || 'info';
    const styles = {
      success: { icon: <FaCheckCircle />, color: "text-emerald-600", bg: "bg-emerald-100" },
      paid:    { icon: <FaCheckCircle />, color: "text-emerald-600", bg: "bg-emerald-100" },
      payment: { icon: <FaCreditCard />,  color: "text-violet-600",  bg: "bg-violet-100" },
      warning: { icon: <FaExclamationTriangle />, color: "text-amber-600", bg: "bg-amber-100" },
      alert:   { icon: <FaBell />, color: "text-rose-600", bg: "bg-rose-100" },
      info:    { icon: <FaInfoCircle />,  color: "text-blue-600",    bg: "bg-blue-100" },
    };
    const config = styles[normalizedType] || styles.info;
    return (
      <div className={`w-12 h-12 flex items-center justify-center rounded-2xl text-xl shadow-sm ${config.bg} ${config.color}`}>
        {config.icon}
      </div>
    );
  };

  // --- ফিল্টারিং লজিক ---
  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    return notifications.filter(n => {
      const msg = n.message?.toLowerCase() || "";
      const search = searchTerm.toLowerCase();
      const matchesSearch = msg.includes(search);
      const matchesTab = activeTab === "Unread" ? !n.is_read : true;
      return matchesSearch && matchesTab;
    });
  }, [notifications, searchTerm, activeTab]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-10 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight italic">INBOX</h2>
            <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">System Alerts & Logs</p>
          </div>
          <div className="relative group w-full md:w-80">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-600 transition-all"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-8">
          {["All", "Unread"].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-2 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                activeTab === tab ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {loading ? (
             <div className="text-center py-20 text-slate-400 font-black animate-pulse tracking-widest uppercase text-xs">Fetching Data...</div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => { setSelectedNotification(n); handleMarkAsRead(n); }}
                className={`group flex items-center gap-4 p-4 md:p-5 rounded-[2rem] border transition-all duration-300 cursor-pointer ${
                  !n.is_read 
                    ? "bg-white border-indigo-100 shadow-xl shadow-indigo-100/30" 
                    : "bg-slate-50 border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <div className="shrink-0">{getIcon(n.type)}</div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-tighter ${!n.is_read ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {n.type || "Update"}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300 uppercase">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className={`text-sm font-bold truncate pr-4 ${!n.is_read ? "text-slate-900" : "text-slate-500"}`}>
                    {n.message}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                   <button 
                    onClick={(e) => {
                        e.stopPropagation(); 
                        e.preventDefault();
                        handleDelete(n.id);
                    }}
                    disabled={isDeleting === n.id}
                    className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                   >
                     {isDeleting === n.id ? (
                        <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                     ) : (
                        <FaTrashAlt size={14}/>
                     )}
                   </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
               <FaBell className="mx-auto text-slate-100 mb-4" size={40} />
               <p className="text-slate-300 font-black uppercase text-[10px] tracking-[0.3em]">No records found</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Details Modal --- */}
      {selectedNotification && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-10 text-center">
                <div className="flex justify-center mb-6">{getIcon(selectedNotification.type)}</div>
                <h3 className="text-xl font-black text-slate-900 mb-4 uppercase tracking-tighter">Notification Detail</h3>
                
                <div className="bg-slate-50 p-6 rounded-2xl text-left mb-8">
                   <p className="text-slate-600 leading-relaxed font-bold italic text-sm md:text-base italic">"{selectedNotification.message}"</p>
                </div>

                <div className="flex flex-col gap-3">
                   <button onClick={() => setSelectedNotification(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Close View</button>
                   <button 
                    onClick={() => handleDelete(selectedNotification.id)}
                    className="w-full py-2 text-rose-500 font-bold text-[10px] uppercase tracking-widest hover:underline"
                   >
                     {isDeleting === selectedNotification.id ? "Processing..." : "Delete Permanently"}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}