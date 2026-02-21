"use client";

import { useState, useEffect } from "react";
import { useAuth } from "app/context/AuthContext";
import api from "@/lib/api";
import { 
  FaUserEdit, FaSignOutAlt, FaEnvelope, FaPhone, 
  FaMapMarkerAlt, FaHashtag, FaGlobeAsia, FaTimes, 
  FaWallet, FaChartLine, FaCopy, FaCheckCircle, FaVenusMars, FaHistory
} from "react-icons/fa";
import toast from "react-hot-toast";

export default function ProfilePage() {
  
  const { user, logout, loading } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Edit Form States
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone_number: user?.phone_number || "",
    division: user?.division || "",
    district: user?.district || "",
    upazila: user?.upazila || "",
    gender: user?.gender || ""
  });

  // ইউজার ডাটা চেঞ্জ হলে ফর্ম আপডেট করা
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        phone_number: user.phone_number || "",
        division: user.division || "",
        district: user.district || "",
        upazila: user.upazila || "",
        gender: user.gender || ""
      });
    }
  }, [user]);

  // --- ১. ইউনিক আইডি কপি ফাংশন (Premium Toast) ---
  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Unique ID copied!", {
      icon: '📋',
      style: { borderRadius: '12px' }
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // --- ২. প্রোফাইল আপডেট ফাংশন ---
  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    const lt = toast.loading("Updating profile...");
    
    try {
      await api.patch("/users/update-me/", formData);
      toast.success("Profile updated successfully!", { id: lt });
      
      setIsEditModalOpen(false);
      // রিলোড করার আগে ১.৫ সেকেন্ড সময় দিচ্ছি যাতে টোস্ট দেখা যায়
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      toast.error("Update failed. Please try again.", { id: lt });
    } finally {
      setUpdating(false);
    }
  };

  // --- ৩. লগআউট কনফার্মেশন ---
  const handleLogout = () => {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">Do you want to log out?</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1 text-xs bg-slate-100 rounded-lg">canceled</button>
          <button 
            onClick={() => {
              toast.dismiss(t.id);
              logout();
            }}
            className="px-3 py-1 text-xs bg-rose-600 text-white rounded-lg"
          >
          Yes, logout
          </button>
        </div>
      </div>
    ));
  };

  if (loading) return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="h-12 bg-white rounded-2xl animate-pulse shadow-sm" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-64 bg-white rounded-[2.5rem] animate-pulse" />
        <div className="h-64 bg-white rounded-[2.5rem] animate-pulse" />
      </div>
    </div>
  );



  
  return (
    <div className="min-h-screen bg-[#f4f7fe] pb-20 font-sans">
      {/* Top Stylish Header */}
      <div className="h-72 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-transparent"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-40 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Profile Summary Card */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-[3.5rem] p-8 shadow-2xl shadow-blue-100 border border-white text-center">
              <div className="relative inline-block mb-6">
                <div className="w-40 h-40 rounded-[3rem] bg-gradient-to-tr from-blue-600 to-indigo-600 p-1.5 shadow-xl">
                  <div className="w-full h-full rounded-[2.8rem] bg-white flex items-center justify-center text-6xl font-black text-blue-600 italic border-4 border-white uppercase">
                    {user?.name?.[0] || "U"}
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-10 h-10 rounded-2xl border-4 border-white flex items-center justify-center text-white" title="Active Account">
                  <FaCheckCircle size={16} />
                </div>
              </div>

              <h1 className="text-2xl font-black text-slate-800 italic uppercase truncate px-2">{user?.name}</h1>
              
              {/* Unique ID with Copy Option */}
              <div className="mt-4 flex items-center justify-center gap-2">
                 <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <FaHashtag className="text-blue-500 text-xs" />
                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{user?.profile?.unique_id}</span>
                    <button 
                      onClick={() => copyToClipboard(user?.profile?.unique_id)}
                      className={`ml-2 transition-all ${copied ? 'text-emerald-500' : 'text-slate-400 hover:text-blue-600'}`}
                    >
                      {copied ? <FaCheckCircle /> : <FaCopy />}
                    </button>
                 </div>
              </div>

              {/* Balance Stats Area */}
              <div className="grid grid-cols-2 gap-3 mt-8">
                <div className="bg-blue-50 p-4 rounded-[2rem] border border-blue-100">
                   <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Account Balance</p>
                   <p className="text-xl font-black text-blue-600 tracking-tighter italic">৳{user?.profile?.acount_balance}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-[2rem] border border-purple-100">
                   <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">Token Balance</p>
                   <p className="text-xl font-black text-purple-600 tracking-tighter italic">{user?.profile?.word_balance?.toLocaleString()}</p>
                </div>
              </div>

              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="w-full mt-8 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <FaUserEdit /> Edit Profile
              </button>
            </div>
          </div>

          {/* Right: Detailed Info */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/80 backdrop-blur-md rounded-[3.5rem] p-8 md:p-12 shadow-xl border border-white">
              <h3 className="text-xl font-black text-slate-900 mb-10 italic uppercase flex items-center gap-3">
                <span className="w-2 h-8 bg-blue-600 rounded-full"></span> Detailed Intelligence
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoRow icon={<FaEnvelope />} label="Registered Email" value={user?.email} color="bg-blue-50 text-blue-600" />
                <InfoRow icon={<FaPhone />} label="Phone Connection" value={user?.phone_number} color="bg-emerald-50 text-emerald-600" />
                <InfoRow icon={<FaGlobeAsia />} label="Division" value={user?.division} color="bg-indigo-50 text-indigo-600" />
                <InfoRow icon={<FaMapMarkerAlt />} label="Region (Upazila)" value={`${user?.upazila}, ${user?.district}`} color="bg-rose-50 text-rose-600" />
                <InfoRow icon={<FaVenusMars />} label="Gender Identity" value={user?.gender || "Not Specified"} color="bg-purple-50 text-purple-600" />
                <InfoRow icon={<FaHistory />} label="Last Activity" value={new Date(user?.profile?.updated_at).toLocaleDateString()} color="bg-orange-50 text-orange-600" />
              </div>
            </div>

            {/* Account Metadata Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Member Since</p>
                    <h4 className="text-lg font-black italic uppercase">{new Date(user?.created_at).toLocaleDateString()}</h4>
                  </div>
                  <FaChartLine size={32} className="text-blue-500" />
               </div>
               <div onClick={logout} className="bg-rose-500 rounded-[2.5rem] p-8 text-white flex items-center justify-between cursor-pointer hover:bg-rose-600 transition-all shadow-xl shadow-rose-100">
                  <div>
                    <p className="text-[9px] font-black text-rose-200 uppercase tracking-[0.3em] mb-1">Security</p>
                    <h4 className="text-lg font-black italic uppercase">Close Session</h4>
                  </div>
                  <FaSignOutAlt size={32} />
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3.5rem] p-8 md:p-12 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-rose-500">
              <FaTimes size={24} />
            </button>
            
            <h2 className="text-3xl font-black text-slate-900 italic uppercase mb-8">Edit Identity</h2>
            
            <form onSubmit={handleUpdate} className="space-y-5">
              <EditInput label="Full Name" value={formData.name} onChange={(v) => setFormData({...formData, name: v})} icon={<FaUserEdit/>} />
              <EditInput label="Phone Number" value={formData.phone_number} onChange={(v) => setFormData({...formData, phone_number: v})} icon={<FaPhone/>} />
              
              <div className="grid grid-cols-2 gap-4">
                 <EditInput label="Division" value={formData.division} onChange={(v) => setFormData({...formData, division: v})} icon={<FaGlobeAsia/>} />
                 <EditInput label="District" value={formData.district} onChange={(v) => setFormData({...formData, district: v})} icon={<FaMapMarkerAlt/>} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <EditInput label="Upazila" value={formData.upazila} onChange={(v) => setFormData({...formData, upazila: v})} icon={<FaMapMarkerAlt/>} />
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2 block">Gender</label>
                    <select 
                      className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-600 outline-none font-bold text-slate-800 transition-all appearance-none"
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                 </div>
              </div>

              <button 
                type="submit" 
                disabled={updating}
                className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-900 transition-all shadow-xl shadow-blue-100"
              >
                {updating ? "Updating..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Information Row Helper
function InfoRow({ icon, label, value, color }) {
  return (
    <div className="flex items-center gap-4 p-5 bg-white border border-slate-50 rounded-3xl hover:shadow-lg transition-all group">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${color} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="truncate">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-slate-800 font-black text-sm uppercase tracking-tight truncate">{value || "N/A"}</p>
      </div>
    </div>
  );
}

// Edit Input Helper
function EditInput({ label, value, onChange, icon }) {
  return (
    <div className="relative">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2 block">{label}</label>
      <div className="relative">
         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">{icon}</span>
         <input 
            type="text"
            className="w-full p-4 pl-12 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-600 outline-none font-bold text-slate-800 transition-all"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
      </div>
    </div>
  );
}