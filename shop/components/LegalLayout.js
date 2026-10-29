import { Logo, SiteFooter } from "@/components/SiteChrome";
import { SITE } from "@/lib/site";

export default function LegalLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20">
        <div className="mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-5xl items-center justify-between rounded-2xl bg-slate-900/80 px-4 py-3 shadow-sm backdrop-blur-md border border-slate-800">
          <Logo />
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            যোগাযোগ
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-6 pt-10">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">Legal</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-400">{subtitle}</p>}
          <p className="mt-3 text-xs text-slate-500">Last updated: {SITE.legalUpdatedAt}</p>
        </div>
        <article className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-800/80 sm:p-9 legal text-slate-300">
          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

