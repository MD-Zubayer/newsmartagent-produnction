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
  UsersIcon,
  KeyIcon,
  ChartBarIcon,
  DocumentTextIcon
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import api from "../../lib/api";
import { PiggyBank } from "lucide-react";
import { useDisplay } from "../../(dashboard)/DisplayContext";

export default function Sidebar({ viewMode, isDesktopMode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { isSidebarOpen, closeSidebar } = useDisplay();

  const topLinks = [
    { name: "Overview", href: "/dashboard/user", icon: HomeIcon, roles: ["user"] },
    { name: "Saving", href: "/dashboard/saving", icon: PiggyBank, roles: ["user"] },
    { name: "Orders", href: "/dashboard/orders", icon: ShoppingCartIcon, roles: ["user"] },
    { name: "Connect", href: "/dashboard/connect", icon: LinkIcon, roles: ["user"] },
    { name: "Sheet", href: user?.sheet_id ? `/dashboard/sheet/${user.sheet_id}` : "/dashboard/user", icon: TableCellsIcon, roles: ["user"] },
    { name: "Docs", href: "/dashboard/docs", icon: DocumentTextIcon, roles: ["user"] },
    { name: "Offers", href: "/dashboard/offers", icon: TagIcon, roles: ["user"] },
    { name: "History", href: "/dashboard/history", icon: ClockIcon, roles: ["user"] },
    
    { name: "Overview", href: "/dashboard/agent", icon: HomeIcon, roles: ["agent"] },
    { name: "My Referrals", href: "/dashboard/agent/referrals", icon: UsersIcon, roles: ["agent"] },
    { name: "OTP Settings", href: "/dashboard/agent/otp", icon: KeyIcon, roles: ["agent"] },
    { name: "Accounts", href: "/dashboard/agent/accounts", icon: ChartBarIcon, roles: ["agent"] },

    { name: "Payment", href: "/dashboard/payment", icon: CreditCardIcon, roles: ["user", "agent"] },
    { name: "Notifications", href: "/dashboard/notifications", icon: BellIcon, roles: ["user", "agent"] },
    { name: "Contacts", href: "/dashboard/contacts", icon: UsersIcon, roles: ["user", "agent"] },
    { name: "AI Agent", href: "/dashboard/aiAgent", icon: CpuChipIcon, roles: ["user", "agent"], highlight: true },
  ];

  const bottomLinks = [
    { name: "Settings", href: "/dashboard/settings", icon: Cog6ToothIcon },
    { name: "Profile", href: "/dashboard/profile", icon: UserIcon },
    { name: "Logout", href: "/dashboard/logout", icon: ArrowRightOnRectangleIcon },
  ];

  const filteredTopLinks = topLinks.filter(link => link.roles.includes(viewMode));

  const handleLogout = async () => {
    try {
      await api.post("/logout/", {}, { withCredentials: true });
      setUser(null);
      localStorage.removeItem("active_view");
      router.push("/signup");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {!isDesktopMode && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed top-0 left-0 h-full flex flex-col bg-white shadow-2xl z-50 transition-all duration-300 ease-in-out ${
        isDesktopMode 
        ? "w-40 translate-x-0" 
        : isSidebarOpen 
          ? "w-40 translate-x-0" 
          : "w-40 -translate-x-full md:translate-x-0"
      } p-3`}>
        
        {/* Logo Section */}
        <div className="flex justify-center items-center mb-2 mt-12  md:mt-16 px-1">
          <img
            src="/newsmartagent.png"
            alt="Logo"
            className="w-[75px] h-[75px] object-contain rounded-lg"
          />
          
        </div>

        {/* Dynamic Top Links */}
        <nav className="flex-1 flex flex-col items-stretch overflow-y-auto custom-scrollbar">
          {filteredTopLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            const isSpecial = link.highlight;

            return (
              <Link key={link.name} href={link.href} onClick={closeSidebar}>
                <div
                  className={`flex items-center justify-start w-full p-2.5 mb-1 rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                      : isSpecial
                      ? "text-purple-600 bg-purple-50 hover:bg-purple-100 font-semibold"
                      : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="md:inline pl-3 text-sm font-medium truncate">
                    {link.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Links */}
        <div className="flex flex-col items-stretch pt-4 border-t border-gray-100">
          {bottomLinks.map((link) => {
            const Icon = link.icon;
            const isLogout = link.name === "Logout";

            return isLogout ? (
              <div
                key={link.name}
                onClick={() => {
                  handleLogout();
                  closeSidebar();
                }}
                className="flex items-center justify-start w-full p-2.5 mb-1 rounded-lg transition-all cursor-pointer text-red-500 hover:bg-red-50"
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="md:inline pl-3 text-sm font-medium">Logout</span>
              </div>
            ) : (
              <Link key={link.name} href={link.href} onClick={closeSidebar}>
                <div
                  className={`flex items-center justify-start w-full p-2.5 mb-1 rounded-lg transition-all cursor-pointer ${
                    pathname === link.href ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="md:inline pl-3 text-sm font-medium">
                    {link.name === "Profile" && user ? user.name?.split(' ')[0] || "Profile" : link.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}