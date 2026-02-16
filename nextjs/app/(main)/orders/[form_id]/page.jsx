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
  Navigation 
} from "lucide-react"; 

export default function PublicOrderForm({ params }) {
  const resolvedParams = use(params);
  const form_id = resolvedParams.form_id;

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (!form_id) {
      setErrorMsg("Error: Form ID missing in URL!");
      setLoading(false);
      return;
    }
    
    // ফরম ডাটা অবজেক্ট আপডেট করা হয়েছে
    const formData = {
      form_id: form_id,
      customer_name: e.target.name.value,
      phone_number: e.target.phone.value,
      district: e.target.district.value, // নতুন ফিল্ড
      upazila: e.target.upazila.value,   // নতুন ফিল্ড
      address: e.target.address.value,
      product_name: e.target.product.value,
      extra_info: e.target.extra_info.value,
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/api/orders/", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (res.ok) {
        setSubmitted(true);
      } else {
        console.log("Validation Errors:", result);
        // ব্যাকএন্ড থেকে আসা স্পেসিফিক ফিল্ড এরর হ্যান্ডলিং
        if (result.district || result.upazila) {
            setErrorMsg("জেলা এবং উপজেলার তথ্য প্রদান করুন।");
        } else {
            setErrorMsg(result.form_id ? "Invalid Link!" : "আপনার তথ্যগুলো সঠিক নয়।");
        }
      }
    } catch (error) {
      console.error("Order error:", error);
      setErrorMsg("সার্ভারে কানেক্ট করা যাচ্ছে না। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center p-8 bg-white shadow-2xl rounded-3xl max-w-sm w-full border border-green-100 animate-in fade-in zoom-in duration-300">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">অর্ডার সফল হয়েছে!</h2>
          <p className="text-gray-500 mt-2">আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব। ধন্যবাদ!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-2xl rounded-3xl overflow-hidden border border-gray-100 relative">
        
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
          <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-90" />
          <h1 className="text-2xl font-extrabold tracking-tight">অর্ডার কনফার্ম করুন</h1>
          <p className="text-blue-100 text-sm mt-1">সঠিক তথ্য দিয়ে নিচের ফরমটি পূরণ করুন</p>
        </div>

        {errorMsg && (
          <div className="mx-8 mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {/* নাম */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">আপনার নাম</label>
            <div className="flex items-center mt-1">
              <User className="absolute ml-3 text-gray-400 w-5 h-5" />
              <input name="name" type="text" placeholder="উদা: রহিম খান" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
            </div>
          </div>

          {/* ফোন */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">ফোন নম্বর</label>
            <div className="flex items-center mt-1">
              <Phone className="absolute ml-3 text-gray-400 w-5 h-5" />
              <input name="phone" type="tel" placeholder="017XXXXXXXX" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
            </div>
          </div>

          {/* জেলা ও উপজেলা গ্রিড */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
                <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">জেলা</label>
                <div className="flex items-center mt-1">
                    <Navigation className="absolute ml-3 text-gray-400 w-4 h-4" />
                    <input name="district" type="text" placeholder="উদা: ঢাকা" className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
                </div>
            </div>
            <div className="relative">
                <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">উপজেলা</label>
                <div className="flex items-center mt-1">
                    <MapPin className="absolute ml-3 text-gray-400 w-4 h-4" />
                    <input name="upazila" type="text" placeholder="উদা: সাভার" className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
                </div>
            </div>
          </div>

          {/* পণ্যের নাম */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">পণ্যের নাম</label>
            <div className="flex items-center mt-1">
              <Package className="absolute ml-3 text-gray-400 w-5 h-5" />
              <input name="product" placeholder="উদা: Redmi Note 11" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>

          {/* অতিরিক্ত তথ্য */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">অতিরিক্ত তথ্য (ঐচ্ছিক)</label>
            <div className="flex items-center mt-1">
              <MessageSquare className="absolute ml-3 text-gray-400 w-5 h-5" />
              <input name="extra_info" placeholder="কালার, সাইজ বা বিশেষ নোট" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>

          {/* বিস্তারিত ঠিকানা */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 tracking-wide">বিস্তারিত ঠিকানা</label>
            <div className="flex mt-1">
              <MapPin className="absolute mt-3 ml-3 text-gray-400 w-5 h-5" />
              <textarea name="address" placeholder="বাসা নম্বর, রোড, এলাকা..." rows="2" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none" required />
            </div>
          </div>

          <button type="submit" disabled={loading} className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg shadow-lg transform transition-all active:scale-95 mt-4 ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"}`}>
            {loading ? "প্রসেসিং..." : "অর্ডার কনফার্ম করুন"}
          </button>
        </form>

        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">আপনার তথ্য আমাদের কাছে নিরাপদ</p>
        </div>
      </div>
    </div>
  );
}