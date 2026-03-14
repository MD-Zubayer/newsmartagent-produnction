"use client";

import { createContext, useContext, useState, useEffect } from "react";

const DisplayContext = createContext();

export function DisplayProvider({ children }) {
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dashboard_desktop_mode") === "true";
    setIsDesktopMode(saved);
    setIsMounted(true);
  }, []);

  const toggleDesktopMode = () => {
    const newValue = !isDesktopMode;
    setIsDesktopMode(newValue);
    localStorage.setItem("dashboard_desktop_mode", newValue);
  };

  return (
    <DisplayContext.Provider value={{ isDesktopMode, toggleDesktopMode, isMounted }}>
      {children}
    </DisplayContext.Provider>
  );
}

export function useDisplay() {
  const context = useContext(DisplayContext);
  if (!context) {
    throw new Error("useDisplay must be used within a DisplayProvider");
  }
  return context;
}
