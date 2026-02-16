import axios from "axios";

const axiosInstance = axios.create({
    baseURL: "http://127.0.0.1:8000/api/",
    withCredentials: true, // এটি কুকি আদান-প্রদানের জন্য সবচেয়ে গুরুত্বপূর্ণ
    headers: {
        "Content-Type": "application/json",
    },
});

// রিকোয়েস্ট ইন্টারসেপ্টর: এখন আর localStorage থেকে টোকেন লাগবে না।
// ব্রাউজার অটোমেটিক কুকি পাঠিয়ে দেবে।
axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// রেসপন্স ইন্টারসেপ্টর: টোকেন এক্সপায়ার হলে রিফ্রেশ করা
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // যদি ৪০১ (Unauthorized) এরর আসে এবং এটি রিফ্রেশ করার চেষ্টা না হয়ে থাকে
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // রিফ্রেশ এন্ডপয়েন্টে রিকোয়েস্ট পাঠান। 
        // ব্যাকএন্ড রিফ্রেশ টোকেনটি কুকি থেকে নিয়ে নতুন অ্যাক্সেস টোকেন কুকিতে সেট করে দেবে।
        await axios.post(
          "http://127.0.0.1:8000/api/token/refresh/", 
          {}, // বডি খালি থাকলেও সমস্যা নেই যদি কুকি থেকে রিফ্রেশ টোকেন নেওয়া হয়
          { withCredentials: true }
        );

        // নতুন টোকেন এখন কুকিতে আছে, তাই আগের রিকোয়েস্টটি আবার পাঠান
        return axiosInstance(originalRequest);
      } catch (err) {
        // রিফ্রেশ টোকেনও কাজ না করলে লগআউট করিয়ে দিন
        if (typeof window !== "undefined") {
            window.location.href = "/";
        }
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;