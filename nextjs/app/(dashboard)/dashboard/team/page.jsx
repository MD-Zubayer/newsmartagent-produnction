"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  UsersIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  AdjustmentsHorizontalIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import OptionTooltip from "../../../../components/OptionTooltip";

const PAGE_PERMISSION_ITEMS = [
  {
    key: "inbox",
    title: "মেসেজ ও কমেন্ট ইনবক্স (Contacts / Inbox)",
    desc: "কাস্টমারের মেসেজ দেখা ও কথা বলার পেজ",
    tooltip:
      "এটি চালু থাকলে টিম মেম্বার বাম পাশের সাইডবারে 'Contacts' পেজটি দেখতে পাবেন এবং ফেসবুক, হোয়াটসঅ্যাপ ও অন্যান্য চ্যানেলের মেসেজ ও কমেন্ট দেখতে পারবেন।",
  },
  {
    key: "orders",
    title: "অর্ডার ম্যানেজমেন্ট (Orders)",
    desc: "সব অর্ডার দেখা ও প্রসেস করার পেজ",
    tooltip:
      "এটি চালু থাকলে স্টাফ অর্ডার লিস্ট পেজে যেতে পারবেন, নতুন অর্ডার দেখতে ও প্রসেস করতে পারবেন।",
  },
  {
    key: "customers",
    title: "কাস্টমার তালিকা (Customers)",
    desc: "কাস্টমারদের প্রোফাইল ও পূর্বের অর্ডার হিস্ট্রি",
    tooltip:
      "এটি চালু থাকলে স্টাফ সব কাস্টমারের তালিকা, ফোন নম্বর, ঠিকানা এবং কে আগে কয়টি অর্ডার করেছেন তা দেখতে পারবেন।",
  },
  {
    key: "products",
    title: "প্রোডাক্ট ও অফার পেজ (Products & Offers)",
    desc: "পণ্য তালিকা, স্টক এবং প্রমোশনাল অফার পেজ",
    tooltip:
      "এটি চালু থাকলে প্রোডাক্ট ক্যাটালগ পেজে প্রবেশ করতে পারবেন। তবে কেনা দাম বা লাভ দেখতে পারবেন কি না তা নিচের কাজের পারমিশন থেকে নিয়ন্ত্রণ করা যাবে।",
  },
  {
    key: "crm",
    title: "স্মার্ট সিআরএম (Smart CRM)",
    desc: "লিড ট্র্যাকিং ও ফলো-আপ পাইপলাইন",
    tooltip:
      "পটেনশিয়াল কাস্টমার বা লিডদের কোন পর্যায়ে আছে (New, Interested, Follow-up) তা ট্র্যাক করার পেজ।",
  },
  {
    key: "spreadsheet",
    title: "ডাটাশিট / স্প্রেডশিট (Spreadsheet)",
    desc: "টেবিল আকারে ডাটা ও শিট ম্যানেজমেন্ট",
    tooltip:
      "এক্সেল বা গুগল শিটের মতো ডাটাশিট পেজ ব্যবহার করার অনুমতি।",
  },
  {
    key: "image_gallery",
    title: "ইমেজ গ্যালারি (Image Gallery)",
    desc: "প্রোডাক্টের ছবি আপলোড ও গ্যালারি ব্যবহার",
    tooltip:
      "প্রোডাক্টের ছবি আপলোড করা এবং গ্যালারি থেকে ছবি বাছাই করার পেজ।",
  },
  {
    key: "overview",
    title: "ড্যাশবোর্ড ওভারভিউ (Overview)",
    desc: "মূল ড্যাশবোর্ডের সারসংক্ষেপ দেখা",
    tooltip:
      "ড্যাশবোর্ডের মূল সামারি কার্ড এবং অ্যানালিটিক্স চার্ট দেখার অনুমতি।",
  },
  {
    key: "finance",
    title: "হিসাব ও লাভ-ক্ষতি (Finance & Profit)",
    desc: "ব্যবসার আয়-ব্যয় ও লাভের রিপোর্ট (সংবেদনশীল)",
    tooltip:
      "ব্যবসার মোট বিক্রি, পণ্যের ক্রয় খরচ এবং নিট লাভের আর্থিক হিসাব দেখার পেজ। সাধারণ স্টাফদের জন্য এটি বন্ধ রাখা নিরাপদ।",
    sensitive: true,
  },
  {
    key: "saving",
    title: "সেভিং ও ক্যাশবুক (Saving)",
    desc: "ব্যবসার জমানো টাকা ও ফান্ডের হিসাব (সংবেদনশীল)",
    tooltip:
      "ব্যবসার ক্যাশবুক এবং সেভিংস ফান্ডের হিসাব দেখার পেজ। শুধু মালিক বা অ্যাকাউন্ট্যান্টের জন্য প্রযোজ্য।",
    sensitive: true,
  },
  {
    key: "ai_agent",
    title: "অটোমেশন ও চ্যানেল কনফিগারেশন (Agent Setup)",
    desc: "চ্যানেল সেটআপ ও সিস্টেম প্রম্পট পরিবর্তন",
    tooltip:
      "অটো-রিপ্লাই কীভাবে কাজ করবে, মেইন সিস্টেম প্রম্পট ও নিয়মকানুন পরিবর্তন করার পেজ।",
    sensitive: true,
  },
  {
    key: "connect",
    title: "সোশ্যাল পেজ কানেক্ট (Connect Pages)",
    desc: "ফেসবুক, হোয়াটসঅ্যাপ ও টেলিগ্রাম কানেকশন",
    tooltip:
      "নতুন ফেসবুক পেজ, ইনস্টাগ্রাম, ইউটিউব বা হোয়াটসঅ্যাপ নম্বর সংযুক্ত ও বিচ্ছিন্ন করার পেজ।",
    sensitive: true,
  },
  {
    key: "payments",
    title: "বিলিং ও সাবস্ক্রিপশন (Payments)",
    desc: "প্যাকেজ রিনিউ ও পেমেন্ট হিস্ট্রি",
    tooltip:
      "সফটওয়্যারের সাবস্ক্রিপশন প্যাকেজ কেনা, রিনিউ এবং পেমেন্ট হিস্ট্রি দেখার পেজ।",
    sensitive: true,
  },
  {
    key: "team",
    title: "টিম ও রোল ম্যানেজমেন্ট (Team Management)",
    desc: "নতুন স্টাফ যোগ করা ও রোল পরিবর্তন করা",
    tooltip:
      "নতুন টিম মেম্বার যোগ করা, রিমুভ করা এবং অন্যদের পারমিশন পরিবর্তন করার পেজ।",
    sensitive: true,
  },
  {
    key: "settings",
    title: "অ্যাকাউন্ট ও সিকিউরিটি সেটিংস (Settings)",
    desc: "পাসওয়ার্ড ও মূল প্রোফাইল সেটিংস",
    tooltip:
      "মূল ব্যবসার অ্যাকাউন্ট সেটিংস ও সিকিউরিটি অপশন পরিবর্তন করার পেজ।",
    sensitive: true,
  },
];

const TASK_PERMISSION_GROUPS = [
  {
    groupTitle: "১. কাস্টমার ইনবক্স ও মেসেজিং (Inbox Tasks)",
    groupTooltip:
      "ইনবক্সের ভেতর কাস্টমারদের সাথে চ্যাট করার সময় কোন কোন বাটন ও কাজ স্টাফ ব্যবহার করতে পারবেন তা নির্ধারণ করুন।",
    items: [
      {
        key: "inbox_view_all_chats",
        title: "সব কাস্টমারের চ্যাট দেখার অনুমতি",
        desc: "চালু থাকলে সব চ্যাট দেখবে; বন্ধ থাকলে শুধু নিজের কাছে অ্যাসাইন করা এবং অপেক্ষমাণ চ্যাট দেখবে",
        tooltip:
          "এটি চালু থাকলে স্টাফ দোকানের সব কাস্টমারের মেসেজ দেখতে পাবেন। আর বন্ধ রাখলে শুধু তার নিজের কাছে ফরওয়ার্ড করা চ্যাট এবং যারা হিউম্যান সাপোর্টের জন্য অপেক্ষা করছে তাদের চ্যাট দেখতে পাবেন।",
      },
      {
        key: "inbox_reply",
        title: "কাস্টমারকে মেসেজ ও কমেন্টের উত্তর দেওয়া",
        desc: "সরাসরি কাস্টমারকে রিপ্লাই পাঠাতে পারবে",
        tooltip:
          "এটি চালু থাকলে স্টাফ কাস্টমারকে সরাসরি মেসেজ বা কমেন্টের উত্তর পাঠাতে পারবেন। বন্ধ থাকলে শুধু চ্যাট পড়তে পারবেন কিন্তু রিপ্লাই দিতে পারবেন না।",
      },
      {
        key: "inbox_forward_assign",
        title: "মেসেজ ফরওয়ার্ড ও দায়িত্ব নেওয়া (Forward / Claim)",
        desc: "অন্য টিম মেম্বারের কাছে চ্যাট ফরওয়ার্ড করতে বা নিজে দায়িত্ব নিতে পারবে",
        tooltip:
          "চ্যাট হেডারের 'আমি কথা বলছি' এবং 'ফরওয়ার্ড' বাটন ব্যবহার করে কাস্টমারকে অন্য টিম মেম্বারের কাছে পাঠানোর অনুমতি।",
      },
      {
        key: "inbox_internal_notes",
        title: "টিম নোট লেখা (Internal Whisper Note)",
        desc: "চ্যাটের ভেতর টিমের জন্য গোপন নোট লিখতে পারবে",
        tooltip:
          "চ্যাটের ভেতর হলুদ রঙের গোপন টিম নোট লেখার অনুমতি, যা কাস্টমার কখনোই দেখতে পাবে না কিন্তু অন্য সহকর্মীরা দেখতে পাবেন।",
      },
      {
        key: "inbox_toggle_ai",
        title: "অটো-রিপ্লাই চালু / বন্ধ করা",
        desc: "কাস্টমারের অটো-রিপ্লাই পজ বা চালু করতে পারবে",
        tooltip:
          "কোনো নির্দিষ্ট কাস্টমারের জন্য স্বয়ংক্রিয় উত্তর (Auto Reply) বন্ধ করে ম্যানুয়াল মোডে নেওয়া বা পুনরায় চালু করার অনুমতি।",
      },
      {
        key: "inbox_edit_contact_prompt",
        title: "কাস্টমার স্পেসিফিক নির্দেশনা পরিবর্তন",
        desc: "নির্দিষ্ট কাস্টমারের জন্য আলাদা নির্দেশনা সেট করতে পারবে",
        tooltip:
          "নির্দিষ্ট কোনো কাস্টমারের সেটিংসে গিয়ে তার জন্য বিশেষ প্রম্পট বা নির্দেশনা যোগ করার অনুমতি।",
      },
    ],
  },
  {
    groupTitle: "২. অর্ডার ও কুরিয়ার ম্যানেজমেন্ট (Order Tasks)",
    groupTooltip:
      "অর্ডার কনফার্ম, এডিট, কুরিয়ারে বুকিং এবং ডিলিট করার ক্ষমতা নিয়ন্ত্রণ করুন।",
    items: [
      {
        key: "orders_view",
        title: "অর্ডার তালিকা দেখা",
        desc: "অর্ডারসমূহের বিস্তারিত তথ্য দেখতে পারবে",
        tooltip:
          "কাস্টমারের অর্ডারসমূহের বিস্তারিত তালিকা ও পণ্যের বিবরণ দেখার অনুমতি।",
      },
      {
        key: "orders_create_edit",
        title: "নতুন অর্ডার তৈরি ও এডিট করা",
        desc: "কাস্টমারের ঠিকানা, ফোন বা অর্ডারের তথ্য সংশোধন করতে পারবে",
        tooltip:
          "কাস্টমারের নাম, ঠিকানা, ফোন নম্বর বা অর্ডারের পণ্য পরিবর্তন ও সংশোধন করার অনুমতি।",
      },
      {
        key: "orders_change_status",
        title: "অর্ডারের স্ট্যাটাস পরিবর্তন (Confirm / Cancel / Delivered)",
        desc: "অর্ডার পেন্ডিং থেকে কনফার্ম বা ক্যান্সেল করতে পারবে",
        tooltip:
          "অর্ডার যাচাই করে Pending থেকে Confirmed, Processing, বা Cancelled স্ট্যাটাসে পরিবর্তন করার অনুমতি।",
      },
      {
        key: "orders_book_courier",
        title: "কুরিয়ারে পার্সেল বুকিং দেওয়া (Steadfast / Pathao / RedX)",
        desc: "১-ক্লিকে কুরিয়ারে অর্ডার পাঠাতে পারবে",
        tooltip:
          "ড্যাশবোর্ড থেকে সরাসরি Steadfast, Pathao বা RedX কুরিয়ারে পার্সেল এন্ট্রি ও বুকিং দেওয়ার অনুমতি।",
      },
      {
        key: "orders_delete",
        title: "অর্ডার মুছে ফেলা (Delete Order)",
        desc: "সিস্টেম থেকে যেকোনো অর্ডার ডিলিট করতে পারবে (সংবেদনশীল)",
        tooltip:
          "সতর্কতা: এটি চালু থাকলে স্টাফ যেকোনো অর্ডার ডাটাবেস থেকে স্থায়ীভাবে ডিলিট করে ফেলতে পারবেন।",
        sensitive: true,
      },
    ],
  },
  {
    groupTitle: "৩. প্রোডাক্ট, স্টক ও অফার (Product & Offer Tasks)",
    groupTooltip:
      "পণ্য যোগ করা, স্টক আপডেট, ডিসকাউন্ট অফার এবং পণ্যের গোপন কেনা দাম দেখার অনুমতি নিয়ন্ত্রণ করুন।",
    items: [
      {
        key: "products_view",
        title: "প্রোডাক্ট তালিকা দেখা",
        desc: "পণ্যের দাম, ছবি ও বিবরণ দেখতে পারবে",
        tooltip:
          "আপনার দোকানের সব পণ্যের ছবি, বিক্রয়মূল্য এবং স্টক দেখার অনুমতি।",
      },
      {
        key: "products_create_edit",
        title: "নতুন প্রোডাক্ট যোগ ও তথ্য এডিট করা",
        desc: "নতুন পণ্য তৈরি এবং বিক্রয়মূল্য ও বিবরণ আপডেট করতে পারবে",
        tooltip:
          "নতুন পণ্য ক্যাটালগে তোলা এবং পণ্যের নাম, বিবরণ, ছবি ও বিক্রয়মূল্য এডিট করার অনুমতি।",
      },
      {
        key: "products_update_stock",
        title: "স্টক পরিমাণ আপডেট করা (Stock Update)",
        desc: "পণ্যের স্টক বাড়াতে বা কমাতে পারবে",
        tooltip:
          "নতুন মাল আসলে বা স্টক শেষ হলে পণ্যের স্টক সংখ্যা আপডেট করার অনুমতি।",
      },
      {
        key: "products_manage_offers",
        title: "প্রমোশনাল অফার ও ডিসকাউন্ট তৈরি/বন্ধ করা",
        desc: "পণ্যে ছাড় বা কুপন অফার সেট ও এডিট করতে পারবে",
        tooltip:
          "১-ক্লিকে পণ্যের ওপর ডিসকাউন্ট, ফ্ল্যাশ সেল বা ফ্রি ডেলিভারি অফার চালু এবং বন্ধ করার অনুমতি।",
      },
      {
        key: "products_view_cost_profit",
        title: "পণ্যের কেনা দাম ও লাভ দেখা (Cost Price & Profit Margin)",
        desc: "বন্ধ থাকলে স্টাফ কখনোই পণ্যের আসল কেনা দাম বা লাভ দেখতে পাবে না",
        tooltip:
          "গুরুত্বপূর্ণ: এটি বন্ধ রাখলে আপনার স্টাফ প্রোডাক্ট আপলোড বা এডিট করলেও পণ্যের কেনা দাম (Cost Price) এবং প্রতি পিসে কত টাকা লাভ হচ্ছে তা কখনোই দেখতে পাবেন না।",
        sensitive: true,
      },
      {
        key: "products_delete",
        title: "প্রোডাক্ট ডিলিট করা",
        desc: "ক্যাটালগ থেকে পণ্য স্থায়ীভাবে মুছে ফেলতে পারবে (সংবেদনশীল)",
        tooltip:
          "সতর্কতা: এটি চালু থাকলে স্টাফ ক্যাটালগ থেকে যেকোনো প্রোডাক্ট ডিলিট করতে পারবেন।",
        sensitive: true,
      },
    ],
  },
];

const DEPARTMENT_LABELS = {
  all: "সকল বিভাগ (All Departments)",
  support: "কাস্টমার কেয়ার (Support)",
  sales: "সেলস টিম (Sales)",
  delivery: "অর্ডার ও ডেলিভারি (Delivery)",
  billing: "পেমেন্ট ও বিলিং (Billing)",
  general: "সাধারণ বিভাগ (General)",
};

function formatDepartmentLabel(dept) {
  if (!dept || dept === "all") return "সকল বিভাগ (All)";
  const parts = String(dept).split(",").map((d) => d.trim()).filter(Boolean);
  if (parts.length === 0 || parts.includes("all")) return "সকল বিভাগ (All)";
  return parts.map((p) => DEPARTMENT_LABELS[p] || p).join(", ");
}

export default function TeamManagementPage() {
  const { user } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState("members"); // 'members' | 'roles'
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [presets, setPresets] = useState({});
  const [agents, setAgents] = useState([]);

  // Member Add / Edit Modal
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [savingMember, setSavingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    phone_number: "",
    password: "",
    custom_role_id: "",
    department: "all",
    max_concurrent_chats: 15,
    allowed_agent_ids: [],
    use_custom_override: false,
    permissions_override: { pages: {}, tasks: {} },
  });

  // Role Create / Edit Modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    preset_key: "custom",
    permissions: { pages: {}, tasks: {} },
  });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, rolesRes, agentsRes] = await Promise.all([
        api.get("/team/members/"),
        api.get("/team/roles/"),
        api.get("/AgentAI/agents/"),
      ]);
      setMembers(
        Array.isArray(membersRes?.data?.members) ? membersRes.data.members : []
      );
      setRoles(Array.isArray(rolesRes?.data?.roles) ? rolesRes.data.roles : []);
      setPresets(rolesRes?.data?.presets || {});
      setAgents(Array.isArray(agentsRes?.data) ? agentsRes.data : []);
    } catch (err) {
      console.error("Failed to load team data:", err);
      toast.error("টিমের তথ্য লোড করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Open Member Modal (Add or Edit)
  const openAddMemberModal = () => {
    setEditingMember(null);
    const defaultRole = roles[0];
    setMemberForm({
      name: "",
      email: "",
      phone_number: "",
      password: "",
      custom_role_id: defaultRole ? String(defaultRole.id) : "",
      department: "all",
      max_concurrent_chats: 15,
      allowed_agent_ids: [],
      use_custom_override: false,
      permissions_override: defaultRole?.permissions || {
        pages: {},
        tasks: {},
      },
    });
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (member) => {
    setEditingMember(member);
    const hasOverride =
      member.permissions_override &&
      (Object.keys(member.permissions_override.pages || {}).length > 0 ||
        Object.keys(member.permissions_override.tasks || {}).length > 0);
    setMemberForm({
      name: member.name || "",
      email: member.email || "",
      phone_number: member.phone_number || "",
      password: "",
      custom_role_id: member.custom_role ? String(member.custom_role) : "",
      department: member.department || "all",
      max_concurrent_chats: member.max_concurrent_chats || 15,
      allowed_agent_ids: Array.isArray(member.allowed_agent_ids)
        ? member.allowed_agent_ids
        : [],
      use_custom_override: Boolean(hasOverride),
      permissions_override: member.effective_permissions || {
        pages: {},
        tasks: {},
      },
    });
    setIsMemberModalOpen(true);
  };

  const handleMemberRoleSelect = (roleIdStr) => {
    const selectedRole = roles.find((r) => String(r.id) === String(roleIdStr));
    setMemberForm((prev) => ({
      ...prev,
      custom_role_id: roleIdStr,
      permissions_override: selectedRole?.permissions
        ? JSON.parse(JSON.stringify(selectedRole.permissions))
        : prev.permissions_override,
    }));
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (!memberForm.email.trim()) {
      toast.error("টিম মেম্বারের জিমেইল / ইমেইল দিন");
      return;
    }
    setSavingMember(true);
    try {
      const payload = {
        id: editingMember?.id,
        name: memberForm.name.trim(),
        email: memberForm.email.trim(),
        phone_number: memberForm.phone_number.trim(),
        password: memberForm.password,
        custom_role_id: memberForm.custom_role_id
          ? Number(memberForm.custom_role_id)
          : null,
        department: memberForm.department,
        max_concurrent_chats: Number(memberForm.max_concurrent_chats || 15),
        allowed_agent_ids: memberForm.allowed_agent_ids,
        permissions_override: memberForm.use_custom_override
          ? memberForm.permissions_override
          : {},
      };

      if (editingMember) {
        await api.put("/team/members/", payload);
        toast.success("টিম মেম্বারের তথ্য আপডেট করা হয়েছে!");
      } else {
        await api.post("/team/members/", payload);
        toast.success(
          "টিম মেম্বার যুক্ত হয়েছে! এখন উনি গুগল দিয়ে সাইন-ইন করলেই ড্যাশবোর্ডে ঢুকতে পারবেন।"
        );
      }
      setIsMemberModalOpen(false);
      loadAllData();
    } catch (err) {
      toast.error(
        err.response?.data?.error || "টিম মেম্বার সেভ করতে সমস্যা হয়েছে।"
      );
    } finally {
      setSavingMember(false);
    }
  };

  const handleToggleMemberActive = async (member) => {
    try {
      await api.put("/team/members/", {
        id: member.id,
        is_active: !member.is_active,
      });
      toast.success(
        !member.is_active
          ? `${member.name}-এর অ্যাকাউন্ট সক্রিয় করা হয়েছে`
          : `${member.name}-এর অ্যাক্সেস সাময়িকভাবে বন্ধ করা হয়েছে`
      );
      loadAllData();
    } catch (err) {
      toast.error("স্ট্যাটাস পরিবর্তন করা যায়নি");
    }
  };

  const handleDeleteMember = async (member) => {
    if (
      !window.confirm(
        `আপনি কি নিশ্চিতভাবে "${member.name}"-কে আপনার টিম থেকে রিমুভ করতে চান?`
      )
    )
      return;
    try {
      await api.delete(`/team/members/?id=${member.id}`);
      toast.success("টিম মেম্বার রিমুভ করা হয়েছে।");
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || "রিমুভ করা যায়নি।");
    }
  };

  // Role Modal Handlers
  const openCreateRoleModal = (presetKey = "support_agent") => {
    setEditingRole(null);
    const presetObj =
      presets[presetKey] || Object.values(presets)[0] || { permissions: {} };
    setRoleForm({
      name: "",
      description: "",
      preset_key: presetKey,
      permissions: JSON.parse(
        JSON.stringify(presetObj.permissions || { pages: {}, tasks: {} })
      ),
    });
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name || "",
      description: role.description || "",
      preset_key: role.preset_key || "custom",
      permissions: JSON.parse(
        JSON.stringify(role.permissions || { pages: {}, tasks: {} })
      ),
    });
    setIsRoleModalOpen(true);
  };

  const applyPresetToRoleForm = (presetKey) => {
    const presetObj = presets[presetKey];
    if (!presetObj) return;
    setRoleForm((prev) => ({
      ...prev,
      preset_key: presetKey,
      name: prev.name || presetObj.name,
      description: prev.description || presetObj.description,
      permissions: JSON.parse(JSON.stringify(presetObj.permissions)),
    }));
    toast.success(`"${presetObj.name}" টেমপ্লেট লোড হয়েছে`);
  };

  const toggleRolePermission = (section, key) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [section]: {
          ...(prev.permissions?.[section] || {}),
          [key]: !prev.permissions?.[section]?.[key],
        },
      },
    }));
  };

  const toggleMemberOverridePermission = (section, key) => {
    setMemberForm((prev) => ({
      ...prev,
      permissions_override: {
        ...prev.permissions_override,
        [section]: {
          ...(prev.permissions_override?.[section] || {}),
          [key]: !prev.permissions_override?.[section]?.[key],
        },
      },
    }));
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      toast.error("রোলের নাম লিখুন");
      return;
    }
    setSavingRole(true);
    try {
      if (editingRole) {
        await api.put("/team/roles/", {
          id: editingRole.id,
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
          permissions: roleForm.permissions,
        });
        toast.success("কাস্টম রোল আপডেট করা হয়েছে!");
      } else {
        await api.post("/team/roles/", {
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
          preset_key: roleForm.preset_key,
          permissions: roleForm.permissions,
        });
        toast.success("নতুন কাস্টম রোল তৈরি হয়েছে!");
      }
      setIsRoleModalOpen(false);
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || "রোল সেভ করা যায়নি।");
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (
      !window.confirm(`আপনি কি নিশ্চিতভাবে "${role.name}" রোলটি মুছে ফেলতে চান?`)
    )
      return;
    try {
      await api.delete(`/team/roles/?id=${role.id}`);
      toast.success("রোল মুছে ফেলা হয়েছে।");
      loadAllData();
    } catch (err) {
      toast.error("রোল মুছে ফেলা যায়নি।");
    }
  };

  const onlineCount = members.filter(
    (m) => m.is_active && m.availability_status === "online"
  ).length;
  const totalActiveChats = members.reduce(
    (sum, m) => sum + (m.active_chats_count || 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-200">
            <UsersIcon className="w-4 h-4" />
            <span>টিম, কাস্টমার কেয়ার ও কাস্টম রোল ম্যানেজমেন্ট</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            আপনার টিম মেম্বার ও অ্যাক্সেস কন্ট্রোল
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            টিম মেম্বারদের শুধু জিমেইল দিয়ে যুক্ত করলেই তারা{" "}
            <b>Continue with Google</b> দিয়ে শপ/কুরিয়ার তথ্য ছাড়াই সরাসরি জয়েন
            করতে পারবেন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <OptionTooltip
            title="মেসেজ ইনবক্স ও লাইভ কিউ"
            description="কাস্টমারদের মেসেজ দেখা, কে কতক্ষণ অপেক্ষা করছে তা দেখা এবং টিম মেম্বারদের কাছে চ্যাট ফরওয়ার্ড করার পেজে যান।"
          >
            <Link
              href="/dashboard/contacts"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold transition"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-emerald-600" />
              <span>মেসেজ ইনবক্স ও কিউ</span>
            </Link>
          </OptionTooltip>

          <OptionTooltip
            title="নতুন কাস্টম রোল তৈরি করুন"
            description="নিজের পছন্দমতো নাম দিয়ে রোল তৈরি করুন এবং কোন পেজ ও কোন কাজের অ্যাক্সেস থাকবে তা টিক চিহ্ন দিয়ে নির্ধারণ করুন।"
          >
            <button
              type="button"
              onClick={() => openCreateRoleModal("support_agent")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs sm:text-sm font-bold transition shadow-2xs"
            >
              <ShieldCheckIcon className="w-4 h-4" />
              <span>+ নতুন কাস্টম রোল</span>
            </button>
          </OptionTooltip>

          <OptionTooltip
            title="নতুন টিম মেম্বার যুক্ত করুন"
            description="স্টাফের জিমেইল ও নাম দিয়ে টিমে যোগ করুন। উনি শুধু Google দিয়ে সাইন-ইন করেই আপনার ওয়ার্কস্পেসে কাজ শুরু করতে পারবেন।"
            align="right"
          >
            <button
              type="button"
              onClick={openAddMemberModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition shadow-sm"
            >
              <UserPlusIcon className="w-4 h-4" />
              <span>+ টিম মেম্বার যোগ করুন</span>
            </button>
          </OptionTooltip>
        </div>
      </div>

      {/* Live Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <OptionTooltip
              title="মোট টিম মেম্বার ও অনলাইন স্ট্যাটাস"
              description="আপনার ওয়ার্কস্পেসে কতজন স্টাফ যুক্ত আছেন এবং তাদের মধ্যে কতজন বর্তমানে অনলাইনে থেকে কাস্টমার সাপোর্ট দিচ্ছেন।"
            >
              <p className="text-xs font-bold text-slate-500">মোট টিম মেম্বার</p>
            </OptionTooltip>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {members.length} জন
            </p>
            <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
              🟢 বর্তমানে অনলাইন: {onlineCount} জন
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UsersIcon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <OptionTooltip
              title="টিমের হাতে চলমান চ্যাট"
              description="বর্তমানে আপনার টিম মেম্বারদের কাছে কয়টি কাস্টমারের চ্যাট অ্যাসাইন করা আছে এবং কথা চলছে।"
            >
              <p className="text-xs font-bold text-slate-500">
                টিমের হাতে চলমান চ্যাট
              </p>
            </OptionTooltip>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalActiveChats} টি
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              অপেক্ষমাণ কাস্টমার সবার উপরে দেখায়
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ClockIcon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <OptionTooltip
              title="কাস্টম রোল ও পারমিশন প্রিসেট"
              description="আপনার তৈরি করা বিভিন্ন পদবী বা রোল, যেখানে কোন পেজ এবং কোন কাজের অনুমতি থাকবে তা সেট করা আছে।"
            >
              <p className="text-xs font-bold text-slate-500">
                কাস্টম রোল ও প্রিসেট
              </p>
            </OptionTooltip>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {roles.length} টি রোল
            </p>
            <p className="text-[11px] text-indigo-600 font-bold mt-0.5">
              পেজ ও কাজভিত্তিক পারমিশন কন্ট্রোল
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <OptionTooltip
          title="টিম মেম্বার তালিকা"
          description="আপনার সব স্টাফের নামের তালিকা, কে অনলাইনে আছেন, কার হাতে কয়টি চ্যাট আছে এবং তাদের রোল পরিবর্তন করুন।"
        >
          <button
            type="button"
            onClick={() => setActiveMainTab("members")}
            className={`px-5 py-3 text-sm font-extrabold border-b-2 transition flex items-center gap-2 ${activeMainTab === "members"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <UsersIcon className="w-4 h-4" />
            <span>টিম মেম্বার তালিকা ({members.length})</span>
          </button>
        </OptionTooltip>

        <OptionTooltip
          title="কাস্টম রোল ও পারমিশন বিল্ডার"
          description="কোন রোলের স্টাফ কোন পেজে যেতে পারবেন এবং কোন কাজ করতে পারবেন তা টিক চিহ্ন দিয়ে কাস্টমাইজ করুন।"
        >
          <button
            type="button"
            onClick={() => setActiveMainTab("roles")}
            className={`px-5 py-3 text-sm font-extrabold border-b-2 transition flex items-center gap-2 ${activeMainTab === "roles"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <ShieldCheckIcon className="w-4 h-4" />
            <span>কাস্টম রোল ও পারমিশন বিল্ডার ({roles.length})</span>
          </button>
        </OptionTooltip>
      </div>

      {/* TAB 1: TEAM MEMBERS */}
      {activeMainTab === "members" && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">
                টিমের তথ্য লোড হচ্ছে...
              </p>
            </div>
          ) : members.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <UserPlusIcon className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900">
                  এখনো কোনো টিম মেম্বার যুক্ত করা হয়নি
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  আপনি একা ব্যবসা চালালে কোনো সেটআপের প্রয়োজন নেই। আর যদি
                  কাস্টমার কেয়ার, অর্ডার কনফার্ম বা প্রোডাক্ট আপলোডের জন্য মানুষ
                  থাকে, তবে নিচের বাটনে ক্লিক করে তাদের জিমেইল দিয়ে যুক্ত করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={openAddMemberModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm"
              >
                <UserPlusIcon className="w-4 h-4" />
                <span>প্রথম টিম মেম্বার যোগ করুন</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map((member) => {
                const effPages = member.effective_permissions?.pages || {};
                const allowedPageItems = PAGE_PERMISSION_ITEMS.filter(
                  (p) => effPages[p.key]
                );

                return (
                  <div
                    key={member.id}
                    className={`bg-white rounded-2xl border p-5 shadow-2xs transition flex flex-col justify-between gap-4 ${member.is_active
                      ? "border-slate-200"
                      : "border-slate-200 bg-slate-50 opacity-75"
                      }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-black text-lg flex items-center justify-center shrink-0">
                            {(member.name || member.email || "M")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-extrabold text-slate-900 text-base truncate">
                                {member.name}
                              </h3>
                              <OptionTooltip
                                title="লাইভ অ্যাভেইলেবিলিটি স্ট্যাটাস"
                                description="মেম্বার বর্তমানে অনলাইনে আছেন, ব্যস্ত আছেন নাকি অফলাইনে আছেন। অটো-অ্যাসাইন ফিচার শুধু অনলাইন মেম্বারদের কাছে চ্যাট পাঠায়।"
                                showIcon={false}
                              >
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-help ${member.availability_status === "online"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : member.availability_status === "busy"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                    }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${member.availability_status === "online"
                                      ? "bg-emerald-500"
                                      : member.availability_status === "busy"
                                        ? "bg-amber-500"
                                        : "bg-slate-400"
                                      }`}
                                  />
                                  {member.availability_status === "online"
                                    ? "অনলাইন"
                                    : member.availability_status === "busy"
                                      ? "ব্যস্ত"
                                      : "অফলাইন"}
                                </span>
                              </OptionTooltip>
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {member.email}
                              {member.phone_number
                                ? ` • ${member.phone_number}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <OptionTooltip
                            title="টিম মেম্বার এডিট ও পারমিশন"
                            description="এই মেম্বারের রোল, ডিপার্টমেন্ট, চ্যানেল অ্যাক্সেস বা ব্যক্তিগত পারমিশন পরিবর্তন করুন।"
                            showIcon={false}
                            align="right"
                          >
                            <button
                              type="button"
                              onClick={() => openEditMemberModal(member)}
                              className="p-2 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                          </OptionTooltip>

                          <OptionTooltip
                            title="টিম থেকে রিমুভ করুন"
                            description="এই মেম্বারকে আপনার ওয়ার্কস্পেস থেকে বাদ দিন। তার কাছে থাকা চলমান চ্যাটগুলো আন-অ্যাসাইন হয়ে যাবে।"
                            showIcon={false}
                            align="right"
                          >
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(member)}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </OptionTooltip>
                        </div>
                      </div>

                      {/* Role & Department Badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <OptionTooltip
                          title="নির্ধারিত রোল"
                          description="এই মেম্বার কোন রোলের অধীনে কাজ করছেন। রোল পরিবর্তন করলে তার পেজ ও কাজের অ্যাক্সেস স্বয়ংক্রিয়ভাবে আপডেট হবে।"
                          showIcon={false}
                        >
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-help">
                            <ShieldCheckIcon className="w-3.5 h-3.5" />
                            রোল: {member.custom_role_name || member.role_title}
                          </span>
                        </OptionTooltip>

                        <OptionTooltip
                          title="ডিপার্টমেন্ট / বিভাগ"
                          description="ডিপার্টমেন্ট অনুযায়ী চ্যাট অটো-অ্যাসাইন বা ফিল্টার করতে সাহায্য করে।"
                          showIcon={false}
                        >
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-help">
                            {formatDepartmentLabel(member.department)}
                          </span>
                        </OptionTooltip>
                      </div>

                      {/* Allowed Pages Preview with Hover Tooltips */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                        <p className="text-[11px] font-bold text-slate-500">
                          অনুমোদিত পেজসমূহ ({allowedPageItems.length} টি — কার্সর
                          রাখলে কাজ দেখা যাবে):
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {allowedPageItems.length > 0 ? (
                            allowedPageItems.map((pItem) => (
                              <OptionTooltip
                                key={pItem.key}
                                title={pItem.title}
                                description={pItem.tooltip}
                                showIcon={false}
                              >
                                <span className="text-[11px] font-semibold bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 px-2 py-0.5 rounded border border-slate-200 cursor-help transition">
                                  ✓ {pItem.title.split(" (")[0]}
                                </span>
                              </OptionTooltip>
                            ))
                          ) : (
                            <span className="text-[11px] text-rose-600 font-bold">
                              কোনো পেজের অনুমতি দেওয়া হয়নি
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Workload Stats & Active Switch */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <OptionTooltip
                          title="চলমান চ্যাট বনাম সর্বোচ্চ লিমিট"
                          description="বর্তমানে উনার হাতে কয়টি কাস্টমার চ্যাট আছে এবং একসাথে সর্বোচ্চ কয়টি চ্যাট অটো-অ্যাসাইন হবে।"
                          showIcon={false}
                        >
                          <span className="font-bold text-slate-700 cursor-help">
                            চলমান চ্যাট:{" "}
                            <strong className="text-indigo-600">
                              {member.active_chats_count || 0}
                            </strong>{" "}
                            / {member.max_concurrent_chats}
                          </span>
                        </OptionTooltip>

                        <OptionTooltip
                          title="আজকের সমাধানকৃত চ্যাট"
                          description="আজ সারাদিনে এই টিম মেম্বার মোট কয়জন কাস্টমারের সমস্যা সমাধান (Resolved) করেছেন।"
                          showIcon={false}
                        >
                          <span className="font-bold text-slate-600 cursor-help">
                            আজ সমাধান:{" "}
                            <strong className="text-emerald-600">
                              {member.resolved_today_count || 0}
                            </strong>
                          </span>
                        </OptionTooltip>
                      </div>

                      <OptionTooltip
                        title="অ্যাক্সেস চালু / সাময়িক বন্ধ"
                        description="ক্লিক করে এই মেম্বারের ড্যাশবোর্ড অ্যাক্সেস সাময়িকভাবে বন্ধ (Pause) বা পুনরায় চালু করতে পারেন।"
                        showIcon={false}
                        align="right"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleMemberActive(member)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition ${member.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            }`}
                        >
                          {member.is_active ? "সক্রিয় আছে" : "নিষ্ক্রিয়"}
                        </button>
                      </OptionTooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUSTOM ROLES & GRANULAR PERMISSION BUILDER */}
      {activeMainTab === "roles" && (
        <div className="space-y-4">
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold text-indigo-950">
                কাস্টম রোল ও পারমিশন টেমপ্লেট
              </h3>
              <p className="text-xs text-indigo-800">
                যেকোনো রোলের &ldquo;পারমিশন কাস্টমাইজ করুন&rdquo; বাটনে ক্লিক করে প্রতিটি
                অপশনের ওপর কার্সর রেখে জেনে নিন কোনটি কী কাজ করে এবং নিজের মতো টিক
                চিহ্ন দিন।
              </p>
            </div>
            <button
              type="button"
              onClick={() => openCreateRoleModal("support_agent")}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 shadow-xs"
            >
              + নতুন কাস্টম রোল তৈরি করুন
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) => {
              const rPages = role.permissions?.pages || {};
              const rTasks = role.permissions?.tasks || {};
              const enabledPagesCount = Object.values(rPages).filter(Boolean)
                .length;
              const enabledTasksCount = Object.values(rTasks).filter(Boolean)
                .length;

              return (
                <div
                  key={role.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base">
                          {role.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {role.description ||
                            "কাস্টমাইজড পেজ এবং টাস্ক পারমিশন রোল"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(role)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                        title="রোল ডিলিট করুন"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        অনুমোদিত পেজ: {enabledPagesCount} টি
                      </span>
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg">
                        অনুমোদিত কাজ (Tasks): {enabledTasksCount} টি
                      </span>
                      {!rTasks.products_view_cost_profit && (
                        <OptionTooltip
                          title="কেনা দাম ও লাভ গোপন"
                          description="এই রোলের স্টাফ প্রোডাক্ট পেজে কাজ করলেও পণ্যের ক্রয়মূল্য (Cost Price) এবং লাভের হিসাব কখনোই দেখতে পাবেন না।"
                          showIcon={false}
                        >
                          <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg cursor-help">
                            🔒 কেনা দাম ও লাভ গোপন
                          </span>
                        </OptionTooltip>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => openEditRoleModal(role)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
                    >
                      <AdjustmentsHorizontalIcon className="w-4 h-4" />
                      <span>পারমিশন কাস্টমাইজ করুন</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT TEAM MEMBER */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="font-extrabold text-slate-900 text-lg">
                  {editingMember
                    ? `টিম মেম্বার এডিট করুন (${editingMember.name})`
                    : "নতুন টিম মেম্বার যোগ করুন"}
                </h2>
                <p className="text-xs text-slate-500">
                  শুধু জিমেইল ও নাম দিয়ে যোগ করলেই উনি{" "}
                  <b>Sign up / Continue with Google</b> দিয়ে ১-ক্লিকে জয়েন করতে
                  পারবেন (পাসওয়ার্ড বা শপের তথ্য লাগবে না)
                </p>
              </div>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleSaveMember}
              className="p-6 space-y-5 overflow-y-auto flex-1"
            >
              {/* Google Sign-In Easy Notice */}
              <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
                <ShieldCheckIcon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-extrabold">
                    গুগল সাইন-ইন সুবিধা (পাসওয়ার্ড ছাড়াই জয়েন):
                  </p>
                  <p className="text-[11px] leading-relaxed text-emerald-900">
                    এখানে টিম মেম্বারের <b>Gmail</b> ও <b>নাম</b> দিয়ে সেভ করুন।
                    এরপর মেম্বার লগইন বা সাইনআপ পেজে গিয়ে{" "}
                    <b>Continue with Google</b> চাপলে শপ/কুরিয়ারের কোনো তথ্য
                    ছাড়াই সরাসরি আপনার ড্যাশবোর্ডে প্রবেশ করবেন।
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <OptionTooltip
                    title="টিম মেম্বারের নাম"
                    description="কাস্টমারকে মেসেজের উত্তর দিলে বা টিম নোট লিখলে এই নামটিই চ্যাটের নিচে দেখা যাবে।"
                  >
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      টিম মেম্বারের নাম *
                    </label>
                  </OptionTooltip>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: তানভীর আহমেদ"
                    value={memberForm.name}
                    onChange={(e) =>
                      setMemberForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <OptionTooltip
                    title="জিমেইল / লগইন ইমেইল"
                    description="স্টাফ যে জিমেইল দিয়ে গুগল লগইন করবেন অথবা ইমেইল-পাসওয়ার্ড দিয়ে লগইন করবেন সেটি এখানে দিন।"
                  >
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      জিমেইল / ইমেইল অ্যাড্রেস *
                    </label>
                  </OptionTooltip>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingMember)}
                    placeholder="staff@gmail.com"
                    value={memberForm.email}
                    onChange={(e) =>
                      setMemberForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <OptionTooltip
                    title="ফোন নাম্বার (ঐচ্ছিক)"
                    description="জরুরি যোগাযোগের জন্য স্টাফের মোবাইল নম্বর রাখতে পারেন। এটি না দিলেও চলবে।"
                  >
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      ফোন নাম্বার (ঐচ্ছিক)
                    </label>
                  </OptionTooltip>
                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={memberForm.phone_number}
                    onChange={(e) =>
                      setMemberForm((prev) => ({
                        ...prev,
                        phone_number: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <OptionTooltip
                    title="পাসওয়ার্ড (ঐচ্ছিক)"
                    description="টিম মেম্বার যদি Google দিয়ে সাইন-ইন করেন, তবে পাসওয়ার্ড দেওয়ার কোনো প্রয়োজন নেই। আর ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করতে চাইলে এখানে পাসওয়ার্ড সেট করে দিন।"
                  >
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      পাসওয়ার্ড (ঐচ্ছিক — গুগল লগইনে লাগবে না)
                    </label>
                  </OptionTooltip>
                  <input
                    type="password"
                    placeholder="খালি রাখলে গুগল দিয়ে সাইন-ইন করবেন"
                    value={memberForm.password}
                    onChange={(e) =>
                      setMemberForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <OptionTooltip
                    title="রোল নির্বাচন করুন"
                    description="এই মেম্বার কোন রোলের পারমিশন পাবেন তা সিলেক্ট করুন। যেমন: সহকারী ম্যানেজার, কাস্টমার সাপোর্ট বা সেলস ম্যানেজার।"
                  >
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      রোল নির্বাচন করুন *
                    </label>
                  </OptionTooltip>
                  <select
                    value={memberForm.custom_role_id}
                    onChange={(e) => handleMemberRoleSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  >
                    <option value="">-- রোল নির্বাচন করুন --</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <OptionTooltip
                    title="একসাথে সর্বোচ্চ চ্যাট লিমিট"
                    description="অটো-অ্যাসাইন করার সময় একজন মেম্বারের হাতে একসাথে সর্বোচ্চ কয়টি অমীমাংসিত চ্যাট দেওয়া যাবে তার সীমা।"
                  >
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      সর্বোচ্চ চ্যাট লিমিট
                    </label>
                  </OptionTooltip>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={memberForm.max_concurrent_chats}
                    onChange={(e) =>
                      setMemberForm((prev) => ({
                        ...prev,
                        max_concurrent_chats: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Department Selection (Supports 'All Departments' or Multiple Specific Departments) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <OptionTooltip
                  title="কাজের বিভাগ (Department)"
                  description="মাঝারি ও ক্ষুদ্র ব্যবসায় সাধারণত একজন কর্মীই সব কাজ (সেলস, সাপোর্ট, ডেলিভারি) সামলান। সেজন্য 'সকল বিভাগ' সিলেক্ট রাখতে পারেন, অথবা একাধিক নির্দিষ্ট বিভাগ বেছে নিতে পারেন।"
                >
                  <label className="text-xs font-bold text-slate-800 block">
                    দায়িত্বের বিভাগ / ডিপার্টমেন্ট (সকল বিভাগ বা একাধিক বিভাগ নির্বাচন করুন)
                  </label>
                </OptionTooltip>
                <p className="text-[11px] text-slate-500">
                  মাঝারি ব্যবসায় একজন কর্মী যদি সব কাজ করেন তবে &apos;সকল বিভাগ&apos; চালু রাখুন। অথবা আলাদা নির্দিষ্ট একাধিক বিভাগ নির্বাচন করতে পারেন।
                </p>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <label className={`flex items-center gap-2.5 cursor-pointer font-bold text-xs p-2.5 rounded-xl border transition ${memberForm.department === "all" || !memberForm.department
                    ? "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                    <input
                      type="checkbox"
                      checked={memberForm.department === "all" || !memberForm.department}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMemberForm((prev) => ({ ...prev, department: "all" }));
                        } else {
                          setMemberForm((prev) => ({ ...prev, department: "support" }));
                        }
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-extrabold text-sm block">✨ সকল বিভাগ (All Departments)</span>
                      <span className="text-[11px] font-normal text-slate-600">
                        একজনই সব ধরনের কাজ (সেলস, সাপোর্ট, অর্ডার, ডেলিভারি, হিসাব) করতে পারবেন।
                      </span>
                    </div>
                  </label>

                  {memberForm.department !== "all" && memberForm.department && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                      {[
                        { key: "support", label: "💬 কাস্টমার সাপোর্ট" },
                        { key: "sales", label: "🛍️ সেলস ও অর্ডার" },
                        { key: "delivery", label: "🚚 ডেলিভারি ও কুরিয়ার" },
                        { key: "billing", label: "💳 পেমেন্ট ও হিসাব" },
                        { key: "general", label: "🏢 সাধারণ বিভাগ" },
                      ].map((dept) => {
                        const currentDepts = memberForm.department
                          ? memberForm.department.split(",").map((d) => d.trim())
                          : [];
                        const isChecked = currentDepts.includes(dept.key);
                        return (
                          <label
                            key={dept.key}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold cursor-pointer transition ${isChecked
                              ? "bg-indigo-50 border-indigo-400 text-indigo-800"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                let updated;
                                if (isChecked) {
                                  updated = currentDepts.filter((k) => k !== dept.key);
                                  if (updated.length === 0) updated = ["support"];
                                } else {
                                  updated = [...currentDepts, dept.key];
                                }
                                setMemberForm((prev) => ({
                                  ...prev,
                                  department: updated.join(","),
                                }));
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{dept.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Channel / Page Scope Selection */}
              {agents.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <OptionTooltip
                    title="নির্দিষ্ট পেজ বা চ্যানেল সীমাবদ্ধতা"
                    description="আপনার একাধিক ফেসবুক পেজ বা হোয়াটসঅ্যাপ থাকলে কে কোন পেজের মেসেজ দেখবে তা নির্দিষ্ট করে দিতে পারেন। কোনোটি টিক না দিলে সব পেজের মেসেজ দেখতে পারবে।"
                  >
                    <label className="text-xs font-bold text-slate-800 block">
                      নির্দিষ্ট ফেসবুক পেজ / হোয়াটসঅ্যাপ চ্যানেল সীমাবদ্ধতা
                      (ঐচ্ছিক)
                    </label>
                  </OptionTooltip>
                  <p className="text-[11px] text-slate-500">
                    কোনোটি সিলেক্ট না করলে সব চ্যানেলের মেসেজ দেখতে পারবে।
                    নির্দিষ্ট চ্যানেল সিলেক্ট করলে শুধু সেই চ্যানেলের কাস্টমারদের
                    দেখবে।
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {agents.map((ag) => {
                      const checked = memberForm.allowed_agent_ids.includes(
                        ag.id
                      );
                      return (
                        <label
                          key={ag.id}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition ${checked
                            ? "bg-indigo-50 border-indigo-500 text-indigo-800"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setMemberForm((prev) => {
                                const exists = prev.allowed_agent_ids.includes(
                                  ag.id
                                );
                                return {
                                  ...prev,
                                  allowed_agent_ids: exists
                                    ? prev.allowed_agent_ids.filter(
                                      (id) => id !== ag.id
                                    )
                                    : [...prev.allowed_agent_ids, ag.id],
                                };
                              });
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span>
                            {ag.name} ({ag.platform})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Per-Member Custom Permission Override Toggle */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <div>
                    <OptionTooltip
                      title="ব্যক্তিগত কাস্টম পারমিশন ওভাররাইড"
                      description="রোল পরিবর্তন না করেও শুধুমাত্র এই নির্দিষ্ট ব্যক্তির জন্য কোনো বিশেষ পেজ বা কাজের অনুমতি যোগ বা বাতিল করতে এটি চালু করুন।"
                    >
                      <span className="text-xs font-extrabold text-slate-900">
                        এই মেম্বারের জন্য আলাদাভাবে কাস্টম পারমিশন সেট করুন
                      </span>
                    </OptionTooltip>
                  </div>
                  <input
                    type="checkbox"
                    checked={memberForm.use_custom_override}
                    onChange={(e) =>
                      setMemberForm((prev) => ({
                        ...prev,
                        use_custom_override: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                </label>

                {memberForm.use_custom_override && (
                  <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-4">
                    <h4 className="text-xs font-extrabold text-indigo-950">
                      ১. কোন কোন পেজে যেতে পারবে:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PAGE_PERMISSION_ITEMS.map((item) => {
                        const checked = Boolean(
                          memberForm.permissions_override?.pages?.[item.key]
                        );
                        return (
                          <label
                            key={item.key}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer ${checked
                              ? "bg-white border-indigo-400"
                              : "bg-white/60 border-slate-200"
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleMemberOverridePermission(
                                  "pages",
                                  item.key
                                )
                              }
                              className="mt-0.5 rounded text-indigo-600"
                            />
                            <div className="min-w-0 flex-1">
                              <OptionTooltip
                                title={item.title}
                                description={item.tooltip}
                              >
                                <span className="font-bold text-slate-900">
                                  {item.title}
                                </span>
                              </OptionTooltip>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {item.desc}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {TASK_PERMISSION_GROUPS.map((grp, gIdx) => (
                      <div key={gIdx} className="space-y-2 pt-2">
                        <OptionTooltip
                          title={grp.groupTitle}
                          description={grp.groupTooltip}
                        >
                          <h4 className="text-xs font-extrabold text-indigo-950">
                            {grp.groupTitle}
                          </h4>
                        </OptionTooltip>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {grp.items.map((tItem) => {
                            const checked = Boolean(
                              memberForm.permissions_override?.tasks?.[
                              tItem.key
                              ]
                            );
                            return (
                              <label
                                key={tItem.key}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer ${checked
                                  ? "bg-white border-emerald-400"
                                  : "bg-white/60 border-slate-200"
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    toggleMemberOverridePermission(
                                      "tasks",
                                      tItem.key
                                    )
                                  }
                                  className="mt-0.5 rounded text-emerald-600"
                                />
                                <div className="min-w-0 flex-1">
                                  <OptionTooltip
                                    title={tItem.title}
                                    description={tItem.tooltip}
                                  >
                                    <span className="font-bold text-slate-900">
                                      {tItem.title}
                                    </span>
                                  </OptionTooltip>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {tItem.desc}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingMember}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {savingMember && (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  )}
                  <span>
                    {editingMember ? "আপডেট সেভ করুন" : "টিম মেম্বার যুক্ত করুন"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div >
      )
      }

      {/* MODAL 2: CUSTOM ROLE & PERMISSION BUILDER */}
      {
        isRoleModalOpen && (
          <div className="fixed inset-0 z-[310] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-lg">
                    {editingRole
                      ? `রোল পারমিশন কাস্টমাইজ করুন: ${editingRole.name}`
                      : "নতুন কাস্টম রোল ও পারমিশন তৈরি করুন"}
                  </h2>
                </div>
                <button
                  onClick={() => setIsRoleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form
                onSubmit={handleSaveRole}
                className="p-6 space-y-6 overflow-y-auto flex-1"
              >
                {/* Quick 1-Click Presets */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <p className="text-xs font-bold text-slate-700">
                    ১-ক্লিকে রেডিমেড টেমপ্লেট থেকে শুরু করুন (এরপর নিচে নিজের মতো
                    পরিবর্তন করতে পারবেন):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(presets).map(([pKey, pVal]) => (
                      <OptionTooltip
                        key={pKey}
                        title={pVal.name}
                        description={pVal.description}
                        showIcon={false}
                      >
                        <button
                          type="button"
                          onClick={() => applyPresetToRoleForm(pKey)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${roleForm.preset_key === pKey
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                            }`}
                        >
                          {pVal.name}
                        </button>
                      </OptionTooltip>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <OptionTooltip
                      title="রোলের নাম"
                      description="আপনার টিমের পদবী অনুযায়ী যেকোনো নাম দিন, যেমন: নাইট শিফট সাপোর্ট, সিনিয়র অর্ডার ম্যানেজার ইত্যাদি।"
                    >
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        রোলের নাম *
                      </label>
                    </OptionTooltip>
                    <input
                      type="text"
                      required
                      placeholder="যেমন: সিনিয়র কাস্টমার এক্সিকিউটিভ / নাইট শিফট মডারেটর"
                      value={roleForm.name}
                      onChange={(e) =>
                        setRoleForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 outline-none font-bold"
                    />
                  </div>
                  <div>
                    <OptionTooltip
                      title="সংক্ষিপ্ত বিবরণ"
                      description="এই রোলের কাজ কী তা মনে রাখার জন্য সংক্ষেপে লিখে রাখতে পারেন।"
                    >
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)
                      </label>
                    </OptionTooltip>
                    <input
                      type="text"
                      placeholder="এই রোলের কাজ কী তা সংক্ষেপে লিখুন..."
                      value={roleForm.description}
                      onChange={(e) =>
                        setRoleForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* SECTION A: PAGE ACCESS CHECKBOXES */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <OptionTooltip
                      title="পেজ অ্যাক্সেস কন্ট্রোল"
                      description="এখানে যে পেজগুলোতে টিক চিহ্ন দেবেন, স্টাফ লগইন করার পর বাম পাশের মেনুতে শুধু সেই পেজগুলোই দেখতে পাবেন। বাকি পেজগুলো সম্পূর্ণ লুকানো থাকবে।"
                    >
                      <h3 className="text-sm font-extrabold text-slate-900">
                        ধাপ ১: কোন কোন পেজে প্রবেশ করতে পারবে (Page Access)
                      </h3>
                    </OptionTooltip>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {PAGE_PERMISSION_ITEMS.map((item) => {
                      const checked = Boolean(
                        roleForm.permissions?.pages?.[item.key]
                      );
                      return (
                        <label
                          key={item.key}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${checked
                            ? "bg-indigo-50/60 border-indigo-500 ring-1 ring-indigo-500/30"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleRolePermission("pages", item.key)
                            }
                            className="mt-1 w-4 h-4 rounded text-indigo-600 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <OptionTooltip
                              title={item.title}
                              description={item.tooltip}
                            >
                              <span className="text-xs font-extrabold text-slate-900 leading-snug">
                                {item.title}
                              </span>
                            </OptionTooltip>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                              {item.desc}
                            </p>
                            {item.sensitive && (
                              <span className="inline-block mt-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                                সংবেদনশীল পেজ
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION B: GRANULAR TASK PERMISSIONS */}
                <div className="space-y-5 pt-2">
                  <div className="border-b border-slate-200 pb-2">
                    <OptionTooltip
                      title="কাজের পারমিশন (Task Permissions)"
                      description="একটি পেজে প্রবেশের অনুমতি থাকলেও সেই পেজের ভেতর স্টাফ কী কী কাজ করতে পারবেন (যেমন: দাম দেখা, ডিলিট করা, কুরিয়ার বুকিং দেওয়া) তা এখান থেকে সূক্ষ্মভাবে নিয়ন্ত্রণ করুন।"
                    >
                      <h3 className="text-sm font-extrabold text-slate-900">
                        ধাপ ২: পেজের ভেতর কোন কোন কাজ করতে পারবে (Task
                        Permissions)
                      </h3>
                    </OptionTooltip>
                  </div>

                  {TASK_PERMISSION_GROUPS.map((group, gIdx) => (
                    <div
                      key={gIdx}
                      className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3"
                    >
                      <OptionTooltip
                        title={group.groupTitle}
                        description={group.groupTooltip}
                      >
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          {group.groupTitle}
                        </h4>
                      </OptionTooltip>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {group.items.map((task) => {
                          const checked = Boolean(
                            roleForm.permissions?.tasks?.[task.key]
                          );
                          return (
                            <label
                              key={task.key}
                              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${checked
                                ? "bg-white border-emerald-500 ring-1 ring-emerald-500/20 shadow-2xs"
                                : "bg-white/70 border-slate-200 hover:bg-white"
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  toggleRolePermission("tasks", task.key)
                                }
                                className="mt-1 w-4 h-4 rounded text-emerald-600 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <OptionTooltip
                                  title={task.title}
                                  description={task.tooltip}
                                >
                                  <span className="text-xs font-extrabold text-slate-900">
                                    {task.title}
                                  </span>
                                </OptionTooltip>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  {task.desc}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRoleModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={savingRole}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingRole && (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    )}
                    <span>রোল ও পারমিশন সেভ করুন</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
}
