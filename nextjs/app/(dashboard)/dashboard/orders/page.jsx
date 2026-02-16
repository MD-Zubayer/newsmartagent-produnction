"use client";
import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api"; 
import { useAuth } from "app/context/AuthContext"; 
import { 
  Package, Phone, CheckSquare, Square, Store, 
  ChevronRight, Link as LinkIcon, Check, MapPin, 
  Search, Printer, LayoutDashboard, BarChart3, TrendingUp
} from "lucide-react";

// Chart JS Imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Chart Register
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement, Filler
);

export default function OrderDashboard() {
  const { user } = useAuth(); 
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formId, setFormId] = useState("");
  const [apiError, setApiError] = useState(null);
  const [copied, setCopied] = useState(false);

  const [viewMode, setViewMode] = useState("orders"); 

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [selectedOrders, setSelectedOrders] = useState([]);

  const shopName = user?.name || "Smart Shop BD";
  
  const orderLink = formId 
    ? `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/orders/${formId}`
    : "Generating link...";

  const copyLink = () => {
    if (!formId) return alert("The link has not been created yet.");
    navigator.clipboard.writeText(orderLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetchOrders();
    fetchFormId(); 
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('orders/'); 
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setApiError("The order could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFormId = async () => {
    try {
      const response = await api.get('users/get-form-id/');
      setFormId(response.data.form_id);
    } catch (error) {
      console.error("Form ID fetch error:", error);
    }
  };

  const analyticsData = useMemo(() => {
    if (!orders.length) return null;
    const userCreateDate = user?.created_at ? new Date(user.created_at) : new Date(orders[orders.length - 1].created_at);
    const today = new Date();
    const dateLabels = [];
    const orderCounts = [];
    let currentDate = new Date(userCreateDate);
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dateLabels.push(currentDate.toLocaleDateString('en-EN', { day: 'numeric', month: 'short' }));
      const dayOrders = orders.filter(o => o.created_at.startsWith(dateStr));
      orderCounts.push(dayOrders.length);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    const pending = orders.filter(o => o.status === 'pending').length;
    const shipped = orders.filter(o => o.status === 'shipped').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    return { labels: dateLabels, lineData: orderCounts, statusData: [pending, shipped, delivered] };
  }, [orders, user]);

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false, 
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Daily Order Growth' },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  };

  const districts = useMemo(() => {
    const list = orders.map(o => o.district).filter(Boolean);
    return ["all", ...new Set(list)];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchSearch = (order.customer_name + order.phone_number + (order.upazila || "") + (order.district || "")).toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "all" || order.status === statusFilter;
      const matchDistrict = districtFilter === "all" || order.district === districtFilter;
      return matchSearch && matchStatus && matchDistrict;
    });
  }, [orders, searchTerm, statusFilter, districtFilter]);

  const toggleSelect = (id) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) setSelectedOrders([]);
    else setSelectedOrders(filteredOrders.map(o => o.id));
  };

  const updateStatus = async (id, s) => {
    try {
      await api.patch(`orders/${id}/`, { status: s });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: s } : o));
    } catch { alert("Status update failed."); }
  };

  const handlePrint = (orderList = null) => {
    const ordersToPrint = orderList || orders.filter(o => selectedOrders.includes(o.id));
    if (ordersToPrint.length === 0) return alert("Select order");
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${shopName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 20px; }
            .page { border: 1px solid #eee; padding: 20px; margin-bottom: 20px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
            h1 { color: #4f46e5; margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          ${ordersToPrint.map(o => `
            <div class="page">
              <div class="header"><h1>${shopName}</h1><div>INVOICE #${o.id}</div></div>
              <p><strong>Customer:</strong> ${o.customer_name} (${o.phone_number})</p>
              <p><strong>Address:</strong> ${o.address}, ${o.district}</p>
              <table>
                <tr><th>Product</th><th>Status</th></tr>
                <tr><td>${o.product_name || "Item"}</td><td>${o.status}</td></tr>
              </table>
            </div>
          `).join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-2 sm:p-4 md:p-10 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans overflow-x-hidden">
      
      {/* HEADER & LINK SHARE */}
      <div className="mb-6 flex flex-col lg:flex-row justify-between items-center lg:items-end gap-4 md:gap-6">
        <div className="space-y-1 w-full text-center lg:text-left">
           <div className="flex items-center gap-2 text-indigo-600 font-bold bg-indigo-50 w-fit px-3 py-1 rounded-full text-[9px] md:text-xs uppercase tracking-widest border border-indigo-100 mx-auto lg:mx-0">
             <Store className="w-3 md:w-4 h-3 md:h-4" /> {shopName}
           </div>
           <h1 className="text-2xl xs:text-3xl md:text-5xl font-black text-gray-900 tracking-tighter leading-tight">
             Order <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Center</span>
           </h1>
        </div>

        <div className="w-full lg:w-auto">
          <div className="bg-white border border-indigo-100 p-1.5 md:p-2.5 md:pl-6 rounded-xl md:rounded-[2.5rem] shadow-lg flex items-center justify-between gap-2 border-b-4 border-b-indigo-500">
            <div className="pl-2 block min-w-0">
              <p className="text-[7px] md:text-[10px] font-black text-indigo-400 uppercase tracking-widest">Share Order Form</p>
              <p className="text-[9px] md:text-sm font-bold text-gray-400 truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] italic">
                {formId ? orderLink : "Loading..."}
              </p>
            </div>
            <button 
              onClick={copyLink}
              disabled={!formId}
              className={`flex items-center gap-1.5 px-3 md:px-8 py-2.5 md:py-4 rounded-lg md:rounded-[1.8rem] font-black text-[10px] md:text-sm transition-all duration-300 flex-shrink-0 ${copied ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white active:scale-95'}`}
            >
              {copied ? <Check className="w-3 h-3 md:w-4 md:h-4" /> : <LinkIcon className="w-3 h-3 md:w-4 md:h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex justify-center mb-6">
        <div className="bg-white p-1 rounded-full shadow-md border border-indigo-50 inline-flex gap-1">
          <button 
            onClick={() => setViewMode("orders")}
            className={`flex items-center gap-1.5 px-4 md:px-8 py-2 md:py-3 rounded-full font-bold text-[10px] md:text-sm transition-all ${viewMode === 'orders' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
          >
            <LayoutDashboard className="w-3 md:w-4 h-3 md:h-4" /> <span className="whitespace-nowrap">Order List</span>
          </button>
          <button 
            onClick={() => setViewMode("analytics")}
            className={`flex items-center gap-1.5 px-4 md:px-8 py-2 md:py-3 rounded-full font-bold text-[10px] md:text-sm transition-all ${viewMode === 'analytics' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
          >
            <BarChart3 className="w-3 md:w-4 h-3 md:h-4" /> <span className="whitespace-nowrap">Analytics</span>
          </button>
        </div>
      </div>

      {/* ANALYTICS VIEW */}
      {viewMode === "analytics" && (
        <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-indigo-50">
              <p className="text-gray-400 text-[8px] md:text-[10px] font-bold uppercase mb-1">Total</p>
              <p className="text-xl md:text-4xl font-black text-indigo-600">{orders.length}</p>
            </div>
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-emerald-50">
              <p className="text-gray-400 text-[8px] md:text-[10px] font-bold uppercase mb-1">Delivered</p>
              <p className="text-xl md:text-4xl font-black text-emerald-500">{orders.filter(o => o.status === 'delivered').length}</p>
            </div>
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-amber-50 col-span-2 lg:col-span-1">
              <p className="text-gray-400 text-[8px] md:text-[10px] font-bold uppercase mb-1">Pending</p>
              <p className="text-xl md:text-4xl font-black text-amber-500">{orders.filter(o => o.status === 'pending').length}</p>
            </div>
          </div>
          {/* Charts remain similar as they use maintainAspectRatio: false */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-4 md:p-8 rounded-2xl md:rounded-[3rem] shadow-sm overflow-hidden">
               <div className="h-[250px] md:h-[300px]">
                  {analyticsData && <Line data={{ labels: analyticsData.labels, datasets: [{ label: 'Orders', data: analyticsData.lineData, borderColor: '#4f46e5', tension: 0.4, fill: true, backgroundColor: 'rgba(79, 70, 229, 0.05)' }] }} options={lineChartOptions} />}
               </div>
            </div>
            <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[3rem] shadow-sm flex flex-col items-center justify-center">
               <div className="w-full max-w-[180px] md:max-w-[250px]">
                 {analyticsData && <Doughnut data={{ labels: ['P', 'S', 'D'], datasets: [{ data: analyticsData.statusData, backgroundColor: ['#fbbf24', '#4f46e5', '#10b981'] }] }} options={{ cutout: '70%', plugins: { legend: { display: false } } }} />}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDERS VIEW */}
      {viewMode === "orders" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-4 md:mb-10 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white shadow-sm rounded-xl text-xs md:text-sm outline-none border border-transparent focus:border-indigo-500" 
                  placeholder="Search orders..." 
                />
              </div>
              <select onChange={(e) => setDistrictFilter(e.target.value)} className="bg-white shadow-sm rounded-xl px-4 py-3 text-xs md:text-sm font-bold outline-none border-r-8 border-transparent">
                <option value="all">Districts</option>
                {districts.filter(d => d !== "all").map(d => <option key={d} value={d}>{d}</option>)}
              </select>
          </div>

          <div className="sticky top-2 z-20 bg-gray-900 text-white p-2.5 md:p-5 mb-6 rounded-xl md:rounded-[2.5rem] shadow-xl flex items-center justify-between gap-2">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 ml-2 text-[10px] md:text-sm font-bold">
              {selectedOrders.length === filteredOrders.length ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />} 
              <span>All</span>
            </button>
            {selectedOrders.length > 0 && (
              <button onClick={() => handlePrint()} className="flex items-center gap-1.5 bg-indigo-500 px-4 py-2 rounded-lg text-[10px] md:text-sm font-black active:scale-95">
                <Printer className="w-3 md:w-4 h-3 md:h-4" /> Print ({selectedOrders.length})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:gap-6">
            {filteredOrders.map((order) => (
              <div key={order.id} className={`rounded-2xl md:rounded-[3.5rem] p-0.5 ${selectedOrders.includes(order.id) ? 'bg-indigo-500' : 'bg-gray-100'}`}>
                <div className="bg-white p-3 xs:p-4 md:p-8 rounded-[1.2rem] md:rounded-[3.3rem] flex flex-col lg:flex-row justify-between gap-4">
                  
                  <div className="flex gap-3 md:gap-6 items-start">
                    <button onClick={() => toggleSelect(order.id)} className="mt-1 flex-shrink-0">
                      {selectedOrders.includes(order.id) ? <CheckSquare className="text-indigo-600 w-5 h-5 md:w-8 md:h-8" /> : <Square className="text-gray-200 w-5 h-5 md:w-8 md:h-8" />}
                    </button>
                    
                    <div className="space-y-2 md:space-y-4 flex-1 min-w-0">
                      <div>
                        <h3 className="text-base xs:text-lg md:text-3xl font-black text-gray-900 tracking-tight truncate">{order.customer_name}</h3>
                        <div className="flex items-center gap-1 text-[9px] md:text-sm font-bold text-gray-400">
                          <MapPin className="w-3 h-3 text-indigo-500" /> {order.district}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5">
                        <span className="flex items-center gap-1 text-[9px] md:text-sm font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-100"><Phone className="w-3 h-3 text-indigo-500" /> {order.phone_number}</span>
                        <span className="flex items-center gap-1 text-[9px] md:text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 truncate max-w-[120px] xs:max-w-none"><Package className="w-3 h-3" /> {order.product_name || "Item"}</span>
                      </div>

                      <p className="text-[10px] md:text-sm text-gray-500 leading-snug bg-slate-50 p-3 md:p-6 rounded-xl md:rounded-[2rem] border-l-4 md:border-l-8 border-indigo-500 break-words">
                        {order.address}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row lg:flex-col justify-between items-center lg:items-end gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-50">
                    <div className="bg-gray-50 px-3 py-1.5 md:py-4 rounded-lg md:rounded-[2rem] border border-gray-100">
                       <p className="text-[7px] md:text-[10px] font-black text-gray-300 uppercase">Order date</p>
                       <p className="text-[9px] md:text-sm font-black text-gray-700">{new Date(order.created_at).toLocaleDateString('en-GB')}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button onClick={() => handlePrint([order])} className="p-2.5 md:p-5 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-[2rem]">
                          <Printer className="w-4 h-4 md:w-6 md:h-6" />
                      </button>
                      
                      <div className="relative">
                        <select 
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                          className={`appearance-none pl-3 md:pl-8 pr-7 md:pr-12 py-2 md:py-5 rounded-lg md:rounded-[2rem] font-black text-[9px] md:text-xs uppercase cursor-pointer ${
                            order.status === 'delivered' ? 'bg-emerald-500 text-white' : 
                            order.status === 'shipped' ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-white'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                        </select>
                        <ChevronRight className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-3 md:w-4 h-3 md:h-4 pointer-events-none rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredOrders.length === 0 && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-100 py-10 text-center mt-6">
          <Package className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">No orders</p>
        </div>
      )}
    </div>
  );
}