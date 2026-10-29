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
  UserGroupIcon,
  KeyIcon,
  ChartBarIcon,
  DocumentTextIcon,
  FunnelIcon,
  PuzzlePieceIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon
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
  const {
    isSidebarOpen,
    closeSidebar,
    sidebarWidth,
    setSidebarWidth,
    resetSidebarWidth,
    isResizing,
    setIsResizing,
    MIN_SIDEBAR_WIDTH,
    MAX_SIDEBAR_WIDTH,
  } = useDisplay();

  const pagePerms = user?.team_context?.permissions?.pages;
  const isTeamStaff = Boolean(user?.team_context?.is_team_member);

  const topLinks = [
    { name: "Overview", href: "/dashboard/user", icon: HomeIcon, roles: ["user"], permKey: "overview" },
    { name: "Saving", href: "/dashboard/saving", icon: PiggyBank, roles: ["user"], permKey: "saving" },
    { name: "Orders", href: "/dashboard/orders", icon: ShoppingCartIcon, roles: ["user"], permKey: "orders" },
    { name: "Customers", href: "/dashboard/customers", icon: UsersIcon, roles: ["user"], permKey: "customers" },
    { name: "Connect", href: "/dashboard/connect", icon: LinkIcon, roles: ["user"], permKey: "connect" },
    { name: "Products", href: "/dashboard/products", icon: TableCellsIcon, roles: ["user"], permKey: "products" },
    { name: "Image Gallery", href: "/dashboard/image-gallery", icon: PhotoIcon, roles: ["user"], permKey: "image_gallery" },
    { name: "Docs", href: "/dashboard/docs", icon: DocumentTextIcon, roles: ["user"], permKey: "spreadsheet" },
    { name: "Offers", href: "/dashboard/offers", icon: TagIcon, roles: ["user"], permKey: "payments" },
    { name: "Payments", href: "/dashboard/payment", icon: CreditCardIcon, roles: ["user"], permKey: "payments" },
    { name: "History", href: "/dashboard/history", icon: ClockIcon, roles: ["user"], permKey: "payments" },

    { name: "Overview", href: "/dashboard/agent", icon: HomeIcon, roles: ["agent"] },
    { name: "My Referrals", href: "/dashboard/agent/referrals", icon: UsersIcon, roles: ["agent"] },
    { name: "OTP Settings", href: "/dashboard/agent/otp", icon: KeyIcon, roles: ["agent"] },
    { name: "Accounts", href: "/dashboard/agent/accounts", icon: ChartBarIcon, roles: ["agent"] },

    { name: "Notifications", href: "/dashboard/notifications", icon: BellIcon, roles: ["user", "agent"] },
    { name: "Contacts", href: "/dashboard/contacts", icon: UsersIcon, roles: ["user", "agent"], permKey: "inbox" },
    { name: "My Team", href: "/dashboard/team", icon: UserGroupIcon, roles: ["user"], permKey: "team" },
    { name: "Smart CRM", href: "/dashboard/crm", icon: FunnelIcon, roles: ["user", "agent"], permKey: "crm" },
    { name: "Comments", href: "/dashboard/comments", icon: ChatBubbleLeftRightIcon, roles: ["user"], permKey: "ai_agent" },
    { name: "AI Agent", href: "/dashboard/aiAgent", icon: CpuChipIcon, roles: ["user", "agent"], highlight: true, permKey: "ai_agent" },
    { name: "Extensions", href: "/dashboard/extensions", icon: PuzzlePieceIcon, roles: ["user", "agent"], permKey: "settings" },
  ];

  const bottomLinks = [
    { name: "Settings", href: "/dashboard/settings", icon: Cog6ToothIcon, permKey: "settings" },
    { name: "Profile", href: "/dashboard/profile", icon: UserIcon },
    { name: "Logout", href: "/dashboard/logout", icon: ArrowRightOnRectangleIcon },
  ];

  const filteredTopLinks = topLinks.filter((link) => {
    if (!link.roles.includes(viewMode)) return false;
    if (isTeamStaff && link.permKey && pagePerms && pagePerms[link.permKey] === false) {
      return false;
    }
    return true;
  });

  const filteredBottomLinks = bottomLinks.filter((link) => {
    if (isTeamStaff && link.permKey && pagePerms && pagePerms[link.permKey] === false) {
      return false;
    }
    return true;
  });

  const handleLogout = async () => {
    try {
      await api.post("/logout/", {}, { withCredentials: true });
      setUser(null);
      localStorage.removeItem("active_view");
      router.push("/login");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.min(
        Math.max(startWidth + deltaX, MIN_SIDEBAR_WIDTH),
        MAX_SIDEBAR_WIDTH
      );
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
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
      <aside
        style={{
          width: isDesktopMode ? `${sidebarWidth}px` : undefined,
          "--desktop-sidebar-w": `${sidebarWidth}px`,
        }}
        className={`fixed top-0 left-0 h-full flex flex-col bg-white shadow-xl border-r border-slate-200/80 z-50 ${isResizing ? "" : "transition-[width,transform] duration-200 ease-out"
          } ${isDesktopMode
            ? "translate-x-0"
            : isSidebarOpen
              ? "w-64 translate-x-0"
              : "w-64 -translate-x-full md:translate-x-0 md:w-[var(--desktop-sidebar-w)]"
          } p-3 select-none`}
      >
        {/* Desktop Resizer Handle */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={resetSidebarWidth}
          title="ড্র্যাগ করে সাইজ ছোট/বড় করুন • ডাবল ক্লিক করলে রিসেট হবে"
          className={`hidden md:block absolute -right-1.5 top-0 w-3 h-full cursor-col-resize group/resizer z-50 select-none ${isResizing ? "bg-indigo-500/20" : "hover:bg-indigo-500/10"
            }`}
        >
          {/* Subtle accent border line */}
          <div
            className={`absolute right-1.5 top-0 w-0.5 h-full transition-colors ${isResizing
                ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]"
                : "bg-transparent group-hover/resizer:bg-indigo-400"
              }`}
          />

          {/* Centered Grab Pill */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 right-0 w-3.5 h-9 rounded-full bg-white border border-slate-300 shadow-sm flex items-center justify-center transition-all ${isResizing
                ? "opacity-100 scale-110 border-indigo-500 ring-2 ring-indigo-200"
                : "opacity-0 group-hover/resizer:opacity-100"
              }`}
          >
            <div className="flex flex-col gap-0.5">
              <span className="w-0.5 h-1 bg-slate-400 rounded-full" />
              <span className="w-0.5 h-1 bg-slate-400 rounded-full" />
              <span className="w-0.5 h-1 bg-slate-400 rounded-full" />
            </div>
          </div>

          {/* Width Tooltip Badge while dragging */}
          {isResizing && (
            <div className="absolute top-16 left-3 px-2 py-0.5 bg-slate-900/90 text-white text-[10px] font-mono font-bold rounded-md shadow-lg backdrop-blur-sm pointer-events-none whitespace-nowrap z-50 flex items-center gap-1.5 border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {sidebarWidth}px
            </div>
          )}
        </div>

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
                  className={`flex items-center justify-start w-full px-3 py-2.5 md:py-2.5 md:px-3.5 mb-1 rounded-xl transition-all cursor-pointer font-bold ${isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : isSpecial
                      ? "text-purple-700 bg-purple-50 hover:bg-purple-100"
                      : "text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                    }`}
                >
                  <Icon className="h-5 w-5 md:h-[22px] md:w-[22px] shrink-0" />
                  <span className="md:inline pl-3 text-sm md:text-[15px] font-bold tracking-tight truncate">
                    {link.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Links */}
        <div className="flex flex-col items-stretch pt-4 border-t border-gray-100">
          {filteredBottomLinks.map((link) => {
            const Icon = link.icon;
            const isLogout = link.name === "Logout";

            return isLogout ? (
              <div
                key={link.name}
                onClick={() => {
                  handleLogout();
                  closeSidebar();
                }}
                className="flex items-center justify-start w-full px-3 py-2.5 md:py-2.5 md:px-3.5 mb-1 rounded-xl transition-all cursor-pointer text-red-600 hover:bg-red-50 font-bold"
              >
                <Icon className="h-5 w-5 md:h-[22px] md:w-[22px] shrink-0" />
                <span className="md:inline pl-3 text-sm md:text-[15px] font-bold tracking-tight">Logout</span>
              </div>
            ) : (
              <Link key={link.name} href={link.href} onClick={closeSidebar}>
                <div
                  className={`flex items-center justify-start w-full px-3 py-2.5 md:py-2.5 md:px-3.5 mb-1 rounded-xl transition-all cursor-pointer font-bold ${pathname === link.href ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                    }`}
                >
                  <div className={`w-5 h-5 md:w-[22px] md:h-[22px] rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center transition-colors ${pathname === link.href ? "bg-white/20" : "bg-gray-100"
                    }`}>
                    {link.name === "Profile" && user?.profile?.profile_photo ? (
                      <img src={user.profile.profile_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Icon className="h-4 w-4 md:h-5 md:w-5" />
                    )}
                  </div>
                  <span className="md:inline pl-3 text-sm md:text-[15px] font-bold tracking-tight truncate">
                    {link.name === "Profile" && user
                      ? (user.name?.length > 10
                        ? user.name.substring(0, user.name.lastIndexOf(' ', 10)) + '...'
                        : user.name || "Profile")
                      : link.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}