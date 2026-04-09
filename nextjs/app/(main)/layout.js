// app/(main)/layout.js
"use client";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WidgetWrapper from "./components/WidgetWrapper";
import { LanguageProvider } from "@/context/LanguageContext";

export default function MainLayout({ children }) {
  return (
    <LanguageProvider>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          {children}
          <WidgetWrapper />
        </main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}
