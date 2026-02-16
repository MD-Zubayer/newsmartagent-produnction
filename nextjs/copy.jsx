"use client";

import { useState, useEffect } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useRouter } from "next/navigation";
import axiosInstance from "@/lib/axios"; // আপনার তৈরি করা axiosInstance ব্যবহার করা ভালো

export default function AuthPage() {
  const router = useRouter();
  const [showSignUp, setShowSignUp] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const createdByOptions = [
    { label: "Self", value: "self" },
    { label: "Agent", value: "agent" },
  ];

  const idTypeOptions = [
    { label: "Agent", value: "agent" },
    { label: "User", value: "user" },
  ];

  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    email: "",
    division: "",
    district: "",
    upazila: "",
    created_by: "",
    id_type: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    // HttpOnly Cookie থাকলে জাভাস্ক্রিপ্ট দিয়ে টোকেন চেক করা যায় না।
    // তবে আপনি যদি ডাটাবেস থেকে ইউজার ডাটা ফেচ করতে পারেন, তবেই বুঝবেন সে লগইন আছে কি না।
    const checkUserStatus = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/token/verify/", {
          method: "POST",
          credentials: "include", // কুকি পাঠানোর জন্য
        });
        if (res.ok) router.push("/dashboard");
      } catch (err) {
        console.log("Not authenticated");
      }
    };
    checkUserStatus();
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "password" || name === "confirmPassword") {
        setPasswordError(
          updated.password !== updated.confirmPassword
            ? "Passwords do not match!"
            : ""
        );
      }
      return updated;
    });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const email = e.target[0].value;
    const password = e.target[1].value;

    const res = await fetch("http://127.0.0.1:8000/api/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // HttpOnly Cookie সেভ করার জন্য এটি বাধ্যতামূলক
      body: JSON.stringify({ email: email, password }), // username এর বদলে email পাঠানো হচ্ছে
    });

    if (res.ok) {
      // HttpOnly Cookie ব্যবহারের সময় আলাদা করে localStorage এ সেভ করার প্রয়োজন নেই
      router.push("/dashboard");
    } else {
      alert("Invalid credentials!");
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    if (passwordError) return;

    const res = await fetch("http://127.0.0.1:8000/api/users/create_user/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...formData,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert("Signup failed: " + JSON.stringify(data));
      return;
    }

    alert("Account created successfully!");
    setShowSignUp(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border">
        {!showSignUp && (
          <>
            <h2 className="text-2xl font-bold text-center mb-6">Log In</h2>

            <form className="flex flex-col gap-4" onSubmit={handleLoginSubmit}>
              <input type="email" placeholder="Email" required className="input" />
              <input type="password" placeholder="Password" required className="input" />

              <button className="btn-primary mt-4">Continue</button>
            </form>

            <div className="flex justify-between mt-4 text-sm text-blue-600">
              <span 
                className="hover:underline cursor-pointer"
                onClick={() => router.push("/forgot-password")}
              >
                Forgot Password?
              </span>

              <span 
                className="hover:underline cursor-pointer"
                onClick={() => setShowSignUp(true)}
              >
                Create account
              </span>
            </div>
          </>
        )}

        {showSignUp && (
          <>
            <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>

            <form className="flex flex-col gap-3" onSubmit={handleSignUpSubmit}>
              <input name="name" placeholder="Full Name" onChange={handleChange} className="input" required />
              <input name="phone_number" placeholder="Phone Number" onChange={handleChange} className="input" required />
              <input name="email" type="email" placeholder="Email" onChange={handleChange} className="input" required />

              <div className="grid grid-cols-3 gap-2">
                <input name="division" placeholder="Division" onChange={handleChange} className="input" />
                <input name="district" placeholder="District" onChange={handleChange} className="input" />
                <input name="upazila" placeholder="Upazila" onChange={handleChange} className="input" />
              </div>

              <select name="created_by" onChange={handleChange} className="input" required>
                <option value="">Created By</option>
                {createdByOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <select name="id_type" onChange={handleChange} className="input" required>
                <option value="">ID Type</option>
                {idTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  onChange={handleChange}
                  className="input pr-10"
                  required
                />
                <span className="absolute right-3 top-3 cursor-pointer text-gray-500" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  onChange={handleChange}
                  className="input pr-10"
                  required
                />
                <span className="absolute right-3 top-3 cursor-pointer text-gray-500" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>

              {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}

              <button className="btn-primary mt-3">Create Account</button>

              <p className="text-center mt-2 text-sm cursor-pointer underline" onClick={() => setShowSignUp(false)}>
                Back to Login
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}