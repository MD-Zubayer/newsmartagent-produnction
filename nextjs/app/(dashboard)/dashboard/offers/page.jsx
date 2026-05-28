"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { FaHashtag, FaArrowRight } from "react-icons/fa";

const cardThemes = [
  {
    wrapper: "from-indigo-100/70 via-sky-100/40 to-fuchsia-100/30",
    iconBg: "bg-indigo-50 text-indigo-600",
    labelBg: "bg-indigo-100 text-indigo-700",
    price: "text-indigo-600",
    detailBg: "bg-indigo-600",
    detailHover: "group-hover:bg-indigo-700",
  },
  {
    wrapper: "from-emerald-100/70 via-teal-100/40 to-cyan-100/30",
    iconBg: "bg-emerald-50 text-emerald-600",
    labelBg: "bg-emerald-100 text-emerald-700",
    price: "text-emerald-600",
    detailBg: "bg-emerald-600",
    detailHover: "group-hover:bg-emerald-700",
  },
  {
    wrapper: "from-rose-100/70 via-pink-100/40 to-orange-100/30",
    iconBg: "bg-rose-50 text-rose-600",
    labelBg: "bg-rose-100 text-rose-700",
    price: "text-rose-600",
    detailBg: "bg-rose-600",
    detailHover: "group-hover:bg-rose-700",
  },
  {
    wrapper: "from-amber-100/70 via-orange-100/40 to-amber-50/30",
    iconBg: "bg-amber-50 text-amber-600",
    labelBg: "bg-amber-100 text-amber-700",
    price: "text-amber-600",
    detailBg: "bg-amber-600",
    detailHover: "group-hover:bg-amber-700",
  },
];

export default function OffersPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/offers/").then(res => {
      setOffers(res.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-10 text-center animate-pulse font-black uppercase">Loading Offers...</div>;

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.14),_transparent_33%),radial-gradient(circle_at_top_right,_rgba(236,72,153,0.12),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.1),_transparent_30%),#f8fafc] py-12 px-4 relative overflow-hidden">
      <div className="absolute pointer-events-none inset-0 -z-10">
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] bg-indigo-500/10 blur-3xl rounded-full" />
        <div className="absolute top-20 -right-20 w-[360px] h-[360px] bg-purple-500/8 blur-3xl rounded-full" />
        <div className="absolute top-1/3 left-1/2 w-[380px] h-[380px] bg-rose-400/10 blur-3xl rounded-full" />
        <div className="absolute bottom-10 left-10 w-[280px] h-[280px] bg-emerald-400/10 blur-3xl rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-12 text-center">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 italic uppercase">
            Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-500">Plan</span>
          </h1>
          <p className="text-slate-500 mt-3 max-w-2xl mx-auto">Pick a plan that suits your needs — tokens, scheduling and supported AI models included.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {offers.map((offer, index) => {
            const theme = cardThemes[index % cardThemes.length];
            return (
              <Link href={`/dashboard/offers/${offer.id}`} key={offer.id} className="group">
                <div className={`p-2 rounded-[2.25rem] bg-gradient-to-br ${theme.wrapper} hover:scale-[1.01] transition-all duration-500`}> 
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-500 border border-transparent hover:border-slate-200 relative overflow-hidden h-full flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div className={`p-3 rounded-xl ${theme.iconBg}`}><FaHashtag /></div>
                        <span className={`${theme.labelBg} text-[10px] font-black px-3 py-1 rounded-full`}>{offer.duration_days} Days</span>
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black text-slate-900 italic uppercase">{offer.tokens} Tokens</h2>
                      <p className="text-sm md:text-lg font-bold text-slate-500 mt-1">Schedule Messages: {offer.schedule_messages?.toLocaleString?.() ?? offer.schedule_messages}</p>
                      <p className={`text-2xl font-black ${theme.price} mt-3`}>৳{offer.price}</p>
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Details & Models</span>
                      <div className={`w-10 h-10 rounded-full ${theme.detailBg} ${theme.detailHover} flex items-center justify-center text-white transition-colors`}>
                        <FaArrowRight />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
