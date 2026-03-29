"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { FaCheckCircle, FaChevronLeft, FaShoppingCart, FaInfoCircle, FaCube } from "react-icons/fa";

export default function OfferDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.get(`/offers/${id}/`)
        .then(res => {
          setOffer(res.data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching offer:", err);
          setLoading(false);
        });
    }
  }, [id]);

  if (loading) return <div className="p-20 text-center font-black animate-pulse uppercase tracking-widest text-slate-400">Loading Plan...</div>;
  
  if (!offer) return (
    <div className="p-20 text-center">
      <FaInfoCircle className="mx-auto text-slate-200 mb-4" size={50} />
      <p className="font-black text-slate-400 uppercase tracking-widest">Offer not found!</p>
      <Link href="/dashboard/offers" className="text-blue-600 text-xs font-bold underline mt-4 block">Back to Offers</Link>
    </div>
  );

  return (
    <div className="py-6 md:py-12 px-4 max-w-5xl mx-auto">
      {/* Back Button */}
      <Link href="/dashboard/offers" className="inline-flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase mb-6 hover:text-blue-600 transition-all">
        <FaChevronLeft /> Back to Offers
      </Link>

      <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-12 shadow-xl shadow-slate-100/50 border border-slate-50">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 border-b border-slate-50 pb-10">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 italic uppercase leading-tight">
                {offer.name || `${offer.tokens} Tokens`}
            </h1>
            <div className="flex items-center gap-3 mt-2">
                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider italic">
                    {offer.duration_days} Days Validity
                </span>
                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider italic">
                    {offer.tokens.toLocaleString()} Tokens
                </span>
                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider italic">
                    {offer.schedule_messages?.toLocaleString?.() ?? offer.schedule_messages} Contacts Allowed
                </span>
            </div>
          </div>
          <div className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">
            ৳{offer.price}
          </div>
        </div>

        {/* 🔹 Compact Model List Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                <FaCube className="text-blue-600" /> Supported AI Models
            </h3>
            <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                {offer.allowed_models?.length || 0} Models Included
            </span>
          </div>
          
          {/* এই গ্রিডটি ১০০+ মডেল থাকলেও পেজ নষ্ট করবে না */}
          <div className="flex flex-wrap gap-2 md:gap-3">
            {offer.allowed_models && offer.allowed_models.length > 0 ? (
              offer.allowed_models.map((model) => (
                <div 
                  key={model.id} 
                  className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-white border border-slate-100 hover:border-blue-200 hover:shadow-md hover:shadow-blue-50 transition-all duration-200 rounded-xl"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:bg-blue-600 transition-colors"></div>
                  <span className="text-[11px] md:text-xs font-black text-slate-700 uppercase italic">
                    {model.name}
                  </span>
                  <span className="text-[8px] font-bold text-slate-300 group-hover:text-blue-300 uppercase tracking-tighter">
                    {model.provider}
                  </span>
                </div>
              ))
            ) : (
              <div className="w-full p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                 No models configured for this plan
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="sticky bottom-4 md:static">
            <Link href={`/dashboard/offer-payment?offer_id=${offer.id}`}>
            <button className="w-full p-5 md:p-7 bg-blue-600 hover:bg-slate-900 text-white rounded-[1.5rem] md:rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs md:text-sm transition-all flex items-center justify-center gap-3 shadow-2xl shadow-blue-200 active:scale-95">
                Buy This Plan <FaShoppingCart />
            </button>
            </Link>
        </div>
      </div>
    </div>
  );
}
