"use client";

import Link from "next/link";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function Header({ searchQuery, onSearchChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0B0E17]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Left: Logo & Network */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-bold text-xs shadow-lg shadow-blue-500/20">
              B20
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white tracking-tight">
                B20 Tracker
              </h1>
            </div>
          </Link>

          {/* Network Badge */}
          <div className="network-badge hidden sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            Base Mainnet
          </div>
        </div>

        {/* Right: Search + Live */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
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
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-44 rounded-lg border border-white/[0.08] bg-[#1A2335] px-3 py-2 pl-9 text-sm text-white placeholder-gray-500 outline-none transition-all focus:w-56 focus:border-[#3B82F6]/40 focus:ring-1 focus:ring-[#3B82F6]/20 sm:w-56 sm:focus:w-64"
            />
          </div>

          {/* Live Indicator */}
          <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse-dot"></span>
            </span>
            <span className="text-[10px] font-semibold text-green-400 tracking-wider uppercase hidden sm:inline">
              Live
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
