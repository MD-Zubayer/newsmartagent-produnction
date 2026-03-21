// app/(main)/layout.js
"use client"; // ✅ Client-side safe

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Script from "next/script";

export default function MainLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}
  

      </main>
      <Footer />


      {/* ✅ NSA Widget: এটি শুধুমাত্র (main) সেকশনে দেখাবে */}
      <Script 
        src="https://newsmartagent.com/widget.js" 
        data-key="3a7d8586-a1eb-4c93-907f-bf8ac128bfa8" 
        strategy="afterInteractive"
      />
    </div>
  );
}
