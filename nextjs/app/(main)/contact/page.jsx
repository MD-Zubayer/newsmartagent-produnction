"use client"; // এটি অবশ্যই যোগ করবেন কারণ আমরা স্টেট ব্যবহার করছি

import React, { useState } from "react";
import { 
  EnvelopeIcon, 
  PhoneIcon, 
  MapPinIcon 
} from "@heroicons/react/24/outline";
import api from "@/lib/api"; // আপনার Axios ইন্টারসেপ্টর

export default function ContactPage() {
  // ১. স্টেট ডিক্লেয়ার করা (মডেলের ফিল্ডের নাম অনুযায়ী)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subjects: "", // মডেল ফিল্ড: subjects
    messages: "", // মডেল ফিল্ড: messages
  });

  const [status, setStatus] = useState({ loading: false, success: null, error: null });

  // ২. ইনপুট হ্যান্ডলার
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ৩. সাবমিট হ্যান্ডলার
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: null, error: null });

    try {
      // আপনার Django API এর এন্ডপয়েন্ট (ধরে নিচ্ছি /contact/create/)
      await api.post("/contact/create/", formData);
      
      setStatus({ loading: false, success: "Your message has been delivered successfully!", error: null });
      setFormData({ name: "", email: "", subjects: "", messages: "" }); // ফর্ম ক্লিয়ার করা
    } catch (err) {
      setStatus({ 
        loading: false, 
        success: null, 
        error: "Sorry! The message could not be sent. Please try again." 
      });
    }
  };

  return (
    <section className="min-h-screen py-20 px-6 bg-[#f8fafc]">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter mb-4">
            Let's <span className="text-indigo-600">Connect</span>
          </h2>
          <p className="text-gray-500 font-medium max-w-md mx-auto">
            আপনার কোনো প্রশ্ন আছে বা আমাদের সাথে কাজ করতে চান? আমাদের মেসেজ দিন, আমরা দ্রুত উত্তর দেব।
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
  {/* Contact Information Cards */}
        <div className="space-y-6">
          {/* Email Card */}
          <div className="bg-white md:p-6 py-6 px-4 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center gap-5 group hover:border-indigo-100 transition-all">
            <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <EnvelopeIcon className="h-4 w-4 md:h-6 md:w-6" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Email Us</p>
              <p className="text-gray-900 font-bold truncate">newsmartagentbd@gmail.com</p>
            </div>
          </div>

          {/* Call Card */}
          <div className="bg-white md:p-6 py-6 px-4 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center gap-5 group hover:border-indigo-100 transition-all">
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <PhoneIcon className="h-4 w-4 md:h-6 md:w-6" />
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Call Us</p>
              <p className="text-gray-900 font-bold">+8801727358743</p>
            </div>
          </div>

          {/* WhatsApp Card (লোকেশনের বদলে এটি যোগ হয়েছে) */}
          <a 
            href="https://wa.me/8801727358743" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white md:p-6 py-6 px-4 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center gap-5 group hover:border-emerald-100 transition-all cursor-pointer"
          >
            <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              {/* যদি react-icons থাকে তবে <FaWhatsapp /> দিতে পারেন, নতুবা একটি আইকন কম্পোনেন্ট */}
              <svg 
                className="h-4 w-4 md:h-6 md:w-6" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.658 1.43 5.63 1.43h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">WhatsApp Help</p>
              <p className="text-gray-900 font-bold">Message Us Anytime</p>
            </div>
          </a>
        </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white shadow-2xl shadow-gray-200 border border-gray-100 py-8 px-5 md:p-10 rounded-[3rem] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-700 ml-1">Your Name</label>
                  <input 
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 font-medium" 
                    placeholder="Your Name" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-700 ml-1">Email Address</label>
                  <input 
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 font-medium" 
                    placeholder="jahid@example.com" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 ml-1">Subject</label>
                <input 
                  name="subjects" // মডেল অনুযায়ী
                  required
                  value={formData.subjects}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 font-medium" 
                  placeholder="How can we help you?" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 ml-1">Message</label>
                <textarea 
                  name="messages" // মডেল অনুযায়ী
                  required
                  value={formData.messages}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl h-40 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 font-medium resize-none" 
                  placeholder="Write your message here..." 
                />
              </div>

              {/* Status Display */}
              {status.success && <p className="text-emerald-500 font-bold text-center">{status.success}</p>}
              {status.error && <p className="text-rose-500 font-bold text-center">{status.error}</p>}

              <button 
                disabled={status.loading}
                className={`w-full cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-3 group ${status.loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {status.loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>

        </div>
      </div>
    </section>
  );
}