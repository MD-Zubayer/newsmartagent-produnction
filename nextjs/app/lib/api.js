// lib/api.js
import axios from 'axios';
import createAuthRefreshInterceptor from 'axios-auth-refresh';

// প্রধান API ইনস্ট্যান্স
const api = axios.create({
  baseURL: 'http://localhost/api/',
  withCredentials: true, // এটি বাধ্যতামূলক যাতে ব্রাউজার কুকি পাঠায়
});

// রিফ্রেশ লজিক
let isRefreshingFailed = false;
const refreshAuthLogic = async (failedRequest) => {
  try {
    // এখানে ডিফল্ট 'axios' ব্যবহার করুন, 'api' নয়
    await axios.post('http://localhost/api/token/refresh/', {}, { withCredentials: true });
    return Promise.resolve();
  } catch (err) {
    isRefreshingFailed = true;
    console.error("Refresh failed, breaking the loop...");

    // 🔴 সমস্যা এখানে ছিল: api.post('/logout/') ব্যবহার করলে লুপ হবে
    // ✅ সমাধান: সরাসরি axios.post ব্যবহার করুন অথবা সরাসরি রিডাইরেক্ট করুন
    try {
      await axios.post('http://localhost/api/logout/', {}, { withCredentials: true });
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
