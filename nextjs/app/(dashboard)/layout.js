import ViewportFix from "./ViewportFix";

export const viewport = {
  width: 1024,
};

export default function DashboardRootLayout({ children }) {
  return (
    <>
      <ViewportFix />
      {children}
    </>
  );
}
