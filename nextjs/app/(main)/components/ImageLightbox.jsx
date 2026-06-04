'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react';

export default function ImageLightbox({ image, images = [], onClose, onPrevious, onNext }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (image && images.length > 0) {
      const idx = images.findIndex(img => img.id === image.id);
      if (idx >= 0) {
        setCurrentIndex(idx);
      }
    }
  }, [image, images]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      onPrevious?.();
    }
    if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      onNext?.();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images.length]);

  const currentImage = images[currentIndex];

  if (!currentImage) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition z-10"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image Container */}
      <div className="relative w-full h-full flex items-center justify-center">
        <img
          src={currentImage.url}
          alt={currentImage.filename}
          className="max-w-95vw max-h-95vh object-contain"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="14" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3EImage Failed%3C/text%3E%3C/svg%3E';
          }}
        />

        {/* Navigation Arrows (only on desktop) */}
        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                onClick={() => {
                  setCurrentIndex(currentIndex - 1);
                  onPrevious?.();
                }}
                className="absolute left-4 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition hidden md:block"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {currentIndex < images.length - 1 && (
              <button
                onClick={() => {
                  setCurrentIndex(currentIndex + 1);
                  onNext?.();
                }}
                className="absolute right-4 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition hidden md:block"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6">
        <div className="text-white space-y-3">
          {/* Filename and Caption */}
          <div>
            <p className="font-medium text-lg">{currentImage.filename}</p>
            {currentImage.caption && (
              <p className="text-gray-300 text-sm mt-1">{currentImage.caption}</p>
            )}
          </div>

          {/* Counter and Actions */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {currentIndex + 1} / {images.length}
            </p>

            <div className="flex gap-2">
              <a
                href={currentImage.url}
                download={currentImage.filename}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 md:hidden flex gap-2">
          <button
            onClick={() => {
              if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
                onPrevious?.();
              }
            }}
            disabled={currentIndex === 0}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              if (currentIndex < images.length - 1) {
                setCurrentIndex(currentIndex + 1);
                onNext?.();
              }
            }}
            disabled={currentIndex === images.length - 1}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
