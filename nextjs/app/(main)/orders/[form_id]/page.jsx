"use client";
import { useState, use } from "react"; 
import { 
  ShoppingCart, 
  CheckCircle, 
  User, 
  Phone, 
  MapPin, 
  Package, 
  MessageSquare,
  Navigation,
  Loader2 // লোডিং আইকনের জন্য
} from "lucide-react"; 
import toast from "react-hot-toast";

export default function PublicOrderForm({ params }) {
  // params আনর‍্যাপ করা
  const resolvedParams = use(params);
  const form_id = resolvedParams.form_id;

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-2xl rounded-3xl overflow-hidden border border-gray-100 relative">
        
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
          <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-90" />
          <h1 className="text-2xl font-extrabold tracking-tight">Confirm order.</h1>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
                <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">district</label>
                <div className="flex items-center mt-1">
                    <Navigation className="absolute ml-3 text-gray-400 w-4 h-4" />
                    <input name="district" type="text" placeholder="district" className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
                </div>
            </div>
            <div className="relative">
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
    </div>
  );
}