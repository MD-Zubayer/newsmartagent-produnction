"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HomeIcon,
  LinkIcon,
  CreditCardIcon,
  TableCellsIcon,
  Cog6ToothIcon,
  UserIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
  TagIcon,
  ShoppingCartIcon,
  UserCircleIcon,
  ClockIcon,
  CpuChipIcon,
  UsersIcon,      // 🔥 নতুন আইকন
  KeyIcon,        // 🔥 ওটিপি বা কি-এর জন্য
  ChartBarIcon    // 🔥 এনালাইটিক্স এর জন্য
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import api from "../../lib/api";

// viewMode প্রপসটি রিসিভ করছি layout.jsx থেকে
export default function Sidebar({ viewMode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuth();

  // --- মেনু ফিল্টারিং লজিক ---
  const topLinks = [
    // { name: "Overview", href: "/dashboard", icon: HomeIcon, roles: ["user", "agent"] },
    
    // শুধু ইউজার মোডের জন্য
    { name: "Overview", href: "/dashboard/user", icon: HomeIcon, roles: ["user"] },
    { name: "Orders", href: "/dashboard/orders", icon: ShoppingCartIcon, roles: ["user"] },
    { name: "Connect", href: "/dashboard/connect", icon: LinkIcon, roles: ["user"] },
    { name: "Sheet", href: user?.sheet_id ? `/dashboard/sheet/${user.sheet_id}` : "/dashboard/user", icon: TableCellsIcon, roles: ["user"] },
    { name: "Offers", href: "/dashboard/offers", icon: TagIcon, roles: ["user"] },
    { name: "History", href: "/dashboard/history", icon: ClockIcon, roles: ["user"] },
    
    // শুধু এজেন্ট মোডের জন্য (আপনার আগের রিকোয়েস্ট অনুযায়ী)
    { name: "Overview", href: "/dashboard/agent", icon: HomeIcon, roles: ["agent"] },
    { name: "My Referrals", href: "/dashboard/agent/referrals", icon: UsersIcon, roles: ["agent"] },
    { name: "OTP Settings", href: "/dashboard/agent/otp", icon: KeyIcon, roles: ["agent"] },
    { name: "Accounts", href: "/dashboard/agent/accounts", icon: ChartBarIcon, roles: ["agent"] },

    // কমন আইটেমস
    { name: "Payment", href: "/dashboard/payment", icon: CreditCardIcon, roles: ["user", "agent"] },
    { name: "Notifications", href: "/dashboard/notifications", icon: BellIcon, roles: ["user", "agent"] },
    { name: "AI Agent", href: "/dashboard/aiAgent", icon: CpuChipIcon, roles: ["user", "agent"], highlight: true },
  ];

  const bottomLinks = [
    { name: "Settings", href: "/dashboard/settings", icon: Cog6ToothIcon },
    { name: "Profile", href: "/dashboard/profile", icon: UserIcon },
    { name: "Logout", href: "/dashboard/logout", icon: ArrowRightOnRectangleIcon },
  ];

  // বর্তমান ভিউ মোড অনুযায়ী মেনু ফিল্টার করা
  const filteredTopLinks = topLinks.filter(link => link.roles.includes(viewMode));

  const handleLogout = async () => {
    try {
      await api.post("/logout/", {}, { withCredentials: true });
      setUser(null);
      localStorage.removeItem("active_view"); // লগআউটের সময় ভিউ মোড মুছে ফেলা ভালো
      router.push("/signup");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <div className="fixed top-0 left-0 h-full flex flex-col bg-white shadow-md w-12 md:w-64 p-3 transition-all z-60">
      {/* Logo Section */}
      <div className="flex items-center mb-6 px-1">
        <Image
          src="/new-smart-agent.png"
          alt="Logo"
          width={75}
          height={75}
          className="object-contain rounded-lg"
        />
        <div className="hidden md:flex flex-col pl-3 overflow-hidden">
          <h3 className="font-black text-gray-800 truncate">New Smart Agent</h3>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${viewMode === 'agent' ? 'text-amber-600' : 'text-blue-600'}`}>
            {viewMode} Dashboard
          </span>
        </div>
      </div>

      {/* Dynamic Top Links */}
      <nav className="flex-1 flex flex-col items-center md:items-stretch overflow-y-auto custom-scrollbar">
        {filteredTopLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          const isSpecial = link.highlight;

          return (
            <Link key={link.name} href={link.href}>
              <div
                className={`flex items-center md:justify-start justify-center w-full p-2.5 mb-1 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                    : isSpecial
                    ? "text-purple-600 bg-purple-50 hover:bg-purple-100 font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden md:inline pl-4 text-sm font-medium truncate">
                  {link.name}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Links */}
      <div className="flex flex-col items-center md:items-stretch pt-4 border-t border-gray-100">
        {bottomLinks.map((link) => {
          const Icon = link.icon;
          const isLogout = link.name === "Logout";

          return isLogout ? (
            <div
              key={link.name}
              onClick={handleLogout}
              className="flex items-center md:justify-start justify-center w-full p-2.5 mb-1 rounded-lg transition-all cursor-pointer text-red-500 hover:bg-red-50"
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline pl-4 text-sm font-medium">Logout</span>
            </div>
          ) : (
            <Link key={link.name} href={link.href}>
              <div
                className={`flex items-center md:justify-start justify-center w-full p-2.5 mb-1 rounded-lg transition-all cursor-pointer ${
                  pathname === link.href ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden md:inline pl-4 text-sm font-medium">
                  {link.name === "Profile" && user ? user.name || "My Profile" : link.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}