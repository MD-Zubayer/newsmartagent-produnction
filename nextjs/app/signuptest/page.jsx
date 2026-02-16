'use client';

import api from '.././lib/api'; 
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // API কল শুরু
    api.get('/offers/')
      .then(response => {
        // মনে রাখবেন: /offers/ সাধারণত একটি লিস্ট বা অবজেক্ট দেয়
        // কনসোলে চেক করে নিন ডাটা কি ফরম্যাটে আসছে
        console.log("Offers Data:", response.data);
        setData(response.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("ডাটা পাওয়া যায়নি", err);
        setError("সার্ভার থেকে ডাটা আনতে সমস্যা হয়েছে।");
        setLoading(false);
      });
  }, []);

  // ১. লোডিং অবস্থা
  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <p className="text-xl font-semibold animate-pulse">লোড হচ্ছে...</p>
    </div>
  );

  // ২. এরর অবস্থা
  if (error) return (
    <div className="text-red-500 p-5 text-center">
      {error}
    </div>
  );

  // ৩. ডাটা দেখানোর অংশ
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">অফার লিস্ট</h1>
      
      {/* যদি ডাটা একটি Array হয় তবে ম্যাপ করে দেখান */}
      {Array.isArray(data) ? (
        <ul className="space-y-2">
          {data.map((offer, index) => (
            <li key={index} className="p-4 border rounded shadow-sm bg-white">
              {offer.word ||  "অফারের নাম নেই"} 
            </li>
          ))}
        </ul>
      ) : (
        <pre className="bg-gray-100 p-4 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}