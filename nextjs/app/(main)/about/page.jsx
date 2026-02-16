// app/about/page.js
import {
  RocketLaunchIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  SparklesIcon,
  BoltIcon,
  CpuChipIcon,
  ChartBarIcon,
  LifebuoyIcon
} from "@heroicons/react/24/outline";

export default function AboutPage() {
  return (
    <section className="min-h-screen bg-white">

      {/* --- Hero Section --- */}
      <div className="relative py-24 bg-gradient-to-b from-indigo-50/50 to-white px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 mb-6 text-xs font-black tracking-[0.2em] uppercase bg-indigo-100 text-indigo-600 rounded-full">
            Our Story
          </span>

          <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tighter mb-6">
            Building the future of <br />
            <span className="text-indigo-600">Facebook Automation.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 font-medium leading-relaxed">
            ৫ মিনিটে চালু করুন আপনার AI অটো-রিপ্লাই সিস্টেম। 
          প্রয়োজন নাই কোন ইঞ্জিনিয়ার,নাই কোন ঝামেলা, শুধু রেজাল্ট।
          </p>
        </div>
      </div>


      <div className="max-w-6xl mx-auto px-6 pb-24">

        {/* --- Features Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mt-6 mb-24">

          <Feature
            Icon={RocketLaunchIcon}
            title="Instant Setup"
            text="শুধু Page ID + Access Token দিলেই ৫ মিনিটে সার্ভিস চালু। কোন টেক ঝামেলা নেই।"
          />

          <Feature
            Icon={ShieldCheckIcon}
            title="No Engineer Cost"
            text="ইঞ্জিনিয়ার ভাড়া, মেইনটেনেন্স খরচ, বাগ ফিক্স—কিছুই দিতে হবে না। সব আমরা হ্যান্ডেল করি।"
          />

          <Feature
            Icon={CpuChipIcon}
            title="AI Hyper Performance"
            text="কম টোকেনে দ্রুত রিপ্লাই। হাই-স্পিড, লো-কস্ট, স্মার্ট অটোমেশন।"
          />

          <Feature
            Icon={ChartBarIcon}
            title="Smart Analytics"
            text="রিয়েল-টাইম ডাটা, কমেন্ট, মেসেজ, রিপ্লাই—সব ড্যাশবোর্ডে ক্লিয়ার রিপোর্ট।"
          />

        </div>


        {/* --- Main Content --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-12">

          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">
              ছোট ব্যবসা থেকে বড় এজেন্সি —
              <span className="text-indigo-600"> সবার জন্য অটোমেশন।</span>
            </h2>

            <p className="text-gray-600 leading-8 font-medium">
              সত্য কথা বলি —
              আজকাল ফেসবুক অটোমেশন করতে গেলে ডেভেলপার লাগে,
              সার্ভার লাগে, মেইনটেনেন্স লাগে, খরচ লাগে।
              কয়েকদিন পরপর সমস্যা আসেই।
            </p>

            <p className="text-gray-600 leading-8 font-medium">
              আমরা ওই পুরা ঝামেলাটা কেটে দিছি।
              Plug & Play সিস্টেম। আপনি শুধু ব্যবহার করবেন।
              বাকিটা আমরা দেখবো।
            </p>
          </div>


{/* --- Why Us Card --- */}
          <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-200/50 relative overflow-hidden group">
            
            {/* Background Glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-3xl group-hover:bg-indigo-100 transition-all"></div>

            <div className="flex items-center gap-3 mb-10 relative z-10">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              <h4 className="text-2xl font-black text-gray-900 tracking-tight">Why Choose Us?</h4>
            </div>

            <ul className="space-y-5 relative z-10">
              {[
                { en: "No Engineering Cost", bn: "এক্সট্রা ইঞ্জিনিয়ার বা ডেভেলপার খরচ নেই" },
                { en: "Instant Deployment", bn: "মাত্র ৫ মিনিটে আপনার এআই এজেন্ট লাইভ হবে" },
                { en: "Smart AI Auto-Reply", bn: "মানুষের মতো নিখুঁত অটো রিপ্লাই সিস্টেম" },
                { en: "Token Optimized", bn: "অত্যাধুনিক প্রযুক্তিতে খরচ কমিয়ে আনুন" },
                { en: "Advanced Analytics", bn: "ফুল ড্যাশবোর্ড এবং ডিটেইলড রিপোর্ট" },
                { en: "24/7 Priority Support", bn: "যেকোনো সমস্যায় আমরা আছি আপনার পাশে" },
                { en: "Guided Tutorials", bn: "সহজ ভিডিও গাইড ও ডকুমেন্টেশন" },
                { en: "Affordable Pricing", bn: "মার্কেটে সবচেয়ে সাশ্রয়ী এবং সেরা ডিল" }
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3 group/item">
                  <div className="mt-1">
                    <div className="bg-emerald-100 text-emerald-600 rounded-full p-1 group-hover/item:bg-emerald-500 group-hover/item:text-white transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-gray-900 uppercase tracking-tight">{item.en}</span>
                    <span className="text-xs font-medium text-gray-500">{item.bn}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>


        {/* --- Extra Trust Section --- */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">

          <Feature
            Icon={BoltIcon}
            title="Lightning Fast"
            text="মেসেজ বা কমেন্ট আসার সাথে সাথে ইনস্ট্যান্ট রিপ্লাই।"
          />

          <Feature
            Icon={UserGroupIcon}
            title="Built for Teams"
            text="মার্কেটার, এজেন্সি, উদ্যোক্তা—সবাই সহজে ব্যবহার করতে পারবে।"
          />

          <Feature
            Icon={LifebuoyIcon}
            title="24/7 Support"
            text="যেকোন সমস্যা? আমরা আছি সবসময়। রিয়েল মানুষ, রিয়েল হেল্প।"
          />

        </div>
      </div>
    </section>
  );
}



function Feature({ Icon, title, text }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50 hover:border-indigo-100 transition-all">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-xl font-black text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed font-medium">{text}</p>
    </div>
  );
}
