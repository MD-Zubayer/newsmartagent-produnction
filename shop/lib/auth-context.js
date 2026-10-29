"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchStorefront } from './api';

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleReady, setIsGoogleReady] = useState(false);

  // Fetch current customer profile from cookie
  const refreshCustomer = useCallback(async () => {
    try {
      const data = await fetchStorefront('/auth/me/');
      setCustomer(data.customer);
      setStats(data.stats);
    } catch (err) {
      setCustomer(null);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCustomer();
  }, [refreshCustomer]);

  // Google Login Handler
  const loginWithGoogleToken = async (idToken, sessionCode = null) => {
    try {
      const res = await fetchStorefront('/auth/google/', {
        method: 'POST',
        body: JSON.stringify({
          id_token: idToken,
          session_code: sessionCode
        })
      });
      if (res.customer) {
        setCustomer(res.customer);
        await refreshCustomer();
        return res.customer;
      }
      return null;
    } catch (err) {
      console.error('Google login failed:', err);
      throw err;
    }
  };

  // Instant One-Click AI Session Login
  const loginWithInstantToken = async (sessionCode) => {
    try {
      const res = await fetchStorefront('/auth/instant/', {
        method: 'POST',
        body: JSON.stringify({ session_code: sessionCode })
      });
      if (res.customer) {
        setCustomer(res.customer);
        await refreshCustomer();
        return res.customer;
      }
      return null;
    } catch (err) {
      console.error('Instant session login failed:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fetchStorefront('/auth/logout/', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setCustomer(null);
      setStats(null);
      window.location.href = '/login';
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        stats,
        isLoading,
        refreshCustomer,
        loginWithGoogleToken,
        loginWithInstantToken,
        logout,
        isAuthenticated: !!customer,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerAuthProvider');
  }
  return context;
}
