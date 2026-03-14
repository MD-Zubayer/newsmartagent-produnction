import ViewportHandler from "./ViewportHandler";

export const viewport = {
  width: 1024,
  initialScale: 0.1, // Forces browser to zoom out to fit content
};

export default function DashboardRootLayout({ children }) {
  return (
    <>
      <ViewportHandler />
      {children}
    </>
  );
}
