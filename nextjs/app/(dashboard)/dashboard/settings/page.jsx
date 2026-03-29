"use client";

import { useState, useEffect } from "react";
import { 
  FaBell, FaRobot, FaShieldAlt, FaGlobe, 
  FaSave, FaCog, FaExclamationCircle,
  FaUserEdit, FaSearch, FaChevronRight,
  FaShoppingCart, FaChevronDown, FaClock, FaCoins
} from "react-icons/fa";
import api from "@/lib/api";
import { toast } from 'react-hot-toast';
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [settings, setSettings] = useState({
    emailNotif: true,
    autoReply: false,
    darkMode: false,
    publicProfile: true,
  });

  const [agentSettings, setAgentSettings] = useState({
    is_order_enable: true,
    auto_renew_enabled: false,
    auto_renew_offer: null
  });
  const [isSaving, setIsSaving] = useState(false);
  const [offers, setOffers] = useState([]);

  // Security States
  const [securityData, setSecurityData] = useState({
    recovery_email: "",
    recovery_whatsapp: "",
    recovery_codes_count: 0,
    recovery_codes_available: [],
    trusted_devices: []
  });
  const [countryCode, setCountryCode] = useState("880");
  const [loginHistory, setLoginHistory] = useState([]);
  const [showCodes, setShowCodes] = useState(false);

  // Per-Contact Settings State
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSettings, setContactSettings] = useState({
    custom_prompt: "",
    custom_instructions: ""
  });

  useEffect(() => {
    if (activeTab === "contacts" || activeTab === "automation") {
      fetchAgents();
      fetchOffers();
    }
    if (activeTab === "security") {
      fetchSecurityData();
      fetchLoginHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedAgent && contactSearch.length >= 2) {
      const delayDebounceFn = setTimeout(() => {
        searchContacts();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [contactSearch, selectedAgent]);

  useEffect(() => {
    fetchAgentSettings();
  }, []);

  useEffect(() => {
    if (user?.profile?.two_factor_enabled !== undefined) {
      setTwoFactorEnabled(user.profile.two_factor_enabled);
    }
  }, [user]);

  const fetchAgentSettings = async () => {
    try {
      const response = await api.get('/settings/agent-settings/');
      setAgentSettings(response.data);
    } catch (err) {
      console.error("Failed to fetch agent global settings:", err);
    }
  };

  const fetchOffers = async () => {
    try {
      const res = await api.get("/offers/");
      setOffers(res.data || []);
    } catch (err) {
      console.error("Failed to load offers:", err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await api.get("/AgentAI/agents/");
      setAgents(res.data || []);
      if (res.data.length > 0 && !selectedAgent) {
        setSelectedAgent(res.data[0].page_id);
      }
    } catch (err) {
      console.error("Failed to load agents:", err);
    }
  };

  const searchContacts = async () => {
    setContactLoading(true);
    try {
      const res = await api.get(`/AgentAI/contacts/${selectedAgent}/?q=${contactSearch}`);
      setContacts(res.data.contacts || []);
    } catch (err) {
      console.error("Failed to search contacts:", err);
    } finally {
      setContactLoading(false);
    }
  };

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setContactSettings({
      custom_prompt: contact.custom_prompt || "",
      custom_instructions: contact.custom_instructions || ""
    });
    setContacts([]);
    setContactSearch("");
  };

  const handleSaveContactSettings = async () => {
    if (!selectedContact) return;
    setIsSaving(true);
    try {
      await api.patch(`/AgentAI/contacts/detail/${selectedContact.id}/`, contactSettings);
      toast.success("Contact settings saved!");
      setSelectedContact(prev => ({ ...prev, ...contactSettings }));
    } catch (err) {
      console.error("Failed to save contact settings:", err);
      toast.error("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAgentToggle = async (agentId, key, currentValue, isDirectValue = false) => {
    setIsSaving(true);
    try {
      const newValue = isDirectValue ? currentValue : !currentValue;
      await api.patch(`/AgentAI/agents/${agentId}/`, { [key]: newValue });
      toast.success(isDirectValue ? "Keywords saved!" : "Setting updated!");
      // Update local agent state if it was a toggle
      if (!isDirectValue) {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, [key]: newValue } : a));
      }
    } catch (err) {
      console.error("Failed to update agent setting:", err);
      toast.error("Failed to update setting.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGlobalSettingChange = async (key, value) => {
    setIsSaving(true);
    try {
      await api.patch('/settings/agent-settings/', { [key]: value });
      setAgentSettings(prev => ({ ...prev, [key]: value }));
      toast.success("Settings updated!");
    } catch (err) {
      console.error("Failed to update global setting:", err);
      toast.error("Failed to update global setting.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGlobalSettingToggle = async (key, currentValue) => {
    handleGlobalSettingChange(key, !currentValue);
  };

  const handleToggle2FA = async () => {
    setIsSaving(true);
    try {
      const newValue = !twoFactorEnabled;
      const res = await api.post('/auth/2fa/toggle/', { enabled: newValue });
      setTwoFactorEnabled(newValue);
      
      // Update local user state
      if (setUser) {
        setUser(prev => ({
          ...prev,
          profile: {
            ...prev.profile,
            two_factor_enabled: newValue
          }
        }));
      }
      
      toast.success(res.data.message);
    } catch (err) {
      console.error("Failed to toggle 2FA:", err);
      toast.error(err.response?.data?.error || "Failed to update 2FA setting.");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchSecurityData = async () => {
    try {
      const res = await api.get("/security/settings/");
      const data = res.data;
      
      // Parse country code from recovery_whatsapp
      if (data.recovery_whatsapp) {
        let whatsapp = data.recovery_whatsapp.replace(/^\+/, '');
        if (whatsapp.startsWith("880")) {
          setCountryCode("880");
          data.recovery_whatsapp = whatsapp.substring(3);
        } else if (whatsapp.startsWith("91")) {
          setCountryCode("91");
          data.recovery_whatsapp = whatsapp.substring(2);
        } else if (whatsapp.startsWith("1")) {
          setCountryCode("1");
          data.recovery_whatsapp = whatsapp.substring(1);
        } else if (whatsapp.startsWith("44")) {
          setCountryCode("44");
          data.recovery_whatsapp = whatsapp.substring(2);
        } else if (whatsapp.startsWith("971")) {
          setCountryCode("971");
          data.recovery_whatsapp = whatsapp.substring(3);
        } else if (whatsapp.startsWith("966")) {
          setCountryCode("966");
          data.recovery_whatsapp = whatsapp.substring(3);
        }
      }
      
      setSecurityData(data);
    } catch (err) {
      console.error("Failed to fetch security data");
    }
  };

  const fetchLoginHistory = async () => {
    try {
      const res = await api.get("/security/login-history/");
      setLoginHistory(res.data || []);
    } catch (err) {
      console.error("Failed to fetch login history");
    }
  };

  const handleUpdateRecovery = async () => {
    setIsSaving(true);
    try {
      // Clean number (remove any leading zeros the user might add)
      const cleanNumber = securityData.recovery_whatsapp.replace(/^0+/, '');
      const fullNumber = countryCode + cleanNumber;
      
      await api.post("/security/settings/", {
        action: "update_recovery",
        recovery_email: securityData.recovery_email,
        recovery_whatsapp: fullNumber
      });
      toast.success("Recovery options updated!");
    } catch (err) {
      toast.error("Failed to update recovery options.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateCodes = async () => {
    if (!confirm("This will replace your previous codes. Continue?")) return;
    setIsSaving(true);
    try {
      const res = await api.post("/security/settings/", { action: "generate_codes" });
      setSecurityData(prev => ({
        ...prev,
        recovery_codes_available: res.data.codes,
        recovery_codes_count: res.data.codes.length
      }));
      setShowCodes(true);
      toast.success("New recovery codes generated!");
    } catch (err) {
      toast.error("Failed to generate codes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (!confirm("Are you sure you want to disconnect this device? It will require 2FA next time you log in.")) return;
    setIsSaving(true);
    try {
      await api.post("/security/settings/", { 
        action: "remove_device", 
        device_id: deviceId 
      });
      setSecurityData(prev => ({
        ...prev,
        trusted_devices: prev.trusted_devices.filter(d => d.id !== deviceId)
      }));
      toast.success("Device disconnected successfully!");
    } catch (err) {
      toast.error("Failed to disconnect device.");
    } finally {
      setIsSaving(false);
    }
  };

  const SettingRow = ({ icon: Icon, title, desc, active, onClick, color }) => (
    <div className="flex items-center justify-between gap-4 p-4 sm:p-5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-white transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2.5 rounded-lg ${color} bg-white border border-slate-200 shadow-sm`}>
          <Icon className="text-lg" />
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-slate-800 text-sm sm:text-base">{title}</h4>
          <p className="text-xs text-slate-500 font-medium">{desc}</p>
        </div>
      </div>
      <button 
        onClick={onClick}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ring-1 ring-inset ${active ? 'bg-indigo-600 ring-indigo-600' : 'bg-slate-300 ring-slate-300'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );

  const tabs = [
    { id: "general", label: "General", icon: FaCog },
    { id: "automation", label: "Automation", icon: FaRobot },
    { id: "contacts", label: "Contact-Specific", icon: FaUserEdit },
    { id: "security", label: "Security", icon: FaShieldAlt },
  ];

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900 rounded-xl text-white shadow-sm">
            <FaCog className="text-lg" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Settings</h2>
            <p className="text-slate-500 text-sm font-medium">Manage preferences, automation rules, and account controls.</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 font-semibold">Most changes apply instantly</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row min-h-[620px]">
        
        {/* Sidebar Tabs */}
        <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 p-4 sm:p-5 flex flex-col gap-2">
          <p className="text-[11px] px-2 font-bold uppercase tracking-widest text-slate-500 mb-1">Setting Categories</p>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-left ${
                activeTab === tab.id 
                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white'
              }`}
            >
              <tab.icon className="text-base" />
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-5 sm:p-7 md:p-8">
          {activeTab === "general" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Display & Notifications</h3>
                <div className="space-y-4">
                  <SettingRow 
                    icon={FaBell} 
                    title="Email Notifications" 
                    desc="Receive weekly reports and alert emails."
                    active={settings.emailNotif}
                    onClick={() => toggleSetting('emailNotif')}
                    color="text-blue-500"
                  />
                  <SettingRow 
                    icon={FaGlobe} 
                    title="Public Portfolio" 
                    desc="Make your automation stats visible to others."
                    active={settings.publicProfile}
                    onClick={() => toggleSetting('publicProfile')}
                    color="text-green-500"
                  />
                </div>
              </section>
            </div>
          )}

          {activeTab === "automation" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">AI Rules</h3>
                
                <div className="mb-8 space-y-4">
                  <SettingRow 
                    icon={FaShoppingCart} 
                    title="Enable Order Link Logic" 
                    desc="AI will provide order links and instructions when users ask to buy."
                    active={agentSettings.is_order_enable}
                    onClick={() => handleGlobalSettingToggle('is_order_enable', agentSettings.is_order_enable)}
                    color="text-green-500"
                  />

                  <div className="pt-6 border-t border-gray-100 mt-6">
                    <SettingRow 
                      icon={FaShoppingCart} 
                      title="Auto-Renew Offer" 
                      desc="Automatic purchase when token balance reaches 2,000."
                      active={agentSettings.auto_renew_enabled}
                      onClick={() => handleGlobalSettingToggle('auto_renew_enabled', agentSettings.auto_renew_enabled)}
                      color="text-indigo-500"
                    />

                    {agentSettings.auto_renew_enabled && (
                      <div className="mt-4 ml-2 sm:ml-14 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Select Offer to Renew</label>
                        
                        <div className="relative group/dropdown">
                          <button
                            onClick={() => {
                              const dropdown = document.getElementById('offer-dropdown');
                              dropdown.classList.toggle('hidden');
                            }}
                            className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              {agentSettings.auto_renew_offer ? (
                                <>
                                  <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                    <FaShoppingCart className="text-xs" />
                                  </div>
                                  <div className="text-left">
                                    <p className="font-black text-gray-900 leading-tight">
                                      {offers.find(o => String(o.id) === String(agentSettings.auto_renew_offer))?.name || "Selected Offer"}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-bold">
                                      {offers.find(o => String(o.id) === String(agentSettings.auto_renew_offer))?.price} BDT • {offers.find(o => String(o.id) === String(agentSettings.auto_renew_offer))?.tokens} Tokens
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <span className="text-gray-400 font-bold">Select an Offer to Auto-Renew</span>
                              )}
                            </div>
                            <FaChevronDown className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                          </button>

                          <div
                            id="offer-dropdown"
                            className="absolute z-50 mt-3 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-3 hidden animate-in fade-in slide-in-from-top-4 duration-300"
                          >
                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                              {offers.length > 0 ? (
                                offers.map(offer => (
                                  <button
                                    key={offer.id}
                                    onClick={() => {
                                      handleGlobalSettingChange('auto_renew_offer', offer.id);
                                      document.getElementById('offer-dropdown').classList.add('hidden');
                                    }}
                                    className={`w-full p-4 rounded-xl transition-all flex items-center justify-between group/item ${
                                      String(agentSettings.auto_renew_offer) === String(offer.id) 
                                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                      : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className={`p-3 rounded-2xl ${String(agentSettings.auto_renew_offer) === String(offer.id) ? 'bg-white/20' : 'bg-gray-100 group-hover/item:bg-white group-hover/item:shadow-sm'} transition-colors`}>
                                        <FaCoins className={String(agentSettings.auto_renew_offer) === String(offer.id) ? 'text-white' : 'text-amber-500'} />
                                      </div>
                                      <div className="text-left">
                                        <p className="font-black text-sm">{offer.name}</p>
                                        <div className={`flex items-center gap-2 mt-0.5 ${String(agentSettings.auto_renew_offer) === String(offer.id) ? 'text-indigo-100' : 'text-gray-400'}`}>
                                          <div className="flex items-center gap-1 text-[10px] font-bold">
                                            <FaClock className="text-[10px]" /> {offer.duration_days} Days
                                          </div>
                                          <span className="text-[10px]">•</span>
                                          <p className="text-[10px] font-bold uppercase tracking-widest">{offer.tokens} Tokens</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`font-black text-lg italic ${String(agentSettings.auto_renew_offer) === String(offer.id) ? 'text-white' : 'text-indigo-600'}`}>
                                        ৳{offer.price}
                                      </p>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="p-10 text-center">
                                  <p className="text-gray-400 font-bold italic">No offers available</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-500 ml-1 sm:ml-6 italic">Ensure sufficient balance for automatic renewal. Tokens renew with {offers.find(o => String(o.id) === String(agentSettings.auto_renew_offer))?.duration_days || "30"} days validity.</p>
                      </div>
                    )}
                  </div>
                </div>

                {agents.length > 0 ? (
                  <div className="space-y-6">
                    {agents.map(agent => (
                      <div key={agent.id} className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3 mb-4 ml-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">
                            {agent.platform[0].toUpperCase()}
                          </div>
                          <h4 className="font-black text-gray-800 text-sm">{agent.name || agent.page_id}</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                          <SettingRow 
                            icon={FaRobot} 
                            title="Auto-Reply" 
                            desc="Automatically respond using AI on this agent."
                            active={agent.is_active}
                            onClick={() => handleAgentToggle(agent.id, 'is_active', agent.is_active)}
                            color="text-purple-500"
                          />
                          <SettingRow 
                            icon={FaCog} 
                            title="Skip History" 
                            desc="Only skip history if a keyword is found (Saves tokens)."
                            active={agent.skip_history}
                            onClick={() => handleAgentToggle(agent.id, 'skip_history', agent.skip_history)}
                            color="text-amber-500"
                          />
                          
                          {agent.skip_history && (
                            <div className="mt-2 ml-14 space-y-2 animate-in slide-in-from-top-2 duration-300">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">History Skip Keywords</label>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder="e.g. reset, clear, নতুন করে (comma separated)"
                                  value={agent.history_skip_keywords || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, history_skip_keywords: val } : a));
                                  }}
                                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 shadow-sm"
                                />
                                <button 
                                  onClick={() => handleAgentToggle(agent.id, 'history_skip_keywords', agent.history_skip_keywords, true)}
                                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-all"
                                >
                                  Save
                                </button>
                              </div>
                              <p className="text-[10px] text-gray-400 ml-2 italic underline decoration-indigo-200/50">Only skips history if one of these keywords is found in the user's message.</p>
                            </div>
                          )}

                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 ml-1">AI Parameters</h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">History Limit</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="number"
                                    value={agent.history_limit ?? ''}
                                    onChange={(e) => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, history_limit: e.target.value } : a))}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 shadow-sm"
                                  />
                                  <button onClick={() => handleAgentToggle(agent.id, 'history_limit', parseInt(agent.history_limit) || 3, true)} className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md hover:bg-slate-900 transition-all">Save</button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Temperature</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="number" step="0.1"
                                    value={agent.temperature ?? ''}
                                    onChange={(e) => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, temperature: e.target.value } : a))}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 shadow-sm"
                                  />
                                  <button onClick={() => handleAgentToggle(agent.id, 'temperature', parseFloat(agent.temperature) || 0.7, true)} className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md hover:bg-slate-900 transition-all">Save</button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Max Tokens</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="number"
                                    value={agent.max_tokens ?? ''}
                                    onChange={(e) => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, max_tokens: e.target.value } : a))}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 shadow-sm"
                                  />
                                  <button onClick={() => handleAgentToggle(agent.id, 'max_tokens', parseInt(agent.max_tokens) || 200, true)} className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md hover:bg-slate-900 transition-all">Save</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <SettingRow 
                    icon={FaRobot} 
                    title="Auto-reply to comments" 
                    desc="Automatically respond to user comments using AI."
                    active={settings.autoReply}
                    onClick={() => toggleSetting('autoReply')}
                    color="text-purple-500"
                  />
                )}
              </section>
              
              <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 flex items-start gap-3">
                <FaExclamationCircle className="text-indigo-600 mt-1" />
                <div>
                  <p className="text-indigo-900 font-semibold text-sm">AI Efficiency</p>
                  <p className="text-indigo-700/70 text-xs font-medium mt-1">
                    Customizing your AI logic for specific users can increase engagement by up to 60%. Use the 'Contact-Specific' tab for granular control.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "contacts" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <section>
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 ml-2">Sender-Specific Logic</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Select Agent</label>
                    <select 
                      value={selectedAgent} 
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/10"
                    >
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.page_id}>{agent.name} ({agent.platform})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Search Contact</label>
                    <div className="relative">
                      <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text"
                        placeholder="Name or identifier..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/10"
                      />
                    </div>
                    
                    {contacts.length > 0 && (
                      <div className="absolute top-[100%] left-0 right-0 z-50 mt-2 bg-white border border-gray-100 shadow-xl rounded-2xl max-h-60 overflow-y-auto p-2">
                        {contacts.map(c => (
                          <button
                            key={c.id}
                            onClick={() => handleSelectContact(c)}
                            className="w-full flex items-center justify-between p-3 hover:bg-indigo-50 rounded-xl transition-colors text-left"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-gray-800">{c.name || c.push_name || c.identifier}</span>
                              <span className="text-[10px] font-bold text-gray-400">{c.identifier}</span>
                            </div>
                            <FaChevronRight className="text-xs text-gray-300" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {selectedContact ? (
                  <div className="space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="p-6 bg-indigo-50/50 border border-indigo-100/50 rounded-[2.5rem]">
                      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-indigo-100/30">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm font-black">
                          {selectedContact.name?.[0] || selectedContact.identifier[0]}
                        </div>
                        <div>
                          <h4 className="font-black text-gray-800">{selectedContact.name || selectedContact.identifier}</h4>
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Editing custom AI rules</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Custom System Prompt (Role)</label>
                          <textarea 
                            rows="4"
                            placeholder="e.g. You are a senior accountant dealing with a high-priority client. Be formal and precise."
                            value={contactSettings.custom_prompt}
                            onChange={(e) => setContactSettings(prev => ({ ...prev, custom_prompt: e.target.value }))}
                            className="w-full px-6 py-4 bg-white border border-gray-100 rounded-[2rem] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm shadow-sm"
                          ></textarea>
                          <p className="text-[10px] text-gray-400 ml-2 italic">This overrides the general agent prompt for this contact.</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Additional Instructions</label>
                          <textarea 
                            rows="4"
                            placeholder="e.g. Always mention the next board meeting. Never discuss pricing."
                            value={contactSettings.custom_instructions}
                            onChange={(e) => setContactSettings(prev => ({ ...prev, custom_instructions: e.target.value }))}
                            className="w-full px-6 py-4 bg-white border border-gray-100 rounded-[2rem] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm shadow-sm"
                          ></textarea>
                          <p className="text-[10px] text-gray-400 ml-2 italic">These instructions are appended to the main prompt.</p>
                        </div>
                      </div>

                      <div className="mt-8 flex items-center justify-between gap-4">
                        <button 
                          onClick={() => setSelectedContact(null)}
                          className="px-6 py-3 text-gray-400 text-xs font-black uppercase hover:text-rose-500"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveContactSettings}
                          disabled={isSaving}
                          className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                          {isSaving ? "Saving..." : <><FaSave /> Save Contact Settings</>}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200">
                    <FaUserEdit className="h-12 w-12 text-gray-300 mb-4" />
                    <h4 className="font-black text-gray-400">Search & select a contact to start</h4>
                    <p className="text-xs text-gray-400 mt-1">Granular AI controls will appear here.</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
              {/* 2FA Toggle */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Account Protection</h3>
                <div className="space-y-4">
                  <SettingRow 
                    icon={FaShieldAlt} 
                    title="Two-Factor Authentication" 
                    desc="Require a verification code sent to your email or WhatsApp during login."
                    active={twoFactorEnabled}
                    onClick={handleToggle2FA}
                    color="text-amber-500"
                  />
                </div>
              </section>

              {/* Recovery Options */}
              <section className="pt-6 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Recovery Options</h3>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Recovery Email</label>
                      <input 
                        type="email"
                        value={securityData.recovery_email || ""}
                        onChange={(e) => setSecurityData({...securityData, recovery_email: e.target.value})}
                        placeholder="Backup email address"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">WhatsApp for Security</label>
                      <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all shadow-sm">
                        <select 
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="bg-slate-50 px-3 py-3 border-r border-slate-200 text-xs font-black text-slate-600 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                          <option value="880">BD +880</option>
                          <option value="91">IN +91</option>
                          <option value="1">US +1</option>
                          <option value="44">UK +44</option>
                          <option value="971">UAE +971</option>
                          <option value="966">KSA +966</option>
                        </select>
                        <input 
                          type="text"
                          value={securityData.recovery_whatsapp || ""}
                          onChange={(e) => setSecurityData({...securityData, recovery_whatsapp: e.target.value.replace(/\D/g, '')})}
                          placeholder="17XXXXXXXX"
                          className="flex-1 px-4 py-3 text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300"
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 ml-2 italic">Select country code and enter number without 0.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleUpdateRecovery}
                    disabled={isSaving}
                    className="w-full md:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg shadow-slate-200"
                  >
                    {isSaving ? "Saving..." : "Update Recovery Info"}
                  </button>
                </div>
              </section>

              {/* Connected Devices Section */}
              <section className="pt-6 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Connected Devices</h3>
                <p className="text-[10px] text-slate-400 mb-4">Disconnecting a device will immediately log it out.</p>
                <div className="space-y-3">
                  {securityData.trusted_devices && securityData.trusted_devices.length > 0 ? (
                    securityData.trusted_devices.map((device) => (
                      <div key={device.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                            <FaGlobe className="text-sm" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 text-sm truncate">{device.device_name}</h4>
                              {device.is_trusted && (
                                <span className="px-1.5 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-700 rounded-md uppercase tracking-wide">Trusted</span>
                              )}
                              {device.is_expired && (
                                <span className="px-1.5 py-0.5 text-[9px] font-black bg-slate-100 text-slate-500 rounded-md uppercase tracking-wide">Expired</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Added {new Date(device.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveDevice(device.id)}
                          className="flex-shrink-0 px-3 py-1.5 text-[10px] font-black text-rose-600 uppercase border border-rose-100 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-400 text-sm font-medium italic">No active sessions found.</p>
                      <p className="text-[10px] text-slate-400 mt-1">All your logged-in devices will appear here.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Recovery Codes */}
              <section className="pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Backup Recovery Codes</h3>
                  <button 
                    onClick={handleGenerateCodes}
                    className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                  >
                    Generate New Codes
                  </button>
                </div>
                
                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-2 bg-white rounded-lg border border-indigo-100 text-indigo-600">
                      <FaShieldAlt />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">You have {securityData.recovery_codes_count} unused codes</p>
                      <p className="text-xs text-slate-500 font-medium">Use these if you lose access to your email and phone.</p>
                    </div>
                  </div>

                  {securityData.recovery_codes_available.length > 0 && (
                    <div className="mt-4">
                       <button 
                        onClick={() => setShowCodes(!showCodes)}
                        className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 mb-4"
                      >
                        {showCodes ? "Hide Codes" : "Show Available Codes"}
                      </button>

                      {showCodes && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-in fade-in zoom-in-95">
                          {securityData.recovery_codes_available.map((code, i) => (
                            <div key={i} className="bg-white border border-indigo-100 p-3 rounded-xl text-center font-mono font-bold text-indigo-600 text-sm shadow-sm select-all">
                              {code}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Login History */}
              <section className="pt-6 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Recent Login Activity</h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                  <table className="w-full text-left bg-white text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Device / Browser</th>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">IP Address</th>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loginHistory.length > 0 ? loginHistory.map((login, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">
                            <div className="flex items-center gap-3">
                              <FaGlobe className="text-slate-300" />
                              {login.device_name || "Unknown Browser"}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{login.ip_address}</td>
                          <td className="px-6 py-4 text-slate-400 font-medium">
                            {new Date(login.created_at).toLocaleString()}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="3" className="px-6 py-10 text-center text-slate-400 italic font-medium">No recent activity logged.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
