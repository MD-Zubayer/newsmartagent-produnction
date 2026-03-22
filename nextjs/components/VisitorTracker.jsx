"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.newsmartagent.com/api";
const VISITOR_KEY = "visitor_uuid";

function getStoredUUID() {
  try { return localStorage.getItem(VISITOR_KEY) || ""; } catch { return ""; }
}
function setStoredUUID(id) {
  try { localStorage.setItem(VISITOR_KEY, id); } catch {}
}

/** Scan ALL localStorage + sessionStorage keys for email / phone patterns */
function detectFromBrowserStorage() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?[0-9\s\-]{7,15}$/;

  let foundEmail = "";
  let foundPhone = "";

  const storages = [localStorage, sessionStorage];

  for (const storage of storages) {
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;

        // Skip our own internal keys
        if (key === VISITOR_KEY || key === "visitor_subscribed" || key === "visitor_popup_dismissed") continue;

        try {
          let raw = storage.getItem(key) || "";

          // If the value looks like JSON, try to extract email/phone from it
          if (raw.startsWith("{") || raw.startsWith("[")) {
            try {
              const parsed = JSON.parse(raw);
              const jsonStr = JSON.stringify(parsed);
              // Pull all email-like strings from JSON blob
              const emails = jsonStr.match(/[^\s@"',]+@[^\s@"',]+\.[^\s@"',]+/g) || [];
              const phones = jsonStr.match(/\+?[0-9]{7,15}/g) || [];
              if (!foundEmail && emails.length) foundEmail = emails[0];
              if (!foundPhone && phones.length) foundPhone = phones[0];
            } catch {}
          }

          // Also test the raw value directly
          const trimmed = raw.trim().replace(/"/g, "");
          if (!foundEmail && emailRegex.test(trimmed)) foundEmail = trimmed;
          if (!foundPhone && phoneRegex.test(trimmed)) foundPhone = trimmed;
        } catch {}
      }
    } catch {}

    if (foundEmail && foundPhone) break;
  }

  return { foundEmail, foundPhone };
}

export default function VisitorTracker() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // ── STEP 1: Always fire a track call on every page load ──
    const trackVisit = async () => {
      try {
        const existingUUID = getStoredUUID();
        const res = await fetch(`${BACKEND_URL}/AgentAI/visitor/track/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitor_uuid: existingUUID || null }),
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.visitor_uuid) setStoredUUID(data.visitor_uuid);
        }
      } catch {}
    };
    trackVisit();

    // ── STEP 2: Check if we should show the subscribe popup ──
    if (
      localStorage.getItem("visitor_subscribed") ||
      localStorage.getItem("visitor_popup_dismissed")
    ) return;

    // Scan ALL browser storage for any email or phone
    const { foundEmail, foundPhone } = detectFromBrowserStorage();

    if (foundEmail || foundPhone) {
      setEmail(foundEmail);
      setPhone(foundPhone);
      const timer = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubscribe = async () => {
    setSubmitting(true);
    try {
      const visitorId = getStoredUUID();
      await fetch(`${BACKEND_URL}/AgentAI/visitor/subscribe/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_uuid: visitorId, email, phone }),
        credentials: "include",
      });
      localStorage.setItem("visitor_subscribed", "1");
      setDone(true);
      setTimeout(() => setShow(false), 2500);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("visitor_popup_dismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
      width: "340px", background: "white", borderRadius: "16px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden",
      animation: "slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      fontFamily: "Inter, sans-serif",
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ height: "5px", background: "linear-gradient(90deg, #06b6d4, #3b82f6)" }} />

      <div style={{ padding: "20px" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>🎉</div>
            <p style={{ fontWeight: 700, color: "#111", fontSize: "16px" }}>আপনাকে ধন্যবাদ!</p>
            <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>আপনার তথ্য সেভ হয়েছে।</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: 0 }}>🔔 আমাদের সাথে থাকুন!</p>
                <p style={{ color: "#6b7280", fontSize: "12px", margin: "4px 0 0" }}>আপনার ব্রাউজারে যে তথ্য পাওয়া গেছে:</p>
              </div>
              <button onClick={handleDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "18px", padding: "0 0 0 8px" }}>✕</button>
            </div>

            {email && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f0f9ff", borderRadius: "8px", padding: "8px 12px", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px" }}>✉️</span>
                <span style={{ fontSize: "13px", color: "#0369a1", fontWeight: 600 }}>{email}</span>
              </div>
            )}
            {phone && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f0fdf4", borderRadius: "8px", padding: "8px 12px", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px" }}>📱</span>
                <span style={{ fontSize: "13px", color: "#15803d", fontWeight: 600 }}>{phone}</span>
              </div>
            )}

            <button
              onClick={handleSubscribe}
              disabled={submitting}
              style={{
                width: "100%", padding: "11px", borderRadius: "10px", border: "none",
                background: submitting ? "#e5e7eb" : "linear-gradient(135deg, #06b6d4, #3b82f6)",
                color: submitting ? "#9ca3af" : "white",
                fontWeight: 700, fontSize: "14px",
                cursor: submitting ? "not-allowed" : "pointer",
                marginTop: "4px", transition: "all 0.2s",
              }}
            >
              {submitting ? "সেভ হচ্ছে..." : "✅ সাবস্ক্রাইব করুন"}
            </button>
            <p style={{ textAlign: "center", fontSize: "10px", color: "#d1d5db", marginTop: "8px" }}>
              আপনার তথ্য সম্পূর্ণ নিরাপদ থাকবে।
            </p>
          </>
        )}
      </div>
    </div>
  );
}
