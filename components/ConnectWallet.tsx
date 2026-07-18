"use client";

import { Wallet, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function ConnectWallet() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#0052FF] to-[#0039B3] px-4 py-2 font-medium text-white shadow-[0_0_15px_rgba(0,82,255,0.3)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,82,255,0.5)] hover:scale-[1.02] active:scale-[0.98]"
    >
      {/* Shine effect */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full" />
      
      <Wallet size={16} className={`transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`} />
      <span className="text-sm font-semibold tracking-wide">Connect Wallet</span>
      <ChevronDown size={14} className="opacity-70 transition-transform duration-300 group-hover:rotate-180" />
    </button>
  );
}
