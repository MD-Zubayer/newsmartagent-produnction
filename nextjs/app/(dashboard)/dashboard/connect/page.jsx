import ConnectForm from "../../../(main)/components/ConnectForm";

export default function ConnectPage() {
import ConnectForm from "../../../(main)/components/ConnectForm";

export default function ConnectPage() {
  const webhookUrl = "https://your-django-domain.com/api/webhook/facebook"; // Still passed but not shown in simplified UI

  return (
    <div className="relative min-h-screen w-full bg-white overflow-x-hidden font-sans">
      
      {/* Dynamic Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e505_1px,transparent_1px),linear-gradient(to_bottom,#4f46e505_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="absolute top-0 left-[-10%] w-[120%] h-[50vh] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-50/40 via-transparent to-transparent opacity-70"></div>
        <div className="absolute bottom-0 right-[-10%] w-[120%] h-[50vh] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-50/30 via-transparent to-transparent opacity-50"></div>
      </div>

      <div className="relative z-10 w-full max-w-screen-2xl mx-auto">
        <ConnectForm webhookUrl={webhookUrl} />
      </div>
    </div>
  );
}
}
