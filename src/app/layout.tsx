import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uni-Organizer",
  description: "Toms Uni-Organizer: Kalender, Klausuren, Lernmaterial",
  appleWebApp: { capable: true, title: "Uni-Organizer", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased min-h-dvh">{children}</body>
    </html>
  );
}
