"use client";

import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

export default function OptionTooltip({
  title,
  description,
  children,
  align = "auto",
  position = "auto",
  className = "",
  showIcon = false,
}) {
  const tooltipText =
    title && description
      ? `${title}\n${description}`
      : description || title || "";

  if (!tooltipText) {
    return <>{children}</>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={tooltipText}
    >
      {children}
      {showIcon && (
        <span
          className="inline-flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-600 transition-colors cursor-help shrink-0"
          title={tooltipText}
          aria-label={title || "বিস্তারিত তথ্য"}
        >
          <QuestionMarkCircleIcon className="w-3.5 h-3.5" />
        </span>
      )}
    </span>
  );
}
