import Link from "next/link";
import { Logo, SiteFooter } from "@/components/SiteChrome";

const features = [
  { icon: "⚡", title: "এক ক্লিকে অর্ডার", text: "Google দিয়ে login, ঠিকানা সেভ — পরের অর্ডার কয়েক সেকেন্ডে।" },
  { icon: "📍", title: "সঠিক ঠিকানা", text: "টাইপ করলেই courier এলাকা suggest হবে, ভুল ঠিকানার ঝামেলা নেই।" },
  { icon: "🚚", title: "লাইভ ট্র্যাকিং", text: "অর্ডার কোথায় আছে — প্রতিটি ধাপ এক নজরে।" },
  { icon: "🧾", title: "সব অর্ডার এক জায়গায়", text: "যে shop থেকেই কিনুন, সব অর্ডারের history আপনার account-এ।" },
];

export default function HomePage() {
  return (
    <div className="bg-aurora flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Link
          href="/privacy"
          className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          Privacy
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 pb-10 pt-8 text-center sm:pt-16">
        <span className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          শীঘ্রই আসছে
        </span>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          কেনাকাটা হোক{" "}
          <span className="bg-gradient-to-r from-brand-600 via-fuchsia-500 to-rose-500 bg-clip-text text-transparent">
            সহজ ও নিশ্চিন্ত
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-slate-600 sm:text-lg">
          Messenger, WhatsApp, Telegram বা TikTok — যেখান থেকেই অর্ডার করুন, আপনার সব অর্ডার, ঠিকানা আর ট্র্যাকিং এক
          সুন্দর app-এ।
        </p>

        <div className="mt-12 grid w-full gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="glass rounded-3xl p-5 text-left shadow-lg shadow-slate-200/40 transition hover:-translate-y-0.5"
            >
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl shadow-sm">{f.icon}</div>
              <h3 className="font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
