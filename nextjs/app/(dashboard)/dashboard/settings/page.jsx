"use client";

import { useState } from "react";
import { 
  FaBell, FaRobot, FaShieldAlt, FaGlobe, 
  FaSave, FaCog, FaCheckCircle, FaExclamationCircle 
} from "react-icons/fa";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    emailNotif: true,
    autoReply: false,
    darkMode: false,
    publicProfile: true,
  });

  const [isSaving, setIsSaving] = useState(false);

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      alert("Settings saved successfully!");
    }, 1500);
  };

  const SettingRow = ({ icon: Icon, title, desc, active, onClick, color }) => (
    <div className="flex items-center justify-between p-4 sm:p-6 bg-gray-50/50 rounded-[2rem] border border-gray-100 hover:bg-white hover:shadow-md transition-all group">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${color} bg-white shadow-sm group-hover:scale-110 transition-transform`}>
          <Icon className="text-lg" />
        </div>
        <div>
          <h4 className="font-black text-gray-800 text-sm sm:text-base">{title}</h4>
          <p className="text-xs text-gray-400 font-medium">{desc}</p>
        </div>
      </div>
      <button 
        onClick={onClick}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${active ? 'bg-indigo-600' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl shadow-indigo-100">
          <FaCog className="text-2xl animate-spin-slow" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">App Settings</h2>
          <p className="text-gray-500 font-medium">Manage your preferences and automation rules.</p>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-[0_30px_80px_rgba(0,0,0,0.04)] border border-gray-50 overflow-hidden">
        
        {/* Settings Categories */}
        <div className="p-6 sm:p-10 space-y-10">
          
          {/* Automation Section */}
          <section>
            <div className="flex items-center gap-2 mb-6 ml-2">
              <FaRobot className="text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Automation & AI</h3>
            </div>
            <div className="space-y-4">
              <SettingRow 
                icon={FaRobot} 
                title="Auto-reply to comments" 
                desc="Automatically respond to user comments using AI."
                active={settings.autoReply}
                onClick={() => toggleSetting('autoReply')}
                color="text-purple-500"
              />
              <SettingRow 
                icon={FaBell} 
                title="Email Notifications" 
                desc="Receive weekly reports and alert emails."
                active={settings.emailNotif}
                onClick={() => toggleSetting('emailNotif')}
                color="text-blue-500"
              />
            </div>
          </section>

          {/* Privacy & App Section */}
          <section>
            <div className="flex items-center gap-2 mb-6 ml-2">
              <FaShieldAlt className="text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Privacy & Display</h3>
            </div>
            <div className="space-y-4">
              <SettingRow 
                icon={FaGlobe} 
                title="Public Portfolio" 
                desc="Make your automation stats visible to others."
                active={settings.publicProfile}
                onClick={() => toggleSetting('publicProfile')}
                color="text-green-500"
              />
              <SettingRow 
                icon={FaShieldAlt} 
                title="Enhanced Security" 
                desc="Enable two-factor authentication for changes."
                active={true}
                onClick={() => {}}
                color="text-amber-500"
              />
            </div>
          </section>

          {/* Alert Box */}
          <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex items-start gap-4">
            <FaExclamationCircle className="text-indigo-600 mt-1" />
            <div>
              <p className="text-indigo-900 font-bold text-sm">Pro Tip!</p>
              <p className="text-indigo-700/70 text-xs font-medium mt-1">
                Enabling Auto-reply can increase your engagement rate by up to 40%. Make sure your tokens are active.
              </p>
            </div>
          </div>

          {/* Save Button Area */}
          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-400 font-bold italic">
              * Some changes may take a few minutes to reflect.
            </p>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 ${
                isSaving 
                ? 'bg-gray-100 text-gray-400' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <><FaSave /> Save Changes</>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}