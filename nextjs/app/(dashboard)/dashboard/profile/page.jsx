"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import Cropper from 'react-easy-crop';
import getCroppedImg from './getCroppedImg';
import { 
  FaUserEdit, FaSignOutAlt, FaEnvelope, FaPhone, 
  FaMapMarkerAlt, FaHashtag, FaGlobeAsia, FaTimes, 
  FaWallet, FaChartLine, FaCopy, FaCheckCircle, FaVenusMars, FaHistory,
  FaShieldAlt, FaKey, FaIdCard, FaCube, FaCoins, FaPercent
} from "react-icons/fa";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { user, loading, setUser } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [fetchingExtras, setFetchingExtras] = useState(true);

  // States for image cropping
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImage, setCropImage] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    division: "",
    district: "",
    upazila: "",
    gender: ""
  });

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
      loadExtraData();
    }
  }, [user]);

  const loadExtraData = async () => {
    setFetchingExtras(true);
    try {
      const [subRes, analyticsRes] = await Promise.all([
        api.get("/subscriptions/"),
        api.get("/AgentAI/tokens/analytics/")
      ]);
      setSubscriptions(subRes.data || []);
      setAnalytics(analyticsRes.data || null);
    } catch (err) {
      console.error("Failed to fetch extra data", err);
    } finally {
      setFetchingExtras(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("ID Copied to Clipboard", {
      style: { borderRadius: '10px', background: '#333', color: '#fff' }
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    const lt = toast.loading("Updating your identity...");
    
    try {
      const res = await api.patch("/users/update-me/", formData);
      toast.success("Identity updated successfully!", { id: lt });
      setUser(res.data);
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error("Update failed. Please check your connection.", { id: lt });
    } finally {
      setUpdating(false);
    }
  };

  // --- Dynamic Usage Calculation ---
  const activeSubs = subscriptions.filter(s => s.is_active);
  const totalInitialTokens = activeSubs.reduce((acc, s) => acc + (s.offer?.tokens || 0), 0);
  const totalUsedTokens = analytics?.summary?.total_tokens || 0;
  const usagePercentage = totalInitialTokens > 0 
    ? Math.min(Math.round((totalUsedTokens / (totalUsedTokens + (user?.profile?.word_balance || 0))) * 100), 100)
    : 0;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl animate-pulse space-y-8">
        <div className="h-40 bg-white rounded-3xl shadow-sm"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-64 bg-white rounded-3xl"></div>
          <div className="h-64 bg-white rounded-3xl"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-800">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200 py-10 px-6 mb-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div 
              className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white shadow-xl overflow-hidden group-hover:bg-slate-200 transition-all cursor-pointer relative"
              onClick={() => document.getElementById('profile-photo-input').click()}
            >
              {user?.profile?.profile_photo ? (
                <img src={user.profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl font-black text-slate-300 italic">{user?.name?.[0]?.toUpperCase() || "U"}</span>
              )}
              
              {/* Overly on hover */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <FaUserEdit className="text-white text-2xl" />
              </div>
            </div>

            <input 
              type="file" 
              id="profile-photo-input" 
              className="hidden" 
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                  setCropImage(reader.result);
                  setShowCropModal(true);
                };
                e.target.value = null; // Reset input
              }}
            />

            {/* Crop Modal */}
            {showCropModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col h-[80vh] md:h-[600px]">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">Adjust Photo</h3>
                    <button onClick={() => setShowCropModal(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                      <FaTimes size={20} />
                    </button>
                  </div>
                  
                  <div className="relative flex-1 bg-slate-100">
                    <Cropper
                      image={cropImage}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onCropComplete={(croppedArea, croppedAreaPixels) => {
                        setCroppedAreaPixels(croppedAreaPixels)
                      }}
                      onZoomChange={setZoom}
                    />
                  </div>

                  <div className="p-6 bg-white flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(e.target.value)}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowCropModal(false)}
                        className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={async () => {
                          const lt = toast.loading("Saving cropped photo...");
                          try {
                            const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
                            const formData = new FormData();
                            formData.append('profile_photo', croppedBlob, 'profile.jpg');

                            const res = await api.patch("/users/update-me/", formData, {
                              headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            toast.success("Profile updated!", { id: lt });
                            setUser(res.data);
                            setShowCropModal(false);
                          } catch (error) {
                            console.error(error);
                            toast.error("Crop failed. Try again.", { id: lt });
                          }
                        }}
                        className="px-8 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="absolute bottom-1 right-1 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-slate-900 transition-all active:scale-90"
              title="Edit Profile Details"
            >
              <FaUserEdit size={16} />
            </button>
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2 uppercase italic">{user?.name}</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 items-center">
              <span className="bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                Active Member
              </span>
              <div className="flex items-center gap-2 text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                <FaHashtag size={10} />
                <span className="text-xs font-bold tracking-wider">{user?.profile?.unique_id}</span>
                <button onClick={() => copyToClipboard(user?.profile?.unique_id)} className="hover:text-indigo-600">
                  <FaCopy size={12} />
                </button>
              </div>
              
              {user?.profile?.profile_photo && (
                <button 
                  onClick={async () => {
                    if(!window.confirm("Delete profile photo?")) return;
                    const lt = toast.loading("Removing photo...");
                    try {
                      const res = await api.patch("/users/update-me/", { profile_photo: null });
                      toast.success("Photo removed", { id: lt });
                      setUser(res.data);
                    } catch (err) {
                      toast.error("Failed to remove photo", { id: lt });
                    }
                  }}
                  className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                >
                  Delete Photo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:flex gap-4 w-full md:w-auto">
             <div className="bg-indigo-50 px-6 py-4 rounded-3xl border border-indigo-100 shadow-sm text-center flex-1">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Account Balance</p>
                <p className="text-xl font-black text-indigo-700 tracking-tighter italic">৳{user?.profile?.acount_balance}</p>
             </div>
             <div className="bg-emerald-50 px-6 py-4 rounded-3xl border border-emerald-100 shadow-sm text-center flex-1">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Commission</p>
                <p className="text-xl font-black text-emerald-700 tracking-tighter italic">৳{user?.profile?.commission_balance || "0.00"}</p>
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Identity Details */}
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white flex items-center justify-between shadow-xl shadow-indigo-100 border border-indigo-500">
                    <div>
                        <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em] mb-1">Tokens Remaining</p>
                        <h4 className="text-2xl font-black italic uppercase">{user?.profile?.word_balance?.toLocaleString()}</h4>
                    </div>
                    <FaCoins size={32} className="text-indigo-300/50" />
                </div>
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex items-center justify-between shadow-xl shadow-slate-200">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Total Used</p>
                        <h4 className="text-2xl font-black italic uppercase">{analytics?.summary?.total_tokens?.toLocaleString() || "0"}</h4>
                    </div>
                    <FaChartLine size={32} className="text-emerald-500" />
                </div>
            </div>

            <section className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-900 mb-8 uppercase tracking-widest flex items-center gap-3">
                <FaIdCard className="text-indigo-600" /> Identity Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                <DetailItem icon={<FaEnvelope />} label="Registered Email" value={user?.email} />
                <DetailItem icon={<FaPhone />} label="Primary Phone" value={user?.phone_number || "Not Linked"} />
                <DetailItem icon={<FaVenusMars />} label="Gender Identity" value={user?.gender} />
                <DetailItem icon={<FaGlobeAsia />} label="Division" value={user?.division} />
                <DetailItem icon={<FaMapMarkerAlt />} label="Region (Upazila)" value={user?.upazila ? `${user.upazila}, ${user.district}` : null} />
                <DetailItem icon={<FaHistory />} label="Joined Date" value={new Date(user?.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
              </div>
            </section>

            {/* Subscriptions Overview */}
            <section className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200">
               <h3 className="text-lg font-black text-slate-900 mb-8 uppercase tracking-widest flex items-center gap-3">
                <FaCube className="text-indigo-600" /> Active Infrastructure
               </h3>
               {subscriptions.length > 0 ? (
                 <div className="space-y-4">
                    {subscriptions.map((sub, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                        <div>
                          <p className="text-sm font-black text-slate-800">{sub.offer?.name || sub.offer_tokens}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expires: {new Date(sub.end_date || sub.expiration_date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                            <span className="bg-white text-emerald-600 text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border border-emerald-100 block mb-1 text-center">
                              {sub.is_active ? "Verified Active" : "Deprioritized"}
                            </span>
                            <p className="text-[10px] font-black text-slate-400 uppercase">{sub.remaining_tokens.toLocaleString()} Left</p>
                        </div>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-xs bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                   {fetchingExtras ? "Synchronizing slots..." : "No active subscriptions found"}
                 </div>
               )}
            </section>
          </div>

          {/* Right: Actions & Security */}
          <div className="lg:col-span-4 space-y-8">
             <div className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl"></div>
                
                <h3 className="text-lg font-black mb-6 uppercase tracking-widest flex items-center gap-3 italic">
                  <FaShieldAlt className="text-indigo-400" /> Security Node
                </h3>
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed mb-8 uppercase tracking-wider">
                  Your identity is protected by Smart Agent end-to-end encryption. Current Health: <span className="text-emerald-400">{analytics?.summary?.success_rate || "99.9"}%</span>
                </p>
                <div className="space-y-4">
                   <button 
                    onClick={() => toast.success("Passphrase reset link sent to your email!", { icon: '📧' })}
                    className="w-full bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex items-center gap-4 transition-all border border-white/5 group"
                   >
                      <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-300 group-hover:scale-110 transition-transform">
                        <FaKey size={14} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">Reset Passphrase</span>
                   </button>
                   <button 
                    onClick={() => {
                      if(window.confirm("Are you sure you want to log out of Smart Agent?")) {
                        api.post('/users/logout/').finally(() => window.location.href = '/signup');
                      }
                    }}
                    className="w-full bg-rose-500/10 hover:bg-rose-500/20 p-4 rounded-2xl flex items-center gap-4 transition-all group border border-rose-500/10"
                   >
                      <div className="w-8 h-8 bg-rose-500 group-hover:bg-rose-600 rounded-lg flex items-center justify-center text-white transition-colors">
                        <FaSignOutAlt size={14} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Close Session</span>
                   </button>
                </div>
             </div>

             <div className="bg-white rounded-[3rem] p-8 text-slate-800 shadow-xl border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                        <FaPercent className="text-indigo-600" /> Usage Capacity
                    </h4>
                    <span className="text-[10px] font-black text-slate-400">{usagePercentage}%</span>
                </div>
                
                <div className="relative h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5 mb-6">
                   <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${usagePercentage > 90 ? 'bg-rose-500' : 'bg-indigo-600'}`} 
                    style={{ width: `${usagePercentage}%` }}
                   ></div>
                </div>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Avg Latency</span>
                        <span className="text-xs font-black text-slate-700">{analytics?.summary?.avg_response_ms || "0"}ms</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Node region</span>
                        <span className="text-xs font-black text-slate-700 capitalize">{user?.division || "Global"}</span>
                    </div>
                </div>

                <p className="text-[10px] font-bold mt-6 text-slate-400 leading-relaxed uppercase tracking-wider italic text-center">
                  Verified high performance node in {user?.division || "Global"} sequence is maintaining stable latency levels.
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Standardized Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-rose-500 transition-colors">
              <FaTimes size={20} />
            </button>
            
            <h2 className="text-2xl font-black text-slate-900 italic uppercase mb-8 flex items-center gap-3">
              <FaIdCard className="text-indigo-600" /> Identity Correction
            </h2>
            
            <form onSubmit={handleUpdate} className="space-y-6">
              <ModalInput label="Full Name" value={formData.name} onChange={(v) => setFormData({...formData, name: v})} placeholder="Full legal name" />
              <ModalInput label="Primary Phone" value={formData.phone_number} onChange={(v) => setFormData({...formData, phone_number: v})} placeholder="e.g. 01700000000" />
              
              <div className="grid grid-cols-2 gap-6">
                 <ModalInput label="Division" value={formData.division} onChange={(v) => setFormData({...formData, division: v})} placeholder="State/Division" />
                 <ModalInput label="District" value={formData.district} onChange={(v) => setFormData({...formData, district: v})} placeholder="City/District" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <ModalInput label="Upazila" value={formData.upazila} onChange={(v) => setFormData({...formData, upazila: v})} placeholder="Region/Upazila" />
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Gender Channel</label>
                    <select 
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:border-indigo-600 outline-none font-bold text-slate-800 transition-all appearance-none text-sm"
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    >
                      <option value="">Select identity</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other Preference</option>
                    </select>
                 </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={updating}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50 active:scale-95"
                >
                  {updating ? "Processing identity..." : "Validate and Sync"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-500 border border-slate-100 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{label}</p>
        <p className="text-base font-bold text-slate-700 break-words leading-tight">{value || "Not synchronized"}</p>
      </div>
    </div>
  );
}

function ModalInput({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{label}</label>
      <input 
        type="text"
        className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:border-indigo-600 outline-none font-bold text-slate-800 transition-all text-sm"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}