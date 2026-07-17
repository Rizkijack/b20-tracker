import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/hooks/useTheme";
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
  keywords: ["B20", "Base", "Base Mainnet", "token tracker", "ERC-20", "blockchain", "crypto dashboard"],
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
      suppressHydrationWarning
    >
      <head>
        {/* Prevent FOUC: apply dark mode before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('b20-tracker-theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                  }
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg-body)", color: "var(--text-primary)" }}>
        {/* Skip-to-main link for keyboard users */}
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>

        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
