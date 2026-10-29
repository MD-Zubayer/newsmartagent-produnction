import Link from "next/link";
import { SITE } from "@/lib/site";

export function Logo({ className = "" }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 7h12l-1 12H7L6 7Z" />
          <path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
      </span>
      <span className="text-[15px] font-bold tracking-tight text-white">{SITE.name}</span>
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-5 pb-10 pt-6 text-sm text-slate-400">
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-800 pt-6 sm:flex-row">
        <p>© {new Date().getFullYear()} {SITE.company}. All rights reserved.</p>
        <nav className="flex gap-5">
          <Link href="/privacy" className="hover:text-slate-200">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-slate-200">Terms of Service</Link>
          <a href={`mailto:${SITE.supportEmail}`} className="hover:text-slate-200">Support</a>
        </nav>
      </div>
    </footer>
  );
}

