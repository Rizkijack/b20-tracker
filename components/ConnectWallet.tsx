"use client";

import { Wallet, Copy, ExternalLink, LogOut, ChevronDown } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { truncateAddress } from "@/lib/b20-client";
import { EXPLORER_URL } from "@/lib/constants";

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export default function ConnectWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const isBaseMainnet = chainId === 8453;

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert("No crypto wallet found. Please install MetaMask or another EVM wallet.");
      return;
    }

    try {
      setIsConnecting(true);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const addr = (accounts as string[])[0];
      setAddress(addr);

      const chainIdHex = await window.ethereum.request({
        method: "eth_chainId",
      });
      setChainId(parseInt(chainIdHex as string, 16));
    } catch (err) {
      console.error("Wallet connect error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setShowDropdown(false);
  }, []);

  const copyAddress = useCallback(() => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      if (args.length === 0) {
        disconnect();
      } else {
        setAddress((args[0] as string[])[0]);
      }
    };

    const handleChainChanged = (chainIdHex: unknown) => {
      setChainId(parseInt(chainIdHex as string, 16));
      window.location.reload();
    };

    const eth = window.ethereum;
    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    eth.request({ method: "eth_accounts" })
      .then((accounts) => {
        if ((accounts as string[]).length > 0) {
          setAddress((accounts as string[])[0]);
          eth.request({ method: "eth_chainId" })
            .then((id) => setChainId(parseInt(id as string, 16)));
        }
      });

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged);
      eth.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnect]);

  // Dropdown close on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showDropdown]);

  if (address) {
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          className="flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-sm font-medium transition-all hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
          style={{ color: "var(--text-primary)" }}
        >
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            <span className="font-mono text-xs">{truncateAddress(address, 4)}</span>
          </div>
          {!isBaseMainnet && (
            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-500">
              Wrong Net
            </span>
          )}
          <ChevronDown
            size={14}
            className={`transition-transform duration-300 ${showDropdown ? "rotate-180" : ""}`}
          />
        </button>

        {showDropdown && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/[0.1] bg-[#0A0A0F] p-3 shadow-2xl z-50"
            onClick={(e) => e.stopPropagation()}
            role="menu"
          >
            <div className="mb-3 pb-3 border-b border-white/[0.08]">
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>
                Connected Wallet
              </p>
              <p className="font-mono text-sm break-all" style={{ color: "var(--text-primary)" }}>
                {address}
              </p>
              {!isBaseMainnet && (
                <p className="text-xs text-yellow-500 mt-1">
                  ⚠️ Not on Base Mainnet (Chain ID: {chainId})
                </p>
              )}
            </div>

            <div className="space-y-1">
              <button
                onClick={copyAddress}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/[0.06]"
                style={{ color: "var(--text-secondary)" }}
              >
                <Copy size={14} />
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <a
                href={`${EXPLORER_URL}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/[0.06]"
                style={{ color: "var(--text-secondary)" }}
              >
                <ExternalLink size={14} />
                View on Explorer
              </a>
              <button
                onClick={disconnect}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-red-500/10"
                style={{ color: "var(--accent-red)" }}
              >
                <LogOut size={14} />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#0052FF] to-[#0039B3] px-4 py-2 font-medium text-white shadow-[0_0_15px_rgba(0,82,255,0.3)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,82,255,0.5)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full" />
      <Wallet size={16} />
      <span className="text-sm font-semibold tracking-wide">
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </span>
    </button>
  );
}
