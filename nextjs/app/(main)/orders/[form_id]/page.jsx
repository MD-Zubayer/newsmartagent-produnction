"use client";
import { useState, use, useEffect } from "react";
import {
  ShoppingCart,
  CheckCircle,
  User,
  Phone,
  MapPin,
  Package,
  MessageSquare,
  Navigation,
  Loader2, // লোডিং আইকনের জন্য
  MessageCircle,
  X,
  Send
} from "lucide-react";
import toast from "react-hot-toast";

export default function PublicOrderForm({ params }) {
  // params আনর‍্যাপ করা
  const resolvedParams = use(params);
  const form_id = resolvedParams.form_id;

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shopProfile, setShopProfile] = useState(null);

  // Fetch shop profile details
  useEffect(() => {
    if (!form_id) return;
    const fetchShopProfile = async () => {
      try {
        const res = await fetch(`https://newsmartagent.com/api/orders/public-profile/${form_id}/`);
        if (res.ok) {
          const data = await res.json();
          setShopProfile(data);
        }
      } catch (error) {
        console.error("Error fetching shop profile:", error);
      }
    };
    fetchShopProfile();
  }, [form_id]);

  // ------------------ CHATBOT LOGIC ------------------
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "আমি তোমার অর্ডার করে দিতে পারি। প্রথমে আপনার নাম লিখুন। 😊", sender: "bot" }
  ]);
  const [chatStep, setChatStep] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [chatData, setChatData] = useState({
    name: "", phone: "", district: "", upazila: "", address: "", product: "", price: "", extra_info: ""
  });

  const steps = [
    { key: 'name', nextQuestion: "আপনার ফোন নাম্বার দিন 📱" },
    { key: 'phone', nextQuestion: "আপনার জেলার নাম কী? 🌍" },
    { key: 'district', nextQuestion: "আপনার উপজেলার নাম কী? 🏙️" },
    { key: 'upazila', nextQuestion: "বিস্তারিত ঠিকানা (বাড়ি/রাস্তা) দিন 🏠" },
    { key: 'address', nextQuestion: "কী প্রোডাক্ট নিতে চাচ্ছেন? 📦" },
    { key: 'product', nextQuestion: "পণ্যের দাম কত? (না জানা থাকলে ০ দিন) 💰" },
    { key: 'price', nextQuestion: "অতিরিক্ত কোনো তথ্য আছে কি? 📝" },
    { key: 'extra_info', nextQuestion: "সব তথ্য ঠিক আছে। আমি কি অর্ডারটি কনফার্ম করব? (হ্যাঁ/না) ✅" },
  ];

  const submitOrderFromChat = async (data) => {
    if (!form_id) return toast.error("Error: ফর্ম আইডি পাওয়া যায়নি!");
    setLoading(true);
    const toastId = toast.loading("অর্ডার প্রসেস হচ্ছে...");

    const formData = {
      form_id: form_id,
      customer_name: data.name,
      phone_number: data.phone,
      district: data.district,
      upazila: data.upazila,
      address: data.address,
      product_name: data.product,
      price: data.price ? parseFloat(data.price) || 0 : 0,
      extra_info: data.extra_info,
    };

    try {
      const res = await fetch("https://newsmartagent.com/api/orders/", {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (res.ok) {
        toast.success("অর্ডারটি সফলভাবে সম্পন্ন হয়েছে! 🚀", { id: toastId });
        setSubmitted(true);
        setMessages(prev => [...prev, { text: "আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে! 🚀 ধন্যবাদ।", sender: "bot" }]);
      } else {
        toast.error(result.detail || "তথ্য ভুল আছে, আবার চেষ্টা করুন।", { id: toastId });
        setMessages(prev => [...prev, { text: "দুঃখিত, কোনো একটি সমস্যা হয়েছে।", sender: "bot" }]);
      }
    } catch (error) {
      toast.error("সার্ভারে সংযোগ দেওয়া সম্ভব হচ্ছে না।", { id: toastId });
      setMessages(prev => [...prev, { text: "সার্ভারে সংযোগ সমস্যা। ইন্টারনেট চেক করুন।", sender: "bot" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    
    let userText = chatInput.trim();
    if (!userText) {
      if (['price', 'extra_info'].includes(steps[chatStep]?.key)) {
        userText = "স্কিপ করা হয়েছে";
      } else {
        return;
      }
    }

    setMessages(prev => [...prev, { text: userText, sender: "user" }]);
    setChatInput("");

    if (chatStep < steps.length) {
      const currentField = steps[chatStep].key;
      setChatData(prev => ({ ...prev, [currentField]: userText === "স্কিপ করা হয়েছে" ? "" : userText }));
      setTimeout(() => setMessages(prev => [...prev, { text: steps[chatStep].nextQuestion, sender: "bot" }]), 500);
      setChatStep(prev => prev + 1);
    }
  };

  const handleConfirmChoice = (isConfirmed) => {
    if (isConfirmed) {
      setMessages(prev => [...prev, { text: "হ্যাঁ", sender: "user" }]);
      setTimeout(() => setMessages(prev => [...prev, { text: "অর্ডার প্রসেস করা হচ্ছে... ⏳", sender: "bot" }]), 300);
      submitOrderFromChat(chatData);
    } else {
      setMessages(prev => [...prev, { text: "না", sender: "user" }]);
      setTimeout(() => setMessages(prev => [...prev, { text: "অর্ডার বাতিল করা হয়েছে। নতুন করে شروع করতে পেজ রিলোড দিন। ❌", sender: "bot" }]), 300);
    }
  };
  // ---------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form_id) {
      toast.error("Error: ফর্ম আইডি পাওয়া যায়নি!");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("অর্ডার প্রসেস হচ্ছে...");

    const formData = {
      form_id: form_id,
      customer_name: e.target.name.value,
      phone_number: e.target.phone.value,
      district: e.target.district.value,
      upazila: e.target.upazila.value,
      address: e.target.address.value,
      product_name: e.target.product.value,
      price: e.target.price.value ? parseFloat(e.target.price.value) || 0 : 0,
      extra_info: e.target.extra_info.value,
    };

    try {
      const res = await fetch("https://newsmartagent.com/api/orders/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("অর্ডারটি সফলভাবে সম্পন্ন হয়েছে! 🚀", { id: toastId });
        setSubmitted(true);
      } else {
        // ব্যাকএন্ড এরর হ্যান্ডলিং
        toast.error(result.detail || "তথ্য ভুল আছে, আবার চেষ্টা করুন।", { id: toastId });
      }
    } catch (error) {
      console.error("Order error:", error);
      toast.error("সার্ভারে সংযোগ দেওয়া সম্ভব হচ্ছে না।", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center p-8 bg-white shadow-2xl rounded-3xl max-w-sm w-full border border-green-100 animate-in fade-in zoom-in duration-300">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">Order was successful!</h2>
          <p className="text-gray-500 mt-2">We will contact you soon. Thank you!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-100 relative">

        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
          {shopProfile && shopProfile.profile_photo_url ? (
            <div className="relative w-20 h-20 mx-auto mb-3">
              <img
                src={shopProfile.profile_photo_url}
                alt="Shop Logo"
                className="w-full h-full object-cover rounded-full border-4 border-white shadow-md"
              />
            </div>
          ) : (
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-90" />
          )}
          <h1 className="text-2xl font-extrabold tracking-tight">{shopProfile?.name || 'Confirm order.'}</h1>
          <p className="text-blue-100 text-sm mt-1">Fill out the form below correctly.</p>
        </div>

        {/* ERROR MSG সেকশনটি সরিয়ে ফেলা হয়েছে কারণ আমরা TOAST ব্যবহার করছি */}

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">Your Name</label>
            <div className="flex items-center mt-1">
              <User className="absolute ml-3 text-gray-400 w-5 h-5" />
              <input name="name" type="text" placeholder="Your Name" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
            </div>
          </div>

          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">phone number</label>
            <div className="flex items-center mt-1">
              <Phone className="absolute ml-3 text-gray-400 w-5 h-5" />
              <input name="phone" type="tel" placeholder="017XXXXXXXX" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">district</label>
              <div className="flex items-center mt-1">
                <Navigation className="absolute ml-3 text-gray-400 w-4 h-4" />
                <input name="district" type="text" placeholder="district" className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
              </div>
            </div>
            <div className="relative flex-1">
              <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">Upazila</label>
              <div className="flex items-center mt-1">
                <MapPin className="absolute ml-3 text-gray-400 w-4 h-4" />
                <input name="upazila" type="text" placeholder="Upazila" className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
              </div>
            </div>
          </div>

          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">Product Name</label>
            <div className="flex items-center mt-1">
              <Package className="absolute ml-3 text-gray-400 w-5 h-5" />
              <input name="product" placeholder="Product Name" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>

          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">Additional info</label>
            <div className="flex items-center mt-1">
              <MessageSquare className="absolute ml-3 text-gray-400 w-5 h-5" />
              <input name="extra_info" placeholder="Color, size..." className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>


          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">Price</label>
            <div className="flex items-center mt-1">
              <DollarSign className="absolute ml-3 text-gray-400 w-5 h-5" />
              <input name="price" placeholder="Price" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>  


          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">Address details</label>
            <div className="flex mt-1">
              <MapPin className="absolute mt-3 ml-3 text-gray-400 w-5 h-5" />
              <textarea name="address" placeholder="House/Road..." rows="2" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none" required />
            </div>
          </div>

          <button type="submit" disabled={loading} className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg shadow-lg transform transition-all active:scale-95 mt-4 flex justify-center items-center gap-2 ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600"}`}>
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : null}
            {loading ? "Processing..." : "Confirm order."}
          </button>
        </form>
      </div>

      {/* Bot FAB */}
      {!chatOpen && !submitted && (
        <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50 animate-in fade-in slide-in-from-bottom duration-500">
          <div className="bg-white px-4 py-2 rounded-2xl shadow-xl border border-indigo-100 text-sm font-bold text-indigo-700 animate-bounce relative cursor-pointer" onClick={() => setChatOpen(true)}>
            আমি তোমার অর্ডার করে দিতে পারি 👋
            <div className="absolute right-4 -bottom-2 w-4 h-4 bg-white border-b border-r border-indigo-100 transform rotate-45"></div>
          </div>
          <button
            onClick={() => setChatOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center ring-4 ring-indigo-200"
          >
            <MessageCircle size={32} />
          </button>
        </div>
      )}

      {/* Chat Window */}
      {chatOpen && (
        <div className="fixed bottom-6 right-6 w-[340px] sm:w-[400px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 z-50 flex flex-col h-[550px] max-h-[85vh] transition-all animate-in slide-in-from-bottom border-t-4 border-t-indigo-500">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-inner">
                <MessageCircle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Smart Agent</h3>
                <p className="text-xs text-blue-100">Online 🟢</p>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-white hover:bg-white/20 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 flex flex-col">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-sm shadow-md' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {/* Confirmation Buttons Selection */}
            {chatStep === steps.length && !submitted && (
              <div className="flex gap-2 justify-end mt-2 animate-in fade-in slide-in-from-bottom-2">
                <button 
                  type="button"
                  onClick={() => handleConfirmChoice(true)}
                  className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-green-600 transition-colors"
                >
                  হ্যাঁ (Confirm)
                </button>
                <button 
                  type="button"
                  onClick={() => handleConfirmChoice(false)}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-red-600 transition-colors"
                >
                  না (Cancel)
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2 items-center">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={chatStep === steps.length ? "দয়া করে উপরের অপশন থেকে নির্বাচন করুন" : 
                (['price', 'extra_info'].includes(steps[chatStep]?.key) ? "লিখুন অথবা স্কিপ করতে Send চাপুন..." : "Type your message...")}
              className="flex-1 bg-gray-100 border-none px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
              disabled={loading || submitted || chatStep === steps.length}
            />
            <button
              type="submit"
              disabled={loading || submitted || chatStep === steps.length || (!chatInput.trim() && !['price', 'extra_info'].includes(steps[chatStep]?.key))}
              className="bg-indigo-600 text-white p-3 rounded-xl shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

    </div>
  );
}