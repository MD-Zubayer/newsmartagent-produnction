import React from 'react';

export const metadata = {
  title: 'Privacy Policy | New Smart Agent',
  description: 'Privacy Policy and Data Deletion Instructions for New Smart Agent.',
};

const PrivacyPolicy = () => {
  return (
    <div className="bg-[#f8fafc] min-h-screen py-8 md:py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight px-2">
            Privacy Policy
          </h1>
          <p className="text-slate-600 text-base md:text-lg max-w-2xl mx-auto px-2">
            আপনার ডাটা সুরক্ষা আমাদের সর্বোচ্চ অগ্রাধিকার। New Smart Agent কিভাবে আপনার তথ্য ব্যবহার করে তা এখানে বিস্তারিত রয়েছে।
          </p>
          <div className="mt-4 inline-block px-4 py-1 rounded-full bg-blue-50 text-blue-700 text-xs md:text-sm font-semibold border border-blue-100">
            Last Updated: March 6, 2026
          </div>
        </div>

        <div className="bg-white shadow-xl shadow-slate-200/50 rounded-2xl md:rounded-3xl overflow-hidden border border-slate-100">
          <div className="p-6 md:p-12">
            
            <div className="space-y-10 md:space-y-12">
              
              {/* Intro */}
              <div className="border-l-4 border-blue-600 pl-4 md:pl-6">
                <p className="text-slate-700 leading-relaxed text-base md:text-lg">
                  At <strong className="text-slate-900">New Smart Agent</strong>, accessible from{" "}
                  <a href="https://newsmartagent.com/" className="text-blue-600 font-medium underline underline-offset-4 break-all">
                    https://newsmartagent.com/
                  </a>
                  , one of our main priorities is the privacy of our visitors and users.
                </p>
              </div>

              {/* Grid Section - Mobile Friendly */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                <div className="space-y-3">
                  <h2 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
                    1. Information We Collect
                  </h2>
                  <ul className="space-y-2 text-slate-600 text-sm md:text-base">
                    <li className="flex gap-2"><span>•</span> <span><strong>Account Data:</strong> Name and email via Meta.</span></li>
                    <li className="flex gap-2"><span>•</span> <span><strong>Page Content:</strong> Comments & messages for automation.</span></li>
                    <li className="flex gap-2"><span>•</span> <span><strong>Log Info:</strong> IP and browser type for security.</span></li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h2 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
                    2. How We Use Data
                  </h2>
                  <ul className="space-y-2 text-slate-600 text-sm md:text-base">
                    <li className="flex gap-2"><span>•</span> <span>Operate and maintain automation tools.</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Personalize & expand our platform.</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Customer support and updates.</span></li>
                  </ul>
                </div>
              </div>

              {/* Security */}
              <div className="bg-slate-50 p-5 md:p-8 rounded-xl md:rounded-2xl border border-slate-100">
                <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-2">3. Data Protection</h2>
                <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                  আমরা আপনার ডাটা সুরক্ষিত রাখতে আধুনিক নিরাপত্তা ব্যবস্থা ব্যবহার করি। 
                  <strong className="text-slate-800"> আপনার ডাটা কখনোই তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।</strong>
                </p>
              </div>

              {/* Data Deletion - Highly Responsive Section */}
              <div className="mt-12 bg-slate-900 rounded-2xl md:rounded-3xl p-6 md:p-10 text-white shadow-2xl">
                <h2 className="text-xl md:text-3xl font-bold mb-4 md:mb-6">
                  User Data Deletion Instructions
                </h2>
                <p className="text-slate-400 mb-6 text-sm md:text-lg">
                  New Smart Agent values your privacy. আপনি নিচের ধাপগুলো অনুসরণ করে আপনার ডাটা মুছে ফেলতে পারেন:
                </p>
                
                <div className="flex flex-col space-y-6">
                  {/* Step List */}
                  <div className="bg-white/5 p-5 rounded-xl border border-white/10">
                    <ol className="list-decimal pl-5 space-y-3 text-slate-200 text-sm md:text-base">
                      <li>Go to Facebook Profile <strong>Settings & Privacy &gt; Settings</strong>.</li>
                      <li>Find <strong>Apps and Websites</strong>.</li>
                      <li>Search for <strong>New Smart Agent</strong>.</li>
                      <li>Click the <strong>Remove</strong> button.</li>
                    </ol>
                  </div>
                  
                  {/* Contact Box */}
                  <div className="p-5 bg-blue-600/10 rounded-xl border border-blue-500/20">
                    <p className="text-[10px] md:text-xs text-blue-400 uppercase tracking-widest font-bold mb-2">Permanent Deletion</p>
                    <p className="text-slate-200 text-xs md:text-sm mb-3">সার্ভার থেকে স্থায়ীভাবে ডাটা মুছতে ইমেইল করুন:</p>
                    <a href="mailto:newsmartagentbd@gmail.com" className="text-base md:text-xl font-mono font-bold text-blue-400 break-all hover:text-blue-300 transition-colors">
                      newsmartagentbd@gmail.com
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <footer className="mt-8 md:mt-12 text-center text-slate-400 text-[10px] md:text-sm">
          <p>&copy; {new Date().getFullYear()} New Smart Agent. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPolicy;