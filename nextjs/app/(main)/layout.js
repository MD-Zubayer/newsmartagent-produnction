// app/(main)/layout.js
"use client"; // ✅ Client-side safe

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WidgetWrapper from "./components/WidgetWrapper";

export default function MainLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}
  
      <WidgetWrapper />
      </main>
      <Footer />
    </div>
  );
}
