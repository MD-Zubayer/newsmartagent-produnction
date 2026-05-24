"use client";

import {
  RocketLaunchIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  SparklesIcon,
  BoltIcon,
  CpuChipIcon,
  ChartBarIcon,
  LifebuoyIcon,
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";

export default function AboutPage() {
  const { lang } = useLanguage();
  const tr = (en, bn) => (lang === "bn" ? bn : en);

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "New Smart Agent",
    url: "https://newsmartagent.com",
    logo: "https://newsmartagent.com/newsmartagent.png",
    description:
      "New Smart Agent is an AI automation platform for Facebook pages, messenger automation, and smart customer management.",
    sameAs: [
      "https://facebook.com/newsmartagent",
      "https://youtube.com/@newsmartagent",
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />

      <section className="min-h-screen bg-white">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }}
          className="relative overflow-hidden bg-gradient-to-b from-indigo-100/70 to-white px-6 py-24"
        >
          <div className="pointer-events-none absolute inset-0">
            <motion.div
              className="absolute -right-40 -top-40 h-72 w-72 rounded-full bg-pink-300 opacity-30 blur-3xl"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            />
            <motion.div
              className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-indigo-300 opacity-30 blur-3xl"
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
            />
          </div>

          <pre className="pointer-events-none absolute inset-0 overflow-hidden p-8 font-mono text-sm text-indigo-200">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  repeat: Infinity,
                  repeatDelay: 2,
                  duration: 4,
                  ease: "easeInOut",
                },
              }}
              className="whitespace-pre"
            >{`// Initialize AI Agent
const agent = new SmartAgent({
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
  platform: "facebook",
});

agent.start();`}</motion.div>
          </pre>

          <div className="relative z-10 mx-auto max-w-6xl pb-24">
            <div className="mb-24 mt-6 grid grid-cols-1 gap-8 md:grid-cols-4">
              <Feature
                Icon={RocketLaunchIcon}
                title="Instant Setup"
                text={tr(
                  "Go live in 5 minutes with just Page ID + Access Token. Zero tech hassle.",
                  "শুধু Page ID + Access Token দিলেই ৫ মিনিটে সার্ভিস চালু। কোন টেক ঝামেলা নেই।"
                )}
              />

              <Feature
                Icon={ShieldCheckIcon}
                title="No Engineer Cost"
                text={tr(
                  "No engineer hiring, maintenance cost, or bug-fix overhead. We handle it all.",
                  "ইঞ্জিনিয়ার ভাড়া, মেইনটেনেন্স খরচ, বাগ ফিক্স—কিছুই দিতে হবে না। সব আমরা হ্যান্ডেল করি।"
                )}
              />

              <Feature
                Icon={CpuChipIcon}
                title="AI Hyper Performance"
                text={tr(
                  "Fast replies with fewer tokens. High speed, low cost, smart automation.",
                  "কম টোকেনে দ্রুত রিপ্লাই। হাই-স্পিড, লো-কস্ট, স্মার্ট অটোমেশন।"
                )}
              />

              <Feature
                Icon={ChartBarIcon}
                title="Smart Analytics"
                text={tr(
                  "Real-time data for comments, messages, and replies with clear dashboards.",
                  "রিয়েল-টাইম ডাটা, কমেন্ট, মেসেজ, রিপ্লাই—সব ড্যাশবোর্ডে ক্লিয়ার রিপোর্ট।"
                )}
              />
            </div>

            <div className="grid grid-cols-1 items-center gap-16 py-12 lg:grid-cols-2">
              <div className="space-y-6">
                <h2 className="text-3xl font-black leading-tight text-gray-900 md:text-4xl">
                  Automate for everyone
                  <span className="text-indigo-600"> from small business to big agencies.</span>
                </h2>

                <p className="text-gray-600 leading-8 font-medium">
                  {tr(
                    "Let’s be honest—traditional Facebook automation needs developers, servers, maintenance, and recurring costs. Issues keep showing up.",
                    "সত্য কথা বলি — আজকাল ফেসবুক অটোমেশন করতে গেলে ডেভেলপার লাগে, সার্ভার লাগে, মেইনটেনেন্স লাগে, খরচ লাগে। কয়েকদিন পরপর সমস্যা আসেই।"
                  )}
                </p>

                <p className="text-gray-600 leading-8 font-medium">
                  {tr(
                    "We removed that entire hassle. Plug & Play system—you just use it, we handle the rest.",
                    "আমরা ওই পুরা ঝামেলাটা কেটে দিছি। Plug & Play সিস্টেম। আপনি শুধু ব্যবহার করবেন। বাকিটা আমরা দেখবো।"
                  )}
                </p>
              </div>

              <div>
                <div className="mb-4 inline-block rounded-lg bg-indigo-600 p-2">
                  <SparklesIcon className="h-5 w-5 text-white" />
                </div>
                <h4 className="mb-6 text-2xl font-black tracking-tight text-gray-900">Why Choose Us?</h4>

                <ul className="relative z-10 space-y-5">
                  {[
                    { en: "No Engineering Cost", bn: "এক্সট্রা ইঞ্জিনিয়ার বা ডেভেলপার খরচ নেই" },
                    { en: "Instant Deployment", bn: "মাত্র ৫ মিনিটে আপনার এআই এজেন্ট লাইভ হবে" },
                    { en: "Smart AI Auto-Reply", bn: "মানুষের মতো নিখুঁত অটো রিপ্লাই সিস্টেম" },
                    { en: "Token Optimized", bn: "অত্যাধুনিক প্রযুক্তিতে খরচ কমিয়ে আনুন" },
                    { en: "Advanced Analytics", bn: "ফুল ড্যাশবোর্ড এবং ডিটেইলড রিপোর্ট" },
                    { en: "24/7 Priority Support", bn: "যেকোনো সমস্যায় আমরা আছি আপনার পাশে" },
                    { en: "Guided Tutorials", bn: "সহজ ভিডিও গাইড ও ডকুমেন্টেশন" },
                    { en: "Affordable Pricing", bn: "মার্কেটে সবচেয়ে সাশ্রয়ী এবং সেরা ডিল" },
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3 group/item">
                      <div className="mt-1">
                        <div className="rounded-full bg-emerald-100 p-1 text-emerald-600 transition-all group-hover/item:bg-emerald-500 group-hover/item:text-white">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={4}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black uppercase tracking-tight text-gray-900">
                          {tr(item.en, item.bn)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-24 grid grid-cols-1 gap-8 md:grid-cols-3">
              <Feature
                Icon={BoltIcon}
                title="Lightning Fast"
                text={tr(
                  "Instant replies the moment a message or comment arrives.",
                  "মেসেজ বা কমেন্ট আসার সাথে সাথে ইনস্ট্যান্ট রিপ্লাই।"
                )}
              />

              <Feature
                Icon={UserGroupIcon}
                title="Built for Teams"
                text={tr(
                  "Made for marketers, agencies, and founders—everyone can use it easily.",
                  "মার্কেটার, এজেন্সি, উদ্যোক্তা—সবাই সহজে ব্যবহার করতে পারবে।"
                )}
              />

              <Feature
                Icon={LifebuoyIcon}
                title="24/7 Support"
                text={tr(
                  "Any issue? We are here 24/7—real humans, real help.",
                  "যেকোন সমস্যা? আমরা আছি সবসময়। রিয়েল মানুষ, রিয়েল হেল্প।"
                )}
              />
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function Feature({ Icon, title, text }) {
  return (
    <div className="rounded-[2.5rem] border border-gray-50 bg-white p-8 shadow-xl transition-all hover:border-indigo-100">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mb-3 text-xl font-black text-gray-900">{title}</h3>
      <p className="text-sm font-medium leading-relaxed text-gray-500">{text}</p>
    </div>
  );
}
