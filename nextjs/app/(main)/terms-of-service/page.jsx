"use client";

import React from 'react';
import { HiOutlineShieldCheck, HiOutlineDocumentText, HiOutlineLockClosed, HiOutlineMail, HiOutlineCheckCircle, HiOutlineExclamation, HiOutlineCash, HiOutlineScale, HiOutlineLogout, HiOutlineClipboardList, HiOutlineGlobeAlt } from 'react-icons/hi';
import { FaFacebook, FaRobot, FaShieldAlt, FaBalanceScale, FaUserCheck, FaBan, FaCreditCard } from 'react-icons/fa';

export default function TermsOfService() {
  const sections = [
    {
      id: "intro",
      title: "1. Introduction & Acceptance",
      icon: <HiOutlineDocumentText />,
      fullText: `By accessing or using NewSmartAgent (https://newsmartagent.com), you agree to be bound by these Terms of Service. Our platform provides AI-powered automation, Messenger integration, and workflow management services. If you do not agree to these terms, you may not access or use the service.`
    },
    {
      id: "eligibility",
      title: "2. Eligibility",
      icon: <FaUserCheck />,
      fullText: `You must be at least 13 years of age to use NewSmartAgent, in compliance with Meta’s safety policies. By creating an account, you represent and warrant that you have the legal capacity to enter into a binding agreement and that your use of the service does not violate any applicable law.`
    },
    {
      id: "registration",
      title: "3. Account Security",
      icon: <HiOutlineLockClosed />,
      fullText: `To access our features, you must register for an account. You agree to provide accurate and complete information during registration. You are solely responsible for maintaining the confidentiality of your account credentials (password and login). Any activity that occurs under your account is your responsibility. You must notify us immediately of any unauthorized use.`
    },
    {
      id: "description",
      title: "4. Service Description",
      icon: <FaRobot />,
      fullText: `4. Service Description
NewSmartAgent is an AI-driven SaaS platform designed to enhance business efficiency. Our services include:

Automated Engagement: Automating responses to messages and comments on connected Facebook Pages via official APIs.

Workflow Orchestration: Creating and managing intelligent AI workflows through a centralized dashboard.

Business Communication: Providing a secure infrastructure to streamline customer interactions and automate repetitive tasks.

We provide the platform on an "as-is" and "as-available" basis. We reserve the right to update, modify, or discontinue features at our discretion to improve service quality.`
    },
    {
      id: "acceptable-use",
      title: "5. Acceptable Use",
      icon: <FaBan />,
      fullText: `You agree to use the platform responsibly. You are strictly prohibited from:
• Using automation to send spam, phishing, or harassing messages.
• Automating illegal content or violating any intellectual property rights.
• Attempting to reverse-engineer our backend or bypass security measures.
• Violating Meta’s Developer Policies or Community Standards while using our integrations.`
    },
    {
      id: "third-party",
      title: "6. Third-Party Services",
      icon: <HiOutlineGlobeAlt />,
      fullText: `Our platform integrates with third-party services, including Meta (Facebook Graph API), AI providers (OpenAI/Grok), and payment processors. Your use of these integrations is subject to the respective third-party’s terms and policies. We are not responsible for changes, downtime, or data handling practices of these external providers.`
    },
    {
      id: "payment",
      title: "7. Payment & Manual Transactions",
      icon: <FaCreditCard />,
      fullText: `Manual Payments: Currently, we accept payments via local mobile financial services (bKash, Nagod) and Bank Transfers. Activation of service occurs only after manual verification of the Transaction ID (TrxID) and sender details.
Subscription Model: Our services are offered as fixed-validity packs (e.g., 7 days, 30 days) with specific usage limits. Once validity expires or the limit is reached, automation will pause.
Refunds: All manual payments are final. No refunds will be issued once the subscription is activated.`
    },
    {
      id: "privacy",
      title: "8. Data Privacy",
      icon: <FaShieldAlt />,
      fullText: `Your use of NewSmartAgent is also governed by our Privacy Policy. By using the service, you consent to the collection and processing of data (including Facebook tokens and message metadata) as described in that policy to enable automation features.`
    },
    {
      id: "disclaimers",
      title: "9. Disclaimers & Liability",
      icon: <FaBalanceScale />,
      fullText: `"As-Is" Basis: We do not guarantee that the AI will always provide 100% accurate responses or that message delivery will be uninterrupted.
Liability: In no event shall NewSmartAgent or its founders be liable for any indirect, incidental, or consequential damages (including loss of business profits) arising from your use of the platform.`
    },
    {
      id: "termination",
      title: "10. Termination",
      icon: <HiOutlineLogout />,
      fullText: `By You: You may stop using the service and delete your account at any time.
By Us: We reserve the right to suspend or terminate your access if you violate these terms or engage in abusive behavior.
Effect: Upon termination, your stored Facebook tokens will be revoked, and access to your automation workflows will end.`
    },
    {
       id: "governing-law",
       title: "11. Governing Law",
       icon: <HiOutlineScale />,
       fullText: `These Terms are governed by and construed in accordance with the laws of Bangladesh. Any disputes arising from these terms shall be resolved in the courts of Bangladesh.`
    },
    {
       id: "contact",
       title: "12. Contact Support",
       icon: <HiOutlineMail />,
       fullText: `For any questions regarding these Terms, please contact us at:
Email: newsmartagentbd@gmail.com
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
            <p>Last Updated: March 2026</p>
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
                        support@newsmartagent.com
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
          <p className="text-[10px] font-bold text-slate-300 text-center mt-12 uppercase tracking-[0.6em]">
            Terms of Service • © 2026 NewSmartAgent. All rights reserved.
          </p>
        </footer>

      </div>
    </div>
  );
}