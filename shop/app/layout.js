import "./globals.css";
import Script from "next/script";
import { CustomerAuthProvider } from "@/lib/auth-context";

export const metadata = {
  title: "স্মার্ট কাস্টমার শপ ও অর্ডার ট্র্যাকিং | Smart Shop",
  description: "এক ক্লিকে গুগল লগইন করে অর্ডার করুন এবং লাইভ কুরিয়ার ট্র্যাকিং দেখুন।",
  applicationName: "SmartShop",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SmartShop",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <CustomerAuthProvider>
          {children}
        </CustomerAuthProvider>
      </body>
    </html>
  );
}
