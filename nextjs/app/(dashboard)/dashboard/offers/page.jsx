"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { FaHashtag, FaArrowRight, FaTag, FaGift, FaTicketAlt, FaCoins, FaCrown, FaStar, FaShoppingCart } from "react-icons/fa";
function getOfferIcon(name){
  if(!name) return FaHashtag;
  const n = String(name).toLowerCase();
  if(n.includes('gift') || n.includes('present') || n.includes('bonus')) return FaGift;
  if(n.includes('coin') || n.includes('token') || n.includes('credit') || n.includes('coins')) return FaCoins;
  if(n.includes('pro') || n.includes('premium') || n.includes('business') || n.includes('agency')) return FaCrown;
  if(n.includes('star') || n.includes('elite') || n.includes('plus')) return FaStar;
  if(n.includes('ticket') || n.includes('coupon') || n.includes('voucher')) return FaTicketAlt;
  if(n.includes('shop') || n.includes('bundle') || n.includes('package')) return FaShoppingCart;
  if(n.includes('tag') || n.includes('label')) return FaTag;
  return FaHashtag;
}
import { motion } from 'framer-motion';

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
    <div className="py-12 px-4 bg-[#f4f7fe] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 italic uppercase">
            Choose Your <span className="text-blue-600">Plan</span>
          </h1>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {offers.map((offer, i) => {
            const palettes = [
              { color: '#4f46e5', bg: 'rgba(79,70,229,0.08)', border: 'rgba(79,70,229,0.12)' },
              { color: '#0ea5b7', bg: 'rgba(14,165,183,0.08)', border: 'rgba(14,165,183,0.12)' },
              { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.12)' },
            ];
            const p = palettes[i % palettes.length];

            return (
              <Link href={`/dashboard/offers/${offer.id}`} key={offer.id} className="block outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.45, ease: 'easeOut' }}
                  whileHover={{ y: -6 }}
                  className="group cursor-pointer"
                >
                  <div
                    className="relative p-2 rounded-[2.5rem] h-full transition-all duration-500"
                    style={{
                      background: `linear-gradient(145deg, ${p.bg}, #ffffff)`,
                      boxShadow: `0 20px 40px -15px ${p.color}30, 0 0 0 1px ${p.border}`,
                    }}
                  >
                    <div className="relative bg-white/90 backdrop-blur-2xl h-full rounded-[2.25rem] p-6 flex flex-col border border-white overflow-hidden shadow-sm transition-all duration-300 group-hover:bg-white group-hover:shadow-lg">
                      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40" style={{ background: p.color }} />

                      <div className="flex items-start justify-between mb-6 relative z-10">
                        <div
                          className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-3xl shrink-0 transition-transform duration-500 group-hover:scale-105"
                          style={{
                            background: `linear-gradient(135deg, ${p.bg}, #ffffff)`,
                            border: `1px solid ${p.border}`,
                            boxShadow: `inset 0 4px 8px rgba(255,255,255,0.8), 0 10px 18px -6px ${p.color}40`,
                          }}
                        >
                          {(() => {
                            const Icon = getOfferIcon(offer.icon || offer.type || offer.name || '');
                            return <Icon />;
                          })()}
                        </div>
                        <span className="text-[10px] font-black px-3 py-1.5 rounded-full" style={{ background: p.color, color: '#fff', boxShadow: `0 4px 10px ${p.color}40` }}>{offer.duration_days} Days</span>
                      </div>

                      <div className="relative z-10 flex-1">
                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight group-hover:text-slate-800 transition-colors">{offer.tokens} Tokens</h2>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">Schedule Messages: {offer.schedule_messages?.toLocaleString?.() ?? offer.schedule_messages}</p>
                      </div>

                      <div className="mt-6 flex items-center justify-between relative z-10">
                        <div className="font-black text-lg text-indigo-700">৳{offer.price}</div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</span>
                          <div className="w-10 h-10 rounded-full bg-slate-900 group-hover:bg-blue-600 flex items-center justify-center text-white transition-colors">
                            <FaArrowRight />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
