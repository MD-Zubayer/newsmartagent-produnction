"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.newsmartagent.com/api";

export default function VisitorTracker() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Don't show if already subscribed or dismissed
    if (localStorage.getItem("visitor_subscribed") || localStorage.getItem("visitor_popup_dismissed")) return;

    // Check common keys where email/phone might be stored
    const keys = ["email", "userEmail", "user_email", "phone", "userPhone", "user_phone", "mobile", "contactEmail", "contactPhone"];
    let foundEmail = "";
    let foundPhone = "";

    keys.forEach((k) => {
      const val = localStorage.getItem(k) || "";
      if (!foundEmail && val.includes("@")) foundEmail = val;
      if (!foundPhone && /^\+?[0-9]{7,15}$/.test(val.replace(/\s/g, ""))) foundPhone = val;
    });

    if (foundEmail || foundPhone) {
      setEmail(foundEmail);
      setPhone(foundPhone);
      // Delay popup by 2 seconds to not be jarring
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const getVisitorId = () => {
    // Try to read cookie
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("VISITOR_ID="));
    return cookie ? cookie.trim().split("=")[1] : null;
  };

  const handleSubscribe = async () => {
    setSubmitting(true);
    try {
      const visitorId = getVisitorId();
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
      // Silently fail
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
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        width: "340px",
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        overflow: "hidden",
        animation: "slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header gradient bar */}
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
                <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: 0 }}>
                  🔔 আমাদের সাথে থাকুন!
                </p>
                <p style={{ color: "#6b7280", fontSize: "12px", margin: "4px 0 0" }}>
                  সর্বশেষ অফার ও আপডেট সরাসরি পান।
                </p>
              </div>
              <button
                onClick={handleDismiss}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "18px", padding: "0 0 0 8px" }}
              >
                ✕
              </button>
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
                width: "100%",
                padding: "11px",
                borderRadius: "10px",
                border: "none",
                background: submitting ? "#e5e7eb" : "linear-gradient(135deg, #06b6d4, #3b82f6)",
                color: submitting ? "#9ca3af" : "white",
                fontWeight: 700,
                fontSize: "14px",
                cursor: submitting ? "not-allowed" : "pointer",
                marginTop: "4px",
                transition: "all 0.2s",
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
