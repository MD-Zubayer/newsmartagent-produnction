// app/components/DashboardCard.js
export default function DashboardCard({ title, value }) {
  return (
    <div className="bg-white shadow-md rounded-md p-4">
      <h3 className="text-gray-500">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
      
    </div>
  );
}
