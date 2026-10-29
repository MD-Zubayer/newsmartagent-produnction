"use client";

import React, { useMemo } from 'react';

/**
 * Strips internal AI control tags before rendering.
 */
function cleanContent(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\[\[\s*(WIDGET|ACTION)\s*:\s*[a-zA-Z0-9_:+\-#]+\s*\]\]/gi, '')
    .replace(/\[\[\s*(WIDGET|ACTION)[^\]]*$/gi, '')
    .trim();
}

/**
 * Parses inline markdown: bold, italic, inline code, links, and auto-links.
 */
function renderInlineMarkdown(text) {
  if (!text) return null;

  // Regex tokens:
  // 1. Links: [label](url)
  // 2. Inline Code: `code`
  // 3. Bold: **text** or __text__
  // 4. Italic: *text* or _text_
  // 5. Strikethrough: ~~text~~
  // 6. Bare URLs: https://...
  const tokenRegex = /(\[.*?\]\(https?:\/\/[^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?:\b|(?<=\s))\*[^*]+\*(?=\s|\b)|(?:\b|(?<=\s))_[^_]+_(?=\s|\b)|~~[^~]+~~|https?:\/\/[^\s<]+)/g;

  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Link: [label](url)
    const linkMatch = part.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline font-semibold transition-colors break-all"
        >
          {linkMatch[1] || linkMatch[2]}
        </a>
      );
    }

    // Bare URL: https://...
    if (/^https?:\/\/[^\s<]+$/.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline font-semibold transition-colors break-all"
        >
          {part}
        </a>
      );
    }

    // Inline Code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded-md bg-slate-900/90 text-indigo-300 border border-slate-700/60 font-mono text-[11px] sm:text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold: **text** or __text__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
        <strong key={index} className="font-bold text-white tracking-wide">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic: *text* or _text_
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Strikethrough: ~~text~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return (
        <del key={index} className="line-through text-slate-400">
          {part.slice(2, -2)}
        </del>
      );
    }

    return part;
  });
}

/**
 * MarkdownMessage
 * Lightweight, zero-dependency, safe Markdown renderer for Shop chat messages.
 */
export default function MarkdownMessage({ content = '', isStreaming = false, className = '' }) {
  const cleaned = useMemo(() => cleanContent(content), [content]);

  const blocks = useMemo(() => {
    if (!cleaned) return [];

    const lines = cleaned.split('\n');
    const parsedBlocks = [];
    let currentList = null; // { type: 'ul' | 'ol', items: [] }
    let inCodeBlock = false;
    let codeBlockLines = [];

    const flushList = () => {
      if (currentList) {
        parsedBlocks.push(currentList);
        currentList = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Fenced Code Block Toggle: ```
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          parsedBlocks.push({
            type: 'code_block',
            content: codeBlockLines.join('\n')
          });
          codeBlockLines = [];
          inCodeBlock = false;
        } else {
          flushList();
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Empty Line
      if (!trimmed) {
        flushList();
        parsedBlocks.push({ type: 'empty' });
        continue;
      }

      // Headings: #, ##, ###
      if (/^#{1,4}\s+/.test(trimmed)) {
        flushList();
        const level = trimmed.match(/^(#{1,4})\s+/)[1].length;
        const text = trimmed.replace(/^#{1,4}\s+/, '');
        parsedBlocks.push({ type: 'heading', level, text });
        continue;
      }

      // Blockquotes: >
      if (/^>\s+/.test(trimmed)) {
        flushList();
        parsedBlocks.push({
          type: 'blockquote',
          text: trimmed.replace(/^>\s+/, '')
        });
        continue;
      }

      // Bullet List: - item, * item, • item
      const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) {
        if (!currentList || currentList.type !== 'ul') {
          flushList();
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(bulletMatch[1]);
        continue;
      }

      // Numbered List: 1. item, 2. item
      const numberMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
      if (numberMatch) {
        if (!currentList || currentList.type !== 'ol') {
          flushList();
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(numberMatch[2]);
        continue;
      }

      // Normal paragraph line
      flushList();
      parsedBlocks.push({ type: 'p', text: line });
    }

    if (inCodeBlock && codeBlockLines.length > 0) {
      parsedBlocks.push({
        type: 'code_block',
        content: codeBlockLines.join('\n')
      });
    }

    flushList();
    return parsedBlocks;
  }, [cleaned]);

  if (!cleaned) {
    if (isStreaming) {
      return (
        <span className="inline-block w-2 h-4 ml-1 align-middle bg-indigo-400 animate-pulse rounded-sm shadow-[0_0_8px_rgba(129,140,248,0.9)]" />
      );
    }
    return null;
  }

  return (
    <div className={`space-y-1.5 leading-relaxed break-words select-text ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'empty') {
          return <div key={idx} className="h-1" />;
        }

        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4';
          const sizeClass =
            block.level === 1
              ? 'text-sm sm:text-base font-black text-white mt-1 mb-0.5'
              : block.level === 2
                ? 'text-xs sm:text-sm font-bold text-indigo-200 mt-1 mb-0.5'
                : 'text-xs font-bold text-slate-100 mt-0.5';
          return (
            <Tag key={idx} className={sizeClass}>
              {renderInlineMarkdown(block.text)}
            </Tag>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-indigo-500/60 pl-2.5 py-0.5 my-1 text-slate-300 italic bg-indigo-500/5 rounded-r"
            >
              {renderInlineMarkdown(block.text)}
            </blockquote>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul key={idx} className="space-y-1 my-1 pl-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <span className="flex-1">{renderInlineMarkdown(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={idx} className="space-y-1 my-1 pl-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-100">
                  <span className="font-mono text-[11px] font-bold text-indigo-400 min-w-4 text-right shrink-0 mt-0.5">
                    {itemIdx + 1}.
                  </span>
                  <span className="flex-1">{renderInlineMarkdown(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'code_block') {
          return (
            <pre
              key={idx}
              className="p-3 my-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-indigo-200 font-mono text-[11px] sm:text-xs overflow-x-auto shadow-inner"
            >
              <code>{block.content}</code>
            </pre>
          );
        }

        // Paragraph
        return (
          <p key={idx} className="text-xs sm:text-sm leading-relaxed text-slate-100">
            {renderInlineMarkdown(block.text)}
            {isStreaming && idx === blocks.length - 1 && (
              <span className="inline-block w-2 h-4 ml-1.5 align-middle bg-indigo-400 animate-pulse rounded-sm shadow-[0_0_8px_rgba(129,140,248,0.9)]" />
            )}
          </p>
        );
      })}
    </div>
  );
}
