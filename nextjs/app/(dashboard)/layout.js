import ViewportFix from "./ViewportFix";
import { DisplayProvider } from "./DisplayContext";

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function DashboardRootLayout({ children }) {
  return (
    <DisplayProvider>
      <ViewportFix />
      {children}
    </DisplayProvider>
  );
}
