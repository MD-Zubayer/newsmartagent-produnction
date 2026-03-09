"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { FaRobot, FaCheckCircle, FaChevronLeft, FaShoppingCart } from "react-icons/fa";

export default function OfferDetailsPage() {
  const { id } = useParams();
  const [offer, setOffer] = useState(null);

  useEffect(() => {
    api.get(`/offers/${id}/`).then(res => setOffer(res.data));
  }, [id]);

  if (!offer) return <div className="p-20 text-center font-black italic">Fetching Details...</div>;

  return (
    <div className="py-12 px-4 max-w-4xl mx-auto">
      <Link href="/offers" className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase mb-8 hover:text-blue-600 transition-colors">
        <FaChevronLeft /> Back to Offers
      </Link>

      <div className="bg-white rounded-[3.5rem] p-8 md:p-12 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 italic uppercase">{offer.tokens} Tokens Plan</h1>
            <p className="text-blue-600 font-bold uppercase tracking-widest text-xs mt-2 italic">Validity: {offer.duration_days} Days</p>
          </div>
          <div className="text-4xl font-black text-slate-900">৳{offer.price}</div>
        </div>

        <div className="mb-12">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 rounded-full"></span> Included AI Models
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offer.allowed_models?.map(model => (
              <div key={model.id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4 hover:bg-blue-50 transition-colors">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm"><FaRobot size={20} /></div>
                <div>
                  <p className="text-sm font-black text-slate-800">{model.name}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-black">{model.provider}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link href={`/payment?offer_id=${offer.id}`}>
          <button className="w-full p-6 bg-blue-600 hover:bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-100">
            Proceed to Payment <FaShoppingCart />
          </button>
        </Link>
      </div>
    </div>
  );
}