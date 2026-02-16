import axios from 'axios';
import createAuthRefreshInterceptor from 'axios-auth-refresh';

// ১. মেইন Axios ইনস্ট্যান্স
const api = axios.create({
    baseURL: 'http://localhost:8000/api', // আপনার ব্যাকএন্ড URL
    withCredentials: true, // এটি ছাড়া HttpOnly কুকি কাজ করবে না
});

// ২. টোকেন রিফ্রেশ করার ফাংশন
const refreshAuthLogic = (failedRequest) => 
    axios.post('http://localhost:8000/api/token/refresh/', {}, { withCredentials: true })
        .then(tokenRefreshResponse => {
            // রিফ্রেশ সফল হলে এটি নিজে থেকেই আগের আটকে যাওয়া রিকোয়েস্টটি পুনরায় পাঠাবে
            return Promise.resolve();
        })
        .catch(err => {
            // যদি রিফ্রেশ টোকেনেরও মেয়াদ শেষ হয়ে যায় (লগআউট)
            // এখানে আপনি ইউজারকে লগইন পেজে পাঠিয়ে দিতে পারেন
            // window.location.href = '/login'; 
            return Promise.reject(err);
        });

// ৩. লাইব্রেরিটি অ্যাপ্লাই করা
createAuthRefreshInterceptor(api, refreshAuthLogic);

export default api;