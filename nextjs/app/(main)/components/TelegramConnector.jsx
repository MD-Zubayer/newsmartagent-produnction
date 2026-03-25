"use client";

import { useState, useEffect } from "react";
import { FaTelegram, FaRobot, FaCheckCircle, FaExclamationCircle, FaKey, FaCopy, FaLink, FaUsers } from "react-icons/fa";
import axiosInstance from "@/lib/api";
import { toast } from "react-hot-toast";

export default function TelegramConnector() {
  const [activeTab, setActiveTab] = useState('shared'); // 'shared' or 'custom'
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [botToken, setBotToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [sharedBotAgents, setSharedBotAgents] = useState([]);

  // Fetch existing data
  useEffect(() => {
    fetchAgents();
    fetchSharedBotAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await axiosInstance.get("/agents/");
      const telegramAgents = res.data.filter(agent => agent.platform === 'telegram');
      setAgents(telegramAgents);
    } catch (err) {
      console.error("Failed to fetch agents", err);
    }
  };

  const fetchSharedBotAgents = async () => {
    try {
      const res = await axiosInstance.get("/settings/telegram/shared-bot/");
      setSharedBotAgents(res.data.agents || []);
    } catch (err) {
      console.error("Failed to fetch shared bot agents", err);
    }
  };

  const validateToken = async () => {
    if (!botToken.trim()) {
      toast.error("Please enter a bot token");
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      // We'll validate via our backend API
      const res = await axiosInstance.post("/settings/telegram/setup/", {
        token: botToken,
        agent_id: selectedAgent?.id || null
      });

      setValidationResult({
        success: true,
        bot_username: res.data.bot_username,
        message: res.data.message
      });

      toast.success("Bot configured successfully!");
      fetchAgents(); // Refresh agents list

    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to validate token";
      setValidationResult({
        success: false,
        error: errorMsg
      });
      toast.error(errorMsg);
    } finally {
      setIsValidating(false);
    }
  };

  const createNewAgent = async () => {
    if (!botToken.trim()) {
      toast.error("Please enter a bot token first");
      return;
    }

    setIsLoading(true);
    try {
      // Create new agent
      const agentRes = await axiosInstance.post("/agents/", {
        name: "Telegram Bot",
        platform: "telegram",
        system_prompt: "You are a helpful AI assistant for Telegram. Respond naturally and helpfully to user messages.",
        ai_agent_type: "support"
      });

      const newAgent = agentRes.data;

      // Configure bot for this agent
      await axiosInstance.post("/settings/telegram/setup/", {
        token: botToken,
        agent_id: newAgent.id
      });

      toast.success("New Telegram agent created and configured!");
      fetchAgents();

    } catch (err) {
      toast.error("Failed to create agent");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const createSharedBotAgent = async (name = 'Telegram Auto Agent') => {
    const agentName = name || prompt("Enter agent name:");
    if (!agentName) return;

    setIsLoading(true);
    try {
      const res = await axiosInstance.post("/settings/telegram/shared-bot/", {
        name: agentName,
        system_prompt: "You are a helpful AI assistant. Respond naturally and helpfully to user messages on Telegram.",
        greeting_message: "Hello! How can I help you today?"
      });

      toast.success("Shared bot agent created!");
      fetchSharedBotAgents();

    } catch (err) {
      toast.error("Failed to create shared bot agent");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter italic uppercase">
            Telegram Integration
          </h3>
          <p className="text-[10px] md:text-xs text-sky-600 font-black uppercase tracking-[0.3em] opacity-70 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(14,165,233,0.5)]"></span>
            Choose Your Integration Method
          </p>
        </div>
      </div>

      {/* Tab Selection */}
      <div className="flex bg-slate-100 rounded-[2rem] p-2">
        <button
          onClick={() => setActiveTab('shared')}
          className={`flex-1 py-3 px-6 rounded-xl font-bold uppercase tracking-wider transition-all ${
            activeTab === 'shared'
              ? 'bg-sky-500 text-white shadow-lg'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FaUsers className="inline mr-2" />
          Shared Bot (Easy)
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex-1 py-3 px-6 rounded-xl font-bold uppercase tracking-wider transition-all ${
            activeTab === 'custom'
              ? 'bg-sky-500 text-white shadow-lg'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FaRobot className="inline mr-2" />
          Custom Bot (Advanced)
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50/50 rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-12 border border-slate-100 relative overflow-hidden">

        {activeTab === 'shared' ? (
          /* Shared Bot Section */
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-sky-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-sky-600 shadow-inner">
                <FaUsers size={48} className="animate-pulse" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight italic">
                  Shared Bot Integration
                </h4>
                <p className="text-slate-500 font-medium max-w-md mx-auto opacity-80 leading-relaxed">
                  Use our shared @NewSmartAgent_Bot. Create agents and share unique links with your customers.
                </p>
              </div>
            </div>

            {/* Create New Shared Agent */}
            <div className="flex justify-center">
              <button
                onClick={createSharedBotAgent}
                disabled={isLoading}
                className="bg-sky-500 text-white px-8 py-4 rounded-xl font-bold uppercase tracking-wider hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <FaRobot />
                    Create New Agent
                  </>
                )}
              </button>
            </div>

            {/* Existing Shared Agents */}
            {sharedBotAgents.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">
                  Your Shared Bot Agents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sharedBotAgents.map(agent => (
                    <div key={agent.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-bold text-slate-900">{agent.name}</h5>
                        <span className="text-sm text-slate-500">{agent.connected_chats} connected</span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600 break-all">{agent.deep_link}</p>
                        <button
                          onClick={() => copyToClipboard(agent.deep_link)}
                          className="w-full bg-sky-500 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider hover:bg-sky-600 transition-all flex items-center justify-center gap-2 text-sm"
                        >
                          <FaCopy />
                          Copy Link
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Custom Bot Section */
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-sky-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-sky-600 shadow-inner">
                <FaRobot size={48} className="animate-pulse" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight italic">
                  Custom Bot Setup
                </h4>
                <p className="text-slate-500 font-medium max-w-md mx-auto opacity-80 leading-relaxed">
                  Create your own Telegram bot via @BotFather and connect it here.
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
              <h4 className="font-bold text-blue-900 mb-2">How to Get Your Bot Token</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <p>1. Message <strong>@BotFather</strong> on Telegram</p>
                <p>2. Send <code className="bg-blue-100 px-2 py-1 rounded text-xs">/newbot</code></p>
                <p>3. Follow the prompts to create your bot</p>
                <p>4. Copy the token from BotFather's response</p>
                <p>5. Paste the token below and configure</p>
              </div>
            </div>

            {/* Token Input */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Bot Token
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                  />
                  <FaKey className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Agent Selection */}
              {agents.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Select Existing Agent (Optional)
                  </label>
                  <select
                    value={selectedAgent?.id || ""}
                    onChange={(e) => {
                      const agent = agents.find(a => a.id == e.target.value);
                      setSelectedAgent(agent || null);
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                  >
                    <option value="">Create New Agent</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} (@{agent.page_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={validateToken}
                  disabled={isValidating || !botToken.trim()}
                  className="flex-1 bg-sky-500 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isValidating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Validating...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle />
                      Configure Bot
                    </>
                  )}
                </button>

                {!selectedAgent && (
                  <button
                    onClick={createNewAgent}
                    disabled={isLoading || !botToken.trim()}
                    className="flex-1 bg-slate-600 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <FaRobot />
                        Create Agent
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Validation Result */}
            {validationResult && (
              <div className={`mt-6 p-4 rounded-xl border ${
                validationResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {validationResult.success ? (
                    <FaCheckCircle className="text-emerald-600" />
                  ) : (
                    <FaExclamationCircle className="text-red-600" />
                  )}
                  <span className="font-bold uppercase tracking-wider text-sm">
                    {validationResult.success ? 'Success' : 'Error'}
                  </span>
                </div>
                {validationResult.success ? (
                  <div className="space-y-2">
                    <p className="text-sm">{validationResult.message}</p>
                    <p className="text-sm">
                      <strong>Bot Username:</strong> @{validationResult.bot_username}
                      <button
                        onClick={() => copyToClipboard(`@${validationResult.bot_username}`)}
                        className="ml-2 text-sky-600 hover:text-sky-800"
                      >
                        <FaCopy className="inline w-3 h-3" />
                      </button>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm">{validationResult.error}</p>
                )}
              </div>
            )}

            {/* Existing Custom Bots */}
            {agents.length > 0 && (
              <div className="mt-8">
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">
                  Your Custom Bots
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agents.map(agent => (
                    <div key={agent.id} className="bg-white p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3 mb-2">
                        <FaTelegram className="text-sky-500" />
                        <span className="font-bold text-slate-900">{agent.name}</span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">@{agent.page_id}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        <span className={agent.is_active ? 'text-emerald-600' : 'text-red-600'}>
                          {agent.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}