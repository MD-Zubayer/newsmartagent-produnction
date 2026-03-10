"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { FaHashtag, FaArrowRight } from "react-icons/fa";

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
          {offers.map((offer) => (
            <Link href={`/dashboard/offers/${offer.id}`} key={offer.id} className="group">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 border border-transparent hover:border-blue-100 relative overflow-hidden h-full flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><FaHashtag /></div>
                    <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-full">{offer.duration_days} Days</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 italic uppercase">{offer.tokens} Tokens</h2>
                  <p className="text-2xl font-black text-blue-600 mt-2">৳{offer.price}</p>
                </div>
                <div className="mt-8 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Details & Models</span>
                  <div className="w-10 h-10 rounded-full bg-slate-900 group-hover:bg-blue-600 flex items-center justify-center text-white transition-colors">
                    <FaArrowRight />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}