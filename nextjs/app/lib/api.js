// lib/api.js
import axios from 'axios';
import createAuthRefreshInterceptor from 'axios-auth-refresh';

// প্রধান API ইনস্ট্যান্স
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/',
  withCredentials: true,
});

// রিফ্রেশ লজিক
let isRefreshingFailed = false;
const refreshAuthLogic = async (failedRequest) => {
  try {
    // এখানে ডিফল্ট 'axios' ব্যবহার করুন, 'api' নয়
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/';
    await axios.post(`${apiUrl.replace(/\/$/, '')}/token/refresh/`, {}, { withCredentials: true });
    return Promise.resolve();
  } catch (err) {
    isRefreshingFailed = true;
    console.error("Refresh failed, breaking the loop...");

    // 🔴 সমস্যা এখানে ছিল: api.post('/logout/') ব্যবহার করলে লুপ হবে
    // ✅ সমাধান: সরাসরি axios.post ব্যবহার করুন অথবা সরাসরি রিডাইরেক্ট করুন
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/';
      await axios.post(`${apiUrl.replace(/\/$/, '')}/logout/`, {}, { withCredentials: true });
    } catch (logoutErr) {
      console.log("Logout request failed, but we don't care, just redirecting.");
    }

    if (typeof window !== 'undefined') {
      window.location.replace('/signup'); // .replace ব্যবহার করাই ভালো যাতে ব্যাক করা না যায়
    }
    
    return Promise.reject(err);
  }
};
// Interceptor সেটআপ
createAuthRefreshInterceptor(api, refreshAuthLogic, {
  statusCodes:[401], 
  pauseInstanceWhileRefreshing: true, // রিফ্রেশ চলাকালীন অন্য কলগুলো কিউতে জমা থাকবে
});

export default api;
