import { UserCircleIcon } from "@heroicons/react/24/outline";

export default function AccountPage() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-8">
        <UserCircleIcon className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </div>

      <div className="space-y-6 bg-white p-8 border rounded-2xl shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <input type="text" className="mt-1 block w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Junayed Ahmed" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email Address</label>
          <input type="email" disabled className="mt-1 block w-full p-3 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" placeholder="junayed@example.com" />
        </div>
        <button className="bg-black text-white px-6 py-3 rounded-xl hover:opacity-80 transition-opacity">
          Update Profile
        </button>
      </div>
    </div>
  );
}