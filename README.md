# B20 Tracker — Base Mainnet Real-Time Dashboard

A real-time blockchain tracker for [B20 tokens](https://docs.base.org/base-chain/specs/upgrades/beryl/b20) on [Base Mainnet](https://base.org). Built with Next.js, Tailwind CSS, and ethers.js.

![B20 Tracker](https://img.shields.io/badge/Network-Base%20Mainnet-0052FF?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square)

## Features

- **📊 Dashboard Overview** — Total B20 tokens, asset/stablecoin breakdown, block height
- **🪙 Token List** — All discovered B20 tokens with name, symbol, variant, and supply
- **📡 Live Event Feed** — Real-time Transfer, Mint, and Burn events from Base Mainnet
- **🔍 Search & Filter** — Find tokens by name, symbol, or contract address
- **📋 Token Detail Pages** — Per-token activity history with full event details
- **🌙 Dark Theme** — Sleek dark UI inspired by Base branding

## How It Works

1. **Token Discovery** — Scans Base Mainnet blocks for `Transfer` events from B20-prefixed addresses (`0xB20f...`)
2. **Metadata Fetching** — Calls `name()`, `symbol()`, `totalSupply()`, `decimals()` on each discovered token
3. **Event Polling** — Polls new blocks every 4 seconds for Transfer events from all known B20 addresses
4. **Variant Detection** — Determines if a token is an Asset or Stablecoin from its address encoding

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
cd b20-tracker

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables (Optional)

```bash
# .env.local
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

The default uses Base's public RPC endpoint. You can use any Base Mainnet RPC provider (Alchemy, Infura, QuickNode, etc.) for better rate limits.

## Project Structure

```
b20-tracker/
├── app/
│   ├── layout.tsx                  # Root layout (dark theme)
│   ├── page.tsx                    # Main dashboard
│   └── token/
│       └── [address]/
│           └── page.tsx             # Per-token detail
├── components/
│   ├── Header.tsx                  # Navigation & search
│   ├── StatsBar.tsx                # Overview statistics
│   ├── TokenList.tsx               # Token list with search
│   └── LiveEventFeed.tsx           # Real-time event stream
├── hooks/
│   ├── useB20Tokens.ts             # Token discovery & metadata
│   ├── useB20Events.ts             # Live event polling
│   ├── useStats.ts                 # Aggregate statistics
│   └── useTokenDetail.ts           # Per-token data
├── lib/
│   ├── constants.ts                # B20 addresses, topics, ABIs
│   ├── types.ts                   # TypeScript interfaces
│   ├── b20-client.ts              # ethers.js blockchain helpers
│   └── event-decoder.ts           # Event decoding & display helpers
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Blockchain | ethers.js v6 |
| Network | Base Mainnet RPC |

## Deploy on Vercel

1. Push this repository to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repository
4. Deploy — no environment variables required for basic usage

For production with a dedicated RPC provider, add `NEXT_PUBLIC_BASE_RPC_URL` as an environment variable in Vercel settings.

## B20 Protocol Resources

- [B20 Token Standard Spec](https://docs.base.org/base-chain/specs/upgrades/beryl/b20)
- [Launch a B20 Token](https://docs.base.org/get-started/launch-b20-token)
- [base-std GitHub](https://github.com/base/base-std) — Solidity interfaces & libraries
- [Coinbase B20 Events API](https://docs.cdp.coinbase.com/data/sql-api/b20-events)

## License

MIT
