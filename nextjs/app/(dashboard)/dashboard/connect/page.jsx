import ConnectForm from "../../../(main)/components/ConnectForm";

export default function ConnectPage() {
  const webhookUrl = "https://your-django-domain.com/api/webhook/facebook"; // Change to your Django URL

  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden pb-20 font-sans">
      
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e508_1px,transparent_1px),linear-gradient(to_bottom,#4f46e508_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none"></div>

      <div className="relative z-10">
        <ConnectForm webhookUrl={webhookUrl} />
      </div>
    </div>
  );
}
