"use client";

import React from 'react';
import { HiOutlineShieldCheck, HiOutlineDocumentText, HiOutlineLockClosed, HiOutlineMail, HiOutlineClock, HiOutlineClipboardList, HiOutlineCloudUpload, HiOutlineKey, HiOutlineTrash, HiOutlineExclamationCircle, HiOutlineGlobeAlt } from 'react-icons/hi';
import { FaFacebook, FaRobot, FaShieldAlt, FaDatabase, FaExchangeAlt, FaUserShield } from 'react-icons/fa';

export default function PrivacyPolicy() {
  const sections = [
    {
      id: "introduction",
      title: "Introduction",
      icon: <HiOutlineDocumentText />,
      fullText: `Welcome to NewSmartAgent (accessible from newsmartagent.com). Your privacy is extremely important to us. This Privacy Policy document explains how we collect, use, disclose, and safeguard your information when you use our AI automation SaaS platform. By accessing or using our services, you agree to the collection and use of information in accordance with this policy.`
    },
    {
      id: "info-collect",
      title: "1. Information We Collect",
      icon: <HiOutlineClipboardList />,
      fullText: `We may collect several types of information to provide and improve our services. 

Personal Information: When you register for an account, we may collect: Name, Email address, Phone number, Company name (optional), and Billing details.

Account Data: To provide automation services we may store AI automation workflows, settings and configuration data, and connected accounts and integrations.

Usage Data: We automatically collect certain technical information such as IP address, browser type, device information, log files, pages visited, and time and date of access. This information helps us improve performance, security, and user experience.`
    },
    {
      id: "ai-processing",
      title: "2. AI Data Processing",
      icon: <FaRobot />,
      fullText: `NewSmartAgent uses artificial intelligence technologies to automate workflows, analyze inputs, and generate responses. Depending on how you use the platform, AI systems may process: user prompts, automation instructions, messages or comments from integrated platforms, and generated outputs. We do not use private user data to train AI models without explicit permission, unless clearly stated.`
    },
    {
      id: "third-party",
      title: "3. Third-Party Integrations",
      icon: <HiOutlineGlobeAlt />,
      fullText: `Our platform may integrate with third-party services to enable automation features. Examples include payment processing services, social media APIs, AI service providers, and cloud infrastructure providers. These third-party services may process limited information necessary to provide their functionality. Each third-party service operates under its own privacy policy.`
    },
    {
      id: "usage",
      title: "4. How We Use Your Information",
      icon: <HiOutlineClipboardList />,
      fullText: `We use the collected data for purposes such as: providing and maintaining the service, running AI automation workflows, processing payments and subscriptions, improving platform performance, providing customer support, detecting fraud or abuse, and ensuring security and reliability.`
    },
    {
      id: "cookies",
      title: "5. Cookies and Tracking",
      icon: <HiOutlineClock />,
      fullText: `Our website may use cookies and similar technologies to maintain user sessions, analyze platform usage, and improve user experience. You may disable cookies through your browser settings, but some features of the service may not function properly.`
    },
    {
      id: "security",
      title: "6. Data Storage and Security",
      icon: <HiOutlineLockClosed />,
      fullText: `We implement appropriate technical and organizational measures to protect your data, including encrypted data transmission (HTTPS), secure servers and infrastructure, access control mechanisms, and monitoring and logging systems. However, no system on the internet can be guaranteed to be completely secure.`
    },
    {
      id: "retention",
      title: "7. Data Retention",
      icon: <HiOutlineClock />,
      fullText: `We retain user information only as long as necessary to provide services, maintain legal compliance, resolve disputes, and enforce our agreements. If you delete your account, we will remove or anonymize your personal data unless retention is required by law.`
    },
    {
      id: "rights",
      title: "8. User Rights",
      icon: <FaUserShield />,
      fullText: `Depending on your jurisdiction, you may have the right to: access your personal data, correct inaccurate information, request deletion of your data, or withdraw consent for data processing. To make such requests, please contact us.`
    },
    {
      id: "children",
      title: "9. Children's Privacy",
      icon: <HiOutlineExclamationCircle />,
      fullText: `Our services are not intended for individuals under the age of 13. We do not knowingly collect personal information from children. If we become aware that a child has provided personal information, we will remove such data promptly.`
    },
    {
      id: "facebook-collect",
      title: "Facebook Data Collection",
      icon: <FaFacebook />,
      fullText: `When a user connects their Facebook Page to NewSmartAgent, we may access certain data via the Facebook Graph API with the permissions granted by the user. The information we may collect includes: Facebook Page ID, page name and basic page details, page access token, messages sent to the page through Facebook Messenger, comments on Facebook posts, sender ID, public profile information available through Meta permissions, and message timestamps and conversation metadata. We only access information required to operate automation features.`
    },
    {
       id: "messenger",
       title: "Messenger Automation Data",
       icon: <FaExchangeAlt />,
       fullText: `When Messenger automation is enabled, our system may process: incoming messages, conversation IDs, message timestamps, sender identifiers, and automation response data. This data is used to generate automated replies and manage messaging workflows.`
    },
    {
       id: "token-handling",
       title: "Page Access Token Handling",
       icon: <HiOutlineKey />,
       fullText: `To enable automation features, NewSmartAgent stores Facebook Page access tokens. These tokens are used only to: send automated messages, reply to comments, execute automation workflows, and access messaging features through Meta APIs. Security measures include secure storage, restricted system access, and encrypted communication. Users may disconnect their Facebook Page at any time to revoke access.`
    },
    {
       id: "fb-deletion",
       title: "Facebook Data Deletion",
       icon: <HiOutlineTrash />,
       fullText: `Users can request deletion of their data collected through Facebook integration. Option 1: Remove NewSmartAgent from your Facebook account settings under apps and websites. Option 2: Request deletion by contacting support@newsmartagent.com. Please include your Facebook Page ID and the email associated with your account. Once verified, we will delete the data within a reasonable timeframe.`
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-600 selection:bg-indigo-100 selection:text-indigo-600">
      
      {/* Dynamic Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-purple-100/20 rounded-full blur-[100px] animate-delay-2000"></div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-20 relative z-10">
        
        {/* Header Section */}
        <header className="text-left mb-20 md:mb-32 space-y-8 border-l-4 border-indigo-600 pl-8 md:pl-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-100 rounded-full shadow-sm text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">
            <HiOutlineShieldCheck className="text-lg animate-pulse" /> Compliance & Transparency
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter italic leading-none">
            Privacy <br className="hidden md:block"/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Governance</span>
          </h1>
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 text-xs font-black text-slate-400 uppercase tracking-widest">
            <p>Version 2.4.0</p>
            <div className="hidden md:block w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
            <p>Last Updated: March 2026</p>
            <div className="hidden md:block w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
            <p>newsmartagent.com</p>
          </div>
        </header>

        {/* Content Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {sections.map((section) => (
            <div key={section.id} className="group bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.04)] hover:shadow-[0_48px_96px_-24px_rgba(79,70,229,0.12)] transition-all duration-700 hover:-translate-y-2">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 group-hover:rotate-6">
                  {section.icon}
                </div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase italic whitespace-pre-line leading-tight">
                  {section.title}
                </h2>
              </div>
              <div className="text-sm md:text-base leading-relaxed text-slate-500 font-medium whitespace-pre-line opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                {section.fullText}
              </div>
            </div>
          ))}
        </div>

        {/* Actionable Footer */}
        <footer className="mt-24 md:mt-32 pt-20 border-t border-slate-100">
          <div className="relative overflow-hidden bg-slate-950 p-2 rounded-[3rem] md:rounded-[4rem] group/footer">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-50 group-hover/footer:opacity-100 transition-opacity duration-1000"></div>
            <div className="relative bg-slate-950 rounded-[2.8rem] md:rounded-[3.8rem] p-12 md:p-24 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-12 overflow-hidden">
               <div className="space-y-6 text-center md:text-left">
                  <h3 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter leading-none">Questions? <br className="hidden md:block"/> Get in touch.</h3>
                  <div className="flex flex-col md:flex-row items-center gap-6 text-slate-400 font-black text-[10px] md:text-xs uppercase tracking-[0.3em]">
                     <div className="flex items-center gap-3">
                        <HiOutlineMail className="text-indigo-400 text-xl" />
                        newsmartagentbd@gmail.com
                     </div>
                     <div className="hidden md:block w-2 h-2 bg-slate-800 rounded-full"></div>
                     <div className="flex items-center gap-3">
                        <HiOutlineShieldCheck className="text-indigo-400 text-xl" />
                        GDPR Compliant
                     </div>
                  </div>
               </div>
               <div className="w-20 h-20 md:w-32 md:h-32 bg-white rounded-full flex items-center justify-center text-slate-950 hover:bg-indigo-600 hover:text-white transition-all duration-700 cursor-pointer group-hover/footer:scale-110 shadow-2xl shadow-white/5">
                  <FaShieldAlt className="text-3xl md:text-5xl" />
               </div>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-300 text-center mt-12 uppercase tracking-[0.6em]">
            © 2026 NewSmartAgent Intelligence • Built for the future of SaaS.
          </p>
        </footer>

      </div>
    </div>
  );
}