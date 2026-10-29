"use client";

import React from "react";

/**
 * RichTextDisplay
 * Renders rich text HTML or plain text gracefully with formatting preserved.
 */
export default function RichTextDisplay({ content = "", className = "" }) {
  if (!content) {
    return <span className="text-slate-400">No description provided.</span>;
  }

  // Check if string contains HTML tags
  const isHTML = /<[a-z][\s\S]*>/i.test(content);

  if (isHTML) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: content }}
        className={`leading-relaxed [&_h1]:text-base [&_h1]:font-black [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_p]:my-1 ${className}`}
      />
    );
  }

  return <p className={`whitespace-pre-wrap leading-relaxed ${className}`}>{content}</p>;
}
