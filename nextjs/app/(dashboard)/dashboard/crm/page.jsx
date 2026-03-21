"use client";

import React, { useState, useEffect } from "react";
import { 
  FunnelIcon, 
  PhoneIcon, 
  EnvelopeIcon, 
  EllipsisHorizontalIcon,
  ChevronRightIcon
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
  const [loading, setLoading] = useState(true);
  
  // For drag and drop
  const [draggingContactId, setDraggingContactId] = useState(null);

  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      fetchContacts();
    }
  }, [selectedAgentId]);

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
      setContacts(res.data.contacts || []);
    } catch (err) {
      toast.error("Failed to load CRM data");
    } finally {
      setLoading(false);
    }
  };

  const currentBoard = STAGES.map(stage => ({
    ...stage,
    cards: contacts.filter(c => (c.crm_data?.lead_stage || "new") === stage.id)
  }));

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
      <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center gap-2">
            <FunnelIcon className="h-6 w-6 text-cyan-600" />
            Smart Pipeline
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI-Powered Lead Management</p>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={selectedAgentId} 
            onChange={e => setSelectedAgentId(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all shadow-sm font-medium"
          >
            <option value="all">🌐 All Channels & Agents</option>
            {agents.map(a => (
              <option key={a.id} value={a.page_id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          </div>
        ) : (
          <div className="flex h-full gap-6 px-2 min-w-max pb-4">
            {currentBoard.map((col) => (
              <div 
                key={col.id} 
                className={`w-[320px] shrink-0 flex flex-col rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className={`px-4 py-3 border-b border-gray-100 flex items-center justify-between ${col.bgLight}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${col.color}`}></span>
                    <h3 className="font-bold text-gray-800">{col.label}</h3>
                  </div>
                  <span className="text-xs font-semibold bg-white text-gray-500 px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
                    {col.cards.length}
                  </span>
                </div>

                {/* Column Body / Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f8f9fa]/50">
                  {col.cards.map(card => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group ${draggingContactId === card.id ? 'opacity-50 scale-95' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${col.color}`}>
                            {card.name ? card.name.charAt(0).toUpperCase() : '?'}
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
                    // Skip standardized keys to avoid visual duplication, though seeing all is fine too
                    if (["lead_stage", "phone_number", "email"].includes(key) && !value) return null;
                    
                    return (
                      <div key={key} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm flex flex-col break-words">
                        <span className="text-[11px] uppercase font-bold text-cyan-600 tracking-wider mb-1">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm text-gray-800 font-medium">
                          {typeof value === 'object' ? JSON.stringify(value) : value.toString()}
                        </span>
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
    </div>
  );
}
