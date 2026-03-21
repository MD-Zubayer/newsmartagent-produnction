import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./(main)/components/Navbar";
import Footer from "./(main)/components/Footer";
import { Toaster } from "react-hot-toast";
import MessengerButton from "./(main)/components/MessengerButton";
// import Footer from "../components/Footer";
import { usePathname } from "next/navigation";
import Script from "next/script";



const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});





export const viewport = {
  themeColor: "#ffffff",
};

export const metadata = {
  title: {
    default: "New Smart Agent - AI Automation Platform",
    template: "%s | New Smart Agent",
  },
  description:
    "New Smart Agent is an AI automation platform that automatically replies to Facebook messages, comments, and manages customer orders 24/7.",
  icons: {
    icon: "/newsmartagent.png"
  },
  keywords: [
    "AI Automation",
    "Facebook Auto Reply",
    "Messenger Automation",
    "AI Chatbot",
    "Business Automation",
    "New Smart Agent"
  ],
  metadataBase: new URL("https://newsmartagent.com"),

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "New Smart Agent - AI Automation Platform",
    description:
      "Automate Facebook replies, manage customers, and collect orders with AI.",
    url: "https://newsmartagent.com",
    siteName: "New Smart Agent",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/newsmartagent.png", // আপনার লোগো বা একটি ব্যানার ইমেজ
        width: 1200,
        height: 630,
        alt: "New Smart Agent - AI Automation Platform",
      },
    ],
  },
  // favicon এবং অ্যাপল টাচ আইকন এর জন্য icons সেকশনটি এভাবে দিতে পারেন
  icons: {
    icon: "/newsmartagent.png",
    apple: "/newsmartagent.png",
  },

  twitter: {
    card: "summary_large_image",
    title: "New Smart Agent",
    description:
      "AI automation platform for Facebook pages and customer management.",
  },

  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "New Smart Agent",
  },
};

export default function RootLayout({ children }) {


  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');


  const structuredData = [{
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "New Smart Agent",
    url: "https://newsmartagent.com",
    description:
      "AI automation platform for Facebook pages, messenger automation, and smart customer management.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",

    offers: {
      "@type": "Offer",
      price: "100",
      priceCurrency: "BDT",
      priceSpecification: {
        "@type": "PriceSpecification",
        price: "100",
        priceCurrency: "BDT",
        valueAddedTaxIncluded: false
      },
      availability: "https://schema.org/InStock",
      url: "https://newsmartagent.com/signup"
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "New Smart Agent",
    "url": "https://newsmartagent.com",
    "logo": "https://newsmartagent.com/newsmartagent.png",
    "sameAs": [
      "https://www.facebook.com/share/1G5CKXCgCk/", // আপনার ফেসবুক পেজ লিঙ্ক
      "http://www.youtube.com/@NewSmartAgent"
    ]
  }
  ]

  return (
    <html lang="en">
      <head>
        <meta name="facebook-domain-verification" content="mtx9mkprfp4g4qth08yyt53r69k561" />

      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />

        {children}
        <MessengerButton />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== "undefined" && "serviceWorker" in navigator) {
                window.addEventListener("load", function () {
                  navigator.serviceWorker.register("/sw.js").then(
                    function (registration) {
                      console.log("Service Worker registration successful with scope: ", registration.scope);
                    },
                    function (err) {
                      console.log("Service Worker registration failed: ", err);
                    }
                  );
                });
              }
            `,
          }}
        />


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



{!isDashboard && (
          <Script 
            src="https://newsmartagent.com/widget.js" 
            data-key="9d94fbd8-167a-42d2-b3e8-389062ca8b49" 
            strategy="afterInteractive"
          />
        )}

      </body>
    </html>
  );
}
