import { ShoppingCartIcon } from "@heroicons/react/24/outline";

export default function OrdersPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <ShoppingCartIcon className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold">My Subscriptions</h1>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-semibold text-gray-600">Plan</th>
              <th className="p-4 font-semibold text-gray-600">Status</th>
              <th className="p-4 font-semibold text-gray-600">Expiry</th>
              <th className="p-4 font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b hover:bg-gray-50">
              <td className="p-4 font-medium">Pro Plan</td>
              <td className="p-4"><span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">Active</span></td>
              <td className="p-4 text-gray-600">Feb 28, 2026</td>
              <td className="p-4"><button className="text-blue-600 hover:underline">Manage</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}