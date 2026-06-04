'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Loader } from 'lucide-react';
import ImageUploader from './ImageUploader';
import ImageGallery from './ImageGallery';
import ImageLightbox from './ImageLightbox';
import api from '@/lib/api';

export default function ImageManagementModal({
  sheetId,
  rowIndex,
  fallbackRowImageUrl,
  isOpen,
  onClose,
  onPrimaryImageChanged,
}) {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [replaceImageId, setReplaceImageId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const replaceFileInputRef = useRef(null);

  // Fetch images on modal open
  useEffect(() => {
    if (isOpen && sheetId && rowIndex !== undefined) {
      fetchImages();
    }
  }, [isOpen, sheetId, rowIndex, fallbackRowImageUrl]);

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get(
        `/datasheet/spreadsheets/${sheetId}/rows/${rowIndex}/images/`
      );

      const fetchedImages = response.data.images || [];
      const mergedImages = [...fetchedImages];
      if (fallbackRowImageUrl) {
        const hasFallback = fetchedImages.some(img => img.url === fallbackRowImageUrl);
        if (!hasFallback) {
          mergedImages.push({
            id: `fallback-${rowIndex}`,
            url: fallbackRowImageUrl,
            filename: 'Row image',
            caption: '',
            is_primary: false,
            position: 0,
            source: 'cell',
            isFallback: true,
          });
        }
      }
      setImages(mergedImages);
    } catch (err) {
      console.error('Failed to fetch images:', err);
      setError('Failed to load images');
    } finally {
      setIsLoading(false);
    }
  };

  const notifyPrimaryImage = (fetchedImages, uploadedImages) => {
    if (!onPrimaryImageChanged) return;

    const primaryImage = fetchedImages.find((img) => img.is_primary) || uploadedImages?.[0] || fetchedImages[0] || null;
    if (primaryImage) {
      onPrimaryImageChanged(primaryImage);
    }
  };

  const handleUpload = async (files, type) => {
    try {
      setIsLoading(true);
      setError(null);
      setUploadProgress(0);

      const formData = new FormData();

      if (type === 'file') {
        files.forEach((file) => {
          formData.append('files', file);
        });
      } else {
        formData.append('urls', files[0]);
      }

      const response = await api.post(
        `/datasheet/spreadsheets/${sheetId}/rows/${rowIndex}/images/`,
        formData,
        {
          onUploadProgress: type === 'file'
            ? (progressEvent) => {
                const percentCompleted = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                );
                setUploadProgress(percentCompleted);
              }
            : undefined,
        }
      );

      // Refresh image list
      const getResponse = await api.get(
        `/datasheet/spreadsheets/${sheetId}/rows/${rowIndex}/images/`
      );
      const uploadedImages = response.data.uploaded || [];
      const fetchedImages = getResponse.data.images || [];
      const mergedImages = [...fetchedImages];
      if (fallbackRowImageUrl) {
        const hasFallback = fetchedImages.some(img => img.url === fallbackRowImageUrl);
        if (!hasFallback) {
          mergedImages.push({
            id: `fallback-${rowIndex}`,
            url: fallbackRowImageUrl,
            filename: 'Row image',
            caption: '',
            is_primary: false,
            position: 0,
            source: 'cell',
            isFallback: true,
          });
        }
      }
      setImages(mergedImages);

      notifyPrimaryImage(fetchedImages, uploadedImages);
      setUploadProgress(null);

      // Show success toast
      console.log('✅ Image uploaded successfully');
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.error || 'Upload failed');
      setUploadProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (image) => {
    setConfirmAction({
      type: 'delete',
      title: 'Delete image?',
      subtitle: `This image will be removed from row ${rowIndex}.`,
      image,
    });
  };

  const executeDelete = async () => {
    if (!confirmAction?.image) return;
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const image = confirmAction.image;
      const isFallback = image?.isFallback;
      const deletedUrl = image?.url;

      if (isFallback) {
        await api.delete(`/datasheet/spreadsheets/${sheetId}/row-image/`, {
          data: { row_index: rowIndex },
        });
      } else {
        await api.delete(
          `/datasheet/spreadsheets/${sheetId}/row/images/${image.id}/`
        );
      }

      const response = await api.get(
        `/datasheet/spreadsheets/${sheetId}/rows/${rowIndex}/images/`
      );
      const fetchedImages = response.data.images || [];
      const mergedImages = [...fetchedImages];
      if (fallbackRowImageUrl && !isFallback) {
        const hasFallback = fetchedImages.some(img => img.url === fallbackRowImageUrl);
        if (!hasFallback) {
          mergedImages.push({
            id: `fallback-${rowIndex}`,
            url: fallbackRowImageUrl,
            filename: 'Row image',
            caption: '',
            is_primary: false,
            position: 0,
            source: 'cell',
            isFallback: true,
          });
        }
      }
      setImages(mergedImages);
      setStatusMessage('Image removed successfully.');

      if (previewImage?.id === image.id) {
        setPreviewImage(null);
      }

      if (onPrimaryImageChanged) {
        const primaryImage = fetchedImages.find((img) => img.is_primary) || null;
        const shouldClearRowUrl = isFallback || deletedUrl === fallbackRowImageUrl;
        if (shouldClearRowUrl || !primaryImage) {
          onPrimaryImageChanged(primaryImage);
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Failed to delete the image. Please try again.');
    } finally {
      setIsLoading(false);
      setConfirmAction(null);
    }
  };

  const cancelConfirm = () => {
    setConfirmAction(null);
  };

  const handleSetPrimary = async (imageId) => {
    try {
      setIsLoading(true);
      await api.post(
        `/datasheet/spreadsheets/${sheetId}/row/images/${imageId}/set-primary/`
      );

      // Refresh image list
      const response = await api.get(
        `/datasheet/spreadsheets/${sheetId}/rows/${rowIndex}/images/`
      );
      const fetchedImages = response.data.images || [];
      const mergedImages = [...fetchedImages];
      if (fallbackRowImageUrl) {
        const hasFallback = fetchedImages.some(img => img.url === fallbackRowImageUrl);
        if (!hasFallback) {
          mergedImages.push({
            id: `fallback-${rowIndex}`,
            url: fallbackRowImageUrl,
            filename: 'Row image',
            caption: '',
            is_primary: false,
            position: 0,
            source: 'cell',
            isFallback: true,
          });
        }
      }
      setImages(mergedImages);

      notifyPrimaryImage(fetchedImages, []);
    } catch (err) {
      console.error('Failed to set primary:', err);
      setError('Failed to set as primary image');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplace = async (imageId) => {
    setReplaceImageId(imageId);
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !replaceImageId) return;

    try {
      setIsLoading(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', file);

      await api.patch(
        `/datasheet/spreadsheets/${sheetId}/row/images/${replaceImageId}/`,
        formData
      );

      const response = await api.get(
        `/datasheet/spreadsheets/${sheetId}/rows/${rowIndex}/images/`
      );
      const fetchedImages = response.data.images || [];
      const mergedImages = [...fetchedImages];
      if (fallbackRowImageUrl) {
        const hasFallback = fetchedImages.some(img => img.url === fallbackRowImageUrl);
        if (!hasFallback) {
          mergedImages.push({
            id: `fallback-${rowIndex}`,
            url: fallbackRowImageUrl,
            filename: 'Row image',
            caption: '',
            is_primary: false,
            position: 0,
            source: 'cell',
            isFallback: true,
          });
        }
      }
      setImages(mergedImages);

      const primaryImage = fetchedImages.find((img) => img.is_primary) || null;
      if (primaryImage && onPrimaryImageChanged) {
        onPrimaryImageChanged(primaryImage);
      }
    } catch (err) {
      console.error('Replace failed:', err);
      setError('Failed to replace image');
    } finally {
      setIsLoading(false);
      setReplaceImageId(null);
      event.target.value = null;
    }
  };

  const handlePreview = (image) => {
    setPreviewImage(image);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:flex items-center justify-center hidden"
        onClick={onClose}
      />

      {/* Modal Container - Desktop/Tablet */}
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-col gap-3 p-6 border-b bg-slate-50 dark:bg-slate-950/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Image Gallery</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Upload, manage, and choose the thumbnail image for this row.</p>
              </div>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-semibold dark:bg-indigo-950 dark:text-indigo-200">Row {rowIndex}</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-semibold dark:bg-slate-900 dark:text-slate-300">{images.length} image{images.length !== 1 ? 's' : ''}</span>
              {statusMessage && (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold dark:bg-emerald-950/80 dark:text-emerald-200">{statusMessage}</span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-3xl flex gap-3 items-start text-slate-700 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-100">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-sm">{error}</div>
              </div>
            )}

            {/* Upload Progress */}
            {uploadProgress !== null && (
              <div className="p-4 bg-slate-900/95 border border-slate-800 rounded-3xl text-slate-100">
                <div className="flex items-center gap-3">
                  <Loader className="w-5 h-5 text-cyan-300 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Uploading...</p>
                    <div className="w-full bg-slate-700 rounded-full h-2 mt-2 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Image Uploader */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-medium mb-4">Upload Images</h3>
              <ImageUploader
                onUpload={handleUpload}
                isLoading={isLoading}
                maxFiles={10}
              />
              <input
                ref={replaceFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReplaceFileChange}
              />
            </div>

            {/* Image Gallery */}
            {(isLoading && images.length === 0) ? (
              <div className="text-center py-12">
                <Loader className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600">Loading images...</p>
              </div>
            ) : (
              <div>
                <h3 className="font-medium mb-4">Your Images</h3>
                <ImageGallery
                  images={images}
                  onSetPrimary={handleSetPrimary}
                  onDelete={handleDelete}
                  onReplace={handleReplace}
                  onPreview={handlePreview}
                  isLoading={isLoading}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Full-Screen Modal */}
      <div className="md:hidden fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white dark:bg-slate-950">
          <div>
            <h2 className="text-lg font-semibold">🖼️ Images</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Row {rowIndex} · {images.length} image{images.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-red-700">{error}</div>
            </div>
          )}

          {/* Upload Progress */}
          {uploadProgress !== null && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 text-blue-600 animate-spin" />
                <p className="text-xs font-medium text-blue-900 flex-1">Uploading...</p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Image Uploader */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <h3 className="font-medium text-sm mb-3">Upload</h3>
            <ImageUploader
              onUpload={handleUpload}
              isLoading={isLoading}
              maxFiles={10}
            />
          </div>

          {/* Image Gallery */}
          {(isLoading && images.length === 0) ? (
            <div className="text-center py-8">
              <Loader className="w-6 h-6 animate-spin mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Loading...</p>
            </div>
          ) : (
            <div>
              <h3 className="font-medium text-sm mb-3">Gallery</h3>
              <ImageGallery
                images={images}
                onSetPrimary={handleSetPrimary}
                onDelete={handleDelete}
                onReplace={handleReplace}
                onPreview={handlePreview}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-rose-50 dark:bg-rose-950/80">
              <h3 className="text-lg font-semibold text-rose-700 dark:text-rose-100">{confirmAction.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{confirmAction.subtitle}</p>
            </div>
            <div className="px-6 py-5">
              <div className="rounded-3xl bg-slate-100 dark:bg-slate-950 p-4 flex items-center gap-4">
                <img src={confirmAction.image.url} alt="Preview" className="w-20 h-20 rounded-3xl object-cover border border-slate-200 dark:border-slate-800" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{confirmAction.image.filename || 'Image'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{confirmAction.image.url}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={cancelConfirm} className="flex-1 rounded-2xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-700 transition py-3 font-semibold">Cancel</button>
              <button onClick={executeDelete} className="flex-1 rounded-2xl bg-rose-600 text-white hover:bg-rose-700 transition py-3 font-semibold">Delete Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview */}
      {previewImage && (
        <ImageLightbox
          image={previewImage}
          images={images}
          onClose={() => setPreviewImage(null)}
          onPrevious={() => {
            const currentIdx = images.findIndex(img => img.id === previewImage.id);
            if (currentIdx > 0) {
              setPreviewImage(images[currentIdx - 1]);
            }
          }}
          onNext={() => {
            const currentIdx = images.findIndex(img => img.id === previewImage.id);
            if (currentIdx < images.length - 1) {
              setPreviewImage(images[currentIdx + 1]);
            }
          }}
        />
      )}
    </>
  );
}
