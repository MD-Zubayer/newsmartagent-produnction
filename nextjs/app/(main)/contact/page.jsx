"use client";

import React from "react";

export default function ContactPage() {
  console.log("ContactPage rendering (Minimal)...");
  return (
    <section className="min-h-screen py-20 px-6 bg-[#f8fafc]">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter mb-4">
          Contact <span className="text-indigo-600">Us</span>
        </h2>
        <p className="text-gray-500 font-medium max-w-md mx-auto">
          Minimal contact page to test loading.
        </p>
      </div>
    </section>
  );
}