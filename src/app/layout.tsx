import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Pretzel Quest | NFL Picks",
  description: "Pretzel Quest: pick every NFL game, track accuracy, and climb the leaderboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <AppHeader />
        <div className="min-w-0">{children}</div>
      </body>
    </html>
  );
}
