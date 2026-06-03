'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';

export default function ImageUploader({ onUpload, isLoading = false, maxFiles = 10 }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const urlInputRef = useRef(null);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [urlInput, setUrlInput] = useState('');

  const acceptedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFiles = (files) => {
    const errors = [];
    let validCount = 0;

    for (let file of files) {
      // Check file type
      if (!acceptedFormats.includes(file.type)) {
        errors.push(`${file.name}: Invalid format. Accepted: JPEG, PNG, WebP, GIF`);
        continue;
      }

      // Check file size
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      validCount++;
      if (validCount >= maxFiles) break;
    }

    return { validCount, errors };
  };

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;

    const { validCount, errors } = validateFiles(files);

    if (errors.length > 0) {
      setError(errors.join('\n'));
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (validCount === 0) {
      setError('No valid files selected');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Convert FileList to Array and take only valid files
    const validFiles = Array.from(files).slice(0, maxFiles);
    onUpload(validFiles, 'file');
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }

    try {
      new URL(urlInput); // Validate URL format
    } catch {
      setError('Invalid URL format');
      setTimeout(() => setError(null), 3000);
      return;
    }

    onUpload([urlInput.trim()], 'url');
    setUrlInput('');
    setUploadMode('file'); // Reset to file mode
  };

  return (
    <div className="w-full">
      {/* Mode Selector */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => { setUploadMode('file'); setError(null); }}
          className={`px-4 py-2 font-medium transition ${
            uploadMode === 'file'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📁 From Device
        </button>
        <button
          onClick={() => { setUploadMode('url'); setError(null); }}
          className={`px-4 py-2 font-medium transition ${
            uploadMode === 'url'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          🔗 From URL
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 whitespace-pre-line">{error}</div>
        </div>
      )}

      {/* File Upload Mode */}
      {uploadMode === 'file' && (
        <div className="space-y-4">
          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-700 font-medium">
              Drag and drop images here
            </p>
            <p className="text-gray-500 text-sm mt-1">
              or click to browse
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Supported: JPEG, PNG, WebP, GIF (max 10MB each, up to {maxFiles} files)
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileSelect(e.target.files)}
              disabled={isLoading}
              className="hidden"
              onClick={(e) => e.stopPropagation()}
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? '⏳ Uploading...' : 'Browse Files'}
            </button>
          </div>

          {/* Click zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="hidden"
          />
        </div>
      )}

      {/* URL Upload Mode */}
      {uploadMode === 'url' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              ref={urlInputRef}
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/image.jpg"
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleUrlSubmit();
                }
              }}
            />
            <button
              onClick={handleUrlSubmit}
              disabled={isLoading || !urlInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? '⏳' : '➕'}
            </button>
          </div>
          <p className="text-gray-500 text-sm">
            Paste an image URL and click to add it to the gallery
          </p>
        </div>
      )}
    </div>
  );
}
