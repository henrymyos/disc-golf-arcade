import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SwRegister } from "./sw-register";
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
  // Resolves relative Open Graph / Twitter image URLs (e.g. /og?…) to absolute
  // links on the live domain so shared/challenge links unfurl correctly.
  metadataBase: new URL("https://discgolfarcade.com"),
  title: "Disc Golf Arcade",
  description: "A retro pixel-art disc golf game — 18 holes, a daily challenge, real discs, and a leaderboard.",
  appleWebApp: { capable: true, title: "Disc Golf Arcade", statusBarStyle: "black-translucent" },
};

export const viewport = {
  themeColor: "#0f1117",
  // Lets env(safe-area-inset-*) report real values so the control panel can
  // pad itself above curved phone corners / the home indicator.
  viewportFit: "cover" as const,
  // Lock the scale so mobile browsers don't zoom in when you focus a text field,
  // and pinch-zoom can't drift the fixed game board off-screen.
  width: "device-width" as const,
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body className="min-h-full flex flex-col bg-[#0f1117]">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
