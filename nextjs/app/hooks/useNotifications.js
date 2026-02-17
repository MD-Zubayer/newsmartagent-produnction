"use client";
import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";

export const useNotifications = (user) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);
  
  // ১. অডিও রিফারেন্স তৈরি (যাতে বারবার লোড না হয়)
  const audioRef = useRef(null);

  useEffect(() => {
    // ব্রাউজারে অডিও অবজেক্ট ইনিশিয়ালাইজ করা
    // আপনার public ফোল্ডারে notification.mp3 নামে একটি ফাইল রাখুন
    audioRef.current = new Audio("/sounds/nextjs_ringe_1.mp3");
  }, []);

  // ২. পুরানো নোটিফিকেশন ফেচ করা
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get("notifications/"); 
        setNotifications(res.data);
        setUnreadCount(res.data.filter((n) => !n.is_read).length);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };
    if (user) fetchNotifications();
  }, [user]);

  // ৩. লাইভ WebSocket কানেকশন
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/ws/notifications/`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("✅ WebSocket Connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // --- সাউন্ড প্লে করার লজিক ---
        if (audioRef.current) {
          audioRef.current.play().catch(err => console.log("Audio play blocked:", err));
        }

        setNotifications((prev) => [data, ...prev]);
        setUnreadCount((prev) => prev + 1);
        
        toast.success(data.message || "নতুন নোটিফিকেশন!", { 
          icon: "🔔",
          position: "top-right" 
        });
      } catch (err) {
        console.error("Socket Data Parse Error:", err);
      }
    };

    socket.onclose = () => console.log("ℹ️ WebSocket Connection Closed.");

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await api.post(`notifications/${id}/read/`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  return { notifications, unreadCount, markAsRead };
};