"use client";

import React from 'react';
import { HiOutlineShieldCheck, HiOutlineDocumentText, HiOutlineLockClosed, HiOutlineMail, HiOutlineCheckCircle, HiOutlineExclamation, HiOutlineCash, HiOutlineScale, HiOutlineLogout, HiOutlineClipboardList, HiOutlineGlobeAlt } from 'react-icons/hi';
import { FaFacebook, FaRobot, FaShieldAlt, FaBalanceScale, FaUserCheck, FaBan, FaCreditCard, FaTiktok } from 'react-icons/fa';

export default function TermsOfService() {
  const sections = [
    {
      id: "intro",
      title: "1. Introduction & Acceptance",
      icon: <HiOutlineDocumentText />,
      fullText: `By accessing or using New Smart Agent (NSA) at https://newsmartagent.com, you agree to be bound by these Terms of Service. Our platform provides AI-powered automation, Messenger integration, and workflow management services. If you do not agree to these terms, you may not access or use the service.`
    },
    {
      id: "eligibility",
      title: "2. Eligibility",
      icon: <FaUserCheck />,
      fullText: `You must be at least 13 years of age to use New Smart Agent (NSA), in compliance with Meta’s safety policies. By creating an account, you represent and warrant that you have the legal capacity to enter into a binding agreement and that your use of the service does not violate any applicable law.`
    },
    {
      id: "registration",
      title: "3. Account Security",
      icon: <HiOutlineLockClosed />,
      fullText: `To access our features, you must register for an account. You agree to provide accurate and complete information during registration. You are solely responsible for maintaining the confidentiality of your account credentials (password and login). Any activity that occurs under your account is your responsibility. You must notify us immediately of any unauthorized use.`
    },
    {
      id: "api-authorization",
      title: "4. User Accounts & API Authorization",
      icon: <HiOutlineClipboardList />,
      fullText: `To use our AI automation features, you must authorize New Smart Agent (NSA) to access your Google Business Profile and/or YouTube account via Google OAuth. You are responsible for maintaining the security of your account and any actions taken under your credentials. New Smart Agent (NSA) is not liable for any unauthorized access resulting from user negligence.`
    },
    {
      id: "api-usage",
      title: "5. API Usage & User Responsibility",
      icon: <HiOutlineShieldCheck />,
      fullText: `By using New Smart Agent (NSA), you agree to comply with all applicable Google Terms of Service and YouTube Terms of Service. You are solely responsible for any content posted through your authorized Google accounts. NSA is not responsible for any actions taken by Google (such as account suspension) due to your misuse of automated features.`
    },
    {
      id: "description",
      title: "6. Service Description",
      icon: <FaRobot />,
      fullText: `Service Description
New Smart Agent (NSA) is an AI-driven SaaS platform designed to enhance business efficiency. Our services include:

Automated Engagement: Automating responses to messages and comments on connected Facebook Pages via official APIs.

Workflow Orchestration: Creating and managing intelligent AI workflows through a centralized dashboard.

Business Communication: Providing a secure infrastructure to streamline customer interactions and automate repetitive tasks.

We provide the platform on an "as-is" and "as-available" basis. We reserve the right to update, modify, or discontinue features at our discretion to improve service quality.`
    },
    {
      id: "acceptable-use",
      title: "7. Permitted Use & Restrictions",
      icon: <FaBan />,
      fullText: `You agree not to use New Smart Agent (NSA) for any illegal activities, including but not limited to:
• Generating or posting spam, offensive, or misleading reviews/comments.
• Violating Google’s Service Policies or any third-party rights.
• Using the platform to distribute malware or engage in any form of automated abuse.
Users are prohibited from using New Smart Agent (NSA) to generate spam, misleading reviews, or artificial engagement that violates Google’s Service Policies.

You must not use NSA to generate or distribute spam, misleading reviews, or artificial engagement. Any attempt to automate bulk activities that violate third-party API policies will result in immediate termination of your account.`
    },
    {
      id: "tiktok-terms",
      title: "8. Specific Terms for TikTok API Integration",
      icon: <FaTiktok />,
      fullText: `1. TikTok API Services Participation
By using the TikTok automation features provided by New Smart Agent (NSA), you acknowledge and agree that:

Our platform uses TikTok API Services to automate video comments and direct messages.

You are also bound by the TikTok Terms of Service and TikTok Community Guidelines.

2. User Responsibility & Content

Prohibited Content: You are strictly prohibited from using our automation tools to post spam, hate speech, or any content that violates TikTok’s policies.

Account Security: You are responsible for the security of your TikTok account while it is connected to our platform.

Consent: You must have the necessary rights and permissions for any content you automate or respond to via our dashboard.

3. Limitations and Compliance

API Limits: New Smart Agent is subject to TikTok’s API rate limits. We are not responsible for delays or failures in automation caused by TikTok’s platform restrictions or account-level bans.

No Unauthorized Use: Our services shall not be used for any unauthorized harvesting of TikTok user data or creating fake engagement (e.g., botting followers).

4. Account Disconnection

Users can revoke New Smart Agent’s access to their TikTok account at any time through our dashboard or via their TikTok Security Settings.

Upon disconnection, our system will immediately cease all automated interactions on your behalf.`
    },
    {
      id: "ai-disclaimer",
      title: "9. AI-Generated Content Disclaimer",
      icon: <FaRobot />,
      fullText: `New Smart Agent (NSA) provides AI-generated responses for customer engagement. While we strive for accuracy, users are encouraged to review automated replies. New Smart Agent (NSA) is not responsible for any inaccuracies, misunderstandings, or reputational damage caused by AI-generated content.`
    },
    {
      id: "third-party",
      title: "10. Third-Party Services",
      icon: <HiOutlineGlobeAlt />,
      fullText: `Our platform integrates with third-party services, including Meta (Facebook Graph API), AI providers (OpenAI/Grok), and payment processors. Your use of these integrations is subject to the respective third-party’s terms and policies. We are not responsible for changes, downtime, or data handling practices of these external providers.

By using New Smart Agent (NSA), you agree to be bound by the YouTube Terms of Service and Google Business Profile Terms.`
    },
    {
      id: "payment",
      title: "11. Payment & Manual Transactions",
      icon: <FaCreditCard />,
      fullText: `Manual Payments: Currently, we accept payments via local mobile financial services (bKash, Nagod) and Bank Transfers. Activation of service occurs only after manual verification of the Transaction ID (TrxID) and sender details.
Subscription Model: Our services are offered as fixed-validity packs (e.g., 7 days, 30 days) with specific usage limits. Once validity expires or the limit is reached, automation will pause.
Refunds: All manual payments are final. No refunds will be issued once the subscription is activated.`
    },
    {
      id: "privacy",
      title: "12. Data Privacy",
      icon: <FaShieldAlt />,
      fullText: `Your use of New Smart Agent (NSA) is also governed by our Privacy Policy. By using the service, you consent to the collection and processing of data (including Facebook tokens and message metadata) as described in that policy to enable automation features.`
    },
    {
      id: "termination",
      title: "13. Termination of Service",
      icon: <HiOutlineLogout />,
      fullText: `We reserve the right to suspend or terminate your access to New Smart Agent (NSA) if you violate these terms or if your actions pose a risk to our platform or other users. You may also terminate your account at any time by disconnecting your Google services and contacting our support.`
    },
    {
      id: "liability",
      title: "14. Limitation of Liability",
      icon: <FaBalanceScale />,
      fullText: `New Smart Agent (NSA) and its developers shall not be liable for any indirect, incidental, or consequential damages arising out of your use of the service, including data loss or business interruption.`
    },
    {
       id: "governing-law",
       title: "15. Governing Law",
       icon: <HiOutlineScale />,
       fullText: `These Terms are governed by and construed in accordance with the laws of Bangladesh. Any disputes arising from these terms shall be resolved in the courts of Bangladesh.`
    },
    {
       id: "contact",
       title: "16. Contact Support",
       icon: <HiOutlineMail />,
       fullText: `For any questions regarding these Terms, please contact us at:
Email: newsmartagentbd@gmail.com
Address: Sadarpur, Faridpur, Bangladesh.
Official Website: https://newsmartagent.com`
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-600 selection:bg-indigo-100 selection:text-indigo-600">
      
      {/* Dynamic Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-100/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-100/20 rounded-full blur-[100px] animate-delay-2000"></div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-20 relative z-10">
        
        {/* Header Section */}
        <header className="text-left mb-20 md:mb-32 space-y-8 border-l-4 border-purple-600 pl-8 md:pl-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-100 rounded-full shadow-sm text-[10px] font-black text-purple-600 uppercase tracking-[0.3em]">
            <HiOutlineCheckCircle className="text-lg animate-pulse" /> Terms of Use
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter italic leading-none">
            Terms <br className="hidden md:block"/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">of Service</span>
          </h1>
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 text-xs font-black text-slate-400 uppercase tracking-widest">
            <p>Protocol V.3</p>
            <div className="hidden md:block w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
            <p>Last Updated: March 27, 2026</p>
            <div className="hidden md:block w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
            <p>Legal Center</p>
          </div>
        </header>

        {/* Content Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {sections.map((section) => (
            <div key={section.id} className="group bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.04)] hover:shadow-[0_48px_96px_-24px_rgba(139,92,246,0.12)] transition-all duration-700 hover:-translate-y-2">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 text-2xl group-hover:bg-purple-600 group-hover:text-white transition-all duration-500 group-hover:rotate-6 shadow-sm">
                  {section.icon}
                </div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase italic leading-tight">
                  {section.title}
                </h2>
              </div>
              <div className="text-sm md:text-base leading-relaxed text-slate-500 font-medium whitespace-pre-line opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                {section.fullText}
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Footer */}
        <footer className="mt-24 md:mt-32 pt-20 border-t border-slate-100">
          <div className="relative overflow-hidden bg-slate-950 p-2 rounded-[3rem] md:rounded-[4rem] group/footer">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 opacity-50 group-hover/footer:opacity-100 transition-opacity duration-1000"></div>
            <div className="relative bg-slate-950 rounded-[2.8rem] md:rounded-[3.8rem] p-12 md:p-24 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-12 overflow-hidden">
               <div className="space-y-6 text-center md:text-left">
                  <h3 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter leading-none">Need assistance? <br className="hidden md:block"/> We're here.</h3>
                  <div className="flex flex-col md:flex-row items-center gap-6 text-slate-400 font-black text-[10px] md:text-xs uppercase tracking-[0.3em]">
                     <div className="flex items-center gap-3">
                        <HiOutlineMail className="text-purple-400 text-xl" />
                        newsmartagentbd@gmail.com
                     </div>
                     <div className="hidden md:block w-2 h-2 bg-slate-800 rounded-full"></div>
                     <div className="flex items-center gap-3 text-purple-400">
                        <FaShieldAlt className="text-lg" />
                        Secure Agreement
                     </div>
                  </div>
               </div>
               <div className="w-20 h-20 md:w-32 md:h-32 bg-white rounded-full flex items-center justify-center text-slate-950 hover:bg-purple-600 hover:text-white transition-all duration-700 cursor-pointer group-hover/footer:scale-110 shadow-2xl shadow-white/5">
                  <HiOutlineShieldCheck className="text-3xl md:text-5xl" />
               </div>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-300 text-center mt-8 uppercase tracking-[0.6em]">
            Terms of Service • © 2026 New Smart Agent (NSA). All rights reserved.
          </p>
          <p className="text-xs text-slate-400 text-center mt-2">
            Contact: newsmartagentbd@gmail.com • Address: Sadarpur, Faridpur, Bangladesh
          </p>
        </footer>

      </div>
    </div>
  );
}
