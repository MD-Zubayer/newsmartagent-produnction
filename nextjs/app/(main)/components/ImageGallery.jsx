'use client';

import React, { useState } from 'react';
import { Star, Trash2, Edit2, Copy, Eye } from 'lucide-react';

export default function ImageGallery({
  images = [],
  onSetPrimary,
  onDelete,
  onReplace,
  onPreview,
  isLoading = false,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyUrl = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-lg">📷 No images yet</p>
        <p className="text-sm mt-1">Upload images to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <div
            key={image.id}
            onMouseEnter={() => setHoveredId(image.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="group rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl transition overflow-hidden"
          >
            {/* Image Container */}
            <div className="relative overflow-hidden aspect-square">
              <img
                src={image.url}
                alt={image.filename}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="14" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3EBroken Image%3C/text%3E%3C/svg%3E';
                }}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition" />

              {image.is_primary && (
                <div className="absolute top-3 left-3 rounded-full bg-amber-500/95 px-3 py-1 text-[11px] font-semibold text-slate-950 shadow-lg shadow-amber-500/20">
                  <Star className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" />
                  Primary
                </div>
              )}

              {(hoveredId === image.id || isLoading) && (
                <div className="absolute inset-0 flex flex-col justify-between p-3 bg-slate-950/60 text-white">
                  <div className="flex justify-end">
                    {image.is_primary && (
                      <div className="rounded-full bg-amber-500/90 px-2 py-1 text-[11px] font-semibold">Primary</div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onPreview(image)}
                      title="Preview"
                      disabled={isLoading}
                      className="rounded-2xl bg-slate-900/95 px-3 py-2 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition"
                    >
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1" /> Preview
                    </button>
                    {!image.is_primary && !image.isFallback && (
                      <button
                        onClick={() => onSetPrimary(image.id)}
                        title="Set as default image"
                        disabled={isLoading}
                        className="rounded-2xl bg-amber-400 px-3 py-2 text-slate-950 text-xs font-semibold hover:bg-amber-300 disabled:opacity-50 transition"
                      >
                        <Star className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1" /> Default
                      </button>
                    )}
                    {!image.isFallback && (
                      <button
                        onClick={() => onReplace(image.id)}
                        title="Edit image"
                        disabled={isLoading}
                        className="rounded-2xl bg-emerald-500 px-3 py-2 text-slate-950 text-xs font-semibold hover:bg-emerald-400 disabled:opacity-50 transition"
                      >
                        <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1" /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(image)}
                      title="Delete"
                      disabled={isLoading}
                      className="rounded-2xl bg-rose-600 px-3 py-2 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 transition"
                    >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 space-y-2 text-slate-900 dark:text-slate-100">
              <p className="truncate font-semibold text-sm">{image.filename || 'Image'}</p>
              {image.caption && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{image.caption}</p>
              )}
              <button
                onClick={() => handleCopyUrl(image.url, image.id)}
                title="Copy URL"
                className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-600 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-100 transition"
              >
                <Copy className="w-3 h-3 sm:w-4 sm:h-4" /> {copiedId === image.id ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Image Count */}
      <div className="text-sm text-slate-600 dark:text-slate-400 border-t pt-4">
        📊 Total: {images.length} image{images.length !== 1 ? 's' : ''}
        {images.filter(img => img.is_primary).length > 0 && (
          <span className="ml-2">| ⭐ 1 Primary</span>
        )}
      </div>
    </div>
  );
}
