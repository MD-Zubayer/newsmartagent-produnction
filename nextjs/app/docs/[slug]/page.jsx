// app/docs/[slug]/page.jsx
"use client";
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useDocs } from '../DocsContext';
import { CpuChipIcon } from '@heroicons/react/24/outline';

// Skeleton for loading state
const DocSkeleton = () => (
  <div className="animate-pulse space-y-8">
    <div className="h-12 bg-gray-100 rounded-xl w-3/4" />
    <div className="h-4 bg-gray-50 rounded w-full" />
    <div className="h-4 bg-gray-50 rounded w-5/6" />
    <div className="h-64 bg-gray-50 rounded-3xl w-full mt-12" />
  </div>
);

export default function DocTopicPage({ params }) {
  const { slug } = React.use(params);
  const { lang, supportEmail } = useDocs();

  // Custom component to render the dynamic support email
  const SupportEmail = () => (
    <a href={`mailto:${supportEmail}`} className="text-indigo-600 underline font-bold hover:text-indigo-800 transition-colors">
      {supportEmail}
    </a>
  );

  // Dynamically import the MDX file based on language and slug
  const Content = dynamic(
    () => import(`../content-mdx/${lang}/${slug}.mdx`).catch(() => {
      return () => (
        <div className="p-20 text-center">
          <div className="inline-flex p-4 bg-red-50 rounded-full mb-6 text-red-600">
            <CpuChipIcon className="h-12 w-12" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Documentation Not Found</h2>
          <p className="text-gray-500 font-medium italic">We are currently updating this section. Please check back later.</p>
        </div>
      );
    }),
    { 
      loading: () => <DocSkeleton />,
      ssr: true 
    }
  );

  return (
    <div className="max-w-4xl mx-auto min-h-[70vh]">
      <section className="mb-24 max-w-none">
        <Suspense fallback={<DocSkeleton />}>
          <Content components={{ SupportEmail }} />
        </Suspense>
      </section>

      <footer className="pt-16 border-t border-gray-100 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <CpuChipIcon className="h-5 w-5 text-indigo-600" />
          <span className="font-black text-gray-900 uppercase tracking-tighter">News Smart Agent</span>
        </div>
        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em]">
          © 2026 Powered by Advanced AI Foundations. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
