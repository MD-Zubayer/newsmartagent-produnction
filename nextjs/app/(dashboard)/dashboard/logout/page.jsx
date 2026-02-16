// app/dashboard/logout/page.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // ১. লোকাল স্টোরেজ থেকে টোকেন মুছে ফেলা
    localStorage.removeItem("user_token");
    
    // ২. আপনি যদি অন্য কোনো ডাটা (যেমন guestUser) সেভ করে থাকেন, তাও মুছে দিন
    localStorage.clear(); 

    // ৩. লগইন পেজে রিডাইরেক্ট করা
    // আপনার লগইন পেজের পাথ যদি "/" হয় তবে সেটি দিন
    router.push("/"); 
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 font-semibold">Logging out...</p>
      </div>
    </div>
  );
}