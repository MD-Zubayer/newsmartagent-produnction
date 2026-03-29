"use client";

import React, { useState, useEffect } from "react";
import { 
  FunnelIcon, 
  PhoneIcon, 
  EnvelopeIcon, 
  EllipsisHorizontalIcon,
  ChevronRightIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import api from "@/lib/api";

const STAGES = [
  { id: "new", label: "New Leads", color: "bg-blue-500", bgLight: "bg-blue-50" },
  { id: "cold", label: "Cold", color: "bg-gray-500", bgLight: "bg-gray-50" },
  { id: "warm", label: "Warm", color: "bg-orange-500", bgLight: "bg-orange-50" },
  { id: "hot", label: "Hot", color: "bg-rose-500", bgLight: "bg-rose-50" },
  { id: "converted", label: "Converted", color: "bg-emerald-500", bgLight: "bg-emerald-50" },
  { id: "lost", label: "Lost", color: "bg-zinc-800", bgLight: "bg-zinc-100" },
];

export default function SmartCRMPage() {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("all");
  const [contacts, setContacts] = useState([]);
  const [contactsRaw, setContactsRaw] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [draggingContactId, setDraggingContactId] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  // Scheduling state
  const [isScheduleModal, setIsScheduleModal] = useState(false);
  const [scheduleText, setScheduleText] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState("all");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [viewSchedule, setViewSchedule] = useState(null);
  const [scheduleAudienceCount, setScheduleAudienceCount] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [scheduleDetail, setScheduleDetail] = useState(null);

  useEffect(() => {
    fetchAgents();
    fetchSchedules();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      fetchContacts();
    }
  }, [selectedAgentId]);

  useEffect(() => {
    applyFilters(contactsRaw, startDate, endDate, statusFilter);
  }, [startDate, endDate, statusFilter, contactsRaw]);

  const fetchAgents = async () => {
    try {
      const res = await api.get("/AgentAI/agents/");
      setAgents(res.data);
      if (res.data.length > 0) {
        setSelectedAgentId("all");
      }
    } catch (err) {
      toast.error("Failed to load agents");
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/AgentAI/contacts/${selectedAgentId}/`);
      const rows = res.data.contacts || [];
      const withActivity = rows.filter(c => c.last_message || c.crm_data?.ai_summary);
      setContactsRaw(withActivity);
      applyFilters(withActivity, startDate, endDate, statusFilter);
    } catch (err) {
      toast.error("Failed to load CRM data");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (list, sDate, eDate, stage) => {
    let filtered = list;
    if (stage && stage !== "all") {
      filtered = filtered.filter(c => (c.crm_data?.lead_stage || "new") === stage.id ? false : true);
    }
    if (stage && stage !== "all") {
      filtered = filtered.filter(c => (c.crm_data?.lead_stage || "new") === stage);
    }
    if (sDate) {
      const sd = new Date(sDate);
      filtered = filtered.filter(c => new Date(c.created_at) >= sd);
    }
    if (eDate) {
      const ed = new Date(eDate);
      ed.setHours(23,59,59,999);
      filtered = filtered.filter(c => new Date(c.created_at) <= ed);
    }
    setContacts(filtered);
  };

  const fetchSchedules = async () => {
    setLoadingSchedule(true);
    try {
      const params = {};
      if (scheduleStatus !== "all") params.status = scheduleStatus;
      if (scheduleStart) params.run_after = scheduleStart;
      if (scheduleEnd) params.run_before = scheduleEnd;
      const res = await api.get("/AgentAI/schedule/", { params });
      setSchedules(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      toast.error("Failed to load schedules");
    } finally {
      setLoadingSchedule(false);
    }
  };

  const fetchScheduleDetail = async (id) => {
    try {
      const res = await api.get("/AgentAI/schedule/", { params: { id } });
      const data = Array.isArray(res?.data) ? res.data[0] : res.data;
      setScheduleDetail(data);
    } catch (err) {
      toast.error("Failed to load schedule detail");
    }
  };

  const handleSchedule = async () => {
    if (selectedAgentId === "all") {
      toast.error("একটি নির্দিষ্ট এজেন্ট নির্বাচন করুন");
      return;
    }
    if (!scheduleText.trim() || !scheduleTime) {
      toast.error("মেসেজ ও সময় দিন");
      return;
    }
    if (selectedContacts.length === 0 && statusFilter === "all" && !startDate && !endDate) {
      toast.error("কমপক্ষে একজন কন্টাক্ট সিলেক্ট করুন বা ফিল্টার দিন");
      return;
    }
    try {
      const payload = {
        agent_id: selectedAgentId,
        message: scheduleText,
        run_at: scheduleTime,
        filters: {
          lead_stage: statusFilter,
          start_date: startDate || null,
          end_date: endDate || null,
          contact_ids: selectedContacts
        }
      };
      const res = await api.post("/AgentAI/schedule/", payload);
      toast.success(`Scheduled for ${scheduleTime} (${res.data.audience_count} contacts)`);
      setScheduleAudienceCount(res.data.audience_count ?? null);
      setScheduleText("");
      setScheduleTime("");
      setSelectedContacts([]);
      setShowSchedulePanel(true);
      fetchSchedules();
    } catch (err) {
      toast.error(err.response?.data?.error || "Scheduling failed");
    }
  };

  const handleDeleteSchedule = async (id) => {
    try {
      await api.delete("/AgentAI/schedule/", { data: { id } });
      toast.success("Schedule deleted");
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  };

  const handleViewSchedule = async (s) => {
    setScheduleDetail(null);
    setViewSchedule(s);
    await fetchScheduleDetail(s.id);
  };

  const currentBoard = STAGES.map(stage => ({
    ...stage,
    cards: contacts.filter(c => (c.crm_data?.lead_stage || "new") === stage.id)
  }));

  const toggleContactSelect = (id) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  const handleDragStart = (e, contactId) => {
    setDraggingContactId(contactId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', contactId.toString());
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, stageId) => {
    e.preventDefault();
    if (!draggingContactId) return;

    const updatedContacts = contacts.map(c => {
      if (c.id === draggingContactId) {
        return { ...c, crm_data: { ...c.crm_data, lead_stage: stageId } };
      }
      return c;
    });
    setContacts(updatedContacts);
    setDraggingContactId(null);

    try {
      await api.patch(`/AgentAI/contacts/detail/${draggingContactId}/`, {
        crm_data: { lead_stage: stageId }
      });
    } catch (err) {
      toast.error("Failed to update lead stage");
      fetchContacts();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8f9fa] overflow-hidden">
      {/* Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between shrink-0 shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center gap-2">
            <FunnelIcon className="h-6 w-6 text-cyan-600" />
            Smart Pipeline
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI-Powered Lead Management</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <select 
            value={selectedAgentId} 
            onChange={e => setSelectedAgentId(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all shadow-sm font-medium"
          >
            <option value="all">🌐 All Channels & Agents</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all shadow-sm font-medium"
          >
            <option value="all">All Stages</option>
            {STAGES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all shadow-sm font-medium"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all shadow-sm font-medium"
          />
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setScheduleAudienceCount(null); setIsScheduleModal(true); }}
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow hover:bg-emerald-700 transition"
            disabled={selectedAgentId === "all"}
            title={selectedAgentId === "all" ? "একটি নির্দিষ্ট এজেন্ট সিলেক্ট করুন" : "নতুন Schedule তৈরি করুন"}
          >
            + New Schedule
          </button>
          <div className="text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">
            Selected: <span className="font-bold">{selectedContacts.length}</span>
          </div>
          <button
            onClick={() => setShowSchedulePanel(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold shadow hover:bg-cyan-700 transition"
          >
            <QueueListIcon className="w-4 h-4" />
              <span>Schedule Center</span>
              {schedules.length > 0 && (
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">{schedules.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          </div>
        ) : (
          <div className="flex h-full gap-4 sm:gap-6 px-1 sm:px-2 min-w-max pb-4">
            {currentBoard.map((col) => (
              <div 
                key={col.id} 
                className="w-[280px] sm:w-[320px] shrink-0 flex flex-col rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className={`px-4 py-3 border-b border-gray-100 flex items-center justify-between ${col.bgLight}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${col.color}`}></span>
                    <h3 className="font-bold text-gray-800">{col.label}</h3>
                  </div>
                  <span className="text-xs font-semibold bg-white text-gray-500 px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
                    {col.cards.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f8f9fa]/50">
                  {col.cards.map(card => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      className={`bg-white rounded-lg p-4 shadow-sm border ${selectedContacts.includes(card.id) ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-gray-200'} hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group ${draggingContactId === card.id ? 'opacity-50 scale-95' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(card.id)}
                            onChange={() => toggleContactSelect(card.id)}
                            className="mt-1 h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                          />
                          {card.profile_picture ? (
                            <img 
                              src={card.profile_picture} 
                              alt={card.name || card.identifier} 
                              className="w-10 h-10 rounded-full object-cover shadow-sm bg-white border border-gray-100"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${col.color}`}
                            style={{ display: card.profile_picture ? 'none' : 'flex' }}
                          >
                            {(card.name || card.identifier || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{card.name || card.identifier}</h4>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
                              {card.platform} {card.agent_name && <><ChevronRightIcon className="w-2 h-2" /> {card.agent_name}</>}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedCard(card)}
                          className="text-gray-400 hover:text-blue-600 transition-colors p-1 bg-gray-50 hover:bg-blue-50 rounded"
                          title="View all details"
                        >
                          <EllipsisHorizontalIcon className="w-5 h-5" />
                        </button>
                      </div>

                      {card.crm_data?.ai_summary && (
                        <p className="text-xs text-gray-600 mt-3 line-clamp-3 leading-relaxed bg-gray-50 p-2 rounded border border-gray-100">
                          {card.crm_data.ai_summary}
                        </p>
                      )}

                      {(card.crm_data?.phone || card.crm_data?.email) && (
                        <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-1.5">
                          {card.crm_data?.phone && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <PhoneIcon className="w-3.5 h-3.5 text-blue-500" />
                              <span className="truncate">{card.crm_data.phone}</span>
                            </div>
                          )}
                          {card.crm_data?.email && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <EnvelopeIcon className="w-3.5 h-3.5 text-green-500" />
                              <span className="truncate">{card.crm_data.email}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {col.cards.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm font-medium">
                      Drop leads here
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Schedule button (always visible, avoids header overlap) */}
      <button
        onClick={() => setShowSchedulePanel(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 transition"
        title="Open Schedule Center"
      >
        <QueueListIcon className="w-5 h-5" />
        <span className="hidden sm:inline">Schedule Center</span>
      </button>

      {/* Dynamic Attributes Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedCard(null)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Deep Insights <span className="text-sm font-normal text-gray-500 px-2 py-0.5 bg-gray-200 rounded-full">{selectedCard.name || selectedCard.identifier}</span>
              </h2>
              <button 
                onClick={() => setSelectedCard(null)}
                className="text-gray-400 hover:text-gray-600 bg-white shadow-sm border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <p className="text-sm text-gray-500 mb-4">
                The AI automatically extracted the following dynamic traits and facts from the conversation:
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                {selectedCard.crm_data?.raw_data && Object.keys(selectedCard.crm_data.raw_data).length > 0 ? (
                  Object.entries(selectedCard.crm_data.raw_data).map(([key, value]) => {
                    if (["lead_stage", "phone_number", "email"].includes(key) && !value) return null;
                    
                    return (
                      <div key={key} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm flex flex-col break-words">
                        <span className="text-[11px] uppercase font-bold text-cyan-600 tracking-wider mb-1">
                          {key.replace(/_/g, " ")}
                        </span>
                        <div className="text-sm text-gray-800 font-medium">
                          {Array.isArray(value) ? (
                            <ul className="list-disc pl-4 space-y-1 my-1">
                              {value.map((item, idx) => <li key={idx}>{item}</li>)}
                            </ul>
                          ) : typeof value === 'object' && value !== null ? (
                            <div className="flex flex-col gap-1 mt-1 border-l-2 border-gray-200 pl-3">
                              {Object.entries(value).map(([k, v]) => (
                                <div key={k} className="text-xs">
                                  <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span> 
                                  <span className="ml-1 text-gray-800 font-semibold">{v?.toString()}</span>
                                </div>
                              ))}
                            </div>
                          ) : typeof value === 'boolean' ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {value ? 'Yes' : 'No'}
                            </span>
                          ) : (
                            <span>{value?.toString() || '-'}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No artificial intelligence traits extracted yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setIsScheduleModal(false); setScheduleAudienceCount(null); }}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 z-10 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Schedule Message
                {selectedContacts.length > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-1">
                    {selectedContacts.length} selected
                  </span>
                )}
              </h2>
              <button 
                onClick={() => setIsScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-white shadow-sm border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              {scheduleAudienceCount !== null && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  <span className="font-semibold">Audience:</span>
                  <span>{scheduleAudienceCount} contacts</span>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-gray-700">Message</label>
                <textarea
                  rows={4}
                  value={scheduleText}
                  onChange={(e) => setScheduleText(e.target.value)}
                  className="mt-2 w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Write the message to send..."
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Send at</label>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="mt-2 w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              <p className="text-xs text-gray-500">বর্তমান ফিল্টার (স্ট্যাটাস/তারিখ) এই শিডিউলে প্রয়োগ হবে।</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => { setIsScheduleModal(false); setScheduleAudienceCount(null); }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold shadow hover:bg-cyan-700 transition"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Center Drawer */}
      {showSchedulePanel && (
        <div className="fixed inset-0 z-40 flex sm:justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm sm:block hidden" onClick={() => setShowSchedulePanel(false)} />
          <div className="w-full sm:w-[520px] bg-white shadow-2xl h-full overflow-y-auto sm:rounded-l-2xl sm:border-l sm:border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 sticky top-0 z-10">
              <h3 className="font-bold text-gray-800">Schedule Center</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setScheduleAudienceCount(null); setIsScheduleModal(true); }}
                  className="px-3 py-2 rounded bg-cyan-600 text-white text-xs font-semibold shadow hover:bg-cyan-700"
                  disabled={selectedAgentId === "all"}
                  title={selectedAgentId === "all" ? "একটি নির্দিষ্ট এজেন্ট সিলেক্ট করুন" : "Schedule message"}
                >
                  + New
                </button>
                <button
                  onClick={fetchSchedules}
                  className="text-xs px-3 py-2 rounded border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setShowSchedulePanel(false)}
                  className="text-gray-400 hover:text-gray-600 bg-white shadow-sm border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3 pb-24">
              <div className="flex flex-wrap gap-2 text-xs">
                <select
                  value={scheduleStatus}
                  onChange={(e) => setScheduleStatus(e.target.value)}
                  className="px-2 py-2 rounded border border-gray-200 bg-gray-50"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                </select>
                <input
                  type="datetime-local"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="px-2 py-2 rounded border border-gray-200 bg-gray-50"
                />
                <input
                  type="datetime-local"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  className="px-2 py-2 rounded border border-gray-200 bg-gray-50"
                />
              </div>

              {loadingSchedule ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : schedules.length === 0 ? (
                <p className="text-sm text-gray-400">No schedules.</p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((s) => (
                    <div key={s.id} className="border border-gray-200 rounded-lg p-3 shadow-sm">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="capitalize px-2 py-0.5 rounded bg-gray-100 text-gray-700">{s.status}</span>
                            <span>{new Date(s.run_at).toLocaleString()}</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-800 line-clamp-2">{s.message}</p>
                          <div className="mt-1 text-[11px] text-gray-500">Audience: {s.audience_count}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleViewSchedule(s)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold mr-2"
                          >
                            View
                          </button>
                          {s.status === "pending" && (
                            <button
                              onClick={() => handleDeleteSchedule(s.id)}
                              className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Detail Modal */}
      {viewSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewSchedule(null)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 z-10 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Schedule Details</h2>
              <button 
                onClick={() => setViewSchedule(null)}
                className="text-gray-400 hover:text-gray-600 bg-white shadow-sm border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm text-gray-700">
              <div>
                <p className="font-semibold">Message</p>
                <p className="mt-1 bg-gray-50 p-2 rounded border border-gray-100 whitespace-pre-wrap">{scheduleDetail?.message || viewSchedule.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-semibold">Run At</p>
                  <p>{new Date(scheduleDetail?.run_at || viewSchedule.run_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-semibold">Status</p>
                  <p className="capitalize">{scheduleDetail?.status || viewSchedule.status}</p>
                </div>
                <div>
                  <p className="font-semibold">Audience Count</p>
                  <p>{scheduleDetail?.audience_count ?? viewSchedule.audience_count}</p>
                </div>
                <div>
                  <p className="font-semibold">Created</p>
                  <p>{scheduleDetail?.created_at ? new Date(scheduleDetail.created_at).toLocaleString() : "-"}</p>
                </div>
              </div>
              {scheduleDetail?.filter_payload && (
                <div>
                  <p className="font-semibold">Filters</p>
                  <pre className="mt-1 bg-gray-50 p-2 rounded border border-gray-100 text-xs overflow-auto">{JSON.stringify(scheduleDetail.filter_payload, null, 2)}</pre>
                </div>
              )}
              {scheduleDetail?.error_message && (
                <div>
                  <p className="font-semibold text-rose-600">Error</p>
                  <p className="text-rose-500 bg-rose-50 border border-rose-100 rounded p-2 mt-1 whitespace-pre-wrap">{scheduleDetail.error_message}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50">
              <button
                onClick={() => setViewSchedule(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
