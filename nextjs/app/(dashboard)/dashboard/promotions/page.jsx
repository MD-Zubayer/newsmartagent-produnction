"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import CatalogHeaderNav from "@/components/CatalogHeaderNav";
import PromotionsManager from "@/components/PromotionsManager";

export default function PromotionsPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* ChatGPT-style Segmented Nav with activeTab="promotions" */}
        <CatalogHeaderNav
          activeTab="promotions"
          sheetId={user?.sheet_id}
          onTabChange={(tab) => {
            if (tab === "spreadsheet") {
              if (user?.sheet_id) router.push(`/dashboard/sheet/${user.sheet_id}`);
            } else {
              router.push(`/dashboard/products${tab !== "list" ? `?tab=${tab}` : ""}`);
            }
          }}
        />

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 animate-fadeIn">
          <PromotionsManager
            onBackToProducts={() => router.push("/dashboard/products")}
          />
        </div>
      </div>
    </div>
  );
}
