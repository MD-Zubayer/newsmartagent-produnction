"use client";

import { useAuth } from "app/context/AuthContext";
import { 
  FaUserEdit, FaShieldAlt, FaBell, FaSignOutAlt, 
  FaEnvelope, FaPhone, FaMapMarkerAlt, FaCalendarCheck, FaChevronRight,
  FaFingerprint, FaIdCard, FaGlobeAsia, FaHashtag
} from "react-icons/fa";

export default function ProfilePage() {
  const { user, logout, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f7fe] pb-20 font-sans">
      {/* Header Banner */}
      <div className="h-64 bg-slate-900 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-sm"></div>
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#f4f7fe] to-transparent"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-32 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Profile Identity Card */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-[3rem] p-8 shadow-2xl shadow-indigo-100 border border-white relative overflow-hidden text-center">
              {/* Profile Image & ID Badge */}
              <div className="relative inline-block mb-6">
                <div className="w-40 h-40 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 p-1 shadow-2xl">
                  <div className="w-full h-full rounded-[2.3rem] bg-white flex items-center justify-center text-6xl font-black text-indigo-600 italic border-4 border-white uppercase">
                    {user?.name?.[0] || "A"}
                  </div>
                </div>
                
                {/* UNIQUE ID BADGE - সরাসরি ফটোর নিচে */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2 rounded-2xl shadow-xl border-2 border-white flex items-center gap-2 min-w-max">
                  <FaHashtag className="text-pink-500 text-xs" />
                  <span className="text-xs font-black tracking-[0.2em] uppercase">
                    {user?.profile?.unique_id || "ST-0000"}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <h1 className="text-3xl font-black text-slate-800 tracking-tighter italic uppercase">
                  {user?.name || "Agent Name"}
                </h1>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-2 bg-indigo-50 inline-block px-4 py-1.5 rounded-full">
                  {user?.id_type || "Standard Agent"}
                </p>
              </div>

              {/* Quick Action */}
              <button className="w-full mt-8 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg flex items-center justify-center gap-2 group">
                <FaUserEdit className="group-hover:rotate-12 transition-transform" /> Edit Profile
              </button>
            </div>
          </div>

          {/* Right Column: Details & Stats */}
          <div className="lg:col-span-8 space-y-6">
            {/* Info Grid */}
            <div className="bg-white/70 backdrop-blur-md rounded-[3rem] p-8 md:p-12 shadow-xl border border-white">
              <h3 className="text-xl font-black text-slate-800 mb-10 italic uppercase flex items-center gap-3">
                <div className="w-2 h-8 bg-pink-500 rounded-full"></div> Account Intelligence
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoBox icon={<FaEnvelope />} label="Registered Email" value={user?.email} color="text-blue-500" />
                <InfoBox icon={<FaPhone />} label="Verified Phone" value={user?.phone_number} color="text-emerald-500" />
                <InfoBox icon={<FaGlobeAsia />} label="Jurisdiction" value={`${user?.upazila}, ${user?.division}`} color="text-purple-500" />
                <InfoBox icon={<FaCalendarCheck />} label="Onboarding Date" value={new Date(user?.created_at).toLocaleDateString()} color="text-orange-500" />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white flex items-center justify-between group hover:bg-indigo-800 transition-all cursor-pointer">
                <div>
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Security Status</p>
                  <h4 className="text-lg font-black italic">Active Shield 2.0</h4>
                </div>
                <FaShieldAlt size={32} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>

              <div 
                onClick={logout}
                className="bg-rose-50 rounded-[2.5rem] p-8 border border-rose-100 flex items-center justify-between group hover:bg-rose-500 transition-all cursor-pointer"
              >
                <div>
                  <p className="text-[10px] font-black text-rose-400 group-hover:text-rose-100 uppercase tracking-widest mb-1">Termination</p>
                  <h4 className="text-lg font-black italic text-rose-600 group-hover:text-white">Close Session</h4>
                </div>
                <FaSignOutAlt size={32} className="text-rose-400 group-hover:text-white group-hover:-translate-x-2 transition-all" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Sub-component for Details
function InfoBox({ icon, label, value, color }) {
  return (
    <div className="p-6 bg-white rounded-3xl border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all group">
      <div className="flex items-center gap-4">
        <div className={`p-4 rounded-2xl bg-slate-50 ${color} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className="truncate">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
          <p className="text-slate-800 font-black text-sm md:text-base tracking-tight truncate uppercase">
            {value || "Not Verified"}
          </p>
        </div>
      </div>
    </div>
  );
}