# B20 Scanner - Data Source Integration Documentation

## Overview

The B20 Scanner now supports multiple data sources for real-time token discovery and market data. This document explains the architecture and how to configure the different data sources.

## Data Source Architecture

### Priority Order for Token Discovery

1. **B20 Factory Contract** (Primary)
   - Direct integration with Base's official B20 Token Factory
   - Most reliable and up-to-date source
   - No API key required
   - Real-time via event logs

2. **DexScreener** (Secondary)
   - Free DEX aggregator
   - Comprehensive token data across multiple DEXes
   - No API key required
   - Good for discovering newly listed tokens

3. **GeckoTerminal** (Secondary)
   - Free DEX analytics platform
   - Detailed pool and trading data
   - No API key required
   - Alternative to DexScreener

4. **Block Scanning** (Fallback)
   - Traditional block-by-block scanning
   - Always available but slower
   - No API key required

### Priority Order for Market Data

1. **DexScreener** - Free, comprehensive
2. **GeckoTerminal** - Free, detailed
3. **Birdeye.so** - Requires API key, high quality
4. **CoinGecko** - Free tier available, optional API key
5. **CoinMarketCap** - Requires API key

## Configuration

### Environment Variables

Create a `.env.local` file in your project root:

```bash
# Blockchain RPC
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY,https://mainnet.base.org
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org

# Market Data API Keys (all optional but recommended)
BIRDEYE_API_KEY=your_birdeye_api_key
COINGECKO_API_KEY=your_coingecko_api_key  # Optional for higher rate limits
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key

# Redis Cache (optional for production)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

### API Key Sources

- **Birdeye.so**: Get free API key at https://birdeye.so/user/profile
- **CoinGecko**: Pro API key at https://www.coingecko.com/en/api/pricing (free tier works without key)
- **CoinMarketCap**: Get API key at https://pro.coinmarketcap.com/signup

## API Endpoints

### Token Discovery

#### GET `/api/b20-tokens`
Returns all B20 tokens from multiple sources with optional market data.

**Query Parameters:**
- `limit` (number): Maximum number of tokens to return (1-1000, default: 500)
- `market` (boolean): Include market data (default: true)

**Example:**
```bash
curl "http://localhost:3000/api/b20-tokens?limit=100&market=true"
```

#### GET `/api/factory-tokens`
Returns B20 tokens discovered via the factory contract.

**Query Parameters:**
- `limit` (number): Maximum number of tokens (1-10000, default: 500)
- `fromBlock` (number): Start scanning from this block (default: 0)
- `metadata` (boolean): Include token metadata (default: false)

**Example:**
```bash
curl "http://localhost:3000/api/factory-tokens?limit=100&metadata=true"
```

#### GET `/api/thirdparty-tokens`
Returns B20 tokens discovered via third-party APIs (DexScreener, GeckoTerminal).

**Query Parameters:**
- `limit` (number): Maximum number of tokens (1-500, default: 100)

**Example:**
```bash
curl "http://localhost:3000/api/thirdparty-tokens?limit=50"
```

### Market Data

#### GET `/api/market`
Returns market data for a single token.

**Query Parameters:**
- `address` (string, required): Token contract address
- `sources` (string): Comma-separated list of sources to use

**Example:**
```bash
curl "http://localhost:3000/api/market?address=0xB20f..."
```

#### GET `/api/market/batch`
Returns market data for multiple tokens.

**Query Parameters:**
- `addresses` (string, required): Comma-separated list of addresses (max 20)
- `sources` (string): Comma-separated list of sources to use

**Example:**
```bash
curl "http://localhost:3000/api/market/batch?addresses=0xB20f...,0xB20f..."
```

### Health Check

#### GET `/api/health`
Returns health status of all data sources and endpoints.

**Example:**
```bash
curl "http://localhost:3000/api/health"
```

## Client-Side Usage

### Using the Hook

```tsx
import { useB20Tokens } from "@/hooks/useB20Tokens";

function MyComponent() {
  const { 
    tokens, 
    loading, 
    error, 
    currentBlock, 
    lastScannedBlock, 
    dataSource 
  } = useB20Tokens();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Data Source: {dataSource}</h2>
      <p>Tokens: {tokens.length}</p>
      {/* Render tokens */}
    </div>
  );
}
```

### Data Source Information

The `dataSource` field indicates which method was used to discover tokens:
- `"factory"` - Direct from B20 Factory contract (most reliable)
- `"thirdparty"` - From DexScreener/GeckoTerminal
- `"blockscan"` - Traditional block scanning (fallback)

## Server-Side Usage

### Direct Factory Integration

```typescript
import { getB20TokensFromFactory, getB20TokensWithMetadata } from "@/lib/b20-factory";

// Get raw token data from factory
const tokens = await getB20TokensFromFactory(100, 0);

// Get tokens with metadata
const tokensWithMetadata = await getB20TokensWithMetadata(100);
```

### Third-Party Discovery

```typescript
import { fetchB20TokensFromThirdParty } from "@/lib/b20-factory";

const tokens = await fetchB20TokensFromThirdParty(100);
```

### Market Data

```typescript
import { fetchTokenMarketData, batchFetchMarketData } from "@/lib/market-data";

// Single token
const marketData = await fetchTokenMarketData("0xB20f...");

// Multiple tokens
const addresses = ["0xB20f...", "0xB20f..."];
const marketDataMap = await batchFetchMarketData(addresses);
```

## Troubleshooting

### No Tokens Displayed

1. **Check data source availability**:
   ```bash
   curl "http://localhost:3000/api/health"
   ```

2. **Test factory endpoint directly**:
   ```bash
   curl "http://localhost:3000/api/factory-tokens?limit=10"
   ```

3. **Test third-party endpoint**:
   ```bash
   curl "http://localhost:3000/api/thirdparty-tokens?limit=10"
   ```

### Slow Performance

- **Add more RPC endpoints**: Set `BASE_RPC_URL` to a comma-separated list
- **Configure Redis cache**: Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- **Add API keys**: Configure Birdeye, CoinGecko, or CoinMarketCap keys

### Missing Market Data

- Ensure at least one market data API key is configured
- Check that the token has trading pairs on supported DEXes
- Try different sources using the `sources` query parameter

## Rate Limits and Caching

### Built-in Caching

- **Token metadata**: Cached for 5 minutes
- **Market data**: Cached for 1 minute
- **Block timestamps**: Cached for 2 minutes
- **Factory tokens**: Cached for 5 minutes

### Rate Limit Considerations

- **DexScreener**: Free, no rate limits reported
- **GeckoTerminal**: Free, reasonable rate limits
- **Birdeye**: Free tier has rate limits (60k credits/month)
- **CoinGecko**: Free tier has rate limits (10-30 calls/minute)
- **CoinMarketCap**: Free tier has rate limits (10k calls/month)

## Fallback Mechanism

The system automatically falls back to the next available data source if the primary source fails:

1. **Token Discovery**: Factory → Third-party → Block scanning
2. **Market Data**: All available sources are queried simultaneously, with priority given to the first successful response

## Monitoring

Use the health check endpoint to monitor data source availability:

```bash
# Check health status
curl "http://localhost:3000/api/health"

# Check specific endpoint
curl "http://localhost:3000/api/factory-tokens?limit=1"
```

## Performance Optimization

1. **Use Redis cache** for production deployments
2. **Configure multiple RPC endpoints** for redundancy
3. **Add all available API keys** for maximum data coverage
4. **Use the batch API** for market data to reduce requests

## Migration Guide

If you're upgrading from an older version:

1. **No breaking changes** - The existing API endpoints remain the same
2. **New endpoints available** - `/api/b20-tokens`, `/api/factory-tokens`, `/api/thirdparty-tokens`
3. **Improved reliability** - Multiple fallback sources ensure data availability
4. **Better performance** - Factory integration is much faster than block scanning

## Contributing

To add a new data source:

1. Add configuration to `lib/data-sources.ts`
2. Create a new fetch function in `lib/market-data.ts` or `lib/b20-factory.ts`
3. Add the source to the priority arrays
4. Update the hook to use the new source

## License

This integration is provided as-is for the B20 Scanner project. Refer to the main project license for usage terms.
