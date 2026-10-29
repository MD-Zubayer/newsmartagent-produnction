"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  UsersIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  XMarkIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
  PaperAirplaneIcon,
  ShoppingBagIcon,
  ClockIcon,
  UserPlusIcon,
  HandRaisedIcon,
  LockClosedIcon,
  CheckBadgeIcon,
  DocumentTextIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import OptionTooltip from "../../../../components/OptionTooltip";

function parseDashboardMessage(rawContent) {
  if (!rawContent || typeof rawContent !== "string")
    return { text: rawContent || "", product: null };
  const match = rawContent.match(
    /^\[PRODUCT_ATTACHED\s+id=([^\s]+)\s+name="([^"]*)"\s+price="([^"]*)"\s+image="([^"]*)"\]\s*([\s\S]*)$/i
  );
  if (match) {
    return {
      text: match[5] || "",
      product: {
        id: match[1],
        name: match[2],
        price: match[3],
        image: match[4],
      },
    };
  }
  return { text: rawContent, product: null };
}

function formatContactLastMessage(raw) {
  if (!raw) return "কোনো বার্তা নেই";
  const parsed = parseDashboardMessage(raw);
  if (parsed.product) {
    const textPart = parsed.text ? ` - ${parsed.text}` : "";
    return `🛍️ ${parsed.product.name}${textPart}`;
  }
  return raw;
}

function getLiveWaitingSeconds(contact, nowMs) {
  if (!contact) return 0;
  if (contact.support_status === "resolved" && !contact.is_human_needed) {
    return 0;
  }
  const isWaitingState =
    contact.is_human_needed ||
    contact.support_status === "waiting_human" ||
    contact.support_status === "in_progress" ||
    Boolean(contact.waiting_since);

  if (!isWaitingState) return 0;

  if (contact.waiting_since) {
    const diff = Math.floor(
      (nowMs - new Date(contact.waiting_since).getTime()) / 1000
    );
    if (diff > 0) return diff;
  }
  return Math.max(0, Number(contact.waiting_seconds || 0));
}

function formatWaitingBadge(seconds) {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;

  let label = "";
  if (mins < 1) {
    label = `${seconds} সে. অপেক্ষমাণ`;
  } else if (hours > 0) {
    label = `${hours} ঘণ্টা ${remMins} মি. অপেক্ষমাণ`;
  } else {
    label = `${mins} মি. অপেক্ষমাণ`;
  }

  if (mins >= 15) {
    return {
      label,
      dotClass: "bg-rose-500 animate-ping",
      badgeClass:
        "bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-500/20",
      level: "critical",
    };
  }
  if (mins >= 5) {
    return {
      label,
      dotClass: "bg-amber-500",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      level: "warning",
    };
  }
  return {
    label,
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    level: "normal",
  };
}

const DEPARTMENT_LABELS = {
  all: "সকল বিভাগ",
  support: "কাস্টমার সাপোর্ট",
  sales: "সেলস ও অর্ডার",
  delivery: "ডেলিভারি ও কুরিয়ার",
  billing: "হিসাব ও রিফান্ড",
  general: "সাধারণ বিভাগ",
};

function formatDepartmentBadge(dept) {
  if (!dept || dept === "all") return "সকল বিভাগ";
  const parts = String(dept).split(",").map((d) => d.trim()).filter(Boolean);
  if (parts.length === 0 || parts.includes("all")) return "সকল বিভাগ";
  return parts.map((p) => DEPARTMENT_LABELS[p] || p).join(", ");
}

function formatCompactRoleTitle(role) {
  if (!role) return "এজেন্ট";
  let cleaned = String(role).replace(/\s*\([^)]*\)/g, "").trim();
  if (cleaned.length > 20) {
    cleaned = cleaned.substring(0, 18) + "...";
  }
  return cleaned || "এজেন্ট";
}

// --- Resilient Customer Avatar Component ---
function CustomerAvatar({ contact, size = "w-10 h-10", textSize = "text-sm", rounded = "rounded-2xl" }) {
  const [imgError, setImgError] = useState(false);
  const photoUrl = contact?.profile_picture || contact?.profile_photo_url || contact?.profile_photo;
  const name = contact?.name || contact?.push_name || contact?.identifier || "C";
  const initial = (name.charAt(0) || "C").toUpperCase();

  // Reset imgError if photoUrl changes
  useEffect(() => {
    setImgError(false);
  }, [photoUrl]);

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${size} ${rounded} object-cover shadow-2xs bg-white shrink-0 border border-slate-100`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${size} ${rounded} flex items-center justify-center text-white font-black ${textSize} shrink-0 shadow-2xs ${contact?.platform === "whatsapp"
        ? "bg-[#25d366]"
        : contact?.platform === "tiktok"
          ? "bg-black"
          : contact?.platform === "youtube"
            ? "bg-red-500"
            : contact?.platform === "facebook_comment"
              ? "bg-[#1877f2]"
              : contact?.platform === "telegram"
                ? "bg-sky-500"
                : contact?.platform === "instagram"
                  ? "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400"
                  : "bg-[#0084ff]"
        }`}
    >
      {initial}
    </div>
  );
}

// --- Authentic Real Platform Brand Icons ---
function WhatsAppIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        d="M17.5 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.78-1.48-1.76-1.65-2.06-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.25-.6-.49-.5-.67-.52-.18 0-.37 0-.57 0-.2 0-.52.07-.8.37-.27.3-1.03 1.02-1.03 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function MessengerIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <defs>
        <linearGradient id="msgGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00B2FE" />
          <stop offset="50%" stopColor="#006AFF" />
          <stop offset="100%" stopColor="#9B34FE" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill="url(#msgGradPrimary)" />
      <path
        d="M12 4.5C7.86 4.5 4.5 7.6 4.5 11.44c0 2.19 1.1 4.14 2.8 5.4v2.66l2.54-1.39c.69.19 1.41.29 2.16.29 4.14 0 7.5-3.1 7.5-6.96S16.14 4.5 12 4.5Zm.88 9.33-1.94-2.06-3.77 2.06 4.15-4.4 1.98 2.06 3.73-2.06-4.15 4.4Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function FacebookIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        d="M15.5 12.5h-2.5V20h-3v-7.5H8v-2.5h2V8.3c0-2 1.2-3.3 3.2-3.3.96 0 1.98.17 1.98.17v2.2h-1.11c-1.02 0-1.37.64-1.37 1.3v1.53h2.6l-.3 2.5Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function InstagramIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <defs>
        <radialGradient id="instaGradPrimary" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#instaGradPrimary)" />
      <path
        d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.2-8.5a1.17 1.17 0 1 1-2.34 0 1.17 1.17 0 0 1 2.34 0Z"
        fill="#FFFFFF"
      />
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        rx="4.5"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  );
}

function WebWidgetIcon({ className = "w-4 h-4" }) {
  return (
    <div className={`rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shrink-0 shadow-2xs ${className}`}>
      <svg viewBox="0 0 24 24" className="w-3/5 h-3/5 fill-current" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.08L2.05 21.95a1 1 0 0 0 1.22 1.22l4.87-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Zm0 18c-1.52 0-2.95-.39-4.2-1.07l-.3-.16-2.92.8 1.05-2.85-.18-.32A7.95 7.95 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8Zm-3-9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm3 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm3 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      </svg>
    </div>
  );
}

function TelegramIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="12" fill="#229ED9" />
      <path
        d="M17.2 7.3 5.3 11.9c-.8.3-.8.8-.1 1l3 1 7-4.4c.3-.2.6-.1.4.1l-5.7 5.1-.2 3.1c.3 0 .4-.1.6-.3l1.5-1.5 3.1 2.3c.6.3 1 .2 1.2-.6l2-9.4c.2-.9-.3-1.3-.9-1Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function YouTubeIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect width="24" height="24" rx="6" fill="#FF0000" />
      <path d="M10 8.5v7l6-3.5-6-3.5Z" fill="#FFFFFF" />
    </svg>
  );
}

function TikTokIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect width="24" height="24" rx="6" fill="#000000" />
      <path
        d="M16.6 8.2c-.8-.5-1.4-1.2-1.7-2.1-.1-.3-.2-.7-.2-1.1h-2.8v11.4c0 1.2-1 2.1-2.2 2.1-1.2 0-2.2-1-2.2-2.1 0-1.2 1-2.1 2.2-2.1.2 0 .4 0 .7.1V11.2c-.2 0-.5-.1-.7-.1-2.7 0-4.9 2.2-4.9 4.8 0 2.7 2.2 4.9 4.9 4.9 2.7 0 4.9-2.2 4.9-4.8V9.7c1.1.8 2.5 1.2 4 1.2V8.2c-.7 0-1.4-.2-1.9-.5z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function PlatformLogo({ platform, className = "w-4 h-4" }) {
  switch (platform?.toLowerCase()) {
    case "whatsapp":
      return <WhatsAppIcon className={className} />;
    case "tiktok":
      return <TikTokIcon className={className} />;
    case "messenger":
      return <MessengerIcon className={className} />;
    case "facebook":
    case "facebook_comment":
      return <FacebookIcon className={className} />;
    case "instagram":
      return <InstagramIcon className={className} />;
    case "web_widget":
    case "web":
      return <WebWidgetIcon className={className} />;
    case "telegram":
      return <TelegramIcon className={className} />;
    case "youtube":
      return <YouTubeIcon className={className} />;
    default:
      return <MessengerIcon className={className} />;
  }
}

export default function Contacts() {
  const { user } = useAuth();
  const { notifications } = useNotifications(user);

  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [contacts, setContacts] = useState([]);
  const [summary, setSummary] = useState({
    messages: 0,
    youtube: 0,
    waiting_human: 0,
    unassigned_human: 0,
    my_assigned: 0,
  });
  const [unreadSummary, setUnreadSummary] = useState({
    messages: 0,
    comments: 0,
  });
  const [activeTab, setActiveTab] = useState("messages"); // messages | comments
  const [queueFilter, setQueueFilter] = useState("all"); // all | waiting | mine | unassigned
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate dot counts per agent within their respective platform
  // (e.g. 1st WhatsApp gets 1 dot, 2nd WhatsApp gets 2 dots)
  // Each agent pill in the top bar displays its platform icon + name + matching dots,
  // and the same matching dots appear on each customer card in the contacts list!
  const { agentDotMap, sortedAgentPills } = useMemo(() => {
    const dotMap = {};
    const platformCounters = {};

    const enriched = agents.map((agent) => {
      const rawPlatform = (agent.platform || "messenger").toLowerCase();
      const platformKey =
        rawPlatform === "facebook_comment" ? "facebook" : rawPlatform;

      platformCounters[platformKey] = (platformCounters[platformKey] || 0) + 1;
      const dotCount = platformCounters[platformKey];
      dotMap[agent.id] = dotCount;
      if (agent.page_id) {
        dotMap[agent.page_id] = dotCount;
      }

      let label = "Messenger";
      if (platformKey === "whatsapp") label = "WhatsApp";
      else if (platformKey === "tiktok") label = "TikTok";
      else if (platformKey === "messenger") label = "Messenger";
      else if (platformKey === "facebook") label = "Facebook";
      else if (platformKey === "instagram") label = "Instagram";
      else if (platformKey === "web_widget" || platformKey === "web") label = "Web Chat";
      else if (platformKey === "telegram") label = "Telegram";
      else if (platformKey === "youtube") label = "YouTube";

      return {
        ...agent,
        platformKey,
        platformLabel: label,
        dotCount,
        contactCount: 0,
        unreadCount: 0,
        latestMessageTime: 0,
      };
    });

    // Compute activity from loaded contacts
    contacts.forEach((c) => {
      const target = enriched.find(
        (a) => a.id === c.agent || a.page_id === c.page_id
      );
      if (target) {
        target.contactCount += 1;
        target.unreadCount += c.unread_count || 0;
        if (c.last_message_time) {
          const t = new Date(c.last_message_time).getTime();
          if (t > target.latestMessageTime) {
            target.latestMessageTime = t;
          }
        }
      }
    });

    // Sort: highest unread first, then latest message time, then total contacts
    const sorted = [...enriched].sort((a, b) => {
      if (b.unreadCount !== a.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }
      if (b.latestMessageTime !== a.latestMessageTime) {
        return b.latestMessageTime - a.latestMessageTime;
      }
      if (b.contactCount !== a.contactCount) {
        return b.contactCount - a.contactCount;
      }
      return 0;
    });

    return { agentDotMap: dotMap, sortedAgentPills: sorted };
  }, [agents, contacts]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [historyContact, setHistoryContact] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  // Reply vs Internal Team Note state
  const [replyText, setReplyText] = useState("");
  const [replyMode, setReplyMode] = useState("reply"); // 'reply' | 'note'
  const [sendingReply, setSendingReply] = useState(false);

  // Team & Forwarding state
  const [teamMembers, setTeamMembers] = useState([]);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardMode, setForwardMode] = useState("assign"); // 'assign' | 'auto' | 'unassign'
  const [forwardMemberId, setForwardMemberId] = useState("");
  const [forwardDepartment, setForwardDepartment] = useState("");
  const [forwardNote, setForwardNote] = useState("");
  const [submittingForward, setSubmittingForward] = useState(false);
  const [myPresence, setMyPresence] = useState("online");

  // Live waiting clock tick (every 10 seconds)
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Contact Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    custom_prompt: "",
    custom_instructions: "",
    is_auto_reply_enabled: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const messagesEndRefDesktop = useRef(null);
  const messagesEndRefMobile = useRef(null);
  const observer = useRef();

  // Permissions helper from user.team_context
  const teamContext = user?.team_context || {};
  const isTeamMember = Boolean(teamContext?.is_team_member);
  const hasTeam = Boolean(
    isTeamMember ||
    (teamMembers?.length || 0) > 0 ||
    (teamContext?.team_members_count && teamContext.team_members_count > 0)
  );
  const taskPerms = teamContext?.permissions?.tasks || {};
  const canReply = taskPerms.inbox_reply !== false;
  const canForwardAssign = taskPerms.inbox_forward_assign !== false;
  const canToggleAutoReply = taskPerms.inbox_toggle_ai !== false;
  const canWriteInternalNotes = taskPerms.inbox_internal_notes !== false;
  const canManageTeam = teamContext?.permissions?.pages?.team !== false;

  // Auto-reset team-specific filters if user is solo
  useEffect(() => {
    if (!hasTeam && (queueFilter === "mine" || queueFilter === "unassigned")) {
      setQueueFilter("all");
    }
  }, [hasTeam, queueFilter]);

  useEffect(() => {
    if (!hasTeam && replyMode !== "reply") {
      setReplyMode("reply");
    }
  }, [hasTeam, replyMode]);

  useEffect(() => {
    if (teamContext?.availability_status) {
      setMyPresence(teamContext.availability_status);
    }
  }, [teamContext?.availability_status]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const scrollToBottom = () => {
    const doScroll = () => {
      messagesEndRefDesktop.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
      messagesEndRefMobile.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
    };
    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 40);
    setTimeout(doScroll, 160);
  };

  const lastMessageElementRef = useCallback(
    (node) => {
      if (historyLoading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreHistory) {
          setHistoryPage((prevPageNumber) => prevPageNumber + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [historyLoading, hasMoreHistory]
  );

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get("/AgentAI/contacts/summary/");
      setSummary(
        res.data || {
          messages: 0,
          youtube: 0,
          waiting_human: 0,
          unassigned_human: 0,
          my_assigned: 0,
        }
      );
    } catch (err) {
      console.error("Summary load failed", err);
    }
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const res = await api.get("/team/members/");
      const membersList = Array.isArray(res?.data?.members)
        ? res.data.members.filter((m) => m.is_active)
        : [];
      setTeamMembers(membersList);
    } catch (err) {
      console.error("Failed to load team members:", err);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get("/AgentAI/agents/");
      const agentList = Array.isArray(res?.data) ? res.data : [];
      setAgents(agentList);
      setSelectedAgent("all");
    } catch (err) {
      console.error("Failed to load agents:", err);
      toast.error("চ্যানেল লোড করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(
    async (
      agentId = "all",
      commentsOnly = false,
      queue = queueFilter,
      platformFilter = selectedPlatform
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (commentsOnly) params.set("comments_only", "true");
        if (queue && queue !== "all") params.set("queue", queue);
        if (platformFilter && platformFilter !== "all") {
          params.set("platform", platformFilter);
        }
        const qs = params.toString() ? `?${params.toString()}` : "";
        const res = await api.get(`/AgentAI/contacts/${agentId}/${qs}`);
        const list = Array.isArray(res?.data?.contacts)
          ? res.data.contacts
          : [];
        setContacts(list);
        const unreadSum = list.reduce(
          (acc, c) => acc + (c.unread_count || 0),
          0
        );
        setUnreadSummary((prev) =>
          commentsOnly
            ? { ...prev, comments: unreadSum }
            : { ...prev, messages: unreadSum }
        );
      } catch (err) {
        console.error("Failed to load contacts:", err);
        toast.error("কন্টাক্ট তালিকা লোড করা যায়নি।");
      } finally {
        setLoading(false);
      }
    },
    [queueFilter, selectedPlatform]
  );

  const fetchSingleContact = useCallback(
    async (contactId) => {
      try {
        const res = await api.get(`/AgentAI/contacts/detail/${contactId}/`);
        const contact = res.data;
        let updatedList = [];
        setContacts((prev) => {
          const isCommentPlatform = ["youtube", "facebook_comment"].includes(
            contact.platform
          );
          if (activeTab === "comments" && !isCommentPlatform) return prev;
          if (activeTab === "messages" && isCommentPlatform) return prev;
          const idx = prev.findIndex((c) => c.id === contact.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = contact;
            updatedList = copy;
            return copy;
          }
          const merged = [contact, ...prev].slice(0, 200);
          updatedList = merged;
          return merged;
        });
        if (historyContact?.id === contact.id) {
          setHistoryContact((prev) => ({ ...prev, ...contact }));
        }
        if (updatedList.length) {
          const unreadSum = updatedList.reduce(
            (acc, c) => acc + (c.unread_count || 0),
            0
          );
          setUnreadSummary((prev) =>
            activeTab === "comments"
              ? { ...prev, comments: unreadSum }
              : { ...prev, messages: unreadSum }
          );
        }
        fetchSummary();
      } catch (err) {
        console.error("Single contact fetch failed", err);
      }
    },
    [activeTab, historyContact?.id, fetchSummary]
  );

  const fetchHistory = useCallback(async (contactId, page) => {
    if (page === 1) setHistoryLoading(true);
    try {
      const res = await api.get(
        `/AgentAI/contacts/${contactId}/messages/?page=${page}`
      );
      const newMessages = Array.isArray(res?.data?.results)
        ? res.data.results
        : [];

      setHistoryMessages((prev) => {
        const merged = page === 1 ? newMessages : [...prev, ...newMessages];
        const seen = new Set();
        const unique = [];
        for (const m of merged) {
          const key =
            m?.id ?? `${m?.sent_at ?? ""}|${m?.role ?? ""}|${m?.content ?? ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(m);
        }
        return unique.sort(
          (a, b) => new Date(a?.sent_at || 0) - new Date(b?.sent_at || 0)
        );
      });
      setHasMoreHistory(!!res.data.next);
    } catch (err) {
      console.error("Failed to load history:", err);
      toast.error("মেসেজ হিস্ট্রি লোড করা যায়নি।");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchTeamMembers();
  }, [fetchAgents, fetchTeamMembers]);

  useEffect(() => {
    fetchContacts(selectedAgent, activeTab === "comments", queueFilter);
    fetchSummary();
  }, [selectedAgent, activeTab, queueFilter, fetchContacts, fetchSummary]);

  useEffect(() => {
    if (historyContact && historyPage > 1) {
      fetchHistory(historyContact.id, historyPage);
    }
  }, [historyPage]);

  useEffect(() => {
    if (!historyLoading && historyMessages.length > 0 && historyPage === 1) {
      scrollToBottom();
    }
  }, [historyLoading, historyMessages.length, historyPage]);

  // Real-time Sync Logic
  useEffect(() => {
    if (!Array.isArray(notifications) || !notifications.length) return;
    const lastNotif = notifications[0];

    if (
      lastNotif.action === "CACHE_UPDATE" ||
      lastNotif.action === "HUMAN_HANDOFF"
    ) {
      if (lastNotif.contact_id) {
        fetchSingleContact(lastNotif.contact_id);
      } else {
        fetchContacts(selectedAgent, activeTab === "comments", queueFilter);
      }

      if (
        historyContact &&
        (lastNotif.sender_id === historyContact.identifier ||
          lastNotif.contact_id === historyContact.id)
      ) {
        fetchHistory(historyContact.id, 1);
      }
    }
  }, [notifications, activeTab, queueFilter, selectedPlatform, historyContact, fetchContacts, fetchHistory, fetchSingleContact]);

  const handleTogglePresence = async (newStatus) => {
    setMyPresence(newStatus);
    try {
      await api.post("/team/presence/", { availability_status: newStatus });
      toast.success(
        newStatus === "online"
          ? "আপনার স্ট্যাটাস: অনলাইন"
          : newStatus === "busy"
            ? "আপনার স্ট্যাটাস: ব্যস্ত (Busy)"
            : "আপনার স্ট্যাটাস: অফলাইন"
      );
    } catch (err) {
      toast.error("স্ট্যাটাস আপডেট করা যায়নি");
    }
  };

  const toggleAutoReply = async (contactId, e) => {
    if (e) e.stopPropagation();
    if (!canToggleAutoReply) {
      toast.error("আপনার অটো-রিপ্লাই পরিবর্তন করার অনুমতি নেই।");
      return;
    }
    try {
      const res = await api.post(`/AgentAI/contacts/toggle-reply/${contactId}/`);
      if (res.data.success) {
        const aiEnabled = Boolean(res.data.is_auto_reply_enabled);
        const patch = res.data.contact || {
          is_auto_reply_enabled: aiEnabled,
          is_human_needed: res.data.is_human_needed ?? !aiEnabled,
          waiting_since: aiEnabled ? null : res.data.waiting_since,
          waiting_seconds: aiEnabled ? 0 : undefined,
          support_status:
            res.data.support_status || (aiEnabled ? "resolved" : "in_progress"),
          ...(aiEnabled
            ? {
              assigned_to: null,
              assigned_to_name: null,
              assigned_to_role: null,
              assigned_by: null,
              assigned_by_name: null,
              assigned_to_user_id: null,
              assigned_department: "",
              assignment_note: "",
            }
            : {}),
        };
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, ...patch } : c))
        );
        if (historyContact?.id === contactId) {
          setHistoryContact((prev) => ({ ...prev, ...patch }));
        }
        fetchSummary();
        fetchTeamMembers();
        toast.success(
          aiEnabled
            ? "অটো-রিপ্লাই চালু করা হয়েছে"
            : "অটো-রিপ্লাই বন্ধ করা হয়েছে (ম্যানুয়াল মোড)"
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "সেটিং আপডেট করা যায়নি।");
    }
  };

  const resolveHandoff = async (contactId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.post(
        `/AgentAI/contacts/resolve-handoff/${contactId}/`
      );
      if (res.data.success) {
        const patch = res.data.contact || {
          is_human_needed: false,
          is_auto_reply_enabled: res.data.is_auto_reply_enabled ?? true,
          waiting_since: null,
          waiting_seconds: 0,
          support_status: res.data.support_status || "resolved",
          assigned_to: null,
          assigned_to_name: null,
          assigned_to_role: null,
          assigned_by: null,
          assigned_by_name: null,
          assigned_to_user_id: null,
          assigned_department: "",
          assignment_note: "",
        };
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, ...patch } : c))
        );
        if (historyContact?.id === contactId) {
          setHistoryContact((prev) => ({ ...prev, ...patch }));
        }
        fetchSummary();
        fetchTeamMembers();
        toast.success("কাস্টমারের সমস্যা সমাধান হিসেবে চিহ্নিত হয়েছে ও অটো-রিপ্লাই চালু হয়েছে।");
      }
    } catch (err) {
      toast.error("সমাধান হিসেবে চিহ্নিত করা যায়নি।");
    }
  };

  const handleClaimChat = async (contactId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.post(`/AgentAI/contacts/assign/${contactId}/`, {
        mode: "claim",
      });
      if (res.data.success && res.data.contact) {
        const updated = res.data.contact;
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? updated : c))
        );
        if (historyContact?.id === contactId) {
          setHistoryContact(updated);
          fetchHistory(contactId, 1);
        }
        fetchSummary();
        toast.success("আপনি এই কাস্টমারের দায়িত্ব নিয়েছেন।");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "দায়িত্ব নেওয়া সম্ভব হয়নি।");
    }
  };

  const openForwardModal = (contact) => {
    if (!canForwardAssign) {
      toast.error("আপনার চ্যাট ফরওয়ার্ড করার অনুমতি নেই।");
      return;
    }
    setForwardMode("assign");
    setForwardMemberId(
      contact?.assigned_to_id ? String(contact.assigned_to_id) : ""
    );
    setForwardDepartment(contact?.assigned_department || "");
    setForwardNote(contact?.assignment_note || "");
    setIsForwardModalOpen(true);
  };

  const handleForwardSubmit = async (e) => {
    e.preventDefault();
    if (!historyContact) return;
    if (forwardMode === "assign" && !forwardMemberId) {
      toast.error("যাকে ফরওয়ার্ড করবেন তাকে নির্বাচন করুন।");
      return;
    }
    setSubmittingForward(true);
    try {
      const res = await api.post(
        `/AgentAI/contacts/assign/${historyContact.id}/`,
        {
          mode: forwardMode,
          member_id: forwardMode === "assign" ? Number(forwardMemberId) : null,
          department: forwardDepartment,
          note: forwardNote,
        }
      );
      if (res.data.success && res.data.contact) {
        const updated = res.data.contact;
        setContacts((prev) =>
          prev.map((c) => (c.id === historyContact.id ? updated : c))
        );
        setHistoryContact(updated);
        fetchHistory(historyContact.id, 1);
        fetchSummary();
        fetchTeamMembers();
        setIsForwardModalOpen(false);
        toast.success(
          forwardMode === "unassign"
            ? "চ্যাটটি আন-অ্যাসাইন করা হয়েছে।"
            : "চ্যাটটি সফলভাবে ফরওয়ার্ড করা হয়েছে!"
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "ফরওয়ার্ড করতে সমস্যা হয়েছে।");
    } finally {
      setSubmittingForward(false);
    }
  };

  const openHistory = (contact) => {
    setHistoryContact(contact);
    setHistoryMessages([]);
    setHistoryPage(1);
    setHasMoreHistory(true);
    setIsModalOpen(true);

    setContacts((prev) =>
      prev.map((c) => (c.id === contact.id ? { ...c, unread_count: 0 } : c))
    );

    fetchHistory(contact.id, 1);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !historyContact) return;

    if (replyMode === "note") {
      if (!canWriteInternalNotes) {
        toast.error("আপনার টিম নোট লেখার অনুমতি নেই।");
        return;
      }
      setSendingReply(true);
      try {
        const res = await api.post("/AgentAI/contacts/internal-note/", {
          contact_id: historyContact.id,
          note: replyText.trim(),
        });
        if (res.data.success) {
          toast.success("টিম নোট যোগ করা হয়েছে (কাস্টমার দেখবে না)");
          setReplyText("");
          fetchHistory(historyContact.id, 1);
        }
      } catch (err) {
        toast.error(
          err.response?.data?.error || "টিম নোট সেভ করতে সমস্যা হয়েছে।"
        );
      } finally {
        setSendingReply(false);
      }
      return;
    }

    if (!canReply) {
      toast.error("আপনার কাস্টমারকে রিপ্লাই দেওয়ার অনুমতি নেই।");
      return;
    }

    setSendingReply(true);
    try {
      const res = await api.post("/AgentAI/contacts/unified/reply/", {
        contact_id: historyContact.id,
        message: replyText,
      });

      if (res.data.success) {
        toast.success("উত্তর পাঠানো হয়েছে");
        setReplyText("");
        const patch = res.data.contact || {
          is_auto_reply_enabled: false,
          is_human_needed: true,
          waiting_since: null,
          waiting_seconds: 0,
          support_status: "in_progress",
          last_message: replyText,
          last_message_time: new Date().toISOString(),
        };
        setContacts((prev) =>
          prev.map((c) =>
            c.id === historyContact.id ? { ...c, ...patch } : c
          )
        );
        setHistoryContact((prev) => (prev ? { ...prev, ...patch } : prev));
        fetchHistory(historyContact.id, 1);
        fetchSummary();
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
      toast.error(err.response?.data?.error || "উত্তর পাঠানো যায়নি।");
    } finally {
      setSendingReply(false);
    }
  };

  const openSettings = (contact) => {
    setSettingsForm({
      custom_prompt: contact.custom_prompt || "",
      custom_instructions: contact.custom_instructions || "",
      is_auto_reply_enabled: Boolean(
        contact.is_auto_reply_enabled && !contact.is_human_needed
      ),
    });
    setIsSettingsModalOpen(true);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await api.patch(
        `/AgentAI/contacts/detail/${historyContact.id}/`,
        settingsForm
      );
      setContacts((prev) =>
        prev.map((c) =>
          c.id === historyContact.id ? { ...c, ...res.data } : c
        )
      );
      setHistoryContact((prev) => ({ ...prev, ...res.data }));
      fetchSummary();
      fetchTeamMembers();
      toast.success("সেটিংস সেভ করা হয়েছে!");
      setIsSettingsModalOpen(false);
    } catch (err) {
      toast.error("সেটিংস সেভ করা যায়নি।");
    } finally {
      setSavingSettings(false);
    }
  };

  const myTmId = teamContext?.member_id;
  const myUserName = user?.name?.trim().toLowerCase();

  // Dynamic resilient queue counts for tabs
  const queueCounts = useMemo(() => {
    let waiting = 0;
    let mine = 0;
    let unassigned = 0;

    contacts.forEach((c) => {
      const isResolved = c.support_status === "resolved" && !c.is_human_needed;
      if (isResolved) return;

      const waitSec = getLiveWaitingSeconds(c, nowMs);
      const isWaiting =
        c.is_human_needed ||
        waitSec > 0 ||
        c.support_status === "waiting_human";
      if (isWaiting) waiting += 1;

      const isMine = teamContext?.is_team_member
        ? (myTmId && c.assigned_to === myTmId) ||
        (myUserName &&
          c.assigned_to_name?.trim().toLowerCase() === myUserName)
        : (myUserName &&
          c.assigned_to_name?.trim().toLowerCase() === myUserName) ||
        (myUserName &&
          c.assigned_by_name?.trim().toLowerCase() === myUserName);
      if (isMine) mine += 1;

      if (isWaiting && !c.assigned_to && !c.assigned_to_name) {
        unassigned += 1;
      }
    });

    return {
      all: summary.messages || contacts.length,
      waiting: summary.waiting_human ?? waiting,
      mine: summary.my_assigned ?? mine,
      unassigned: summary.unassigned_human ?? unassigned,
    };
  }, [contacts, summary, teamContext, myTmId, myUserName, nowMs]);

  // Sort & Filter contacts:
  // Longest waiting customer ALWAYS stays at the top (`liveWaitingSec DESC`)
  const sortedAndFilteredContacts = useMemo(() => {
    if (!Array.isArray(contacts)) return [];
    const q = searchQuery.trim().toLowerCase();
    let list = contacts.filter((c) => {
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        c.push_name?.toLowerCase().includes(q) ||
        c.identifier?.toLowerCase().includes(q) ||
        c.assigned_to_name?.toLowerCase().includes(q)
      );
    });

    if (queueFilter === "waiting") {
      list = list.filter(
        (c) =>
          !(c.support_status === "resolved" && !c.is_human_needed) &&
          (c.is_human_needed ||
            getLiveWaitingSeconds(c, nowMs) > 0 ||
            c.support_status === "waiting_human")
      );
    } else if (queueFilter === "mine") {
      list = list.filter((c) => {
        if (c.support_status === "resolved" && !c.is_human_needed) return false;
        if (teamContext?.is_team_member) {
          return (
            (myTmId && c.assigned_to === myTmId) ||
            (myUserName &&
              c.assigned_to_name?.trim().toLowerCase() === myUserName)
          );
        }
        return (
          (myUserName &&
            c.assigned_to_name?.trim().toLowerCase() === myUserName) ||
          (myUserName &&
            c.assigned_by_name?.trim().toLowerCase() === myUserName)
        );
      });
    } else if (queueFilter === "unassigned") {
      list = list.filter(
        (c) =>
          !(c.support_status === "resolved" && !c.is_human_needed) &&
          (c.is_human_needed || getLiveWaitingSeconds(c, nowMs) > 0) &&
          !c.assigned_to &&
          !c.assigned_to_name
      );
    }

    return [...list].sort((a, b) => {
      const waitA = getLiveWaitingSeconds(a, nowMs);
      const waitB = getLiveWaitingSeconds(b, nowMs);
      const isWaitingA = a.is_human_needed || waitA > 0 ? 1 : 0;
      const isWaitingB = b.is_human_needed || waitB > 0 ? 1 : 0;

      if (isWaitingA !== isWaitingB) {
        return isWaitingB - isWaitingA;
      }
      if (isWaitingA && waitA !== waitB) {
        return waitB - waitA; // Longest waiting first!
      }
      const timeA = new Date(
        a.last_message_time || a.updated_at || 0
      ).getTime();
      const timeB = new Date(
        b.last_message_time || b.updated_at || 0
      ).getTime();
      return timeB - timeA;
    });
  }, [contacts, searchQuery, queueFilter, teamContext, myTmId, myUserName, nowMs]);

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0)
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    if (days === 1) return "গতকাল";
    if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const renderMessageItem = (msg, index) => {
    // 1. Internal Team Note / Forwarding Log (Never visible to customer)
    if (msg.is_internal_note || msg.role === "system") {
      return (
        <div key={msg.id || index} className="flex justify-center my-3">
          <div className="max-w-[92%] sm:max-w-[80%] bg-amber-50/95 border-2 border-dashed border-amber-300 text-amber-950 px-4 py-3 rounded-2xl shadow-xs text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-3 border-b border-amber-200/80 pb-1.5">
              <span className="inline-flex items-center gap-1.5 font-black text-[11px] text-amber-900">
                <LockClosedIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                গোপন টিম নোট • {msg.sender_display_name || msg.sender_name || "টিম মেম্বার"}
              </span>
              <span className="text-[10px] text-amber-800 font-extrabold bg-amber-200/70 px-2 py-0.5 rounded-full">
                🔒 কাস্টমার দেখবে না
              </span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-amber-950 font-medium text-[13px]">
              {msg.content}
            </p>
            <div className="text-right text-[10px] text-amber-700/80 font-bold">
              {msg.sent_at
                ? new Date(msg.sent_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : ""}
            </div>
          </div>
        </div>
      );
    }

    const parsed = parseDashboardMessage(msg.content);
    const isAssistant = msg.role === "assistant";
    const isHumanAgentReply =
      isAssistant && Boolean(msg.sent_by_user_id || msg.sender_name);
    const senderBadgeLabel = isAssistant
      ? isHumanAgentReply
        ? msg.sender_display_name || msg.sender_name
        : "Auto Reply"
      : null;

    return (
      <div
        key={msg.id || index}
        className={`flex items-end gap-2.5 ${isAssistant ? "justify-end" : "justify-start"} group my-1`}
      >
        {/* Customer Avatar on Incoming Messages */}
        {!isAssistant && (
          <CustomerAvatar
            contact={historyContact}
            size="w-8 h-8"
            textSize="text-xs"
            rounded="rounded-full"
          />
        )}

        <div
          className={`max-w-[85%] sm:max-w-[76%] px-4 py-3 rounded-2xl text-sm shadow-xs relative space-y-2 transition-all ${isAssistant
            ? isHumanAgentReply
              ? "bg-gradient-to-br from-emerald-50/95 via-teal-50/90 to-emerald-50/95 text-slate-900 rounded-br-xs border border-emerald-200/90 shadow-emerald-500/5"
              : "bg-gradient-to-br from-indigo-50/95 via-violet-50/90 to-purple-50/95 text-slate-900 rounded-br-xs border border-indigo-200/90 shadow-indigo-500/5"
            : "bg-white text-slate-900 rounded-bl-xs border border-slate-200/90 shadow-slate-200/50"
            }`}
        >
          {parsed.product && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/5 border border-slate-200/80 backdrop-blur-xs">
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                {parsed.product.image ? (
                  <img
                    src={parsed.product.image}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <ShoppingBagIcon className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md uppercase tracking-wider block w-fit">
                  🛍️ পণ্যের বিবরণ
                </span>
                <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                  {parsed.product.name}
                </p>
                <p className="text-xs font-black text-emerald-700">
                  ৳{parsed.product.price}
                </p>
              </div>
            </div>
          )}

          <p className="whitespace-pre-wrap leading-relaxed break-words font-medium text-[13.5px]">
            {parsed.text}
          </p>

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-black/5">
            {senderBadgeLabel ? (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${isHumanAgentReply
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300/60"
                  : "bg-indigo-100 text-indigo-800 border border-indigo-300/60"
                  }`}
              >
                {isHumanAgentReply ? "👤" : "✨"} {senderBadgeLabel}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-bold">
                {historyContact?.name || "কাস্টমার"}
              </span>
            )}

            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
              <span>
                {msg.sent_at
                  ? new Date(msg.sent_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "..."}
              </span>
              {isAssistant && (
                <CheckCircleIcon className="h-3.5 w-3.5 text-indigo-600" />
              )}
            </div>
          </div>
        </div>

        {/* Store / Staff Avatar on Outgoing Messages */}
        {isAssistant && (
          <div
            className={`w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs border border-white ${isHumanAgentReply
              ? "bg-emerald-600"
              : "bg-gradient-to-tr from-indigo-600 to-violet-600"
              }`}
          >
            {isHumanAgentReply
              ? (senderBadgeLabel?.charAt(0) || "S").toUpperCase()
              : "AI"}
          </div>
        )}
      </div>
    );
  };

  const activeContactWaitingSec = getLiveWaitingSeconds(historyContact, nowMs);
  const activeContactWaitingBadge = formatWaitingBadge(activeContactWaitingSec);
  const activeContactDotCount = historyContact
    ? agentDotMap[historyContact.agent] ||
    agentDotMap[historyContact.page_id] ||
    1
    : 1;

  const isAssignedToMe = Boolean(
    historyContact &&
    !(historyContact.support_status === "resolved" && !historyContact.is_human_needed) &&
    ((teamContext?.is_team_member &&
      ((myTmId && historyContact.assigned_to === myTmId) ||
        (myUserName &&
          historyContact.assigned_to_name?.trim().toLowerCase() ===
          myUserName))) ||
      (!teamContext?.is_team_member &&
        ((myUserName &&
          historyContact.assigned_to_name?.trim().toLowerCase() ===
          myUserName) ||
          (myUserName &&
            historyContact.assigned_by_name?.trim().toLowerCase() ===
            myUserName))))
  );

  return (
    <div
      className={`w-full font-sans transition-all duration-300 ${isFullscreen
        ? "fixed inset-0 z-[200] bg-white h-screen w-screen overflow-hidden p-0"
        : "relative h-[calc(100vh-75px)] min-h-[560px]"
        }`}
    >
      {/* Main Omnichannel Workspace Hub */}
      <div
        className={`bg-white shadow-xl border border-slate-200/80 overflow-hidden flex flex-col md:flex-row h-full w-full ${isFullscreen ? "rounded-none border-none" : "rounded-2xl sm:rounded-3xl"
          }`}
      >
        {/* LEFT SIDEBAR: Contact & Queue List */}
        <div className="w-full md:w-[380px] lg:w-[410px] border-r border-slate-100 flex flex-col bg-slate-50/40 shrink-0">
          {/* Top Bar with Team Status & Quick Team Link */}
          <div className="px-4 py-3 bg-white/80 backdrop-blur-md flex items-center justify-between gap-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-900 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs ring-2 ring-slate-100">
                {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="font-bold text-xs text-slate-900 truncate block"
                    title={user?.name || "কাস্টমার ইনবক্স"}
                  >
                    {user?.name || "কাস্টমার ইনবক্স"}
                  </span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                    {teamContext?.role_title || "Admin"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium truncate mt-0.5">
                  <span
                    className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-150 truncate shrink-0 max-w-[125px]"
                    title={teamContext?.role_title || "Admin"}
                  >
                    {formatCompactRoleTitle(teamContext?.role_title || "Admin")}
                  </span>
                  {teamContext?.is_team_member && (
                    <span
                      className="text-slate-400 truncate"
                      title={`টিম স্পেস: ${teamContext.workspace_name}`}
                    >
                      • {teamContext.workspace_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Availability Status Selector for Team Members */}
              {teamContext?.is_team_member && (
                <OptionTooltip
                  title="আপনার অনলাইন স্ট্যাটাস"
                  description="অনলাইনে থাকলে স্বয়ংক্রিয়ভাবে নতুন কাস্টমার চ্যাট আপনার কাছে অ্যাসাইন হতে পারবে।"
                  showIcon={false}
                  align="right"
                  position="bottom"
                >
                  <select
                    value={myPresence}
                    onChange={(e) => handleTogglePresence(e.target.value)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-xl border outline-none cursor-pointer shadow-2xs ${myPresence === "online"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : myPresence === "busy"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                  >
                    <option value="online">🟢 অনলাইন</option>
                    <option value="busy">🟠 ব্যস্ত</option>
                    <option value="offline">⚪ অফলাইন</option>
                  </select>
                </OptionTooltip>
              )}

              {hasTeam && canManageTeam && (
                <OptionTooltip
                  title="টিম ও কাস্টম রোল ম্যানেজমেন্ট"
                  description="নতুন টিম মেম্বার যোগ করতে এবং কার কোন পেজ ও কাজের অ্যাক্সেস থাকবে তা নির্ধারণ করতে এখানে ক্লিক করুন।"
                  showIcon={false}
                  align="right"
                  position="bottom"
                >
                  <Link
                    href="/dashboard/team"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition"
                  >
                    <UsersIcon className="h-4 w-4 text-indigo-600" />
                    <span>টিম ({teamMembers?.length || 0})</span>
                  </Link>
                </OptionTooltip>
              )}

              {/* Fullscreen Toggle Button */}
              <OptionTooltip
                title={isFullscreen ? "স্বাভাবিক ভিউ" : "ফুলস্ক্রিন ভিউ"}
                description="চ্যাট ও ইনবক্স উইন্ডো বড় করে পুরো স্ক্রিনে দেখুন।"
                showIcon={false}
                align="right"
                position="bottom"
              >
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition shadow-2xs"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <ArrowsPointingInIcon className="h-4 w-4" />
                  ) : (
                    <ArrowsPointingOutIcon className="h-4 w-4" />
                  )}
                </button>
              </OptionTooltip>
            </div>
          </div>

          {/* Top Platform Switcher Bar (Sorted by message volume & unread priority, with matching dots per agent) */}
          <div className="px-3 pt-2 pb-2 bg-slate-50/80 border-b border-slate-100">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
              {/* All Channels Pill */}
              <button
                type="button"
                onClick={() => setSelectedAgent("all")}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${selectedAgent === "all"
                  ? "bg-slate-900 text-white shadow-xs font-black ring-2 ring-slate-900/10"
                  : "bg-white text-slate-700 hover:bg-slate-100/90 border border-slate-200/80"
                  }`}
                title="সকল প্ল্যাটফর্মের সব মেসেজ ও কাস্টমার একসাথে দেখুন"
              >
                <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white text-[9px] font-black shrink-0">
                  ✦
                </div>
                <span>সব</span>
                {selectedAgent === "all" && contacts.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-bold ml-0.5">
                    {contacts.length}
                  </span>
                )}
              </button>

              {/* Sorted Agent Pills: Platform Icon + Name + Matching Dots */}
              {sortedAgentPills.map((agent) => {
                const isSelected =
                  selectedAgent === agent.page_id ||
                  selectedAgent === String(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() =>
                      setSelectedAgent(agent.page_id || String(agent.id))
                    }
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${isSelected
                      ? "bg-indigo-600 text-white shadow-xs font-black ring-2 ring-indigo-500/20"
                      : "bg-white text-slate-700 hover:bg-slate-100/90 border border-slate-200/80"
                      }`}
                    title={`${agent.platformLabel} • অ্যাকাউন্ট #${agent.dotCount} (${agent.name})`}
                  >
                    <PlatformLogo
                      platform={agent.platform}
                      className="w-4 h-4 shrink-0"
                    />
                    <span>{agent.platformLabel}</span>

                    {/* Designed dots based on this agent's number in this platform */}
                    <div
                      className="flex items-center gap-0.5 ml-0.5"
                      title={`অ্যাকাউন্ট #${agent.dotCount}: ${agent.name}`}
                    >
                      {Array.from({ length: agent.dotCount }).map((_, dIdx) => (
                        <span
                          key={dIdx}
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${isSelected
                            ? "bg-white shadow-[0_0_5px_rgba(255,255,255,0.9)]"
                            : agent.is_active !== false
                              ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] ring-1 ring-emerald-300/40"
                              : "bg-slate-300"
                            }`}
                        />
                      ))}
                    </div>

                    {/* Unread Message Count Badge */}
                    {agent.unreadCount > 0 && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ml-0.5 ${isSelected
                          ? "bg-white/25 text-white"
                          : "bg-rose-500 text-white shadow-xs"
                          }`}
                      >
                        {agent.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Queue Tabs */}
          <div className="p-3 bg-white space-y-2.5 border-b border-slate-100">
            {/* Full-width Modern Search Bar */}
            <div className="relative w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="নাম, ফোন নম্বর বা আইডি দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-100/70 focus:bg-white rounded-xl text-xs font-medium border border-slate-200/60 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Messages vs Comments Switch */}
            <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
              <button
                onClick={() => setActiveTab("messages")}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${activeTab === "messages"
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
              >
                <ChatBubbleLeftRightIcon className="h-4 w-4" />
                মেসেজ ইনবক্স
                {unreadSummary.messages > 0 && (
                  <span className="bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {unreadSummary.messages}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("comments")}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${activeTab === "comments"
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
              >
                <ChatBubbleLeftRightIcon className="h-4 w-4" />
                কমেন্টস
                {unreadSummary.comments > 0 && (
                  <span className="bg-white/20 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {unreadSummary.comments}
                  </span>
                )}
              </button>
            </div>

            {/* Priority Waiting Queue Filter Tabs */}
            {activeTab === "messages" && (
              <div
                className={`grid ${hasTeam ? "grid-cols-4" : "grid-cols-2"
                  } gap-1 bg-slate-100/90 p-1 rounded-xl text-[11px] font-bold`}
              >
                <OptionTooltip
                  title="All Chats"
                  description="All conversations in queue"
                  showIcon={false}
                  align="left"
                >
                  <button
                    type="button"
                    onClick={() => setQueueFilter("all")}
                    className={`w-full py-1.5 px-1 rounded-lg transition-all truncate text-center ${queueFilter === "all"
                      ? "bg-white text-slate-900 shadow-xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    All ({queueCounts.all})
                  </button>
                </OptionTooltip>

                <OptionTooltip
                  title="Waiting (Priority Queue)"
                  description="Customers waiting for human response"
                  showIcon={false}
                  align={hasTeam ? "center" : "right"}
                >
                  <button
                    type="button"
                    onClick={() => setQueueFilter("waiting")}
                    className={`w-full py-1.5 px-1 rounded-lg transition-all truncate flex items-center justify-center gap-1 ${queueFilter === "waiting"
                      ? "bg-rose-600 text-white shadow-xs font-black"
                      : "text-rose-700 hover:bg-rose-50"
                      }`}
                  >
                    <span>Waiting</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${queueFilter === "waiting"
                        ? "bg-white/25 text-white"
                        : "bg-rose-100 text-rose-700"
                        }`}
                    >
                      {queueCounts.waiting}
                    </span>
                  </button>
                </OptionTooltip>

                {hasTeam && (
                  <>
                    <OptionTooltip
                      title="My Assigned Chats"
                      description="Chats assigned to you"
                      showIcon={false}
                    >
                      <button
                        type="button"
                        onClick={() => setQueueFilter("mine")}
                        className={`w-full py-1.5 px-1 rounded-lg transition-all truncate text-center ${queueFilter === "mine"
                          ? "bg-indigo-600 text-white shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                          }`}
                      >
                        Mine ({queueCounts.mine})
                      </button>
                    </OptionTooltip>

                    <OptionTooltip
                      title="Unassigned Waiting Chats"
                      description="Waiting chats not assigned to anyone yet"
                      showIcon={false}
                      align="right"
                    >
                      <button
                        type="button"
                        onClick={() => setQueueFilter("unassigned")}
                        className={`w-full py-1.5 px-1 rounded-lg transition-all truncate text-center ${queueFilter === "unassigned"
                          ? "bg-amber-600 text-white shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                          }`}
                      >
                        Unassigned ({queueCounts.unassigned})
                      </button>
                    </OptionTooltip>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Contact List (Sorted: Longest Waiting Customer at the VERY TOP) */}
          <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-1">
            {loading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex gap-3 p-3 rounded-2xl bg-white border border-slate-100 animate-pulse"
                  >
                    <div className="w-11 h-11 bg-slate-200 rounded-full" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedAndFilteredContacts.length > 0 ? (
              sortedAndFilteredContacts.map((contact) => {
                const waitSec = getLiveWaitingSeconds(contact, nowMs);
                const waitBadge = formatWaitingBadge(waitSec);
                const isSelected = historyContact?.id === contact.id;
                const contactDotCount =
                  agentDotMap[contact.agent] ||
                  agentDotMap[contact.page_id] ||
                  1;

                return (
                  <div
                    key={contact.id}
                    onClick={() => openHistory(contact)}
                    className={`flex gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 border ${isSelected
                      ? "bg-gradient-to-r from-indigo-50/90 to-violet-50/70 border-indigo-300 shadow-sm shadow-indigo-100"
                      : waitBadge?.level === "critical"
                        ? "bg-rose-50/40 border-rose-200 hover:bg-rose-50/80"
                        : "bg-white border-slate-200/60 hover:border-slate-300 hover:bg-white hover:shadow-xs"
                      }`}
                  >
                    {/* Customer Avatar with Platform indicator */}
                    <div className="relative shrink-0">
                      <CustomerAvatar
                        contact={contact}
                        size="w-11 h-11"
                        textSize="text-sm"
                        rounded="rounded-2xl"
                      />

                      {/* Small Platform Badge */}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white shadow-2xs overflow-hidden shrink-0 flex items-center justify-center bg-white">
                        <PlatformLogo
                          platform={contact.platform}
                          className="w-full h-full"
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1.5 mb-0.5">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {contact.name ||
                            contact.push_name ||
                            contact.identifier}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap shrink-0">
                          {formatLastSeen(
                            contact.last_message_time || contact.updated_at
                          )}
                        </span>
                      </div>

                      {/* Live Customer Waiting Timer + Assigned Staff Badges */}
                      {(waitBadge ||
                        (hasTeam &&
                          (contact.assigned_to_name ||
                            contact.is_human_needed))) && (
                          <div className="flex flex-wrap items-center gap-1.5 my-1">
                            {waitBadge && (
                              <span
                                title="কাস্টমার কতক্ষণ ধরে উত্তরের জন্য অপেক্ষা করছেন"
                                className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${waitBadge.badgeClass}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${waitBadge.dotClass}`}
                                />
                                <ClockIcon className="w-3 h-3" />
                                {waitBadge.label}
                              </span>
                            )}

                            {hasTeam && (
                              <>
                                {contact.assigned_to_name ? (
                                  <span
                                    title={`এই চ্যাটটি বর্তমানে ${contact.assigned_to_name}-এর দায়িত্বে আছে`}
                                    className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  >
                                    {contact.assigned_to_name}
                                  </span>
                                ) : (
                                  (contact.is_human_needed || waitSec > 0) && (
                                    <span
                                      title="এখনো কোনো টিম মেম্বার এই চ্যাটের দায়িত্ব নেননি"
                                      className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    >
                                      আন-অ্যাসাইনড
                                    </span>
                                  )
                                )}
                              </>
                            )}
                          </div>
                        )}

                      <div className="flex justify-between items-center mt-1">
                        <p
                          className={`text-xs truncate pr-2 ${contact.unread_count > 0
                            ? "text-slate-900 font-black"
                            : "text-slate-500"
                            }`}
                        >
                          {formatContactLastMessage(contact.last_message)}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {contact.unread_count > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shadow-xs">
                              {contact.unread_count}
                            </span>
                          )}
                          <button
                            onClick={(e) => toggleAutoReply(contact.id, e)}
                            className={`flex-shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black border transition-all ${contact.is_auto_reply_enabled &&
                              !contact.is_human_needed
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                              }`}
                            title={
                              contact.is_auto_reply_enabled &&
                                !contact.is_human_needed
                                ? "অটো-রিপ্লাই চালু (ক্লিক করলে বন্ধ হবে)"
                                : "ম্যানুয়াল মোড (ক্লিক করলে চালু হবে)"
                            }
                          >
                            {contact.is_auto_reply_enabled &&
                              !contact.is_human_needed
                              ? "Auto"
                              : "Manual"}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider truncate">
                            {contact.agent_name || contact.platform}
                          </span>
                          {/* Matching designed dots identifying this specific agent */}
                          {contactDotCount > 0 && (
                            <div
                              className="flex items-center gap-0.5 shrink-0"
                              title={`অ্যাকাউন্ট #${contactDotCount}${contact.agent_name ? ` (${contact.agent_name})` : ""
                                }`}
                            >
                              {Array.from({ length: contactDotCount }).map(
                                (_, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.8)] ring-1 ring-emerald-300/40"
                                  />
                                )
                              )}
                            </div>
                          )}
                        </div>
                        {contact.is_comment && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                            Comment
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400">
                <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-30 text-indigo-500" />
                <p className="text-xs font-bold">এই তালিকায় কোনো কাস্টমার নেই</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CHAT AREA (Desktop Modern Studio) */}
        <div className="flex-1 hidden md:flex flex-col bg-white relative overflow-hidden">
          {!isModalOpen || !historyContact ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-b from-slate-50/50 via-slate-50/20 to-white">
              {/* 3D Glass Box Empty State */}
              <div className="w-20 h-20 rounded-3xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600 shadow-xl shadow-indigo-100 mb-4 transition-transform duration-500 hover:scale-105">
                <ChatBubbleLeftRightIcon className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-1.5">
                কাস্টমার কনভারসেশন নির্বাচন করুন
              </h2>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed font-medium">
                বাম পাশের তালিকা থেকে যেকোনো কাস্টমার বেছে নিন। যেসব কাস্টমার সাহায্যের জন্য সবচেয়ে বেশি সময় অপেক্ষা করছেন, তারা স্বয়ংক্রিয়ভাবে সবার উপরে সাজানো আছে।
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Chat Header */}
              <div className="px-5 py-3.5 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <CustomerAvatar
                      contact={historyContact}
                      size="w-11 h-11"
                      textSize="text-base"
                      rounded="rounded-2xl"
                    />
                    <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-white shadow-2xs overflow-hidden shrink-0 flex items-center justify-center bg-white">
                      <PlatformLogo
                        platform={historyContact?.platform}
                        className="w-full h-full"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900 truncate">
                        {historyContact?.name ||
                          historyContact?.push_name ||
                          historyContact?.identifier}
                      </h3>

                      {activeContactWaitingBadge && (
                        <OptionTooltip
                          title="লাইভ অপেক্ষার সময় (Waiting Time)"
                          description="এই কাস্টমার শেষ মেসেজ দেওয়ার পর থেকে কতক্ষণ ধরে মানুষের উত্তরের জন্য অপেক্ষা করছেন।"
                          showIcon={false}
                        >
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border cursor-help ${activeContactWaitingBadge.badgeClass}`}
                          >
                            <ClockIcon className="w-3 h-3" />
                            {activeContactWaitingBadge.label}
                          </span>
                        </OptionTooltip>
                      )}

                      {hasTeam && historyContact?.assigned_to_name && (
                        <OptionTooltip
                          title="অ্যাসাইন করা টিম মেম্বার"
                          description={`এই কাস্টমারকে বর্তমানে ${historyContact.assigned_to_name} সাপোর্ট দিচ্ছেন।`}
                          title={isAssignedToMe ? "আপনার দায়িত্বে রয়েছে" : "অ্যাসাইন করা টিম মেম্বার"}
                          description={
                            isAssignedToMe
                              ? "এই কাস্টমারের দায়িত্ব বর্তমানে আপনার কাছে রয়েছে।"
                              : `এই কাস্টমারকে বর্তমানে ${historyContact.assigned_to_name} (${formatCompactRoleTitle(historyContact.assigned_to_role || "")}) সাপোর্ট দিচ্ছেন।`
                          }
                          showIcon={false}
                        >
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 cursor-help">
                            দায়িত্বে: {historyContact.assigned_to_name}
                            {historyContact.assigned_to_role
                              ? ` (${historyContact.assigned_to_role})`
                              : ""}
                          </span>
                          {isAssignedToMe ? (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs cursor-help">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>আপনার দায়িত্বে</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 cursor-help">
                              দায়িত্বে: {historyContact.assigned_to_name}
                            </span>
                          )}
                        </OptionTooltip>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-2 mt-0.5">
                      <span
                        className={`w-2 h-2 rounded-full ${historyContact?.is_auto_reply_enabled &&
                          !historyContact?.is_human_needed
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-amber-500"
                          }`}
                      />
                      <span>
                        {historyContact?.is_auto_reply_enabled &&
                          !historyContact?.is_human_needed
                          ? "অটো-রিপ্লাই সচল রয়েছে"
                          : "ম্যানুয়াল কাস্টমার কেয়ার মোড"}
                      </span>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700">
                          {historyContact?.agent_name || historyContact?.platform}
                        </span>
                        {activeContactDotCount > 0 && (
                          <div
                            className="flex items-center gap-0.5"
                            title={`অ্যাকাউন্ট #${activeContactDotCount}${historyContact?.agent_name
                              ? ` (${historyContact.agent_name})`
                              : ""
                              }`}
                          >
                            {Array.from({ length: activeContactDotCount }).map(
                              (_, dIdx) => (
                                <span
                                  key={dIdx}
                                  className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.8)] ring-1 ring-emerald-300/40"
                                />
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </p>
                  </div>
                </div>

                {/* Action Buttons in Header: Claim, Forward, Resolve, Settings */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* 1-Click Claim Button */}
                  {/* Active Talking / Claim Mode Button */}
                  {hasTeam && canForwardAssign && (
                    isAssignedToMe ? (
                      <span
                        title="আপনি বর্তমানে এই কাস্টমারের সাথে কথা বলছেন এবং সাপোর্ট প্রদান করছেন।"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-black shadow-xs cursor-default"
                      >
                        <HandRaisedIcon className="h-4 w-4" />
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>আপনি কথা বলছেন</span>
                      </span>
                    ) : (
                      <OptionTooltip
                        title="নিজে দায়িত্ব নিন (Claim Chat)"
                        description="১-ক্লিকে এই কাস্টমারকে নিজের নামে নিয়ে কথা বলা শুরু করুন।"
                        showIcon={false}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleClaimChat(historyContact.id, e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold shadow-2xs transition active:scale-95"
                        >
                          <HandRaisedIcon className="h-4 w-4 text-indigo-600" />
                          <span>আমি কথা বলব</span>
                        </button>
                      </OptionTooltip>
                    )
                  )}

                  {/* Forward to Team Member Button */}
                  {hasTeam && canForwardAssign && (
                    <OptionTooltip
                      title="টিম মেম্বারের কাছে ফরওয়ার্ড করুন"
                      description="অন্য কোনো টিম মেম্বারকে নির্দেশনা বা নোটসহ এই কাস্টমারের মেসেজটি পাঠিয়ে দিন অথবা অটো-অ্যাসাইন করুন।"
                      showIcon={false}
                    >
                      <button
                        type="button"
                        onClick={() => openForwardModal(historyContact)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow-indigo-500/20 transition"
                      >
                        <UserPlusIcon className="h-4 w-4" />
                        <span>ফরওয়ার্ড</span>
                      </button>
                    </OptionTooltip>
                  )}

                  {/* Resolve Button when waiting, assigned, or in manual mode */}
                  {(historyContact?.is_human_needed ||
                    !historyContact?.is_auto_reply_enabled ||
                    activeContactWaitingSec > 0 ||
                    historyContact?.support_status === "in_progress" ||
                    isAssignedToMe ||
                    Boolean(historyContact?.assigned_to_name)) && (
                      <OptionTooltip
                        title="সমাধান সম্পন্ন (Mark Resolved)"
                        description="কাস্টমারের সাথে কথা শেষ হলে এটি চাপুন। এতে ওয়েটিং টাইমার ও ফরওয়ার্ড দায়িত্ব শেষ হবে এবং পুনরায় অটো-রিপ্লাই চালু হবে।"
                        showIcon={false}
                        align="right"
                      >
                        <button
                          type="button"
                          onClick={(e) => resolveHandoff(historyContact.id, e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-emerald-500/20 transition cursor-pointer"
                        >
                          <CheckBadgeIcon className="h-4 w-4" />
                          <span>সমাধান সম্পন্ন</span>
                        </button>
                      </OptionTooltip>
                    )}

                  <OptionTooltip
                    title="কাস্টমার সেটিংস"
                    description="এই কাস্টমারের জন্য আলাদা নির্দেশনা বা অটো-রিপ্লাই সেটিংস পরিবর্তন করুন।"
                    showIcon={false}
                    align="right"
                  >
                    <button
                      type="button"
                      onClick={() => openSettings(historyContact)}
                      className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition shadow-2xs border border-transparent hover:border-slate-200"
                    >
                      <EllipsisVerticalIcon className="h-5 w-5" />
                    </button>
                  </OptionTooltip>

                  {/* Fullscreen Toggle Button */}
                  <OptionTooltip
                    title={isFullscreen ? "স্বাভাবিক ভিউ" : "ফুলস্ক্রিন ভিউ"}
                    description="চ্যাট উইন্ডো বড় করে পুরো স্ক্রিনে দেখুন বা স্বাভাবিক মোডে ফিরুন।"
                    showIcon={false}
                    align="right"
                  >
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition shadow-2xs border border-transparent hover:border-slate-200"
                      title={isFullscreen ? "স্বাভাবিক ভিউ" : "ফুলস্ক্রিন ভিউ"}
                    >
                      {isFullscreen ? (
                        <ArrowsPointingInIcon className="h-5 w-5" />
                      ) : (
                        <ArrowsPointingOutIcon className="h-5 w-5" />
                      )}
                    </button>
                  </OptionTooltip>

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition shadow-2xs border border-transparent hover:border-rose-100"
                    title="চ্যাট বক্স বন্ধ করুন"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Forward & Assignment Banner (Always shows clearly when assigned or forwarded) */}
              {hasTeam && (historyContact?.assigned_to_name || historyContact?.assignment_note) && (
                <div
                  className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs transition-all ${isAssignedToMe
                    ? "bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white border-emerald-200 text-emerald-950"
                    : "bg-gradient-to-r from-amber-50/90 via-orange-50/30 to-white border-amber-200 text-amber-950"
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className={`p-1.5 rounded-xl shrink-0 ${isAssignedToMe
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                        }`}
                    >
                      <UserPlusIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs">
                          {isAssignedToMe
                            ? "🎯 এই চ্যাটটি আপনার দায়িত্বে রয়েছে"
                            : `👤 দায়িত্বে: ${historyContact.assigned_to_name}`}
                        </span>
                        {historyContact.assigned_by_name && (
                          <span className="text-[11px] font-semibold text-slate-500">
                            (ফরওয়ার্ড করেছেন:{" "}
                            <strong className="text-slate-700">
                              {historyContact.assigned_by_name}
                            </strong>
                            )
                          </span>
                        )}
                        {historyContact.assigned_department && (
                          <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-white/80 border border-slate-200 text-slate-700">
                            {formatDepartmentBadge(
                              historyContact.assigned_department
                            )}
                          </span>
                        )}
                      </div>
                      {historyContact.assignment_note ? (
                        <p className="text-[11px] font-medium text-slate-800 mt-0.5">
                          <strong className="text-slate-600">নির্দেশনা:</strong>{" "}
                          <span className="italic">
                            "{historyContact.assignment_note}"
                          </span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500 mt-0.2">
                          {isAssignedToMe
                            ? "কাস্টমারের সাথে সরাসরি কথা বলে প্রয়োজনীয় সাপোর্ট নিশ্চিত করুন।"
                            : "টিম মেম্বার এই চ্যাটটি সক্রিয়ভাবে হ্যান্ডেল করছেন।"}
                        </p>
                      )}
                    </div>
                  </div>
                  {historyContact.assigned_department && (
                    <span className="text-[10px] font-black bg-amber-200/60 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300 shrink-0">
                      {formatDepartmentBadge(
                        historyContact.assigned_department
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Messages Timeline (Clean Modern SaaS Studio - No WhatsApp Wallpaper) */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-3 bg-gradient-to-b from-slate-50/60 via-slate-50/20 to-white">
                {hasMoreHistory && (
                  <div
                    ref={lastMessageElementRef}
                    className="flex justify-center p-2"
                  >
                    {historyLoading ? (
                      <ArrowPathIcon className="h-5 w-5 text-indigo-600 animate-spin" />
                    ) : (
                      <span className="text-xs bg-white/95 px-3.5 py-1.5 rounded-full shadow-xs border border-slate-200 text-indigo-600 hover:text-indigo-800 cursor-pointer font-bold transition">
                        পূর্ববর্তী মেসেজ লোড করুন
                      </span>
                    )}
                  </div>
                )}

                {historyMessages.map((msg, index) =>
                  renderMessageItem(msg, index)
                )}
                <div ref={messagesEndRefDesktop} />
              </div>

              {/* Desktop Reply & Internal Note Composer Dock */}
              <div
                className={`p-3.5 border-t transition-all ${hasTeam && replyMode === "note"
                  ? "bg-amber-50/90 border-amber-200"
                  : "bg-white/95 backdrop-blur-md border-slate-100"
                  }`}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  {hasTeam && canWriteInternalNotes ? (
                    <div className="inline-flex rounded-xl bg-slate-100/80 p-0.5 border border-slate-200/80 shadow-2xs text-xs font-bold">
                      <OptionTooltip
                        title="কাস্টমারকে সরাসরি উত্তর"
                        description="এখানে যা লিখবেন তা সরাসরি কাস্টমারের মেসেঞ্জার/হোয়াটসঅ্যাপে চলে যাবে এবং অটো-রিপ্লাই বন্ধ হয়ে ম্যানুয়াল মোড চালু হবে।"
                        showIcon={false}
                        align="left"
                      >
                        <button
                          type="button"
                          onClick={() => setReplyMode("reply")}
                          className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${replyMode === "reply"
                            ? "bg-indigo-600 text-white shadow-xs font-black"
                            : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                          কাস্টমারকে উত্তর দিন
                        </button>
                      </OptionTooltip>

                      <OptionTooltip
                        title="গোপন টিম নোট (Internal Whisper)"
                        description="এখানে যা লিখবেন তা শুধু আপনার টিম মেম্বাররা চ্যাটের ভেতর দেখতে পাবেন। কাস্টমারের কাছে এটি কখনোই যাবে না।"
                        showIcon={false}
                      >
                        <button
                          type="button"
                          onClick={() => setReplyMode("note")}
                          className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${replyMode === "note"
                            ? "bg-amber-500 text-white shadow-xs font-black"
                            : "text-amber-800 hover:bg-amber-100/50"
                            }`}
                        >
                          <LockClosedIcon className="w-3.5 h-3.5" />
                          টিম নোট (কাস্টমার দেখবে না)
                        </button>
                      </OptionTooltip>
                    </div>
                  ) : (
                    <div />
                  )}

                  {canToggleAutoReply && (
                    <OptionTooltip
                      title="অটো-রিপ্লাই সুইচ"
                      description="আপনি নিজে কথা বলতে চাইলে অটো-রিপ্লাই বন্ধ রাখুন। কথা শেষ হলে আবার চালু করে দিন।"
                      showIcon={false}
                      align="right"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleAutoReply(historyContact.id, e)}
                        className={`text-[11px] font-bold px-3 py-1 rounded-xl border transition-all cursor-pointer ${historyContact?.is_auto_reply_enabled &&
                          !historyContact?.is_human_needed
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs"
                          }`}
                      >
                        {historyContact?.is_auto_reply_enabled &&
                          !historyContact?.is_human_needed
                          ? "🟢 অটো-রিপ্লাই: চালু"
                          : "⚪ অটো-রিপ্লাই: বন্ধ (চালু করতে ক্লিক করুন)"}
                      </button>
                    </OptionTooltip>
                  )}
                </div>

                <div className="flex items-end gap-2.5">
                  <div
                    className={`flex-1 rounded-2xl flex items-end p-2.5 border shadow-2xs transition-all ${hasTeam && replyMode === "note"
                      ? "bg-amber-50/80 border-amber-300 focus-within:ring-2 focus-within:ring-amber-400/30"
                      : "bg-slate-50/60 focus-within:bg-white border-slate-200/90 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400"
                      }`}
                  >
                    <textarea
                      placeholder={
                        hasTeam && replyMode === "note"
                          ? "টিম মেম্বারদের জন্য গোপন নোট লিখুন (এটি কাস্টমারের কাছে যাবে না)..."
                          : "কাস্টমারকে মেসেজ লিখুন..."
                      }
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={1}
                      className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm py-1 px-2 resize-none max-h-32 text-slate-900 font-medium placeholder-slate-400"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyText.trim()}
                    className={`p-3 rounded-2xl transition-all duration-200 flex items-center justify-center shrink-0 shadow-md ${replyText.trim() && !sendingReply
                      ? replyMode === "note"
                        ? "bg-amber-600 hover:bg-amber-700 text-white hover:scale-105 active:scale-95 shadow-amber-500/20"
                        : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white hover:scale-105 active:scale-95 shadow-indigo-500/25"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                      }`}
                  >
                    {sendingReply ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <PaperAirplaneIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MOBILE CHAT OVERLAY (Modern Slate Studio) */}
      {isModalOpen && historyContact && (
        <div className="fixed inset-0 z-[200] md:hidden flex flex-col bg-slate-50 h-full w-full overflow-hidden">
          {/* Mobile Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex flex-col gap-2 shrink-0 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 -ml-1 text-slate-300 hover:text-white rounded-full transition"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>

              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <CustomerAvatar
                    contact={historyContact}
                    size="w-9 h-9"
                    textSize="text-sm"
                    rounded="rounded-xl"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-slate-900 shadow-2xs overflow-hidden shrink-0 flex items-center justify-center bg-white">
                    <PlatformLogo
                      platform={historyContact?.platform}
                      className="w-full h-full"
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-sm truncate text-white leading-tight">
                    {historyContact?.name ||
                      historyContact?.push_name ||
                      historyContact?.identifier}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300 truncate">
                    <span>
                      {historyContact?.assigned_to_name
                        ? `দায়িত্বে: ${historyContact.assigned_to_name}`
                        : historyContact?.is_auto_reply_enabled &&
                          !historyContact?.is_human_needed
                          ? "অটো-রিপ্লাই চালু"
                          : "ম্যানুয়াল মোড"}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="font-semibold text-slate-200">
                      {historyContact?.agent_name || historyContact?.platform}
                    </span>
                    {activeContactDotCount > 0 && (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: activeContactDotCount }).map(
                          (_, dIdx) => (
                            <span
                              key={dIdx}
                              className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.8)]"
                            />
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {hasTeam && canForwardAssign && (
                  <button
                    type="button"
                    onClick={() => openForwardModal(historyContact)}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white flex items-center gap-1"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    ফরওয়ার্ড
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openSettings(historyContact)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-full"
                >
                  <EllipsisVerticalIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Mobile Quick Bar for Waiting Time / Claim / Resolve */}
            {(activeContactWaitingBadge ||
              (hasTeam && canForwardAssign) ||
              historyContact?.is_human_needed ||
              activeContactWaitingSec > 0) && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    {activeContactWaitingBadge && (
                      <span className="bg-rose-500 text-white font-black px-2 py-0.5 rounded-full text-[10px]">
                        ⏱ {activeContactWaitingBadge.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasTeam && canForwardAssign && (
                      isAssignedToMe ? (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-lg font-bold text-[10px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          আপনি কথা বলছেন
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleClaimChat(historyContact.id, e)}
                          className="bg-white/15 px-2.5 py-1 rounded-lg font-bold text-white text-[11px]"
                        >
                          আমি কথা বলব
                        </button>
                      )
                    )}
                    {(historyContact?.is_human_needed ||
                      !historyContact?.is_auto_reply_enabled ||
                      activeContactWaitingSec > 0 ||
                      historyContact?.support_status === "in_progress" ||
                      isAssignedToMe ||
                      Boolean(historyContact?.assigned_to_name)) && (
                        <button
                          type="button"
                          onClick={(e) => resolveHandoff(historyContact.id, e)}
                          className="bg-emerald-600 px-2.5 py-1 rounded-lg font-bold text-white text-[11px]"
                        >
                          সমাধান সম্পন্ন
                        </button>
                      )}
                  </div>
                </div>
              )}
          </div>

          {/* Mobile Forward & Assignment Banner */}
          {hasTeam && (historyContact?.assigned_to_name || historyContact?.assignment_note) && (
            <div
              className={`px-3 py-2 border-b flex items-center gap-2 text-xs shrink-0 ${isAssignedToMe
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : "bg-amber-50 border-amber-200 text-amber-950"
                }`}
            >
              <UserPlusIcon
                className={`w-4 h-4 shrink-0 ${isAssignedToMe ? "text-emerald-700" : "text-amber-700"
                  }`}
              />
              <div className="min-w-0 text-[11px] leading-tight">
                <span className="font-black">
                  {isAssignedToMe
                    ? "🎯 আপনার দায়িত্বে"
                    : `👤 দায়িত্বে: ${historyContact.assigned_to_name}`}
                </span>
                {historyContact.assigned_by_name && (
                  <span className="text-slate-500 ml-1">
                    (প্রেরক: {historyContact.assigned_by_name})
                  </span>
                )}
                {historyContact.assignment_note && (
                  <p className="italic text-slate-700 mt-0.5 truncate">
                    "{historyContact.assignment_note}"
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Mobile Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 bg-slate-50">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2 text-xs">
                <ArrowPathIcon className="h-6 w-6 animate-spin text-indigo-600" />
                <span>মেসেজ লোড হচ্ছে...</span>
              </div>
            ) : historyMessages.length > 0 ? (
              historyMessages.map((msg, index) =>
                renderMessageItem(msg, index)
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
                <p>কোনো পূর্ববর্তী বার্তা নেই</p>
              </div>
            )}
            <div ref={messagesEndRefMobile} />
          </div>

          {/* Mobile Reply Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendReply();
            }}
            className="p-3 bg-white border-t border-slate-200 flex flex-col gap-2 shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]"
          >
            {hasTeam && canWriteInternalNotes && (
              <div className="flex gap-1.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setReplyMode("reply")}
                  className={`px-3 py-1 rounded-lg font-black transition ${replyMode === "reply"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600"
                    }`}
                >
                  কাস্টমার রিপ্লাই
                </button>
                <button
                  type="button"
                  onClick={() => setReplyMode("note")}
                  className={`px-3 py-1 rounded-lg font-black transition ${replyMode === "note"
                    ? "bg-amber-500 text-white"
                    : "bg-slate-100 text-amber-800"
                    }`}
                >
                  টিম নোট (গোপন)
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={
                  hasTeam && replyMode === "note"
                    ? "টিম নোট লিখুন (কাস্টমার দেখবে না)..."
                    : "মেসেজ লিখুন..."
                }
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm border focus:outline-none shadow-2xs ${replyMode === "note"
                  ? "bg-amber-50 border-amber-300"
                  : "bg-slate-50 border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                  }`}
              />
              <button
                type="submit"
                disabled={sendingReply || !replyText.trim()}
                className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 shadow-sm ${replyText.trim() && !sendingReply
                  ? replyMode === "note"
                    ? "bg-amber-600 text-white shadow-amber-500/20"
                    : "bg-indigo-600 text-white shadow-indigo-500/25"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
              >
                {sendingReply ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <PaperAirplaneIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FORWARD / ASSIGN CONVERSATION MODAL */}
      {isForwardModalOpen && historyContact && (
        <div className="fixed inset-0 z-[320] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="font-extrabold text-slate-900 text-base">
                  টিম মেম্বারের কাছে মেসেজ ফরওয়ার্ড করুন
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  কাস্টমার:{" "}
                  <span className="font-bold text-slate-800">
                    {historyContact.name || historyContact.identifier}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setIsForwardModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleForwardSubmit} className="p-5 space-y-4">
              {/* Mode Tabs */}
              <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <OptionTooltip
                  title="নির্দিষ্ট মেম্বার"
                  description="তালিকা থেকে আপনার পছন্দের যেকোনো একজন টিম মেম্বারকে বেছে নিয়ে তার কাছে চ্যাটটি পাঠান।"
                  showIcon={false}
                  align="left"
                >
                  <button
                    type="button"
                    onClick={() => setForwardMode("assign")}
                    className={`w-full py-2 rounded-lg transition ${forwardMode === "assign"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600"
                      }`}
                  >
                    নির্দিষ্ট মেম্বার
                  </button>
                </OptionTooltip>

                <OptionTooltip
                  title="অটো-অ্যাসাইন (Load Balanced)"
                  description="যারা বর্তমানে অনলাইনে আছেন এবং যার হাতে সবচেয়ে কম চ্যাট আছে, সিস্টেম স্বয়ংক্রিয়ভাবে তার কাছে পাঠিয়ে দেবে।"
                  showIcon={false}
                >
                  <button
                    type="button"
                    onClick={() => setForwardMode("auto")}
                    className={`w-full py-2 rounded-lg transition ${forwardMode === "auto"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600"
                      }`}
                  >
                    অটো-অ্যাসাইন (ফ্রি)
                  </button>
                </OptionTooltip>

                <OptionTooltip
                  title="আন-অ্যাসাইন (Unassign)"
                  description="নির্দিষ্ট মেম্বারের কাছ থেকে সরিয়ে সাধারণ অপেক্ষমাণ তালিকায় রাখুন যাতে যেকোনো ফ্রি এজেন্ট নিতে পারে।"
                  showIcon={false}
                  align="right"
                >
                  <button
                    type="button"
                    onClick={() => setForwardMode("unassign")}
                    className={`w-full py-2 rounded-lg transition ${forwardMode === "unassign"
                      ? "bg-white text-rose-700 shadow-xs"
                      : "text-slate-600"
                      }`}
                  >
                    আন-অ্যাসাইন
                  </button>
                </OptionTooltip>
              </div>

              {forwardMode === "assign" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    কাকে দায়িত্ব দিতে চান নির্বাচন করুন
                  </label>
                  {(teamMembers?.length || 0) === 0 ? (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                      <p className="font-bold">
                        আপনার ওয়ার্কস্পেসে এখনো কোনো টিম মেম্বার যুক্ত করা হয়নি।
                      </p>
                      <Link
                        href="/dashboard/team"
                        className="inline-flex items-center gap-1 text-indigo-700 font-extrabold underline"
                      >
                        + এখানে ক্লিক করে টিম মেম্বার যুক্ত করুন
                      </Link>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {teamMembers.map((m) => {
                        const selected =
                          String(forwardMemberId) === String(m.id);
                        return (
                          <label
                            key={m.id}
                            onClick={() => setForwardMemberId(String(m.id))}
                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${selected
                              ? "bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-500"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${m.availability_status === "online"
                                  ? "bg-emerald-500"
                                  : m.availability_status === "busy"
                                    ? "bg-amber-500"
                                    : "bg-gray-400"
                                  }`}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {m.name}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {m.custom_role_name || m.role_title} •{" "}
                                  {formatDepartmentBadge(m.department)}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                              সক্রিয় চ্যাট: {m.active_chats_count || 0}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {forwardMode === "auto" && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                  <p className="font-bold">
                    স্বয়ংক্রিয় বণ্টন (Load-Balanced Auto Assign)
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    যারা বর্তমানে অনলাইনে আছেন এবং যাদের হাতে সবচেয়ে কম চ্যাট
                    রয়েছে, সিস্টেম স্বয়ংক্রিয়ভাবে তাদের মধ্য থেকে একজনকে এই
                    কাস্টমারের দায়িত্ব দেবে।
                  </p>
                  <div className="pt-1">
                    <label className="text-[11px] font-bold block mb-1">
                      নির্দিষ্ট বিভাগ (ঐচ্ছিক):
                    </label>
                    <select
                      value={forwardDepartment}
                      onChange={(e) => setForwardDepartment(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold"
                    >
                      <option value="">যেকোনো বিভাগ / সকল বিভাগ</option>
                      <option value="support">কাস্টমার সাপোর্ট</option>
                      <option value="sales">সেলস ও অর্ডার</option>
                      <option value="delivery">ডেলিভারি ও কুরিয়ার</option>
                      <option value="billing">হিসাব ও রিফান্ড</option>
                      <option value="general">সাধারণ বিভাগ</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Instruction Note for the Team Member */}
              <div className="space-y-1.5">
                <OptionTooltip
                  title="টিম মেম্বারের জন্য নির্দেশনা"
                  description="যাকে মেসেজটি ফরওয়ার্ড করছেন তাকে কোনো বিশেষ নির্দেশনা দিতে চাইলে এখানে লিখুন। কাস্টমার এটি দেখবে না।"
                >
                  <label className="text-xs font-bold text-slate-700 block">
                    টিম মেম্বারের জন্য নির্দেশনা / নোট (কাস্টমার দেখবে না)
                  </label>
                </OptionTooltip>
                <textarea
                  value={forwardNote}
                  onChange={(e) => setForwardNote(e.target.value)}
                  placeholder="যেমন: উনার অর্ডার #১০৪২ এর কুরিয়ার স্ট্যাটাসটা চেক করে জানান..."
                  rows={3}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForwardModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={
                    submittingForward ||
                    (forwardMode === "assign" && !forwardMemberId)
                  }
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingForward && (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  )}
                  <span>
                    {forwardMode === "unassign"
                      ? "আন-অ্যাসাইন করুন"
                      : "ফরওয়ার্ড নিশ্চিত করুন"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTACT SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="font-bold text-gray-900">কাস্টমার সেটিংস</h2>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    অটো-রিপ্লাই (Auto Reply)
                  </h3>
                  <p className="text-xs text-gray-500">
                    এই কাস্টমারের জন্য স্বয়ংক্রিয় উত্তর চালু বা বন্ধ করুন।
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      is_auto_reply_enabled: !prev.is_auto_reply_enabled,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settingsForm.is_auto_reply_enabled
                    ? "bg-indigo-600"
                    : "bg-gray-200"
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settingsForm.is_auto_reply_enabled
                      ? "translate-x-5"
                      : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900 flex justify-between">
                  কাস্টমার স্পেসিফিক নির্দেশনা (Prompt)
                  <span className="text-xs font-normal text-gray-400">
                    (ঐচ্ছিক)
                  </span>
                </label>
                <textarea
                  value={settingsForm.custom_prompt}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      custom_prompt: e.target.value,
                    }))
                  }
                  placeholder="যেমন: ইনি আমাদের পাইকারি কাস্টমার, সবসময় পাইকারি রেট বলবেন।"
                  className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900 flex justify-between">
                  অতিরিক্ত নোট / নির্দেশনা
                  <span className="text-xs font-normal text-gray-400">
                    (ঐচ্ছিক)
                  </span>
                </label>
                <textarea
                  value={settingsForm.custom_instructions}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      custom_instructions: e.target.value,
                    }))
                  }
                  placeholder="অতিরিক্ত কোনো নিয়ম থাকলে লিখুন..."
                  className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                disabled={savingSettings}
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md hover:shadow-indigo-500/25 disabled:opacity-50 flex items-center gap-2"
              >
                {savingSettings && (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                )}
                সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

