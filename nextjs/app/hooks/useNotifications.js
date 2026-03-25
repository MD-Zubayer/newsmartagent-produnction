// app/hooks/useNotifications.js

"use client";
import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";

export const useNotifications = (user, setOrders = null) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  // ১. অডিও রিফারেন্স
  const audioRef = useRef(null);
  const orderAudioRef = useRef(null);
  const handoffAudioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/nextjs_ringe_1.mp3");
    orderAudioRef.current = new Audio("/sounds/nextjs_ringe_2.mp3");
    handoffAudioRef.current = new Audio("/sounds/human_audio_alart.wav");

    // 🔓 Browser Autoplay Unlock
    // Browsers block audio until user interacts with the page.
    // On first interaction, silently play+pause each audio to "unlock" it.
    const unlock = () => {
      [audioRef, orderAudioRef, handoffAudioRef].forEach(ref => {
        if (ref.current) {
          ref.current.volume = 0;
          ref.current.play().then(() => {
            ref.current.pause();
            ref.current.currentTime = 0;
            ref.current.volume = 1;
          }).catch(() => {});
        }
      });
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };

    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);

    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
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

        if (data.action === "NEW_ORDER") {
          if (orderAudioRef.current) {
            orderAudioRef.current.currentTime = 0;
            orderAudioRef.current.play().catch(err => console.log("Audio play blocked:", err));
          }
          if (setOrders) {
            setOrders((prev) => [data.order_data, ...prev]);
          }
          toast.success("নতুন অর্ডার আসছে! 💰", {
            duration: 5000,
            icon: "📦",
            id: `order-${data.order_data.id}`
          });

        } else if (data.action === "HUMAN_HANDOFF") {
          // 🚨 Human Handoff Alert
          if (handoffAudioRef.current) {
            handoffAudioRef.current.currentTime = 0;
            handoffAudioRef.current.play().catch(err => console.log("Handoff audio blocked:", err));
          }
          toast.error(`🚨 Human Help! ${data.contact_name || data.sender_id || 'A user'} needs assistance!`, {
            duration: 10000,
            style: { background: '#dc2626', color: '#fff', fontWeight: 'bold', borderRadius: '16px' },
            icon: '🆘',
            id: `handoff-${data.contact_id}`
          });

        } else if (data.action === "CACHE_UPDATE") {
          console.log("CACHE_UPDATE received, updating state for sync.");
          setNotifications((prev) => [data, ...prev]);

        } else {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => console.log("Audio play blocked:", err));
          }
          setNotifications((prev) => [data, ...prev]);
          setUnreadCount((prev) => prev + 1);
          toast.success(data.message || "নতুন নোটিফিকেশন!", { icon: "🔔" });
        }

      } catch (err) {
        console.error("Socket Data Parse Error:", err);
      }
    };

    socket.onclose = () => console.log("ℹ️ WebSocket Connection Closed.");

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [user, setOrders]);

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

  return { notifications, setNotifications, unreadCount, markAsRead };
};