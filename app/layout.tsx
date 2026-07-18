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
  title: "B20 Tracker — Base Mainnet Real-Time Dashboard",
  description:
    "Track B20 tokens on Base Mainnet in real-time. Live event feed, token list, transfers, mints, burns, and on-chain activity for Base's native token standard.",
  keywords: ["B20", "Base", "Base Mainnet", "token tracker", "ERC-20", "blockchain"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0D0D0D] text-gray-100">
        {children}
      </body>
    </html>
  );
}
