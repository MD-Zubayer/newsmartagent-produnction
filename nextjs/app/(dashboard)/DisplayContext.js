"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const DisplayContext = createContext();

export const DEFAULT_SIDEBAR_WIDTH = 215;
export const MIN_SIDEBAR_WIDTH = 170;
export const MAX_SIDEBAR_WIDTH = 380;

export function DisplayProvider({ children }) {
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [sidebarWidth, setSidebarWidthState] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const savedDesktop = localStorage.getItem("dashboard_desktop_mode") === "true";
    setIsDesktopMode(savedDesktop);

    const savedWidth = parseInt(localStorage.getItem("dashboard_sidebar_width"), 10);
    if (
      savedWidth &&
      !isNaN(savedWidth) &&
      savedWidth >= MIN_SIDEBAR_WIDTH &&
      savedWidth <= MAX_SIDEBAR_WIDTH
    ) {
      setSidebarWidthState(savedWidth);
    }
    setIsMounted(true);
  }, []);

  const setSidebarWidth = useCallback((width) => {
    const clamped = Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
    setSidebarWidthState(clamped);
    try {
      localStorage.setItem("dashboard_sidebar_width", clamped.toString());
    } catch (e) {}
  }, []);

  const resetSidebarWidth = useCallback(() => {
    setSidebarWidthState(DEFAULT_SIDEBAR_WIDTH);
    try {
      localStorage.setItem("dashboard_sidebar_width", DEFAULT_SIDEBAR_WIDTH.toString());
    } catch (e) {}
  }, []);

  const toggleDesktopMode = () => {
    const newValue = !isDesktopMode;
    setIsDesktopMode(newValue);
    localStorage.setItem("dashboard_desktop_mode", newValue);
    if (newValue) setIsSidebarOpen(false); // Close mobile drawer if switching to desktop mode
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <DisplayContext.Provider value={{ 
      isDesktopMode, 
      toggleDesktopMode, 
      isSidebarOpen, 
      toggleSidebar, 
      closeSidebar,
      isMounted,
      sidebarWidth,
      setSidebarWidth,
      resetSidebarWidth,
      isResizing,
      setIsResizing,
      DEFAULT_SIDEBAR_WIDTH,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH
    }}>
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
