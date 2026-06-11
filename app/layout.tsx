import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Disc Golf Arcade",
  description: "A retro pixel-art disc golf game — 18 holes, a daily challenge, real discs, and a leaderboard.",
};

export const viewport = {
  themeColor: "#0f1117",
  // Lets env(safe-area-inset-*) report real values so the control panel can
  // pad itself above curved phone corners / the home indicator.
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0f1117]">{children}</body>
    </html>
  );
}
