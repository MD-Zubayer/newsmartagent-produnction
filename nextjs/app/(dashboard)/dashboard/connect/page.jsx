import ConnectForm from "../../../(main)/components/ConnectForm";

export default function ConnectPage() {
  const webhookUrl = "https://your-django-domain.com/api/webhook/facebook"; // Change to your Django URL

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <ConnectForm webhookUrl={webhookUrl} />
    </div>
  );
}
