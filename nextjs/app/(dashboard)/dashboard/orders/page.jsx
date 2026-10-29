"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "app/context/AuthContext";
import {
  Package, Phone, CheckSquare, Square, Store, Mail, Globe,
  ChevronRight, Link as LinkIcon, Check, MapPin,
  Search, Printer, LayoutDashboard, BarChart3, TrendingUp, Truck, Plus,
  Filter, RotateCcw, Calendar, Clock, AlertCircle, DollarSign, ShoppingBag, Award, PieChart,
  ShieldCheck, Tag, User, Sparkles, Image as ImageIcon,
  PhoneCall, PhoneForwarded, PhoneOff, Headphones
} from "lucide-react";

// Chart JS Imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import toast from "react-hot-toast";
import { useNotifications } from "@/hooks/useNotifications";

// Chart Register
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, ArcElement, Filler
);

// Platform SVG Icons
function WhatsAppIcon({ className = "w-3 h-3" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.668-.699c.974.53 1.954.82 2.79.821 3.183 0 5.767-2.586 5.768-5.766.001-3.181-2.584-5.767-5.766-5.767zm3.393 8.163c-.144.405-.837.774-1.17.822-.312.043-.683.08-2.029-.475-1.611-.666-2.651-2.316-2.732-2.423-.081-.107-.655-.87-.655-1.662 0-.791.415-1.182.562-1.341.147-.159.324-.199.432-.199.108 0 .216.001.31.006.101.005.236-.039.369.28.136.326.467 1.137.509 1.22.042.083.07.18.014.292-.056.113-.085.183-.169.282-.085.099-.178.221-.254.298-.085.086-.174.179-.075.349.099.17.44 1.053 1.205 1.733.722.64 1.332.839 1.52.924.188.085.297.071.407-.056.11-.127.469-.548.595-.736.126-.188.252-.157.424-.093.172.064 1.091.514 1.278.608.187.094.312.14.358.219.046.079.046.458-.098.863z" />
    </svg>
  );
}

function MessengerIcon({ className = "w-3 h-3" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.914 1.455 5.518 3.735 7.152V22l3.419-1.877c.897.248 1.849.383 2.846.383 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.066 12.457l-2.73-2.91-5.326 2.91 5.86-6.22 2.796 2.91 5.258-2.91-5.858 6.22z" />
    </svg>
  );
}

function InstagramIcon({ className = "w-3 h-3" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TelegramIcon({ className = "w-3 h-3" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function FacebookIcon({ className = "w-3 h-3" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

// Facebook Friends-Style Platform Badges (-space-x-1.5 overlapping circular icons)
function CustomerPlatformBadges({ platforms = [], defaultPlatform = "web" }) {
  const rawList = platforms && platforms.length > 0 ? platforms : [{ platform: defaultPlatform || 'web', label: defaultPlatform || 'Web Store' }];
  const uniquePlatforms = [];
  const seen = new Set();
  for (const p of rawList) {
    const key = (typeof p === 'string' ? p : p.platform || 'web').toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniquePlatforms.push(typeof p === 'string' ? { platform: key, label: key } : p);
    }
  }

  const getPlatformDetails = (key) => {
    switch (key) {
      case 'whatsapp':
        return { name: 'WhatsApp', bg: 'bg-[#25D366] text-white', icon: <WhatsAppIcon className="w-2.5 h-2.5" /> };
      case 'messenger':
        return { name: 'Messenger', bg: 'bg-[#0084FF] text-white', icon: <MessengerIcon className="w-2.5 h-2.5" /> };
      case 'instagram':
        return { name: 'Instagram', bg: 'bg-gradient-to-tr from-[#fd5949] via-[#d6249f] to-[#285AEB] text-white', icon: <InstagramIcon className="w-2.5 h-2.5" /> };
      case 'telegram':
        return { name: 'Telegram', bg: 'bg-[#0088cc] text-white', icon: <TelegramIcon className="w-2.5 h-2.5" /> };
      case 'facebook':
        return { name: 'Facebook', bg: 'bg-[#1877F2] text-white', icon: <FacebookIcon className="w-2.5 h-2.5" /> };
      case 'shop':
      case 'storefront':
        return { name: 'Online Store', bg: 'bg-indigo-600 text-white', icon: <Store className="w-2.5 h-2.5" /> };
      default:
        return { name: 'Web Form', bg: 'bg-slate-700 text-white', icon: <Globe className="w-2.5 h-2.5" /> };
    }
  };

  return (
    <div className="flex items-center -space-x-1.5 overflow-visible py-0.5" title={uniquePlatforms.map(p => p.label || p.platform).join(', ')}>
      {uniquePlatforms.map((p, idx) => {
        const details = getPlatformDetails((p.platform || '').toLowerCase());
        return (
          <div
            key={idx}
            title={`${details.name}${p.identifier ? `: ${p.identifier}` : ''}`}
            className={`w-5 h-5 rounded-full ring-2 ring-white flex items-center justify-center shadow-xs cursor-pointer transition-transform hover:scale-125 hover:z-20 ${details.bg}`}
          >
            {details.icon}
          </div>
        );
      })}
    </div>
  );
}

// Customer Profile Avatar Component
function CustomerAvatar({ name = "Customer", avatarUrl = null, hasAccount = false }) {
  const [imgError, setImgError] = useState(false);
  const getInitials = (n) => {
    if (!n) return "C";
    const parts = n.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="relative flex-shrink-0">
      {avatarUrl && !imgError ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover ring-2 ring-slate-100 shadow-sm"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center ring-2 ring-slate-100 shadow-sm select-none">
          {getInitials(name)}
        </div>
      )}
      {hasAccount && (
        <div
          title="Verified Customer Account"
          className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full ring-2 ring-white flex items-center justify-center shadow-sm"
        >
          <Check className="w-2.5 h-2.5 stroke-[3]" />
        </div>
      )}
    </div>
  );
}

export default function OrderDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formId, setFormId] = useState("");
  const [apiError, setApiError] = useState(null);
  const [copied, setCopied] = useState(false);

  const [viewMode, setViewMode] = useState("orders");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [selectedOrders, setSelectedOrders] = useState([]);

  // Helper for today's date YYYY-MM-DD
  const getTodayStr = useCallback(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Date Filter State (default to Current Day / Today)
  const [selectedPreset, setSelectedPreset] = useState("today"); // "today" | "7d" | "30d" | "month" | "all" | "custom"
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    const today = new Date();
    const formatDateStr = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let sStr = "";
    let eStr = "";

    if (preset === "today") {
      sStr = formatDateStr(today);
      eStr = formatDateStr(today);
    } else if (preset === "7d") {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      sStr = formatDateStr(past);
      eStr = formatDateStr(today);
    } else if (preset === "30d") {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      sStr = formatDateStr(past);
      eStr = formatDateStr(today);
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      sStr = formatDateStr(firstDay);
      eStr = formatDateStr(today);
    } else if (preset === "all") {
      sStr = "";
      eStr = "";
    }

    setStartDate(sStr);
    setEndDate(eStr);
  };

  const handleCustomDateApply = () => {
    setSelectedPreset("custom");
  };

  // Create Store States
  const [createStoreModalOpen, setCreateStoreModalOpen] = useState(false);
  const [newStoreData, setNewStoreData] = useState({ name: "", contact_name: "", contact_number: "", address: "", city_id: "", zone_id: "", area_id: "" });
  const [isCreatingStore, setIsCreatingStore] = useState(false);

  const [pathaoCities, setPathaoCities] = useState([]);
  const [pathaoZones, setPathaoZones] = useState([]);
  const [pathaoAreas, setPathaoAreas] = useState([]);
  const [steadfastCities, setSteadFastCities] = useState([]);
  const [steadfastAreas, setSteadFastAreas] = useState([]);

  // Courier Selection and Booking States
  const [selectedCourier, setSelectedCourier] = useState("pathao"); // pathao or steadfast
  const [courierActive, setCourierActive] = useState(false);
  const [steadfastActive, setSteadFastActive] = useState(false);
  const [courierProviderModalOpen, setCourierProviderModalOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingOrder, setBookingOrder] = useState(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [stores, setStores] = useState([]);
  const [bookingDetails, setBookingDetails] = useState({
    recipient_name: "",
    recipient_phone: "",
    recipient_address: "",
    item_quantity: 1,
    item_weight: 0.5,
    amount_to_collect: 0,
    item_description: "Order Parcel",
    store_id: "",
    recipient_city: "",
    recipient_zone: "",
    recipient_area: "",
    special_instruction: ""
  });
  const [bookingCities, setBookingCities] = useState([]);
  const [bookingZones, setBookingZones] = useState([]);
  const [bookingAreas, setBookingAreas] = useState([]);
  const [addressSuggestions, setAddressSuggestions] = useState(null);

  // Courier Config Modal States
  const [courierConfigModalOpen, setCourierConfigModalOpen] = useState(false);
  const [courierConfigTab, setCourierConfigTab] = useState("pathao"); // pathao or steadfast
  const [pathaoConfigs, setPathaoConfigs] = useState([]);
  const [editingPathaoConfigId, setEditingPathaoConfigId] = useState(null);
  const [pathaoConfig, setPathaoConfig] = useState({
    name: "",
    client_id: "",
    client_secret: "",
    username: "",
    password: "",
    store_id: "",
    webhook_secret: "",
    webhook_url: "",
    is_sandbox: true,
    cod_charge_mode: "seller",
    cod_percentage: 1.0
  });
  const [steadfastConfigs, setSteadFastConfigs] = useState([]);
  const [editingSteadFastConfigId, setEditingSteadFastConfigId] = useState(null);
  const [steadfastConfig, setSteadFastConfig] = useState({
    name: "",
    api_key: "",
    api_secret: "",
    webhook_token: "",
    webhook_url: "",
    is_sandbox: true,
    cod_charge_mode: "seller",
    cod_percentage: 1.0
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [courierFormMode, setCourierFormMode] = useState("list");
  const [isDeletingConfig, setIsDeletingConfig] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Custom Order Manual Entry States
  const [addOrderModalOpen, setAddOrderModalOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [newOrderDetails, setNewOrderDetails] = useState({
    customer_name: "",
    phone_number: "",
    district: "",
    upazila: "",
    address: "",
    product_name: "",
    price: "",
    extra_info: "",
    city_id: "",
    zone_id: "",
    area_id: "",
    item_weight: 0.5,
    item_quantity: 1,
    special_instruction: ""
  });

  const [manualCities, setManualCities] = useState([]);
  const [manualZones, setManualZones] = useState([]);
  const [manualAreas, setManualAreas] = useState([]);
  const [selectedManualCity, setSelectedManualCity] = useState("");
  const [selectedManualZone, setSelectedManualZone] = useState("");
  const [selectedManualArea, setSelectedManualArea] = useState("");

  const [calculatedPrice, setCalculatedPrice] = useState(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [trackingDetails, setTrackingDetails] = useState(null);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [loadingTracking, setLoadingTracking] = useState(false);

  const getConsignmentId = (extraInfo) => {
    if (!extraInfo) return null;
    const match = extraInfo.match(/Tracking ID:\s*([A-Za-z0-9\-]+)/i);
    return match ? match[1] : null;
  };

  const { notifications } = useNotifications(user, setOrders);



  const shopName = user?.name || "Smart Shop BD";

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Auto-booking & Default Courier Settings
  const [autoCourierBooking, setAutoCourierBooking] = useState(false);
  const [defaultCourierProvider, setDefaultCourierProvider] = useState("steadfast");
  const [isSavingCourierPrefs, setIsSavingCourierPrefs] = useState(false);

  useEffect(() => {
    if (user?.profile) {
      setWebsiteUrl(user.profile.website_url || "");
      setBusinessEmail(user.profile.business_email || user.email || "");
      setAutoCourierBooking(Boolean(user.profile.auto_courier_booking));
      setDefaultCourierProvider(user.profile.default_courier_provider || "steadfast");
    }
  }, [user]);

  const fetchLatestCourierPrefs = useCallback(async () => {
    try {
      const res = await api.get("/users/me/");
      if (res.data?.profile) {
        setAutoCourierBooking(Boolean(res.data.profile.auto_courier_booking));
        setDefaultCourierProvider(res.data.profile.default_courier_provider || "steadfast");
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const saveCourierPreferences = async (nextAutoBooking, nextDefaultProvider) => {
    setIsSavingCourierPrefs(true);
    try {
      await api.patch("/users/update-me/", {
        profile: {
          auto_courier_booking: nextAutoBooking,
          default_courier_provider: nextDefaultProvider,
        },
      });
      setAutoCourierBooking(nextAutoBooking);
      setDefaultCourierProvider(nextDefaultProvider);
      toast.success("Courier auto-dispatch & default settings saved!", { icon: "⚡" });
    } catch (err) {
      toast.error("Failed to save courier preferences.");
    } finally {
      setIsSavingCourierPrefs(false);
    }
  };

  const saveProfileSettings = async () => {
    setIsSavingProfile(true);
    const loadingToast = toast.loading("Saving invoice settings...");
    try {
      await api.patch('/users/update-me/', {
        profile: {
          website_url: websiteUrl,
          business_email: businessEmail
        }
      });
      toast.success("Invoice settings updated successfully!", { id: loadingToast });
    } catch (err) {
      toast.error("Failed to save settings. Please try again.", { id: loadingToast });
    } finally {
      setIsSavingProfile(false);
    }
  };


  useEffect(() => {
    fetchOrders();
    fetchFormId();
    checkCourierConfig();
    checkSteadFastConfig();
    fetchLatestCourierPrefs();
  }, [fetchLatestCourierPrefs]);

  const checkCourierConfig = async () => {
    setCourierActive(false);
    try {
      const res = await api.get("/courier/config/");
      if (Array.isArray(res.data)) {
        setPathaoConfigs(res.data);
        const activeConfig = res.data.find(config => config.is_active) || res.data[0];
        if (activeConfig) {
          setPathaoConfig({
            name: activeConfig.name || "",
            client_id: activeConfig.client_id,
            client_secret: "",
            username: activeConfig.username,
            password: "",
            store_id: activeConfig.store_id || "",
            webhook_secret: activeConfig.webhook_secret || "",
            webhook_url: activeConfig.webhook_url || "",
            is_sandbox: activeConfig.is_sandbox,
            cod_charge_mode: activeConfig.cod_charge_mode || "seller",
            cod_percentage: activeConfig.cod_percentage !== undefined ? activeConfig.cod_percentage : 1.0
          });
          setEditingPathaoConfigId(activeConfig.id);
          setCourierActive(true);
          try {
            const storesRes = await api.get(`/courier/stores/?config_id=${activeConfig.id}`);
            setStores(storesRes.data || []);
          } catch (e) {
            console.error("Failed to load courier stores:", e);
          }
        }
      }
    } catch (e) {
      console.log("Pathao courier integration not configured.");
    }
  };

  const checkSteadFastConfig = async () => {
    setSteadFastActive(false);
    try {
      const res = await api.get("/courier/steadfast/config/");
      if (Array.isArray(res.data)) {
        setSteadFastConfigs(res.data);
        const activeConfig = res.data.find(config => config.is_active) || res.data[0];
        if (activeConfig) {
          setSteadFastConfig({
            name: activeConfig.name || "",
            api_key: activeConfig.api_key,
            api_secret: "",
            webhook_token: activeConfig.webhook_token || "",
            webhook_url: activeConfig.webhook_url || "",
            is_sandbox: activeConfig.is_sandbox,
            cod_charge_mode: activeConfig.cod_charge_mode || "seller",
            cod_percentage: activeConfig.cod_percentage !== undefined ? activeConfig.cod_percentage : 1.0
          });
          setEditingSteadFastConfigId(activeConfig.id);
          setSteadFastActive(true);
          try {
            const citiesRes = await api.get("/courier/steadfast/cities/");
            setSteadFastCities(citiesRes.data || []);
          } catch (e) {
            console.error("Failed to load SteadFast cities:", e);
          }
        }
      }
    } catch (e) {
      console.log("SteadFast courier integration not configured.");
    }
  };

  const handleSavePathaoConfig = async () => {
    setIsSavingConfig(true);
    try {
      const payload = { ...pathaoConfig };
      if (!payload.password) delete payload.password;
      if (!payload.client_secret) delete payload.client_secret;
      const targetConfigId = editingPathaoConfigId || (pathaoConfigs.length > 0 ? pathaoConfigs[0].id : null);
      if (targetConfigId) payload.config_id = targetConfigId;

      await api.post("/courier/config/", payload);
      toast.success("Pathao credentials verified & saved successfully!", { icon: "🚚" });
      setCourierFormMode("list");
      setEditingPathaoConfigId(null);
      checkCourierConfig(); // Re-check to enable courier functionality
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to verify or save Pathao credentials.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleDeletePathaoConfig = async (configId) => {
    if (!window.confirm("Are you sure you want to delete this courier configuration?")) return;
    setIsDeletingConfig(true);
    try {
      await api.delete(`/courier/config/?config_id=${configId}`);
      toast.success("Pathao configuration deleted successfully!", { icon: "🗑️" });
      if (editingPathaoConfigId === configId) {
        setEditingPathaoConfigId(null);
      }
      setPathaoConfig({
        name: "",
        client_id: "",
        client_secret: "",
        username: "",
        password: "",
        store_id: "",
        is_sandbox: true
      });
      checkCourierConfig();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete Pathao configuration.");
    } finally {
      setIsDeletingConfig(false);
    }
  };

  const handleSaveSteadFastConfig = async () => {
    setIsSavingConfig(true);
    try {
      const payload = {
        name: steadfastConfig.name,
        api_key: steadfastConfig.api_key,
        webhook_token: steadfastConfig.webhook_token || "",
        is_sandbox: steadfastConfig.is_sandbox,
        cod_charge_mode: steadfastConfig.cod_charge_mode || 'seller',
        cod_percentage: steadfastConfig.cod_percentage !== undefined ? steadfastConfig.cod_percentage : 1.0
      };
      if (steadfastConfig.api_secret) payload.api_secret = steadfastConfig.api_secret;
      const targetConfigId = editingSteadFastConfigId || (steadfastConfigs.length > 0 ? steadfastConfigs[0].id : null);
      if (targetConfigId) payload.config_id = targetConfigId;
      await api.post("/courier/steadfast/config/", payload);
      toast.success("SteadFast configuration saved successfully!", { icon: "🚚" });
      setCourierConfigTab("list");
      setCourierFormMode("list");
      setEditingSteadFastConfigId(null);
      checkSteadFastConfig();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to verify or save SteadFast credentials.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleDeleteSteadFastConfig = async (configId) => {
    if (!window.confirm("Are you sure you want to delete this SteadFast configuration?")) return;
    setIsDeletingConfig(true);
    try {
      await api.delete(`/courier/steadfast/config/?config_id=${configId}`);
      toast.success("SteadFast configuration deleted successfully!", { icon: "🗑️" });
      if (editingSteadFastConfigId === configId) {
        setEditingSteadFastConfigId(null);
      }
      setSteadFastConfig({
        name: "",
        api_key: "",
        api_secret: "",
        is_sandbox: true
      });
      checkSteadFastConfig();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete SteadFast configuration.");
    } finally {
      setIsDeletingConfig(false);
    }
  };

  const handleAddOrder = async () => {
    if (!newOrderDetails.customer_name || !newOrderDetails.phone_number || !newOrderDetails.address) {
      return toast.error("Please fill the required fields: Name, Phone, and Address.");
    }
    setIsSubmittingOrder(true);
    const loadingToast = toast.loading("Adding custom order...");
    try {
      const payload = { ...newOrderDetails, form_id: formId };
      await api.post("/orders/", payload);
      toast.success("Order added successfully!", { id: loadingToast, icon: "📦" });
      setAddOrderModalOpen(false);
      setNewOrderDetails({
        customer_name: "", phone_number: "", district: "", upazila: "", address: "", product_name: "", price: "", extra_info: "",
        city_id: "", zone_id: "", area_id: "", item_weight: 0.5, item_quantity: 1, special_instruction: ""
      });
      setSelectedManualCity("");
      setSelectedManualZone("");
      setSelectedManualArea("");
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add order.", { id: loadingToast });
    } finally {
      setIsSubmittingOrder(false);
    }
  };


  const openBookingModal = (order) => {
    setBookingOrder(order);
    const preferred =
      (order?.courier && order.courier !== "manual" ? order.courier : null) ||
      defaultCourierProvider ||
      (courierActive ? "pathao" : "steadfast");
    setSelectedCourier(preferred);
    setCourierProviderModalOpen(true);
  };

  const startCourierBooking = async (providerOverride = null) => {
    const activeProvider = providerOverride || selectedCourier;
    const loadingToast = toast.loading("Fetching courier suggestions...");
    let suggestedCity = "";
    let suggestedZone = "";
    let suggestedArea = "";

    try {
      const res = await api.get(`/courier/suggested-address/?order_id=${bookingOrder.id}`);
      const data = res.data || {};
      setAddressSuggestions(data);

      const suggestions = activeProvider === "pathao" ? data.pathao : data.steadfast;
      if (suggestions) {
        suggestedCity = suggestions.city_id ? String(suggestions.city_id) : "";
        suggestedZone = suggestions.zone_id ? String(suggestions.zone_id) : "";
        suggestedArea = suggestions.area_id ? String(suggestions.area_id) : "";
      }
      toast.success("Suggestions loaded!", { id: loadingToast });
    } catch (err) {
      console.error("Failed to fetch suggested address from Redis matcher:", err);
      setAddressSuggestions(null);
      toast.dismiss(loadingToast);
    }

    const orderMatchesProvider = bookingOrder.courier === activeProvider;

    setBookingDetails({
      recipient_name: bookingOrder.customer_name || "",
      recipient_phone: bookingOrder.phone_number || "",
      recipient_address: bookingOrder.address || "",
      item_quantity: bookingOrder.item_quantity || 1,
      item_weight: bookingOrder.item_weight || 0.5,
      amount_to_collect: bookingOrder.price || 0,
      item_description: bookingOrder.product_name || "Order Parcel",
      store_id: pathaoConfig.store_id || stores[0]?.store_id || "",
      recipient_city: suggestedCity || (orderMatchesProvider && bookingOrder.city_id ? String(bookingOrder.city_id) : ""),
      recipient_zone: suggestedZone || (orderMatchesProvider && bookingOrder.zone_id ? String(bookingOrder.zone_id) : ""),
      recipient_area: suggestedArea || (orderMatchesProvider && bookingOrder.area_id ? String(bookingOrder.area_id) : ""),
      special_instruction: bookingOrder.special_instruction || ""
    });
    setCourierProviderModalOpen(false);
    setBookingModalOpen(true);
  };

  const handleBookCourier = async () => {
    if (!bookingDetails.recipient_address) {
      return toast.error("Please provide a valid delivery address.");
    }

    setBookingInProgress(true);
    const courierName = selectedCourier === "pathao" ? "Pathao" : "SteadFast";
    const loadingToast = toast.loading(`Booking parcel in ${courierName} Courier...`);

    try {
      let endpoint = "";
      let payload = {};

      if (selectedCourier === "pathao") {
        endpoint = "/courier/book-order/";
        payload = {
          order_id: bookingOrder.id,
          recipient_name: bookingDetails.recipient_name,
          recipient_phone: bookingDetails.recipient_phone,
          recipient_address: bookingDetails.recipient_address,
          item_quantity: bookingDetails.item_quantity,
          item_weight: bookingDetails.item_weight,
          amount_to_collect: bookingDetails.amount_to_collect,
          item_description: bookingDetails.item_description,
          store_id: bookingDetails.store_id || null,
          recipient_city: bookingDetails.recipient_city || null,
          recipient_zone: bookingDetails.recipient_zone || null,
          recipient_area: bookingDetails.recipient_area || null,
          special_instruction: bookingDetails.special_instruction || null
        };
      } else if (selectedCourier === "steadfast") {
        endpoint = "/courier/steadfast/book-order/";
        const selectedCity = bookingCities.find(city => String(city.city_id) === String(bookingDetails.recipient_city));
        const selectedArea = bookingAreas.find(area => String(area.area_id) === String(bookingDetails.recipient_area));
        payload = {
          order_id: bookingOrder.id,
          recipient_name: bookingDetails.recipient_name,
          recipient_phone: bookingDetails.recipient_phone,
          recipient_address: bookingDetails.recipient_address,
          recipient_city_name: selectedCity?.city_name || bookingDetails.recipient_city || null,
          recipient_area_name: selectedArea?.area_name || bookingDetails.recipient_area || null,
          item_quantity: bookingDetails.item_quantity,
          item_weight: bookingDetails.item_weight,
          amount_to_collect: bookingDetails.amount_to_collect,
          item_description: bookingDetails.item_description,
          special_instruction: bookingDetails.special_instruction || null
        };
      }

      const res = await api.post(endpoint, payload);
      toast.success(res.data.message || "Parcel successfully booked!", { id: loadingToast, icon: "🚚" });

      // Update order status and details locally
      const trackingPrefix = selectedCourier === "pathao" ? "Pathao Courier" : "SteadFast Courier";
      setOrders(prev => prev.map(o => {
        if (o.id === bookingOrder.id) {
          const tracking = `\n${trackingPrefix} Tracking ID: ${res.data.consignment_id}`;
          return {
            ...o,
            status: "shipped",
            courier: selectedCourier,
            courier_booking_info: {
              is_booked: true,
              provider: selectedCourier,
              provider_label: trackingPrefix,
              consignment_id: res.data.consignment_id,
              booking_status: "pending",
              error: null,
            },
            extra_info: o.extra_info ? o.extra_info + tracking : tracking.trim()
          };
        }
        return o;
      }));

      setBookingModalOpen(false);
    } catch (e) {
      const errText = e.response?.data?.error || "Failed to book parcel.";
      toast.error(errText, { id: loadingToast });
    } finally {
      setBookingInProgress(false);
    }
  };

  useEffect(() => {
    if (createStoreModalOpen) {
      api.get("/courier/cities/").then(res => setPathaoCities(res.data || [])).catch(console.error);
    }
  }, [createStoreModalOpen]);

  useEffect(() => {
    if (bookingModalOpen) {
      if (selectedCourier === "pathao") {
        api.get("/courier/cities/").then(res => setBookingCities(res.data || [])).catch(console.error);
      } else if (selectedCourier === "steadfast") {
        api.get("/courier/steadfast/cities/").then(res => setBookingCities(res.data || [])).catch(console.error);
      }
    }
  }, [bookingModalOpen, selectedCourier]);

  useEffect(() => {
    if (newStoreData.city_id) {
      api.get(`/courier/zones/?city_id=${newStoreData.city_id}`).then(res => setPathaoZones(res.data || [])).catch(console.error);
    } else {
      setPathaoZones([]);
    }
  }, [newStoreData.city_id]);

  useEffect(() => {
    if (newStoreData.zone_id) {
      api.get(`/courier/areas/?zone_id=${newStoreData.zone_id}`).then(res => setPathaoAreas(res.data || [])).catch(console.error);
    } else {
      setPathaoAreas([]);
    }
  }, [newStoreData.zone_id]);

  useEffect(() => {
    if (selectedCourier === "pathao") {
      if (bookingDetails.recipient_city) {
        api.get(`/courier/zones/?city_id=${bookingDetails.recipient_city}`).then(res => setBookingZones(res.data || [])).catch(console.error);
      } else {
        setBookingZones([]);
      }
    }
  }, [bookingDetails.recipient_city, selectedCourier]);

  useEffect(() => {
    if (selectedCourier === "pathao") {
      if (bookingDetails.recipient_zone) {
        api.get(`/courier/areas/?zone_id=${bookingDetails.recipient_zone}`).then(res => setBookingAreas(res.data || [])).catch(console.error);
      } else {
        setBookingAreas([]);
      }
    } else if (selectedCourier === "steadfast") {
      if (bookingDetails.recipient_city) {
        api.get(`/courier/steadfast/areas/?city_id=${bookingDetails.recipient_city}`).then(res => setBookingAreas(res.data || [])).catch(console.error);
      } else {
        setBookingAreas([]);
      }
    }
  }, [bookingDetails.recipient_city, bookingDetails.recipient_zone, selectedCourier]);

  useEffect(() => {
    if (addOrderModalOpen) {
      api.get("/courier/cities/").then(res => setManualCities(res.data || [])).catch(console.error);
    } else {
      setManualCities([]);
      setManualZones([]);
      setManualAreas([]);
      setSelectedManualCity("");
      setSelectedManualZone("");
      setSelectedManualArea("");
    }
  }, [addOrderModalOpen]);

  // Auto-select Courier City based on bookingOrder.district
  useEffect(() => {
    if (bookingModalOpen && bookingOrder && bookingCities.length > 0 && !bookingDetails.recipient_city) {
      const searchName = (bookingOrder.district || "").toLowerCase().trim();
      if (searchName) {
        const matched = bookingCities.find(c => {
          const cityName = (c.city_name || c.name || "").toLowerCase();
          return cityName.includes(searchName) || searchName.includes(cityName);
        });
        if (matched) {
          const cityId = matched.city_id || matched.id;
          setBookingDetails(prev => ({
            ...prev,
            recipient_city: String(cityId)
          }));
        }
      }
    }
  }, [bookingModalOpen, bookingOrder, bookingCities]);

  // Auto-select Pathao Zone based on bookingOrder.upazila
  useEffect(() => {
    if (bookingModalOpen && selectedCourier === "pathao" && bookingOrder && bookingZones.length > 0 && !bookingDetails.recipient_zone) {
      const searchName = (bookingOrder.upazila || "").toLowerCase().trim();
      if (searchName) {
        const matched = bookingZones.find(z => {
          const zoneName = (z.zone_name || "").toLowerCase();
          return zoneName.includes(searchName) || searchName.includes(zoneName);
        });
        if (matched) {
          setBookingDetails(prev => ({
            ...prev,
            recipient_zone: String(matched.zone_id)
          }));
        }
      }
    }
  }, [bookingModalOpen, selectedCourier, bookingOrder, bookingZones]);

  // Auto-select Courier Area based on bookingOrder.upazila
  useEffect(() => {
    if (bookingModalOpen && bookingOrder && bookingAreas.length > 0 && !bookingDetails.recipient_area) {
      const searchName = (bookingOrder.upazila || "").toLowerCase().trim();
      if (searchName) {
        const matched = bookingAreas.find(a => {
          const areaName = (a.area_name || a.name || "").toLowerCase();
          return areaName.includes(searchName) || searchName.includes(areaName);
        });
        if (matched) {
          const areaId = matched.area_id || matched.id;
          setBookingDetails(prev => ({
            ...prev,
            recipient_area: String(areaId)
          }));
        } else {
          const firstArea = bookingAreas[0];
          const areaId = firstArea.area_id || firstArea.id;
          setBookingDetails(prev => ({
            ...prev,
            recipient_area: String(areaId)
          }));
        }
      }
    }
  }, [bookingModalOpen, bookingOrder, bookingAreas]);

  // Apply pre-matched address suggestions when switching courier in booking modal
  useEffect(() => {
    if (bookingModalOpen && addressSuggestions) {
      const suggestions = selectedCourier === "pathao" ? addressSuggestions.pathao : addressSuggestions.steadfast;
      if (suggestions) {
        setBookingDetails(prev => ({
          ...prev,
          recipient_city: suggestions.city_id ? String(suggestions.city_id) : "",
          recipient_zone: suggestions.zone_id ? String(suggestions.zone_id) : "",
          recipient_area: suggestions.area_id ? String(suggestions.area_id) : ""
        }));
      }
    }
  }, [selectedCourier, bookingModalOpen, addressSuggestions]);

  useEffect(() => {
    if (selectedManualCity) {
      api.get(`/courier/zones/?city_id=${selectedManualCity}`).then(res => setManualZones(res.data || [])).catch(console.error);
    } else {
      setManualZones([]);
    }
    setSelectedManualZone("");
    setSelectedManualArea("");
  }, [selectedManualCity]);

  useEffect(() => {
    if (selectedManualZone) {
      api.get(`/courier/areas/?zone_id=${selectedManualZone}`).then(res => setManualAreas(res.data || [])).catch(console.error);
    } else {
      setManualAreas([]);
    }
    setSelectedManualArea("");
  }, [selectedManualZone]);

  useEffect(() => {
    const calculateDeliveryCharge = async () => {
      setCalculatingPrice(true);
      try {
        if (selectedCourier === "pathao") {
          if (
            bookingDetails.store_id &&
            bookingDetails.recipient_city &&
            bookingDetails.recipient_zone &&
            bookingDetails.item_weight
          ) {
            const payload = {
              store_id: bookingDetails.store_id,
              recipient_city: bookingDetails.recipient_city,
              recipient_zone: bookingDetails.recipient_zone,
              item_weight: bookingDetails.item_weight,
              item_type: 2,
              delivery_type: 48
            };
            const res = await api.post("/courier/price-calculator/", payload);
            setCalculatedPrice(res.data);
          } else {
            setCalculatedPrice(null);
          }
        } else {
          setCalculatedPrice(null);
        }
      } catch (err) {
        console.error("Price calculation failed", err);
        setCalculatedPrice(null);
      } finally {
        setCalculatingPrice(false);
      }
    };

    calculateDeliveryCharge();
  }, [
    selectedCourier,
    bookingDetails.store_id,
    bookingDetails.recipient_city,
    bookingDetails.recipient_zone,
    bookingDetails.recipient_area,
    bookingDetails.item_weight
  ]);

  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);

  const handleTrackOrder = async (consignmentId, orderObj = null) => {
    setLoadingTracking(true);
    setTrackingModalOpen(true);
    setTrackingDetails(null);
    setSelectedOrderForTracking(orderObj || null);
    try {
      const provider = orderObj?.courier_booking_info?.provider || (String(orderObj?.extra_info || '').toLowerCase().includes('steadfast') ? 'steadfast' : 'pathao');
      const endpoint = provider === 'steadfast'
        ? `/courier/steadfast/order-info/${consignmentId}/`
        : `/courier/order-info/${consignmentId}/`;
      const res = await api.get(endpoint);
      setTrackingDetails(res.data);
      if (res.data?.delivery_status === 'unknown' || res.data?.delivery_status === 'cancelled') {
        fetchOrders();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to fetch tracking details.");
    } finally {
      setLoadingTracking(false);
    }
  };

  const handleCreateStore = async () => {
    if (!newStoreData.name || !newStoreData.contact_name || !newStoreData.contact_number || !newStoreData.address || !newStoreData.city_id || !newStoreData.zone_id || !newStoreData.area_id) {
      toast.error("Please fill all required fields");
      return;
    }
    setIsCreatingStore(true);
    const loadingToast = toast.loading("Creating store...");
    try {
      const res = await api.post("/courier/stores/create/", newStoreData);
      toast.success("Store created successfully!", { id: loadingToast, icon: "🏪" });

      const storesRes = await api.get("/courier/stores/");
      setStores(storesRes.data || []);

      if (res.data.store_id) {
        setBookingDetails(prev => ({ ...prev, store_id: res.data.store_id }));
        setPathaoConfig(prev => ({ ...prev, store_id: res.data.store_id }));
      }

      setCreateStoreModalOpen(false);
      setNewStoreData({ name: "", contact_name: "", contact_number: "", address: "" });
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to create store", { id: loadingToast });
    } finally {
      setIsCreatingStore(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('orders/');
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setApiError("The order could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFormId = async () => {
    try {
      const response = await api.get('users/get-form-id/');
      setFormId(response.data.form_id);
    } catch (error) {
      console.error("Form ID fetch error:", error);
    }
  };



  const analyticsData = useMemo(() => {
    if (!orders.length) return null;
    const userCreateDate = user?.created_at ? new Date(user.created_at) : new Date(orders[orders.length - 1].created_at);
    const today = new Date();
    const dateLabels = [];
    const orderCounts = [];
    let currentDate = new Date(userCreateDate);
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dateLabels.push(currentDate.toLocaleDateString('en-EN', { day: 'numeric', month: 'short' }));
      const dayOrders = orders.filter(o => o.created_at.startsWith(dateStr));
      orderCounts.push(dayOrders.length);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    const pending = orders.filter(o => o.status === 'pending').length;
    const shipped = orders.filter(o => o.status === 'shipped').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    return { labels: dateLabels, lineData: orderCounts, statusData: [pending, shipped, delivered] };
  }, [orders, user]);

  const detailedAnalytics = useMemo(() => {
    if (!orders || orders.length === 0) return null;

    let totalRevenue = 0;
    let deliveredRevenue = 0;
    let totalItemsCount = 0;

    // Time-based calculations
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let todayRevenue = 0;
    let todayCount = 0;
    let weeklyRevenue = 0;
    let weeklyCount = 0;
    let monthlyRevenue = 0;
    let monthlyCount = 0;

    const dailyMap = {};
    const districtMap = {};
    const productMap = {};

    orders.forEach(o => {
      const price = Number(o.price) || 0;
      const qty = Number(o.item_quantity) || 1;
      totalRevenue += price;
      totalItemsCount += qty;

      const orderDate = o.created_at ? new Date(o.created_at) : new Date();
      const orderDateStr = o.created_at ? o.created_at.split('T')[0] : '';

      // Today's stats
      if (orderDateStr === todayStr) {
        todayRevenue += price;
        todayCount += 1;
      }

      // Weekly stats (Last 7 Days)
      if (orderDate >= sevenDaysAgo) {
        weeklyRevenue += price;
        weeklyCount += 1;
      }

      // Monthly stats (Last 30 Days)
      if (orderDate >= thirtyDaysAgo) {
        monthlyRevenue += price;
        monthlyCount += 1;
      }

      if (o.status === 'delivered') {
        deliveredRevenue += price;
      }

      // Date breakdown (YYYY-MM-DD)
      const dateStr = o.created_at ? o.created_at.split('T')[0] : 'Unknown';
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, count: 0, revenue: 0, deliveredRevenue: 0 };
      }
      dailyMap[dateStr].count += 1;
      dailyMap[dateStr].revenue += price;
      if (o.status === 'delivered') {
        dailyMap[dateStr].deliveredRevenue += price;
      }

      // District breakdown
      const dist = (o.district || 'Unspecified').trim();
      if (!districtMap[dist]) {
        districtMap[dist] = { district: dist, count: 0, revenue: 0 };
      }
      districtMap[dist].count += 1;
      districtMap[dist].revenue += price;

      // Product breakdown
      const prod = (o.product_name || 'Unspecified Product').trim();
      if (!productMap[prod]) {
        productMap[prod] = { name: prod, count: 0, revenue: 0, quantity: 0 };
      }
      productMap[prod].count += 1;
      productMap[prod].quantity += qty;
      productMap[prod].revenue += price;
    });

    const dailyIncomeList = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    const topDistricts = Object.values(districtMap).sort((a, b) => b.revenue - a.revenue || b.count - a.count);
    const topProducts = Object.values(productMap).sort((a, b) => b.count - a.count || b.revenue - a.revenue);

    const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
    const topDistrict = topDistricts[0] || { district: 'N/A', count: 0, revenue: 0 };
    const topProduct = topProducts[0] || { name: 'N/A', count: 0, revenue: 0 };

    return {
      totalRevenue,
      deliveredRevenue,
      avgOrderValue,
      totalOrders: orders.length,
      totalItemsCount,
      todayRevenue,
      todayCount,
      weeklyRevenue,
      weeklyCount,
      monthlyRevenue,
      monthlyCount,
      dailyIncomeList,
      topDistricts,
      topProducts,
      topDistrict,
      topProduct
    };
  }, [orders]);

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Daily Order Growth' },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  };

  const districts = useMemo(() => {
    const list = orders.map(o => o.district).filter(Boolean);
    return ["all", ...new Set(list)];
  }, [orders]);

  const searchDistrictFiltered = useMemo(() => {
    return orders.filter(order => {
      const matchSearch = (order.customer_name + order.phone_number + (order.upazila || "") + (order.district || "")).toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "all" || order.status === statusFilter;
      const matchDistrict = districtFilter === "all" || order.district === districtFilter;
      return matchSearch && matchStatus && matchDistrict;
    });
  }, [orders, searchTerm, statusFilter, districtFilter]);

  const rangeOrders = useMemo(() => {
    return searchDistrictFiltered.filter(order => {
      if (!startDate && !endDate) return true;
      const orderDateStr = order.created_at ? order.created_at.split('T')[0] : "";
      if (startDate && orderDateStr < startDate) return false;
      if (endDate && orderDateStr > endDate) return false;
      return true;
    });
  }, [searchDistrictFiltered, startDate, endDate]);

  const undeliveredOrders = useMemo(() => {
    const rangeOrderIds = new Set(rangeOrders.map(o => o.id));
    return orders.filter(order => {
      if (order.status === 'delivered') return false;
      if (rangeOrderIds.has(order.id)) return false;
      const matchSearch = (order.customer_name + order.phone_number + (order.upazila || "") + (order.district || "")).toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "all" || order.status === statusFilter;
      const matchDistrict = districtFilter === "all" || order.district === districtFilter;
      return matchSearch && matchStatus && matchDistrict;
    });
  }, [orders, rangeOrders, searchTerm, statusFilter, districtFilter]);

  const allVisibleOrders = useMemo(() => {
    return [...rangeOrders, ...undeliveredOrders];
  }, [rangeOrders, undeliveredOrders]);

  const toggleSelect = (id) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === allVisibleOrders.length && allVisibleOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(allVisibleOrders.map(o => o.id));
    }
  };

  const renderOrderCard = (order) => {
    const isSelected = selectedOrders.includes(order.id);
    const customerInfo = order.customer_info || {};
    const hasAccount = Boolean(customerInfo.has_account || order.customer_id || order.customer);
    const customerAvatarUrl = customerInfo.avatar_url || order.customer_profile_photo;
    const customerName = customerInfo.name || order.customer_name || "Guest Customer";
    const platforms = customerInfo.platforms && customerInfo.platforms.length > 0
      ? customerInfo.platforms
      : [{ platform: order.source_platform || 'web', label: order.source_platform || 'Web Store' }];

    const productInfo = order.product_info || {};
    const orderItems = order.order_items || [];
    const primaryItem = orderItems[0] || {};
    const productImage = productInfo.image || primaryItem.image || order.photo_url || null;
    const productCategory = productInfo.category || primaryItem.category || null;
    const productSku = productInfo.sku || primaryItem.sku || null;
    const productName = productInfo.name || primaryItem.name || order.product_name || "Product";

    const formattedDate = order.created_at
      ? new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : "N/A";
    const formattedTime = order.created_at
      ? new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : "";

    return (
      <div
        key={order.id}
        className={`bg-white border rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:shadow-lg flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
          : 'border-slate-200 hover:border-indigo-300'
          }`}
      >
        {/* --- SECTION 1: Customer Profile, Account Badge & Platforms --- */}
        <div className="flex items-start gap-3.5 w-full xl:w-4/12 min-w-0">
          <button
            onClick={() => toggleSelect(order.id)}
            className="mt-2 text-slate-300 hover:text-indigo-600 transition-colors flex-shrink-0"
            title="Select order"
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-indigo-600" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>

          <CustomerAvatar
            name={customerName}
            avatarUrl={customerAvatarUrl}
            hasAccount={hasAccount}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate leading-snug">
                {customerName}
              </h3>
              {hasAccount ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Account
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500">
                  Guest
                </span>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono ml-auto sm:ml-0 flex-shrink-0">
                #{order.public_id || order.id}
              </span>

              {/* Call Verification Badges */}
              {(order.call_status === 'confirmed') && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                  <PhoneCall className="w-2.5 h-2.5 text-emerald-600" /> Verified by Call
                </span>
              )}
              {(order.call_status === 'unverified_call' || order.call_status === 'uncalled') && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                  <PhoneForwarded className="w-2.5 h-2.5 text-amber-700 animate-pulse" /> Needs Manual Call
                </span>
              )}
              {order.call_status === 'cancelled' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                  <PhoneOff className="w-2.5 h-2.5 text-rose-600" /> Cancelled via Call
                </span>
              )}
              {order.call_status === 'human_requested' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300 shadow-2xs">
                  <Headphones className="w-2.5 h-2.5 text-indigo-600" /> Support Requested
                </span>
              )}
            </div>

            {/* Platforms (Facebook Friends Overlapping Style) & Phone */}
            <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-500 font-medium mb-1">
              <CustomerPlatformBadges platforms={platforms} defaultPlatform={order.source_platform} />
              <a
                href={`tel:${order.phone_number}`}
                className="flex items-center gap-1 hover:text-indigo-600 transition-colors font-semibold"
              >
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{order.phone_number || "No phone"}</span>
              </a>
            </div>

            {/* Location / District */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">
                {[order.upazila, order.district].filter(Boolean).join(", ") || "No address specified"}
              </span>
            </div>
          </div>
        </div>

        {/* --- SECTION 2: Product Catalog Info & Image --- */}
        <div className="flex items-start gap-3 w-full xl:w-5/12 border-t xl:border-t-0 xl:border-l xl:border-r border-slate-100 pt-3 xl:pt-0 pb-3 xl:pb-0 px-0 xl:px-5 min-w-0">
          {/* Catalog Product Image Thumbnail */}
          <div className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0 shadow-xs flex items-center justify-center">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-200"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-300">
                <Package className="w-6 h-6" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Catalog</span>
              </div>
            )}
            {orderItems.length > 1 && (
              <span className="absolute bottom-1 right-1 bg-slate-900/80 backdrop-blur-xs text-white font-black text-[9px] px-1 rounded">
                +{orderItems.length}
              </span>
            )}
          </div>

          {/* Product Specs & Badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold text-slate-900 text-xs sm:text-sm truncate max-w-[200px] sm:max-w-[260px]" title={productName}>
                {productName}
              </span>
              {productCategory && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <Tag className="w-2.5 h-2.5" /> {productCategory}
                </span>
              )}
              {productSku && (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  SKU: {productSku}
                </span>
              )}
            </div>

            {/* Price, Quantity & Add-on tags */}
            <div className="flex items-center flex-wrap gap-2 mb-1.5">
              {order.price > 0 ? (
                <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                  ৳ {Number(order.price).toLocaleString()}
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-400 italic">No price</span>
              )}

              {order.item_quantity && (
                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  Qty: {order.item_quantity}
                </span>
              )}

              {order.delivery_charge > 0 && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  Delivery: ৳{order.delivery_charge}
                </span>
              )}

              {order.item_weight && (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                  {order.item_weight} kg
                </span>
              )}

              {/* Courier Dispatch Status Badge */}
              {order.courier_booking_info?.is_booked ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${order.courier_booking_info.provider === "pathao"
                      ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}
                    title={`Consignment ID: ${order.courier_booking_info.consignment_id}`}
                  >
                    <Truck className="w-3 h-3" />
                    Sent to {order.courier_booking_info.provider === "pathao" ? "Pathao" : "SteadFast"} • #{order.courier_booking_info.consignment_id}
                  </span>

                  {order.courier_booking_info?.latest_status_label && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      {order.courier_booking_info.latest_status_label}
                    </span>
                  )}
                </div>
              ) : order.status === "cancelled" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                  <Truck className="w-3 h-3 opacity-70" /> Courier Cancelled
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${order.courier_booking_info?.error
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  title={order.courier_booking_info?.error || "Not booked in courier yet"}
                >
                  <Truck className="w-3 h-3" />
                  {order.courier_booking_info?.error
                    ? "Courier Dispatch Failed"
                    : `Not Sent to Courier (${(order.courier && order.courier !== "manual" ? order.courier : defaultCourierProvider).toUpperCase()})`}
                </span>
              )}
            </div>

            {order.courier_booking_info?.latest_reason && (
              <div className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md mb-1 border border-rose-200 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                <span>কুরিয়ার নোট/কারণ: {order.courier_booking_info.latest_reason}</span>
              </div>
            )}

            {order.courier_booking_info?.error && !order.courier_booking_info?.is_booked && (
              <div className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg mb-1.5 border border-rose-200 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="truncate" title={order.courier_booking_info.error}>
                  {order.courier_booking_info.error}
                </span>
              </div>
            )}

            {/* Address & Note snippet */}
            <div className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed" title={order.address}>
              <span className="font-bold text-slate-400 uppercase text-[9px] mr-1">Address:</span> {order.address || "No address provided"}
            </div>

            {order.special_instruction && (
              <div className="text-[10px] font-medium text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded mt-1 border border-amber-200/50 line-clamp-1" title={order.special_instruction}>
                Note: {order.special_instruction}
              </div>
            )}
          </div>
        </div>

        {/* --- SECTION 3: Order Actions, Date & Status --- */}
        <div className="flex flex-col sm:flex-row xl:flex-col items-end justify-between xl:justify-center gap-3 w-full xl:w-3/12 border-t xl:border-t-0 border-slate-100 pt-3 xl:pt-0">
          <div className="text-left sm:text-right xl:text-right w-full sm:w-auto xl:w-full flex sm:block xl:block justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Ordered</span>
            <div className="text-xs font-bold text-slate-700">
              {formattedDate} {formattedTime && <span className="text-[10px] text-slate-400 font-normal">({formattedTime})</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto xl:w-full justify-end">
            <button
              onClick={() => handlePrint([order])}
              title="Print Order Invoice"
              className="p-2 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200 hover:border-indigo-200 shadow-sm"
            >
              <Printer className="w-4 h-4" />
            </button>

            {!order.courier_booking_info?.is_booked && !["shipped", "delivered", "cancelled"].includes(order.status) && (
              <button
                onClick={() => (courierActive || steadfastActive) ? openBookingModal(order) : setCourierConfigModalOpen(true)}
                title={(courierActive || steadfastActive) ? "Send to Courier (Pathao / SteadFast)" : "Configure Courier"}
                className={`px-2.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-[11px] font-bold active:scale-95 ${(courierActive || steadfastActive)
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600'
                  : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200'
                  }`}
              >
                <Truck className="w-4 h-4" />
                <span className="hidden sm:inline">Send Courier</span>
              </button>
            )}

            {(order.courier_booking_info?.consignment_id || getConsignmentId(order.extra_info)) && (
              <button
                onClick={() => handleTrackOrder(order.courier_booking_info?.consignment_id || getConsignmentId(order.extra_info), order)}
                title="Track Delivery & View Live Events"
                className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100 shadow-sm flex items-center justify-center active:scale-95"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            <div className="relative flex-1 sm:flex-none">
              <select
                value={order.status}
                onChange={(e) => updateStatus(order.id, e.target.value)}
                className={`w-full appearance-none pl-3 pr-8 py-1.5 sm:py-2 rounded-xl font-bold text-xs uppercase tracking-wide cursor-pointer transition-colors border shadow-sm ${order.status === 'delivered'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-2 focus:ring-emerald-500'
                  : order.status === 'shipped'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 focus:ring-2 focus:ring-indigo-500'
                    : order.status === 'confirmed'
                      ? 'bg-teal-50 text-teal-700 border-teal-200 focus:ring-2 focus:ring-teal-500'
                      : order.status === 'cancelled'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-2 focus:ring-rose-500'
                        : 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-2 focus:ring-amber-500'
                  }`}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none rotate-90 opacity-60" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-64 bg-white border border-slate-200 rounded-[2.5rem] animate-pulse shadow-sm" />
      ))}
    </div>
  );

  // --- ২. স্ট্যাটাস আপডেট (ইউজার ফ্রেন্ডলি) ---
  const updateStatus = async (id, s) => {
    const loadingToast = toast.loading(`${s} Updating status...`);
    try {
      await api.patch(`orders/${id}/`, { status: s });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: s } : o));

      toast.success(`Order now ${s}`, { id: loadingToast });
    } catch (error) {
      toast.error("Update failed. Check network.", { id: loadingToast });
    }
  };


  const handlePrint = (orderList = null) => {
    // ১. অর্ডার লিস্ট ফিল্টার করা
    const ordersToPrint = orderList || orders.filter(o => selectedOrders.includes(o.id));

    // ২. সিলেক্ট না করলে এরর টোস্ট
    if (ordersToPrint.length === 0) {
      return toast.error("Select at least one order to print.", {
        icon: '🖨️',
      });
    }

    // ৩. প্রিন্ট উইন্ডো ওপেন করা
    const printWindow = window.open('', '_blank');

    // পপ-আপ ব্লকার চেক
    if (!printWindow) {
      return toast.error("Your browser has blocked pop-ups! Allow them in settings.");
    }

    toast.success(`${ordersToPrint.length}Generating invoices...`);

    // ৪. ইনভয়েস কন্টেন্ট রাইটিং
    printWindow.document.write(`
      <html>
    <head>
      <title>Invoice - #${ordersToPrint[0]?.id || 'Print'}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: 'Inter', sans-serif; 
          background-color: #f3f4f6; 
          color: #1f2937;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .page { 
          background: white;
          width: 210mm; 
          min-height: 297mm; 
          padding: 15mm 20mm; 
          margin: 10mm auto;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          page-break-after: always;
        }

        /* Header Segment */
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 25px;
          margin-bottom: 30px;
        }
        .company-logo {
          width: 80px;
          height: 80px;
          object-fit: cover;
          border-radius: 12px;
          margin-bottom: 12px;
          border: 1px solid #e5e7eb;
        }

        .company-details h1 {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .company-details p {
          color: #6b7280;
          font-size: 14px;
        }

        .invoice-title-block {
          text-align: right;
        }
        .invoice-title-block h2 {
          font-size: 36px;
          font-weight: 800;
          color: #3b82f6; /* Professional Blue */
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 10px;
        }
        .invoice-meta {
          font-size: 14px;
          color: #4b5563;
        }
        .invoice-meta strong { color: #111827; }

        /* Billing Segment */
        .billing-grid {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }

        .bill-to-section {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
          width: 60%;
        }

        .customer-avatar {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #d1d5db;
        }

        .bill-to-section h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        .bill-to-details h4 {
          font-size: 18px;
          color: #111827;
          margin-bottom: 4px;
        }
        .bill-to-details p {
          font-size: 14px;
          color: #4b5563;
          line-height: 1.5;
        }

        .payment-info {
          width: 35%;
        }
        .payment-info h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        .payment-info-line {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #e5e7eb;
        }
        .payment-info-line span { color: #6b7280; }
        .payment-info-line strong { color: #111827; }

        /* Table Segment */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 40px;
        }
        th {
          background-color: #3b82f6;
          color: white;
          font-size: 13px;
          text-transform: uppercase;
          padding: 12px 15px;
          text-align: left;
          letter-spacing: 1px;
        }
        th:last-child {
          text-align: right;
          border-top-right-radius: 6px;
          border-bottom-right-radius: 6px;
        }
        th:first-child {
          border-top-left-radius: 6px;
          border-bottom-left-radius: 6px;
        }
        td {
          padding: 15px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 15px;
          color: #374151;
        }
        td:last-child {
          text-align: right;
        }

        .item-name { font-weight: 600; color: #111827; margin-bottom: 4px; display: block; }
        .item-desc { font-size: 13px; color: #6b7280; }

        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-shipped { background: #dbeafe; color: #1e40af; }
        .status-delivered { background: #d1fae5; color: #065f46; }

        /* Footer Segment */
        .invoice-footer {
          margin-top: auto;
          border-top: 2px solid #e5e7eb;
          padding-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .footer-thanks {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }
        .footer-contact {
          font-size: 13px;
          color: #6b7280;
          text-align: right;
        }

        @media print {
          body { background: white; }
          .page { 
            margin: 0; 
            padding: 10mm; 
            box-shadow: none; 
            width: 100%;
            height: auto;
          }
        }
      </style>
    </head>
    <body>
      ${ordersToPrint.map(o => {
      let statusClass = 'status-pending';
      if (o.status === 'shipped') statusClass = 'status-shipped';
      if (o.status === 'delivered') statusClass = 'status-delivered';

      return `
        <div class="page">
          
          <div class="invoice-header">
            <div class="company-details">
              ${o.customer_profile_photo ? `<img src="${o.customer_profile_photo}" class="company-logo" alt="Logo" />` : ''}
              <h1>${shopName}</h1>
              <p>Your Trusted Shopping Partner</p>
            </div>
            <div class="invoice-title-block">
              <h2>INVOICE</h2>
              <div class="invoice-meta">
                <p>Invoice No: <strong>#INV-${10000 + !!o.id ? o.id : 0}</strong></p>
                <p>Date: <strong>${new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></p>
              </div>
            </div>
          </div>

          <div class="billing-grid">
            <div class="bill-to-section">
              <div class="bill-to-details">
                <h3>Billed To</h3>
                <h4>${o.customer_name}</h4>
                <p>${o.phone_number}</p>
                <p>${o.address}</p>
                <p>${o.upazila ? o.upazila + ', ' : ''}${o.district}</p>
              </div>
            </div>
            
            <div class="payment-info">
              <h3>Order Details</h3>
              <div class="payment-info-line">
                <span>Payment Method</span>
                <strong>Cash on Delivery</strong>
              </div>
              <div class="payment-info-line">
                <span>Delivery Type</span>
                <strong>Home Delivery</strong>
              </div>
              <div class="payment-info-line">
                <span>Notes/Extra</span>
                <strong>${o.extra_info ? o.extra_info.substring(0, 20) + (o.extra_info.length > 20 ? '...' : '') : 'N/A'}</strong>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 45%;">Item Description</th>
                <th style="width: 10%; text-align: center;">Qty</th>
                <th style="width: 15%; text-align: right;">Unit Price</th>
                <th style="width: 10%; text-align: center;">Status</th>
                <th style="width: 15%;">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>
                  <span class="item-name">${o.product_name || "Premium Product"}</span>
                  <span class="item-desc">Product order from ${shopName}</span>
                </td>
                <td style="text-align: center; font-weight: 600;">1</td>
                <td style="text-align: right; font-weight: 500;">৳ ${Number(o.price || 0).toLocaleString()}</td>
                <td style="text-align: center;">
                  <span class="status-badge ${statusClass}">${o.status}</span>
                </td>
                <td style="text-align: right; font-weight: 700; color: #111827;">৳ ${Number(o.price || 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
            <div style="width: 300px; border-top: 2px solid #e5e7eb; padding-top: 15px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px;">
                <span style="color: #6b7280;">Subtotal:</span>
                <span style="font-weight: 600;">৳ ${Number(o.price || 0).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px;">
                <span style="color: #6b7280;">Shipping:</span>
                <span style="font-weight: 600;">৳ 0</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e5e7eb; font-size: 18px;">
                <span style="color: #111827; font-weight: 800;">Total:</span>
                <span style="color: #3b82f6; font-weight: 800;">৳ ${Number(o.price || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div class="invoice-footer">
            <div class="footer-thanks">
              Thank you for your business!
            </div>
            <div class="footer-contact">
              ${businessEmail || `support@${shopName.toLowerCase().replace(/\s/g, '')}.com`}<br/>
              ${websiteUrl || `www.${shopName.toLowerCase().replace(/\s/g, '')}.com`}
            </div>
          </div>

        </div>
        `;
    }).join('')}
    </body>
  </html>
    `);

    printWindow.document.close();

    // ৫. ইমেজ বা ফন্ট লোড হওয়ার জন্য সামান্য বিরতি দিয়ে প্রিন্ট ডায়ালগ ওপেন করা
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <div className="p-2 sm:p-4 md:p-10 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans overflow-x-hidden">

      {/* HEADER & LINK SHARE */}
      <div className="mb-6 flex flex-col lg:flex-row justify-between items-center lg:items-end gap-4 md:gap-6">
        <div className="space-y-1 w-full text-center lg:text-left">
          <div className="flex items-center gap-2 text-indigo-600 font-bold bg-indigo-50 w-fit px-3 py-1 rounded-full text-[9px] md:text-xs uppercase tracking-widest border border-indigo-100 mx-auto lg:mx-0">
            <Store className="w-3 md:w-4 h-3 md:h-4" /> {shopName}
          </div>
          <h1 className="text-2xl xs:text-3xl md:text-5xl font-black text-gray-900 tracking-tighter leading-tight">
            Order <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Center</span>
          </h1>

          {/* Action Buttons row at the top */}
          <div className="mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <button onClick={() => { setCourierFormMode("list"); setCourierConfigModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-[10px] md:text-xs transition-all border border-indigo-200 shadow-sm active:scale-95">
              <Truck className="w-4 h-4" /> Manage Couriers
            </button>
            <button onClick={() => setAddOrderModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-[10px] md:text-xs transition-all border border-emerald-200 shadow-sm active:scale-95">
              <Package className="w-4 h-4" /> Add Custom Order
            </button>
          </div>
        </div>

        <div className="w-full lg:w-[480px]">
          <div className="bg-white border border-indigo-100 p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col gap-4 border-b-4 border-b-indigo-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Store className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Invoice Branding Settings</h3>
                <p className="text-[9px] font-bold text-slate-400">Configure custom contact info displayed on order invoices</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <div className="flex flex-col gap-1 w-full">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest pl-1">Business Email</span>
                <div className="relative flex items-center w-full">
                  <Mail className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    placeholder="shop@email.com"
                    className="pl-9 pr-3 py-2 bg-slate-50 hover:bg-slate-100/50 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 w-full">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest pl-1">Website URL</span>
                <div className="relative flex items-center w-full">
                  <Globe className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="www.shop.com"
                    className="pl-9 pr-3 py-2 bg-slate-50 hover:bg-slate-100/50 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full transition-all"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={saveProfileSettings}
              disabled={isSavingProfile}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-black text-xs transition-all active:scale-95 shadow-md hover:shadow-lg disabled:opacity-50 w-full"
            >
              {isSavingProfile ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Save Invoice Branding</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex justify-center mb-6">
        <div className="bg-white p-1 rounded-full shadow-md border border-indigo-50 inline-flex gap-1">
          <button
            onClick={() => setViewMode("orders")}
            className={`flex items-center gap-1.5 px-4 md:px-8 py-2 md:py-3 rounded-full font-bold text-[10px] md:text-sm transition-all ${viewMode === 'orders' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
          >
            <LayoutDashboard className="w-3 md:w-4 h-3 md:h-4" /> <span className="whitespace-nowrap">Order List</span>
          </button>
          <button
            onClick={() => setViewMode("analytics")}
            className={`flex items-center gap-1.5 px-4 md:px-8 py-2 md:py-3 rounded-full font-bold text-[10px] md:text-sm transition-all ${viewMode === 'analytics' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
          >
            <BarChart3 className="w-3 md:w-4 h-3 md:h-4" /> <span className="whitespace-nowrap">Analytics</span>
          </button>
        </div>
      </div>

      {/* ANALYTICS VIEW */}
      {viewMode === "analytics" && (
        <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">

          {/* FINANCIAL SUMMARY CARDS */}
          {detailedAnalytics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 p-6 md:p-8 rounded-[2.5rem] shadow-xl text-white group">
                <DollarSign className="absolute -right-4 -top-4 w-28 h-28 text-white/10 rotate-12 group-hover:scale-110 transition-transform" />
                <p className="text-indigo-200 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-2">Total Sales / Revenue</p>
                <h3 className="text-2xl md:text-4xl font-black tracking-tight">৳ {detailedAnalytics.totalRevenue.toLocaleString()}</h3>
                <p className="mt-3 text-indigo-200/80 text-xs font-bold">From {detailedAnalytics.totalOrders} Total Orders</p>
              </div>

              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-emerald-100 flex flex-col justify-between group hover:border-emerald-500 transition-all">
                <div>
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <Check className="w-6 h-6" />
                  </div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Delivered Revenue</p>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900">৳ {detailedAnalytics.deliveredRevenue.toLocaleString()}</h3>
                  <p className="text-xs font-bold text-emerald-600 mt-1">Successfully Delivered</p>
                </div>
              </div>

              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-indigo-50 flex flex-col justify-between group hover:border-indigo-500 transition-all">
                <div>
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Avg Order Value (AOV)</p>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900">৳ {detailedAnalytics.avgOrderValue.toLocaleString()}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">Per Order Average</p>
                </div>
              </div>

              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-amber-100 flex flex-col justify-between group hover:border-amber-500 transition-all">
                <div>
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-4 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                    <Award className="w-6 h-6" />
                  </div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Top District & Product</p>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 truncate" title={detailedAnalytics.topDistrict.district}>
                    📍 {detailedAnalytics.topDistrict.district} ({detailedAnalytics.topDistrict.count} Orders)
                  </p>
                  <p className="text-xs font-black text-indigo-600 truncate mt-1" title={detailedAnalytics.topProduct.name}>
                    🛍️ {detailedAnalytics.topProduct.name} ({detailedAnalytics.topProduct.count} Sold)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SALES PERIOD BREAKDOWN (TODAY, WEEKLY, MONTHLY, TOTAL) */}
          {detailedAnalytics && (
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
              <div>
                <h4 className="text-lg md:text-xl font-black text-slate-900 italic uppercase tracking-tighter flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" /> Sales Period Summary (সময়ভিত্তিক বিক্রির হিসাব)
                </h4>
                <p className="text-slate-400 text-[10px] md:text-xs font-bold">Compare your sales performance across different time intervals</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Today (আজকের হিসাব)", revenue: detailedAnalytics.todayRevenue, count: detailedAnalytics.todayCount, bg: "from-pink-500/10 to-pink-500/5", border: "border-pink-200/60", text: "text-pink-600" },
                  { label: "This Week (এই সপ্তাহের হিসাব)", revenue: detailedAnalytics.weeklyRevenue, count: detailedAnalytics.weeklyCount, bg: "from-indigo-500/10 to-indigo-500/5", border: "border-indigo-200/60", text: "text-indigo-600" },
                  { label: "This Month (এই মাসের হিসাব)", revenue: detailedAnalytics.monthlyRevenue, count: detailedAnalytics.monthlyCount, bg: "from-purple-500/10 to-purple-500/5", border: "border-purple-200/60", text: "text-purple-600" },
                  { label: "Total Lifetime (সর্বমোট হিসাব)", revenue: detailedAnalytics.totalRevenue, count: detailedAnalytics.totalOrders, bg: "from-emerald-500/10 to-emerald-500/5", border: "border-emerald-200/60", text: "text-emerald-600" }
                ].map((item, idx) => (
                  <div key={idx} className={`p-5 rounded-3xl bg-gradient-to-br ${item.bg} border ${item.border} flex flex-col justify-between hover:shadow-md transition-all`}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">{item.label}</span>
                    <div>
                      <span className={`text-xl md:text-2xl font-black ${item.text}`}>৳ {item.revenue.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 font-bold block mt-1">{item.count} Orders</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DAILY INCOME CHART & STATUS SPLIT */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Income Line Chart */}
            <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-lg md:text-xl font-black text-slate-900 italic uppercase tracking-tighter flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" /> Daily Income Trajectory (দৈনিক ইনকাম)
                  </h4>
                  <p className="text-slate-400 text-[10px] font-bold">Revenue generated per day in ৳</p>
                </div>
                <div className="bg-emerald-50 px-3 py-1.5 rounded-xl text-emerald-700 font-black text-[10px] uppercase border border-emerald-100">
                  Revenue Track
                </div>
              </div>

              <div className="h-[300px] md:h-[350px] w-full">
                {detailedAnalytics && (
                  <Line
                    data={{
                      labels: detailedAnalytics.dailyIncomeList.map(d => new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
                      datasets: [{
                        label: 'Revenue (৳)',
                        data: detailedAnalytics.dailyIncomeList.map(d => d.revenue),
                        borderColor: '#10b981',
                        borderWidth: 4,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#10b981',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.4,
                        fill: true,
                        backgroundColor: (context) => {
                          const ctx = context.chart.ctx;
                          const gradient = ctx.createLinearGradient(0, 0, 0, 350);
                          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
                          gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
                          return gradient;
                        },
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: '#1e293b',
                          padding: 12,
                          callbacks: {
                            label: (context) => `Revenue: ৳ ${context.raw.toLocaleString()}`
                          }
                        }
                      },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } },
                        y: {
                          grid: { color: '#f8fafc' },
                          ticks: {
                            font: { size: 10, weight: 'bold' },
                            callback: (val) => `৳ ${val.toLocaleString()}`
                          }
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-slate-900 p-8 md:p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="text-center mb-8 relative z-10">
                <h4 className="text-white text-xl font-black italic uppercase tracking-tighter">Order Status Split</h4>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Delivery Fulfillment Ratio</p>
              </div>

              <div className="w-full max-w-[200px] md:max-w-[240px] relative z-10 transition-transform group-hover:scale-105 duration-500">
                {analyticsData && (
                  <Doughnut
                    data={{
                      labels: ['Pending', 'Shipped', 'Delivered'],
                      datasets: [{
                        data: analyticsData.statusData,
                        backgroundColor: ['#fbbf24', '#6366f1', '#10b981'],
                        borderWidth: 0,
                        hoverOffset: 15
                      }]
                    }}
                    options={{
                      cutout: '75%',
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: '#1e293b',
                          padding: 12,
                          titleFont: { size: 14, weight: 'bold' },
                          cornerRadius: 12
                        }
                      }
                    }}
                  />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-white text-3xl font-black">{orders.length}</span>
                  <span className="text-slate-500 text-[8px] font-black uppercase tracking-widest">Total Orders</span>
                </div>
              </div>

              <div className="mt-8 w-full space-y-3 relative z-10">
                {[
                  { label: 'Pending', count: orders.filter(o => o.status === 'pending').length, color: 'bg-amber-400' },
                  { label: 'Shipped', count: orders.filter(o => o.status === 'shipped').length, color: 'bg-indigo-500' },
                  { label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length, color: 'bg-emerald-500' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-white/80">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                    </div>
                    <span className="text-xs font-black">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DISTRICT & PRODUCT BREAKDOWN SECTION */}
          {detailedAnalytics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* District Breakdown (কোন জেলার মানুষ বেশি নিয়েছে) */}
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight italic">
                        District Sales Breakdown (কোন জেলার মানুুষ বেশি নিয়েছে)
                      </h4>
                      <p className="text-[10px] md:text-xs font-bold text-slate-400">Top purchasing districts by order volume and revenue</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                  {detailedAnalytics.topDistricts.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs font-bold py-6">No district data available</p>
                  ) : (
                    detailedAnalytics.topDistricts.map((d, idx) => {
                      const percent = detailedAnalytics.totalOrders > 0 ? Math.round((d.count / detailedAnalytics.totalOrders) * 100) : 0;
                      return (
                        <div key={d.district} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${idx === 0 ? 'bg-amber-400 text-slate-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {idx + 1}
                              </span>
                              <span className="font-bold text-sm text-slate-800">{d.district}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-indigo-600">৳ {d.revenue.toLocaleString()}</span>
                              <span className="text-[10px] text-slate-400 font-bold block">{d.count} Orders ({percent}%)</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Product Performance Breakdown (কোন প্রোডাক্ট বেশি নিয়েছে) */}
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-pink-50 text-pink-600 rounded-2xl">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight italic">
                        Product Performance (কোন প্রোডাক্ট বেশি নিয়েছে)
                      </h4>
                      <p className="text-[10px] md:text-xs font-bold text-slate-400">Best-selling products ranked by order count & revenue</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                  {detailedAnalytics.topProducts.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs font-bold py-6">No product data available</p>
                  ) : (
                    detailedAnalytics.topProducts.map((p, idx) => {
                      const percent = detailedAnalytics.totalOrders > 0 ? Math.round((p.count / detailedAnalytics.totalOrders) * 100) : 0;
                      return (
                        <div key={p.name} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-pink-200 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-pink-500 text-white' : idx === 1 ? 'bg-purple-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {idx + 1}
                              </span>
                              <span className="font-bold text-sm text-slate-800 truncate" title={p.name}>{p.name}</span>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="text-xs font-black text-pink-600">৳ {p.revenue.toLocaleString()}</span>
                              <span className="text-[10px] text-slate-400 font-bold block">{p.count} Orders | Qty: {p.quantity}</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-pink-500 to-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* DAILY INCOME TABLE BREAKDOWN */}
          {detailedAnalytics && (
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" /> Date-wise Income Breakdown (দৈনিক ইনকাম তালিকা)
                  </h4>
                  <p className="text-[10px] md:text-xs font-bold text-slate-400">Detailed list of income and orders for each day</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="pb-3 px-4">Date (তারিখ)</th>
                      <th className="pb-3 px-4 text-center">Total Orders</th>
                      <th className="pb-3 px-4 text-right">Total Revenue (৳)</th>
                      <th className="pb-3 px-4 text-right">Delivered Revenue (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
                    {detailedAnalytics.dailyIncomeList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">No income history found</td>
                      </tr>
                    ) : (
                      [...detailedAnalytics.dailyIncomeList].sort((a, b) => b.date.localeCompare(a.date)).map((row) => (
                        <tr key={row.date} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-900">
                            {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-black text-[10px]">
                              {row.count} Orders
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            ৳ {row.revenue.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">
                            ৳ {row.deliveredRevenue.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ORDERS VIEW */}
      {viewMode === "orders" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

          {/* Date Filter Bar */}
          <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
                  Order Date Filter
                </h3>
                <p className="text-[10px] md:text-xs font-semibold text-slate-400">
                  Default: Current Day Orders. Filter by custom range or presets.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Presets */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                {[
                  { id: "today", label: "Today" },
                  { id: "7d", label: "7 Days" },
                  { id: "30d", label: "30 Days" },
                  { id: "month", label: "This Month" },
                  { id: "all", label: "All Time" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePresetChange(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${selectedPreset === p.id
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs */}
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Start:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setSelectedPreset("custom");
                    }}
                    className="bg-white text-xs font-bold text-slate-700 px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">End:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setSelectedPreset("custom");
                    }}
                    className="bg-white text-xs font-bold text-slate-700 px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleCustomDateApply}
                  className="px-3 py-1 bg-slate-900 text-white text-xs font-black rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Apply
                </button>
              </div>

              {/* Reset */}
              {(startDate !== getTodayStr() || endDate !== getTodayStr() || selectedPreset !== "today") && (
                <button
                  onClick={() => handlePresetChange("today")}
                  className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  title="Reset to Today"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Search & District Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white shadow-sm rounded-xl text-xs md:text-sm outline-none border border-transparent focus:border-indigo-500"
                placeholder="Search orders..."
              />
            </div>
            <select onChange={(e) => setDistrictFilter(e.target.value)} className="bg-white shadow-sm rounded-xl px-4 py-3 text-xs md:text-sm font-bold outline-none border-r-8 border-transparent">
              <option value="all">Districts</option>
              {districts.filter(d => d !== "all").map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Bulk Select & Print Bar */}
          <div className="sticky top-4 z-20 bg-white/80 backdrop-blur-md border border-gray-200 text-gray-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center justify-between gap-4">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 ml-1 text-sm font-bold text-gray-600 hover:text-indigo-600 transition-colors">
              {selectedOrders.length === allVisibleOrders.length && allVisibleOrders.length > 0 ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
              <span>Select All ({allVisibleOrders.length})</span>
            </button>
            {selectedOrders.length > 0 && (
              <button onClick={() => handlePrint()} className="flex items-center gap-2 bg-indigo-600 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md active:scale-95 hover:bg-indigo-700 transition-all">
                <Printer className="w-4 h-4" /> Print Selected ({selectedOrders.length})
              </button>
            )}
          </div>

          {/* --- SECTION 1: Current Day / Filtered Date Range Orders --- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-l-4 border-indigo-600 pl-4 py-1">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  {selectedPreset === "today" ? "Current Day Orders (আজকের অর্ডার)" : "Filtered Orders (তারিখ পরিসীমার অর্ডার)"}
                </h2>
                <p className="text-xs text-slate-400 font-bold">
                  {selectedPreset === "today" ? `Today's orders (${startDate})` : `Date range: ${startDate || 'Start'} to ${endDate || 'End'}`}
                </p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black text-xs rounded-full border border-indigo-100">
                {rangeOrders.length} Orders
              </span>
            </div>

            {rangeOrders.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {rangeOrders.map(renderOrderCard)}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-8 text-center">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">
                  No orders found for the selected date range
                </p>
              </div>
            )}
          </div>

          {/* --- SECTION 2: Undelivered Orders (Not Delivered Yet) --- */}
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between border-l-4 border-amber-500 pl-4 py-1">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Truck className="w-5 h-5 text-amber-500 animate-bounce" />
                  Undelivered Orders Queue (এখনো ডেলিভারি না হওয়া অর্ডারসমূহ)
                </h2>
                <p className="text-xs text-amber-600/80 font-bold">
                  Pending & Shipped orders from prior dates needing delivery action
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 font-black text-xs rounded-full border border-amber-200">
                {undeliveredOrders.length} Undelivered
              </span>
            </div>

            {undeliveredOrders.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {undeliveredOrders.map(renderOrderCard)}
              </div>
            ) : (
              <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200 py-8 text-center">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-emerald-700 font-bold text-xs uppercase tracking-widest">
                  All previous orders are fully delivered!
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Empty State */}
      {!loading && allVisibleOrders.length === 0 && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-100 py-10 text-center mt-6">
          <Package className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">No orders found</p>
        </div>
      )}

      {/* ── Courier Provider Selection Modal ── */}
      {courierProviderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCourierProviderModalOpen(false)} />

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-8 animate-in zoom-in-95 duration-200 border border-slate-100 z-10">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Select Courier</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Choose preferred delivery partner</p>
              </div>
            </div>

            <div className="space-y-3">
              {courierActive && (
                <button
                  onClick={() => { setSelectedCourier("pathao"); startCourierBooking("pathao"); }}
                  className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${selectedCourier === "pathao" ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:border-indigo-300"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">P</div>
                      <div>
                        <p className="font-bold text-slate-900">Pathao Courier</p>
                        <p className="text-xs text-slate-500">Fast & Reliable Delivery</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedCourier === "pathao" ? "border-indigo-600 bg-indigo-600" : "border-slate-300"}`}>
                      {selectedCourier === "pathao" && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </div>
                </button>
              )}

              {steadfastActive && (
                <button
                  onClick={() => { setSelectedCourier("steadfast"); startCourierBooking("steadfast"); }}
                  className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${selectedCourier === "steadfast" ? "border-green-500 bg-green-50" : "border-slate-200 bg-slate-50 hover:border-green-300"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">S</div>
                      <div>
                        <p className="font-bold text-slate-900">SteadFast Courier</p>
                        <p className="text-xs text-slate-500">Quick & Affordable Shipping</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedCourier === "steadfast" ? "border-green-600 bg-green-600" : "border-slate-300"}`}>
                      {selectedCourier === "steadfast" && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </div>
                </button>
              )}
            </div>

            {!courierActive && !steadfastActive && (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium mb-4">No courier services configured.</p>
                <button
                  onClick={() => {
                    setCourierProviderModalOpen(false);
                    setCourierConfigModalOpen(true);
                  }}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all"
                >
                  Configure Couriers
                </button>
              </div>
            )}

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setCourierProviderModalOpen(false)}
                className="w-full px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pathao Booking Modal ── */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !bookingInProgress && setBookingModalOpen(false)} />

          {/* Dialog Container */}
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 animate-in zoom-in-95 duration-200 border border-slate-100 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Truck className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Book {selectedCourier === "pathao" ? "Pathao" : "SteadFast"} Courier</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Order #{bookingOrder?.id} • {bookingOrder?.customer_name}</p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-5">
              {/* Pickup Store (Pathao Only) */}
              {selectedCourier === "pathao" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pickup Store Address</label>
                    <button type="button" onClick={() => setCreateStoreModalOpen(true)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg transition-colors border border-indigo-100"><Plus className="w-3 h-3" /> New Store</button>
                  </div>
                  <select
                    value={bookingDetails.store_id}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, store_id: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 cursor-pointer transition-all"
                  >
                    <option value="" disabled>Select pickup location</option>
                    {stores.map(store => (
                      <option key={store.store_id} value={store.store_id}>
                        {store.store_name} ({store.store_address})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipient Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Customer Name</label>
                  <input
                    type="text"
                    value={bookingDetails.recipient_name}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, recipient_name: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                  <input
                    type="text"
                    value={bookingDetails.recipient_phone}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, recipient_phone: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Delivery Address <span className="text-red-500">*</span></label>
                <textarea
                  rows="2"
                  value={bookingDetails.recipient_address}
                  onChange={(e) => setBookingDetails(prev => ({ ...prev, recipient_address: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none"
                />
              </div>

              {/* City, Zone, Area Selector for Booking */}
              {selectedCourier === "pathao" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">City</label>
                    <select
                      value={bookingDetails.recipient_city}
                      onChange={(e) => setBookingDetails(prev => ({ ...prev, recipient_city: e.target.value, recipient_zone: "", recipient_area: "" }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
                    >
                      <option value="">Select City</option>
                      {bookingCities.map(city => <option key={city.city_id} value={city.city_id}>{city.city_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Zone</label>
                    <select
                      value={bookingDetails.recipient_zone}
                      onChange={(e) => setBookingDetails(prev => ({ ...prev, recipient_zone: e.target.value, recipient_area: "" }))}
                      disabled={!bookingDetails.recipient_city}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">Select Zone</option>
                      {bookingZones.map(zone => <option key={zone.zone_id} value={zone.zone_id}>{zone.zone_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Area</label>
                    <select
                      value={bookingDetails.recipient_area}
                      onChange={(e) => setBookingDetails(prev => ({ ...prev, recipient_area: e.target.value }))}
                      disabled={!bookingDetails.recipient_zone}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">Select Area</option>
                      {bookingAreas.map(area => <option key={area.area_id} value={area.area_id}>{area.area_name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {selectedCourier === "steadfast" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">City</label>
                    <select
                      value={bookingDetails.recipient_city}
                      onChange={(e) => setBookingDetails(prev => ({ ...prev, recipient_city: e.target.value, recipient_area: "" }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
                    >
                      <option value="">Select City</option>
                      {bookingCities.map(city => <option key={city.city_id} value={city.city_id}>{city.city_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Area</label>
                    <select
                      value={bookingDetails.recipient_area}
                      onChange={(e) => setBookingDetails(prev => ({ ...prev, recipient_area: e.target.value }))}
                      disabled={!bookingDetails.recipient_city}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">Select Area</option>
                      {bookingAreas.map(area => <option key={area.area_id} value={area.area_id}>{area.area_name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Delivery Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">COD Amount (৳) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={bookingDetails.amount_to_collect}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, amount_to_collect: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Weight (kg) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.1"
                    value={bookingDetails.item_weight}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, item_weight: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Item Description</label>
                  <input
                    type="text"
                    value={bookingDetails.item_description}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, item_description: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Special Instruction</label>
                  <input
                    type="text"
                    placeholder="e.g. Deliver before 5 PM"
                    value={bookingDetails.special_instruction}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, special_instruction: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
              </div>
            </div>

            {/* Price Estimate */}
            {(calculatingPrice || calculatedPrice) && (
              <div className="mt-5 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Delivery Charge Estimate</p>
                {calculatingPrice ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    Calculating delivery fee...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-700">
                    <div>Delivery Fee: <span className="font-bold text-slate-900">৳ {calculatedPrice.delivery_fee}</span></div>
                    <div>COD Charge: <span className="font-bold text-slate-900">৳ {calculatedPrice.cod_charge || 0}</span></div>
                    {calculatedPrice.discount > 0 && (
                      <div className="col-span-2 text-emerald-600">Discount: -৳ {calculatedPrice.discount}</div>
                    )}
                    <div className="col-span-2 pt-2 border-t border-indigo-100 font-bold text-indigo-600 text-sm flex justify-between">
                      <span>Total Estimated Cost:</span>
                      <span>৳ {calculatedPrice.total_amount}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
              <button
                disabled={bookingInProgress}
                onClick={() => setBookingModalOpen(false)}
                className="flex-1 px-4 py-3 text-xs sm:text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={bookingInProgress || !bookingDetails.recipient_address}
                onClick={handleBookCourier}
                className="flex-1 px-4 py-3 text-xs sm:text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {bookingInProgress ? "Booking Delivery..." : "Book Delivery"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pathao Settings Modal ── */}
      {courierConfigModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => (!isSavingConfig && !isDeletingConfig) && setCourierConfigModalOpen(false)} />

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 animate-in zoom-in-95 duration-200 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">

            {courierFormMode === "list" ? (
              <>
                <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">Manage Couriers</h3>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Your connected courier services</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCourierConfigTab("pathao");
                      setCourierFormMode("form");
                      setEditingPathaoConfigId(null);
                      setEditingSteadFastConfigId(null);
                      setPathaoConfig({
                        name: "",
                        client_id: "",
                        client_secret: "",
                        username: "",
                        password: "",
                        store_id: "",
                        is_sandbox: true
                      });
                      setSteadFastConfig({
                        name: "",
                        api_key: "",
                        api_secret: "",
                        is_sandbox: true
                      });
                    }}
                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md"
                  >
                    Add Courier
                  </button>
                </div>

                {/* Auto-Dispatch & Default Courier Preferences */}
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/50 border border-indigo-100 shadow-xs space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Auto-Dispatch on Call Confirm
                      </h4>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                        কাস্টমার ওয়েব কলে ১ চেপে অর্ডার কনফার্ম করলেই অটোমেটিক ডিফল্ট কুরিয়ারে বুক হয়ে যাবে
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isSavingCourierPrefs}
                      onClick={() => saveCourierPreferences(!autoCourierBooking, defaultCourierProvider)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 ${autoCourierBooking ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow-xs transition-transform ${autoCourierBooking ? "translate-x-6" : "translate-x-0"
                          }`}
                      />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-indigo-100/80">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Default Courier Service (প্রাথমিক কুরিয়ার)
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={isSavingCourierPrefs}
                        onClick={() => saveCourierPreferences(autoCourierBooking, "pathao")}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${defaultCourierProvider === "pathao"
                          ? "border-indigo-600 bg-indigo-50/90 text-indigo-900 ring-2 ring-indigo-500/20"
                          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                            P
                          </span>
                          <div>
                            <p className="text-xs font-extrabold leading-tight">Pathao</p>
                            <p className="text-[9px] font-semibold opacity-75">
                              {defaultCourierProvider === "pathao" ? "★ Default" : "Set Default"}
                            </p>
                          </div>
                        </div>
                        {defaultCourierProvider === "pathao" && (
                          <Check className="w-4 h-4 text-indigo-600" />
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isSavingCourierPrefs}
                        onClick={() => saveCourierPreferences(autoCourierBooking, "steadfast")}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${defaultCourierProvider === "steadfast"
                          ? "border-emerald-600 bg-emerald-50/90 text-emerald-900 ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                            S
                          </span>
                          <div>
                            <p className="text-xs font-extrabold leading-tight">SteadFast</p>
                            <p className="text-[9px] font-semibold opacity-75">
                              {defaultCourierProvider === "steadfast" ? "★ Default" : "Set Default"}
                            </p>
                          </div>
                        </div>
                        {defaultCourierProvider === "steadfast" && (
                          <Check className="w-4 h-4 text-emerald-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {(pathaoConfigs.length > 0 || steadfastConfigs.length > 0) ? (
                  <div className="space-y-4">
                    {pathaoConfigs.length > 0 && pathaoConfigs.map((config) => (
                      <div key={config.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">{config.name || `Pathao ${config.id}`}</p>
                              {defaultCourierProvider === "pathao" && (
                                <span className="text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={`text-[10px] font-bold ${config.is_active ? 'text-emerald-600 bg-emerald-100' : 'text-amber-600 bg-amber-100'} px-2 py-0.5 rounded-full uppercase`}>
                                {config.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className={`text-[10px] font-bold ${config.is_sandbox ? 'text-amber-700 bg-amber-100' : 'text-blue-700 bg-blue-100'} px-2 py-0.5 rounded-full uppercase`}>
                                {config.is_sandbox ? 'Sandbox' : 'Live'}
                              </span>
                              {config.store_id && (
                                <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full">
                                  Store #{config.store_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setCourierConfigTab("pathao"); setCourierFormMode("form"); setEditingPathaoConfigId(config.id); setPathaoConfig({
                              name: config.name || "",
                              client_id: config.client_id,
                              client_secret: "",
                              username: config.username,
                              password: "",
                              store_id: config.store_id || "",
                              webhook_secret: config.webhook_secret || "",
                              webhook_url: config.webhook_url || "",
                              is_sandbox: config.is_sandbox,
                              cod_charge_mode: config.cod_charge_mode || "seller",
                              cod_percentage: config.cod_percentage !== undefined ? config.cod_percentage : 1.0
                            });
                          }} className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">Edit</button>
                          <button onClick={() => handleDeletePathaoConfig(config.id)} disabled={isDeletingConfig} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">{isDeletingConfig ? "..." : "Delete"}</button>
                        </div>
                      </div>
                    ))}

                    {steadfastConfigs.length > 0 && steadfastConfigs.map((config) => (
                      <div key={config.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">{config.name || `SteadFast ${config.id}`}</p>
                              {defaultCourierProvider === "steadfast" && (
                                <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={`text-[10px] font-bold ${config.is_active ? 'text-emerald-600 bg-emerald-100' : 'text-amber-600 bg-amber-100'} px-2 py-0.5 rounded-full uppercase`}>
                                {config.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                                Packzy API
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setCourierConfigTab("steadfast"); setCourierFormMode("form"); setEditingSteadFastConfigId(config.id); setSteadFastConfig({
                              name: config.name || "",
                              api_key: config.api_key,
                              api_secret: "",
                              webhook_token: config.webhook_token || "",
                              webhook_url: config.webhook_url || "",
                              is_sandbox: config.is_sandbox,
                              cod_charge_mode: config.cod_charge_mode || "seller",
                              cod_percentage: config.cod_percentage !== undefined ? config.cod_percentage : 1.0
                            });
                          }} className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">Edit</button>
                          <button onClick={() => handleDeleteSteadFastConfig(config.id)} disabled={isDeletingConfig} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">{isDeletingConfig ? "..." : "Delete"}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Truck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium mb-4">No courier services configured yet.</p>
                    <button onClick={() => { setCourierConfigTab("pathao"); setCourierFormMode("form"); }} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md">Add Courier</button>
                  </div>
                )}

                <div className="mt-8 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setCourierConfigModalOpen(false)}
                    className="w-full px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className={`p-3 rounded-2xl ${courierConfigTab === "pathao" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Configure {courierConfigTab === "pathao" ? "Pathao" : "SteadFast"} Courier</h3>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Set API credentials to book parcels</p>
                  </div>
                </div>

                <div className="inline-flex rounded-full bg-slate-100 p-1 gap-1 mb-6">
                  <button type="button" onClick={() => setCourierConfigTab("pathao")} className={`px-4 py-2 text-xs font-bold rounded-full transition ${courierConfigTab === "pathao" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"}`}>
                    Pathao
                  </button>
                  <button type="button" onClick={() => setCourierConfigTab("steadfast")} className={`px-4 py-2 text-xs font-bold rounded-full transition ${courierConfigTab === "steadfast" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"}`}>
                    SteadFast
                  </button>
                </div>

                {courierConfigTab === "pathao" ? (
                  <>
                    <div className="space-y-4">
                      {/* Quick Sandbox Fill Banner */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200/70">
                        <div>
                          <p className="text-xs font-bold text-amber-900">Pathao Sandbox (Test Mode)</p>
                          <p className="text-[10px] text-amber-700 font-medium">Use official test credentials to test booking</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPathaoConfig(prev => ({
                              ...prev,
                              name: prev.name || "Pathao Sandbox Test",
                              client_id: "7N1aMJQbWm",
                              client_secret: "wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39",
                              username: "test@pathao.com",
                              password: "lovePathao",
                              is_sandbox: true
                            }));
                            toast.success("Pathao Sandbox test credentials filled!");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition shadow-sm"
                        >
                          Fill Test Credentials
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client ID</label>
                        <input
                          type="text"
                          value={pathaoConfig.client_id}
                          onChange={(e) => setPathaoConfig(prev => ({ ...prev, client_id: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client Secret</label>
                        <input
                          type="password"
                          placeholder={(editingPathaoConfigId || pathaoConfigs.length > 0) ? "Leave empty if unchanged" : "Enter Client Secret"}
                          value={pathaoConfig.client_secret}
                          onChange={(e) => setPathaoConfig(prev => ({ ...prev, client_secret: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Configuration Name</label>
                        <input
                          type="text"
                          value={pathaoConfig.name}
                          onChange={(e) => setPathaoConfig(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Optional label for this config"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username (Email)</label>
                        <input
                          type="email"
                          value={pathaoConfig.username}
                          onChange={(e) => setPathaoConfig(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
                        <input
                          type="password"
                          placeholder={(editingPathaoConfigId || pathaoConfigs.length > 0) ? "Leave empty if unchanged" : "Enter Pathao Password"}
                          value={pathaoConfig.password}
                          onChange={(e) => setPathaoConfig(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Store Selection / Store ID</label>
                          <button type="button" onClick={() => setCreateStoreModalOpen(true)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg transition-colors border border-indigo-100"><Plus className="w-3 h-3" /> New Store</button>
                        </div>
                        {stores && stores.length > 0 && (
                          <select
                            value={pathaoConfig.store_id || ""}
                            onChange={(e) => setPathaoConfig(prev => ({ ...prev, store_id: e.target.value }))}
                            className="w-full px-4 py-3 mb-2 bg-indigo-50/50 border border-indigo-200 rounded-xl font-bold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
                          >
                            <option value="">-- Select from your Pathao Stores --</option>
                            {stores.map(st => (
                              <option key={st.store_id} value={String(st.store_id)}>
                                {st.store_name} (ID: {st.store_id}){st.is_default_store ? " ★ Default" : ""}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          placeholder="Or enter Store ID manually (e.g. 12345)"
                          value={pathaoConfig.store_id || ""}
                          onChange={(e) => setPathaoConfig(prev => ({ ...prev, store_id: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center justify-between">
                          <span>Pathao Webhook Secret</span>
                          <span className="text-[9px] text-indigo-500 lowercase font-medium">from pathao developer panel</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. f3992ecc-59da-4cbe-a049-a13da2018d51"
                          value={pathaoConfig.webhook_secret || ""}
                          onChange={(e) => setPathaoConfig(prev => ({ ...prev, webhook_secret: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </div>

                      {pathaoConfig.webhook_url && (
                        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wide">Pathao Webhook Callback URL:</span>
                            <span className="text-[9px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200">Live Status Sync</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={pathaoConfig.webhook_url}
                              className="w-full text-xs font-mono px-3 py-2 bg-white border border-indigo-200 rounded-lg text-slate-700 select-all outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(pathaoConfig.webhook_url);
                                setCopiedWebhook(true);
                                setTimeout(() => setCopiedWebhook(false), 2000);
                                toast.success("Webhook URL copied to clipboard!", { icon: "📋" });
                              }}
                              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shrink-0 transition-all shadow-xs active:scale-95"
                            >
                              {copiedWebhook ? "Copied! ✓" : "Copy"}
                            </button>
                          </div>
                          <p className="text-[10px] text-indigo-700 font-medium leading-relaxed">
                            Paste this URL into your <strong>Pathao Merchant Portal &gt; Settings &gt; Webhook Settings</strong> for automatic order status updates.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-2">
                        <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${pathaoConfig.is_sandbox ? 'bg-amber-400' : 'bg-emerald-500'}`} onClick={() => setPathaoConfig(prev => ({ ...prev, is_sandbox: !prev.is_sandbox }))}>
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${pathaoConfig.is_sandbox ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">
                            {pathaoConfig.is_sandbox ? "Sandbox Mode (Test Environment)" : "Live Mode (Production Environment)"}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {pathaoConfig.is_sandbox ? "Using https://courier-api-sandbox.pathao.com" : "Using https://api-hermes.pathao.com"}
                          </p>
                        </div>
                      </div>

                      {/* Pathao COD Charge Policy */}
                      <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-indigo-950 uppercase tracking-wider">Pathao COD চার্জ পলিসি</label>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200/60 text-indigo-800">১% Cash On Delivery Fee</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">এই কুরিয়ারের ক্ষেত্রে ১% COD চার্জ কে বহন করবে নির্ধারণ করুন:</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setPathaoConfig(prev => ({ ...prev, cod_charge_mode: 'seller' }))}
                            className={`p-3 rounded-xl border text-left transition-all ${pathaoConfig.cod_charge_mode === 'seller'
                              ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-extrabold text-slate-900">সেলার নিজে দেবেন</span>
                              {pathaoConfig.cod_charge_mode === 'seller' && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">গ্রাহক চার্জমুক্ত থাকবেন; প্রফিট অ্যানালিটিক্সে কুরিয়ার খরচ হিসেবে হিসাব হবে।</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPathaoConfig(prev => ({ ...prev, cod_charge_mode: 'customer' }))}
                            className={`p-3 rounded-xl border text-left transition-all ${pathaoConfig.cod_charge_mode === 'customer'
                              ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-extrabold text-slate-900">গ্রাহক পরিশোধ করবেন</span>
                              {pathaoConfig.cod_charge_mode === 'customer' && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">ডেলিভারি চার্জের সাথে ১% COD চার্জ যুক্ত হয়ে মোট ডেলিভারি বিল হবে।</p>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
                      <button
                        disabled={isSavingConfig}
                        onClick={() => setCourierFormMode("list")}
                        className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                      >
                        Back to List
                      </button>
                      <button
                        disabled={isSavingConfig || !pathaoConfig.client_id || (!editingPathaoConfigId && pathaoConfigs.length === 0 && !pathaoConfig.client_secret) || !pathaoConfig.username}
                        onClick={handleSavePathaoConfig}
                        className="flex-1 px-4 py-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                      >
                        {isSavingConfig ? "Saving..." : (editingPathaoConfigId || pathaoConfigs.length > 0 ? "Save Changes" : "Save & Verify")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/70">
                        <p className="text-xs font-bold text-emerald-900">SteadFast (Packzy) API</p>
                        <p className="text-[10px] text-emerald-700 font-medium">Endpoint: https://portal.packzy.com/api/v1 (Verifies via /get_balance)</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SteadFast API Key</label>
                        <input
                          type="text"
                          value={steadfastConfig.api_key}
                          onChange={(e) => setSteadFastConfig(prev => ({ ...prev, api_key: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SteadFast Secret Key</label>
                        <input
                          type="password"
                          placeholder={(editingSteadFastConfigId || steadfastConfigs.length > 0) ? "Leave empty if unchanged" : "Enter Secret Key"}
                          value={steadfastConfig.api_secret}
                          onChange={(e) => setSteadFastConfig(prev => ({ ...prev, api_secret: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Configuration Name</label>
                        <input
                          type="text"
                          value={steadfastConfig.name}
                          onChange={(e) => setSteadFastConfig(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Optional label for this config"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center justify-between">
                          <span>SteadFast Webhook Auth Token (Optional)</span>
                          <span className="text-[9px] text-emerald-600 lowercase font-medium">from steadfast developer portal</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 3dd87619bf872c422c98721a11ee5cc7"
                          value={steadfastConfig.webhook_token || ""}
                          onChange={(e) => setSteadFastConfig(prev => ({ ...prev, webhook_token: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                        />
                      </div>

                      {steadfastConfig.webhook_url && (
                        <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">SteadFast Webhook Callback URL:</span>
                            <span className="text-[9px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">Live Status Sync</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={steadfastConfig.webhook_url}
                              className="w-full px-3 py-1.5 bg-white border border-emerald-200 text-emerald-950 font-mono text-xs rounded-lg select-all"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(steadfastConfig.webhook_url);
                                toast.success("SteadFast Callback URL copied!");
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shrink-0"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-[10px] text-emerald-800/80 leading-normal">
                            Steadfast Developer Portal-এ Webhook Settings-এ গিয়ে এই Callback URL দিন। Auth Token ব্যবহার করলে উপরোক্ত বক্সে সেভ করুন।
                          </p>
                        </div>
                      )}

                      {/* SteadFast COD Charge Policy */}
                      <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-3">
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-emerald-950 uppercase tracking-wider">SteadFast COD চার্জ পলিসি</label>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800">১% Cash On Delivery Fee</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">এই কুরিয়ারের ক্ষেত্রে ১% COD চার্জ কে বহন করবে নির্ধারণ করুন:</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSteadFastConfig(prev => ({ ...prev, cod_charge_mode: 'seller' }))}
                            className={`p-3 rounded-xl border text-left transition-all ${steadfastConfig.cod_charge_mode === 'seller'
                              ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-extrabold text-slate-900">সেলার নিজে দেবেন</span>
                              {steadfastConfig.cod_charge_mode === 'seller' && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">গ্রাহক চার্জমুক্ত থাকবেন; প্রফিট অ্যানালিটিক্সে কুরিয়ার খরচ হিসেবে হিসাব হবে।</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSteadFastConfig(prev => ({ ...prev, cod_charge_mode: 'customer' }))}
                            className={`p-3 rounded-xl border text-left transition-all ${steadfastConfig.cod_charge_mode === 'customer'
                              ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-extrabold text-slate-900">গ্রাহক পরিশোধ করবেন</span>
                              {steadfastConfig.cod_charge_mode === 'customer' && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">ডেলিভারি চার্জের সাথে ১% COD চার্জ যুক্ত হয়ে মোট ডেলিভারি বিল হবে।</p>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
                      <button
                        disabled={isSavingConfig}
                        onClick={() => setCourierFormMode("list")}
                        className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                      >
                        Back to List
                      </button>
                      <button
                        disabled={isSavingConfig || !steadfastConfig.api_key || (!editingSteadFastConfigId && steadfastConfigs.length === 0 && !steadfastConfig.api_secret)}
                        onClick={handleSaveSteadFastConfig}
                        className="flex-1 px-4 py-3 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                      >
                        {isSavingConfig ? "Saving..." : (editingSteadFastConfigId || steadfastConfigs.length > 0 ? "Save Changes" : "Save & Verify")}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Add Custom Order Modal ── */}
      {addOrderModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmittingOrder && setAddOrderModalOpen(false)} />

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Manual Order Entry</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Add customer data to your table</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Customer Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newOrderDetails.customer_name}
                  onChange={(e) => setNewOrderDetails(prev => ({ ...prev, customer_name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newOrderDetails.phone_number}
                  onChange={(e) => setNewOrderDetails(prev => ({ ...prev, phone_number: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Product Name</label>
                <input
                  type="text"
                  value={newOrderDetails.product_name}
                  onChange={(e) => setNewOrderDetails(prev => ({ ...prev, product_name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">City / District</label>
                <select
                  value={selectedManualCity}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setSelectedManualCity(cid);
                    const name = manualCities.find(c => String(c.city_id) === String(cid))?.city_name || "";
                    setNewOrderDetails(prev => ({ ...prev, district: name, upazila: "", city_id: cid, zone_id: "", area_id: "" }));
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10 cursor-pointer"
                >
                  <option value="">Select City / District</option>
                  {manualCities.map(city => (
                    <option key={city.city_id} value={city.city_id}>{city.city_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Zone</label>
                <select
                  value={selectedManualZone}
                  onChange={(e) => {
                    const zid = e.target.value;
                    setSelectedManualZone(zid);
                    const name = manualZones.find(z => String(z.zone_id) === String(zid))?.zone_name || "";
                    setNewOrderDetails(prev => ({ ...prev, upazila: name, zone_id: zid, area_id: "" }));
                  }}
                  disabled={!selectedManualCity}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">Select Zone</option>
                  {manualZones.map(zone => (
                    <option key={zone.zone_id} value={zone.zone_id}>{zone.zone_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Area</label>
                <select
                  value={selectedManualArea}
                  onChange={(e) => {
                    const aid = e.target.value;
                    setSelectedManualArea(aid);
                    const areaName = manualAreas.find(a => String(a.area_id) === String(aid))?.area_name || "";
                    const zoneName = manualZones.find(z => String(z.zone_id) === String(selectedManualZone))?.zone_name || "";
                    setNewOrderDetails(prev => ({ ...prev, upazila: areaName ? `${zoneName} - ${areaName}` : zoneName, area_id: aid }));
                  }}
                  disabled={!selectedManualZone}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">Select Area</option>
                  {manualAreas.map(area => (
                    <option key={area.area_id} value={area.area_id}>{area.area_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Address <span className="text-red-500">*</span></label>
                <textarea
                  rows="2"
                  value={newOrderDetails.address}
                  onChange={(e) => setNewOrderDetails(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Item Weight (kg) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.1"
                  value={newOrderDetails.item_weight}
                  onChange={(e) => setNewOrderDetails(prev => ({ ...prev, item_weight: parseFloat(e.target.value) || 0.5 }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Item Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={newOrderDetails.item_quantity}
                  onChange={(e) => setNewOrderDetails(prev => ({ ...prev, item_quantity: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Special Instruction</label>
                <input
                  type="text"
                  placeholder="e.g. Deliver before 5 PM"
                  value={newOrderDetails.special_instruction}
                  onChange={(e) => setNewOrderDetails(prev => ({ ...prev, special_instruction: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Price (৳)</label>
                <input
                  type="number"
                  value={newOrderDetails.price}
                  onChange={(e) => setNewOrderDetails(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Extra Info</label>
                <input
                  type="text"
                  value={newOrderDetails.extra_info}
                  onChange={(e) => setNewOrderDetails(prev => ({ ...prev, extra_info: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
              <button
                disabled={isSubmittingOrder}
                onClick={() => setAddOrderModalOpen(false)}
                className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isSubmittingOrder}
                onClick={handleAddOrder}
                className="flex-1 px-4 py-3 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isSubmittingOrder ? "Saving..." : "Add Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Store Modal ── */}
      {createStoreModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isCreatingStore && setCreateStoreModalOpen(false)} />

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 animate-in zoom-in-95 duration-200 z-10">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Create New Store</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Add a new pickup location</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Store Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Main Branch"
                  value={newStoreData.name}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newStoreData.contact_name}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, contact_name: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Phone <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newStoreData.contact_number}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, contact_number: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Address <span className="text-red-500">*</span></label>
                <textarea
                  rows="2"
                  value={newStoreData.address}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">City <span className="text-red-500">*</span></label>
                  <select
                    value={newStoreData.city_id}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, city_id: e.target.value, zone_id: "", area_id: "" }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  >
                    <option value="">Select City</option>
                    {pathaoCities.map(city => <option key={city.city_id} value={city.city_id}>{city.city_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Zone <span className="text-red-500">*</span></label>
                  <select
                    value={newStoreData.zone_id}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, zone_id: e.target.value, area_id: "" }))}
                    disabled={!newStoreData.city_id}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
                  >
                    <option value="">Select Zone</option>
                    {pathaoZones.map(zone => <option key={zone.zone_id} value={zone.zone_id}>{zone.zone_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Area <span className="text-red-500">*</span></label>
                  <select
                    value={newStoreData.area_id}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, area_id: e.target.value }))}
                    disabled={!newStoreData.zone_id}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
                  >
                    <option value="">Select Area</option>
                    {pathaoAreas.map(area => <option key={area.area_id} value={area.area_id}>{area.area_name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
              <button
                disabled={isCreatingStore}
                onClick={() => setCreateStoreModalOpen(false)}
                className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isCreatingStore || !newStoreData.name || !newStoreData.contact_name || !newStoreData.contact_number || !newStoreData.address || !newStoreData.city_id || !newStoreData.zone_id || !newStoreData.area_id}
                onClick={handleCreateStore}
                className="flex-1 px-4 py-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isCreatingStore ? "Creating..." : "Create Store"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Tracking Details Modal ── */}
      {trackingModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setTrackingModalOpen(false)} />

          {/* Dialog Container */}
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 animate-in zoom-in-95 duration-200 border border-slate-100 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Search className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {selectedOrderForTracking?.courier_booking_info?.provider === 'steadfast' ? 'SteadFast Live Tracking' : 'Pathao Live Tracking'}
                </h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Real-time Courier Delivery & Webhook Timeline
                </p>
              </div>
            </div>

            {/* Step-by-Step Courier Webhook Event Timeline */}
            {selectedOrderForTracking?.courier_booking_info?.events && selectedOrderForTracking.courier_booking_info.events.length > 0 && (
              <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    কুরিয়ার ইভেন্ট হিস্ট্রি (Live Webhook Logs)
                  </span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {selectedOrderForTracking.courier_booking_info.events.length} Updates
                  </span>
                </div>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {selectedOrderForTracking.courier_booking_info.events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{ev.status_label || ev.event_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {ev.created_at ? new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        {ev.reason && (
                          <p className="text-[11px] text-rose-600 font-medium mt-0.5">
                            নোট/কারণ: {ev.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingTracking ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-sm text-slate-500 font-bold">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Fetching tracking details...
              </div>
            ) : trackingDetails ? (
              <div className="space-y-6">
                {/* Consignment Status card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consignment ID</p>
                    <p className="font-bold text-slate-800 text-sm">
                      {trackingDetails.consignment_id || trackingDetails.consignment?.consignment_id || selectedOrderForTracking?.courier_booking_info?.consignment_id || "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${(trackingDetails.delivery_status === "unknown" || trackingDetails.delivery_status === "cancelled" || trackingDetails.order_status === "Cancelled")
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : (trackingDetails.delivery_status === "delivered" || trackingDetails.order_status === "Delivered")
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-indigo-50 text-indigo-700"
                      }`}>
                      {trackingDetails.delivery_status === "unknown" ? "Deleted / Cancelled" : (trackingDetails.delivery_status || trackingDetails.order_status || "Pending")}
                    </span>
                  </div>
                </div>

                {trackingDetails.delivery_status === "unknown" && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>এই পার্সেলটি SteadFast প্যানেল থেকে মুছে ফেলা বা বাতিল করা হয়েছে। ড্যাশবোর্ডে অর্ডারটির কুরিয়ার স্ট্যাটাস স্বয়ংক্রিয়ভাবে বাতিল করা হয়েছে।</span>
                  </div>
                )}

                {/* Details */}
                <div className="space-y-3.5 text-xs text-slate-700 font-medium">
                  <div className="flex justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Recipient Name</span>
                    <span className="font-bold text-slate-900">{trackingDetails.recipient_name}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Phone Number</span>
                    <span className="font-bold text-slate-900">{trackingDetails.recipient_phone}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Address</span>
                    <span className="font-bold text-slate-900 text-right max-w-[250px]">{trackingDetails.recipient_address}</span>
                  </div>
                  {trackingDetails.price_plan && (
                    <>
                      <div className="flex justify-between pb-2 border-b border-slate-100">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Delivery Fee</span>
                        <span className="font-bold text-slate-900">৳ {trackingDetails.price_plan.delivery_fee}</span>
                      </div>
                      <div className="flex justify-between pb-2 border-b border-slate-100">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Total Charge</span>
                        <span className="font-bold text-indigo-600 text-sm">৳ {trackingDetails.price_plan.total_amount}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-red-500 font-bold">
                Could not retrieve tracking information.
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 pt-4 border-t border-slate-100">
              <button
                onClick={() => setTrackingModalOpen(false)}
                className="w-full px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95"
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