"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomer } from '@/lib/auth-context';
import { fetchStorefront } from '@/lib/api';
import { readSellerHistory, rememberSeller, sellersFromApi, mergeSellerHistories } from '@/lib/shop-brand';
import { Home, Package, MapPin, User, LogIn, Loader2, ChevronDown, Store, ShoppingCart, MessageSquare } from 'lucide-react';

export default function CustomerAppLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { customer, isAuthenticated, isLoading } = useCustomer();
  const [shopBrand, setShopBrand] = useState({ name: 'SmartShop', logo: '/logo.png' });
  const [sellerHistory, setSellerHistory] = useState([]);
  const [showSellerMenu, setShowSellerMenu] = useState(false);

  // Only protect /account and /addresses. Homepage (/) and public tracking are strictly accessible to everyone.
  const protectedRoutes = ['/account', '/addresses'];
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  useEffect(() => {
    if (!isLoading && !isAuthenticated && isProtected) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, isProtected, router]);

  // Checkout pages are tied to a merchant session, so use that merchant's
  // branding instead of the generic SmartShop fallback in the shell.
  useEffect(() => {
    const savedSellers = readSellerHistory();
    setSellerHistory(savedSellers);
    if (savedSellers[0]) setShopBrand(savedSellers[0]);

    let cancelled = false;
    if (!isLoading && isAuthenticated) {
      fetchStorefront('/shop-history/', { cache: 'no-store' })
        .then((items) => {
          if (cancelled) return;
          const databaseSellers = sellersFromApi(items);
          if (!databaseSellers.length) return;
          const nextHistory = mergeSellerHistories(databaseSellers, savedSellers);
          setSellerHistory(nextHistory);
          if (nextHistory[0]) setShopBrand(nextHistory[0]);
        })
        .catch(() => {
          // Guest/local history remains available if the account endpoint is unavailable.
        });
    }

    // Checkout pages are tied to a merchant session, so use that merchant's
    // branding instead of the generic SmartShop fallback in the shell.
    const match = pathname.match(/^\/checkout\/([^/]+)/);
    if (!match) return () => { cancelled = true; };

    fetchStorefront(`/session/resolve/${encodeURIComponent(match[1])}/`, { cache: 'no-store' })
      .then((session) => {
        if (cancelled) return;
        const nextHistory = rememberSeller(session, match[1]);
        setSellerHistory(nextHistory);
        if (nextHistory[0]) setShopBrand(nextHistory[0]);
      })
      .catch(() => {
        // Keep the last known seller profile if the API is temporarily unavailable.
      });

    return () => { cancelled = true; };
  }, [pathname, isAuthenticated, isLoading]);

  if (isLoading && isProtected) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="mt-3 text-xs text-slate-400">অ্যাপ লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!isAuthenticated && isProtected) {
    return null;
  }

  const sellerLinkMatch = pathname.match(/^\/(?:checkout|shop)\/([^/]+)/);
  const sellerCode = sellerLinkMatch?.[1] || '';
  const isMessagesPage = pathname.startsWith('/messages');
  const navItems = [
    { href: '/', label: 'হোম', icon: Home, exact: true },
    { href: '/shop', label: 'শপ', icon: Store },
    ...(sellerCode ? [
      { href: '/checkout/' + sellerCode, label: 'চেকআউট', icon: ShoppingCart },
    ] : []),
    { href: '/orders', label: 'অর্ডার', icon: Package },
    { href: '/addresses', label: 'ঠিকানা', icon: MapPin },
    { href: '/messages', label: 'মেসেজ', icon: MessageSquare },
  ];

  return (
    <div className={`${isMessagesPage ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'} bg-[#f8fafc] text-slate-800 flex flex-col relative`}>
      {/* Top Header */}
      <header className={`sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-xs shrink-0 ${isMessagesPage ? 'hidden md:block' : ''}`}>
        <div className={`w-full ${isMessagesPage ? 'max-w-full px-3 sm:px-6' : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'} py-2.5 sm:py-3 flex items-center justify-between gap-4`}>
          <div className="relative flex items-center gap-2 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
              <img
                src={shopBrand.logo || '/logo.png'}
                alt={shopBrand.name}
                className="w-9 h-9 rounded-xl object-cover border border-slate-200 bg-white shadow-xs shrink-0 group-hover:scale-105 transition-transform"
                onError={(event) => { event.currentTarget.src = '/logo.png'; }}
              />
              <span className="font-black text-sm tracking-tight text-slate-900 truncate max-w-[145px] sm:max-w-[240px]">{shopBrand.name}</span>
            </Link>

            {sellerHistory.length > 1 && (
              <button
                type="button"
                onClick={() => setShowSellerMenu((open) => !open)}
                className="flex items-center -space-x-2 pl-1 pr-1.5 py-1 rounded-xl hover:bg-slate-100 transition-colors"
                title="আপনার দেখা shop-গুলো"
              >
                {sellerHistory.slice(1, 4).map((seller) => (
                  seller.logo ? (
                    <img key={seller.id} src={seller.logo} alt={seller.name} className="w-6 h-6 rounded-full object-cover border-2 border-white bg-slate-100 shadow-xs" />
                  ) : (
                    <span key={seller.id} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 text-[9px] font-bold text-slate-700 flex items-center justify-center">{seller.name.charAt(0).toUpperCase()}</span>
                  )
                ))}
                <span className="ml-2 text-[10px] text-slate-500"><ChevronDown className="w-3.5 h-3.5" /></span>
              </button>
            )}

            {showSellerMenu && sellerHistory.length > 1 && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur-xl animate-fadeIn">
                <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">আপনার shop history</p>
                {sellerHistory.map((seller) => (
                  <button
                    key={seller.id}
                    type="button"
                    onClick={() => { setShopBrand(seller); setShowSellerMenu(false); }}
                    className={`w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${shopBrand.id === seller.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    {seller.logo ? <img src={seller.logo} alt="" className="w-8 h-8 rounded-lg object-cover bg-slate-100 border border-slate-200" /> : <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{seller.name.charAt(0).toUpperCase()}</span>}
                    <span className="min-w-0 truncate text-xs font-semibold">{seller.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>


          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              {isMessagesPage && (
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
                >
                  <Store className="w-3.5 h-3.5 text-indigo-600" />
                  <span>শপে ফিরুন</span>
                </Link>
              )}
              <Link href="/account" className="flex items-center gap-2 group" title="অ্যাকাউন্ট প্রোফাইল">
                {customer?.avatar_url ? (
                  <img
                    src={customer.avatar_url}
                    alt={customer.name || 'User'}
                    className="w-8 h-8 rounded-full border-2 border-indigo-200 object-cover shadow-xs group-hover:border-indigo-400 transition-colors"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-600 shadow-xs">
                    {customer?.name?.charAt(0) || 'U'}
                  </div>
                )}
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isMessagesPage && (
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
                >
                  <Store className="w-3.5 h-3.5 text-indigo-600" />
                  <span>শপে ফিরুন</span>
                </Link>
              )}
              <Link
                href="/login"
                className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>লগইন</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Screen Content */}
      {isMessagesPage ? (
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </main>
      ) : (
        <main className="flex-1 pb-24 md:pb-10 overflow-y-auto">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
            {children}
          </div>
        </main>
      )}


      {/* Bottom Floating Navigation Bar (Hidden inside Messages full-screen view) */}
      {!isMessagesPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-2 sm:pb-4 safe-area-bottom">
          <div className="w-full max-w-3xl px-3 sm:px-6 pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-2xl rounded-2xl border border-slate-200/90 py-2 px-3 shadow-xl shadow-slate-300/40 flex items-center justify-around">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 ${isActive
                      ? 'text-indigo-600 font-bold scale-105'
                      : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <div className="relative">
                      <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                      {isActive && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-sm shadow-indigo-400" />
                      )}
                    </div>
                    <span className="text-[11px] leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
