"use client";

import { useState } from "react";
import api from "@/lib/api";

export default function TestDocumentAPI() {
  const [docTitle, setDocTitle] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await api.post("/embedding/document/", {
        doc_title: docTitle || "Test Document",
        text: text,
      });

      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to upload document");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Test Document Knowledge API</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Title
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g. Return Policy"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Text (Content)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your long text here..."
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              required
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading || !text}
            className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors
              ${loading || !text ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? "Processing and Chunking..." : "Upload Document"}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-50 text-green-700 border border-green-200 rounded-md">
            <strong>Success!</strong>
            <p className="mt-1">{result.message}</p>
            <p className="text-sm mt-2 opacity-80">
              Generated {result.chunks_saved} vector chunks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
