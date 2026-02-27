import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./(main)/components/Navbar";
import Footer from "./(main)/components/Footer";
import { Toaster } from "react-hot-toast";
import MessengerButton from "./(main)/components/MessengerButton";
// import Footer from "../components/Footer";




const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "new smart agent",
  description: "A 'New Smart Agent' AI system is launching soon to automate business customer replies. It will manage interactions across Facebook, WhatsApp, Instagram, and Telegram. Key features include no-code setup, multi-platform support, and 24/7 AI assistance.",
  icons: {
    icon: "/new-smart-agent.png"
  }
};

export default function RootLayout({ children }) {



  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        
        
        {children}
        <MessengerButton />


<Toaster 
  position="top-center" 
  reverseOrder={false}
  gutter={12} // একাধিক টোস্টের মাঝখানে গ্যাপ
  toastOptions={{
    duration: 5000,
    // ডিফল্ট স্টাইল যা সব টোস্টেই কাজ করবে
    style: {
      background: 'rgba(255, 255, 255, 0.9)', // হালকা সাদাটে গ্লাস লুক
      backdropFilter: 'blur(10px)', // ঝাপসা ব্যাকগ্রাউন্ড (Glassmorphism)
      color: '#1e293b', // ডার্ক ব্লু-গ্রে টেক্সট
      padding: '16px 24px',
      borderRadius: '20px', // বেশি রাউন্ডেড প্রিমিয়াম লুক
      fontSize: '15px',
      fontWeight: '600',
      border: '1px solid rgba(226, 232, 240, 0.8)', // হালকা বর্ডার
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
    },
    // সাকসেস টোস্টের জন্য আলাদা কালার স্কিম
    success: {
      iconTheme: {
        primary: '#10b981', // এমারেল্ড গ্রিন
        secondary: '#fff',
      },
      style: {
        borderLeft: '5px solid #10b981', // বাম পাশে সলিড লাইন
      },
    },
    // এরর টোস্টের জন্য আলাদা কালার স্কিম
    error: {
      iconTheme: {
        primary: '#ef4444', // রেড
        secondary: '#fff',
      },
      style: {
        borderLeft: '5px solid #ef4444',
      },
    },
    // লোডিং টোস্টের জন্য
    loading: {
      style: {
        background: '#fff',
        borderLeft: '5px solid #6366f1', // ইন্ডিগো কালার
      },
    },
  }}
/>
        
      </body>
    </html>
  );
}
