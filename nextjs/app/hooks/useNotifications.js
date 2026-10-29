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
          }).catch(() => { });
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
          const notifMsg = data.message || `নতুন অর্ডার #${data.order_data?.id}`;
          setNotifications((prev) => [
            {
              id: `live-order-${data.order_data?.id || Date.now()}`,
              message: notifMsg,
              type: "order_created",
              is_read: false,
              created_at: new Date().toISOString()
            },
            ...prev
          ]);
          setUnreadCount((prev) => prev + 1);
          toast.success(notifMsg, {
            duration: 6000,
            id: `order-${data.order_data?.id}`
          });

        } else if (data.action === "ORDER_CANCELLED") {
          if (setOrders) {
            setOrders((prev) => prev.map(o => o.id === data.order_data?.id ? { ...o, status: 'cancelled' } : o));
          }
          const cancelMsg = data.message || `অর্ডার #${data.order_data?.id} বাতিল হয়েছে`;
          setNotifications((prev) => [
            {
              id: `live-cancel-${data.order_data?.id || Date.now()}`,
              message: cancelMsg,
              type: "order_cancelled",
              is_read: false,
              created_at: new Date().toISOString()
            },
            ...prev
          ]);
          setUnreadCount((prev) => prev + 1);
          toast.error(cancelMsg, {
            duration: 6000,
            id: `cancel-${data.order_data?.id}`
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

        } else if (data.type === "courier_status_update" || data.action === "COURIER_STATUS_UPDATE") {
          if (setOrders && data.order_id) {
            setOrders((prev) =>
              prev.map((o) => {
                if (o.id !== data.order_id) return o;
                const removed =
                  data.courier_status === "cancelled" ||
                  data.event_name === "unknown" ||
                  data.event_name === "cancelled" ||
                  data.event_name === "manual.booking_reset";
                const newEvent = {
                  event_name: data.event_name || "courier_update",
                  status_label: data.status_label || "কুরিয়ার স্ট্যাটাস আপডেট",
                  reason: data.reason || "",
                  created_at: new Date().toISOString(),
                };
                return {
                  ...o,
                  status: data.order_status || o.status,
                  courier_booking_info: o.courier_booking_info
                    ? {
                        ...o.courier_booking_info,
                        is_booked: !removed,
                        booking_status: data.courier_status || (removed ? "cancelled" : o.courier_booking_info.booking_status),
                        latest_status_label: data.status_label || o.courier_booking_info.latest_status_label,
                        latest_reason: data.reason !== undefined ? data.reason : o.courier_booking_info.latest_reason,
                        events: [newEvent, ...(o.courier_booking_info.events || [])],
                      }
                    : o.courier_booking_info,
                };
              })
            );
          }
          toast.success(`অর্ডার #${data.order_id}: ${data.status_label || "কুরিয়ার স্ট্যাটাস আপডেট"}`, {
            icon: "🚚",
            duration: 5000,
            id: `courier-ws-${data.order_id}-${data.event_name || Date.now()}`,
          });

        } else if (data.action === "CACHE_UPDATE") {
          console.log("CACHE_UPDATE received, updating state for sync.");
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => console.log("Audio play blocked:", err));
          }
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