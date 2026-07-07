"use client";

import Link from "next/link";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function Header({ searchQuery, onSearchChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0D0D0D]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo & Title */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0052FF] text-white font-bold text-sm">
            B20
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              B20 Tracker
            </h1>
            <p className="text-[10px] text-gray-500 -mt-0.5 tracking-wide uppercase">
              Base Mainnet
            </p>
          </div>
        </Link>

        {/* Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search token name, symbol, or address..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-64 rounded-lg border border-white/10 bg-white/5 px-4 py-2 pl-9 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-[#0052FF]/50 focus:bg-white/10 focus:ring-1 focus:ring-[#0052FF]/30 sm:w-80"
            />
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 border border-green-500/20">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </div>
            <span className="text-xs font-medium text-green-400">LIVE</span>
          </div>
        </div>
      </div>
    </header>
  );
}
