# 🎯 B20 Scanner - Production Recommendations Summary

## 📋 Quick Start Checklist

### ✅ Before Going Live

- [ ] **Configure Multiple RPC Endpoints**
  ```bash
  BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY,https://base-mainnet.public.blastapi.io,https://mainnet.base.org
  ```

- [ ] **Setup Redis Cache** (Recommended)
  ```bash
  UPSTASH_REDIS_REST_URL=https://YOUR_INSTANCE.upstash.io
  UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN
  ```

- [ ] **Add API Keys** (Optional but Recommended)
  ```bash
  BIRDEYE_API_KEY=your_key
  COINGECKO_API_KEY=your_key
  COINMARKETCAP_API_KEY=your_key
  ```

- [ ] **Enable HTTPS**
  ```bash
  ENFORCE_HTTPS=true
  ```

- [ ] **Enable Monitoring**
  ```bash
  MONITORING_ENABLED=true
  ```

---

## 🌐 1. Multiple RPC Endpoints Setup

### Why It Matters
- **Redundancy**: If one RPC fails, others continue working
- **Load Balancing**: Distributes requests to prevent overload
- **Rate Limit Avoidance**: Prevents hitting single provider limits
- **Performance**: Different providers may have different speeds

### Recommended Configuration

#### Free RPC Providers (Good for Development)
```bash
BASE_RPC_URL=https://mainnet.base.org,https://base-mainnet.public.blastapi.io,https://base-mainnet.rpc.ankr.com,https://base.drpc.org
```

#### Production RPC Providers (Recommended)
```bash
# Alchemy (Primary)
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Multiple providers with failover
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY,https://base-mainnet.infura.io/v3/YOUR_INFURA_KEY,https://YOUR_QUICKNODE_ENDPOINT,https://mainnet.base.org
```

### RPC Provider Comparison

| Provider | Free Tier | Rate Limit | Latency | Reliability |
|----------|-----------|------------|---------|-------------|
| Base Public | ✅ Yes | ~100 req/sec | Medium | Good |
| Alchemy | ✅ Yes | 300M CU/month | Low | Excellent |
| Infura | ✅ Yes | 100K req/day | Low | Excellent |
| QuickNode | ✅ Yes | Varies | Low | Excellent |
| BlastAPI | ✅ Yes | No limit | Medium | Good |
| Ankr | ✅ Yes | No limit | Medium | Good |
| DRPC | ✅ Yes | No limit | Medium | Good |

### How the System Uses Multiple RPCs

1. **Round-Robin Load Balancing**: Requests are distributed evenly
2. **Performance-Based Routing**: Faster RPCs get more requests
3. **Automatic Failover**: Failed RPCs are temporarily removed
4. **Health Monitoring**: System tracks RPC performance
5. **Automatic Recovery**: Failed RPCs are retried after cooldown

### Testing RPC Configuration

```bash
# Test individual RPC endpoints
curl -v https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Check RPC health in the app
curl https://yourdomain.com/api/health | jq '.rpc'
```

---

## 🗃️ 2. Redis Cache Configuration

### Why It Matters
- **Persists Across Restarts**: Cache survives server restarts
- **Shared Between Instances**: Useful for serverless deployments
- **Reduces RPC Calls**: Caches token metadata, market data, etc.
- **Improves Performance**: Faster response times for cached data

### Setup Options

#### Option A: Upstash Redis (Recommended for Vercel)

1. **Sign up**: [https://upstash.com/](https://upstash.com/)
2. **Create Database**: Choose "Redis REST"
3. **Get Credentials**: Copy URL and Token
4. **Configure**:
   ```bash
   UPSTASH_REDIS_REST_URL=https://YOUR_INSTANCE_ID.upstash.io
   UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN
   ```

#### Option B: Self-Hosted Redis

1. **Install Redis**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # Docker
   docker run --name redis -p 6379:6379 -d redis
   ```

2. **Configure**:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

### Cache Configuration

| Data Type | TTL | Storage | Cache Key Pattern |
|-----------|-----|---------|-------------------|
| Token Metadata | 5 min | Redis + Memory | `meta:{address}` |
| Market Data | 1 min | Redis + Memory | `mkt:{address}` |
| Block Timestamps | 2 min | Redis + Memory | `blk:{blockNumber}` |
| Factory Tokens | 5 min | Redis + Memory | `factory:tokens:{limit}:{fromBlock}` |

### Cache Performance Monitoring

```bash
# Check cache statistics
curl https://yourdomain.com/api/health | jq '.cache'

# Expected output:
{
  "hits": 1500,
  "misses": 200,
  "hitRate": 0.882,  # 88.2% hit rate
  "redis": {
    "connected": true,
    "hits": 1200,
    "misses": 100,
    "hitRate": 0.923
  },
  "inMemory": {
    "hits": 300,
    "misses": 100,
    "hitRate": 0.75,
    "size": 500,
    "evictions": 10
  }
}
```

### Cache Optimization Tips

1. **Increase TTL for Static Data**: Token metadata changes infrequently
2. **Use Redis for Production**: In-memory cache is lost on restart
3. **Monitor Hit Rate**: Aim for >80% hit rate
4. **Cache Batch Requests**: Cache results of batch market data requests
5. **Invalidate Smartly**: Clear cache when data changes

---

## 🔑 3. API Keys Configuration

### Why It Matters
- **Better Market Data**: More sources = more comprehensive data
- **Higher Rate Limits**: Paid APIs have higher limits
- **Better Coverage**: Different APIs have different token coverage
- **Fallback**: Multiple APIs provide redundancy

### Market Data API Keys

#### 1. Birdeye.so (⭐ Recommended)
- **Free Tier**: 60,000 credits/month
- **Coverage**: Excellent for Base tokens
- **Sign Up**: [https://birdeye.so/user/profile](https://birdeye.so/user/profile)
- **Configuration**:
  ```bash
  BIRDEYE_API_KEY=your_api_key_here
  ```

#### 2. CoinGecko
- **Free Tier**: Available without key (rate limited)
- **Pro Tier**: Higher rate limits
- **Sign Up**: [https://www.coingecko.com/en/api/pricing](https://www.coingecko.com/en/api/pricing)
- **Configuration**:
  ```bash
  COINGECKO_API_KEY=your_api_key_here
  ```

#### 3. CoinMarketCap
- **Free Tier**: 10,000 calls/month
- **Sign Up**: [https://pro.coinmarketcap.com/signup](https://pro.coinmarketcap.com/signup)
- **Configuration**:
  ```bash
  COINMARKETCAP_API_KEY=your_api_key_here
  ```

### RPC Provider API Keys

#### Alchemy
```bash
ALCHEMY_API_KEY=your_alchemy_api_key
```

#### Infura
```bash
INFURA_API_KEY=your_infura_api_key
```

#### QuickNode
```bash
QUICKNODE_API_KEY=your_quicknode_api_key
```

### API Key Management Features

✅ **Automatic Validation**: Keys are validated on first use
✅ **Usage Tracking**: Monitor how often each key is used
✅ **Error Monitoring**: Track failed requests per key
✅ **Recommendations**: Get suggestions for missing or invalid keys
✅ **Fallback**: System continues working even if some keys are invalid

### Checking API Key Status

```bash
# Check all API key statuses
curl https://yourdomain.com/api/health | jq '.dataSources'

# Expected output:
{
  "BIRDEYE": {
    "available": true,
    "reason": null
  },
  "COINGECKO": {
    "available": true,
    "reason": null
  },
  "COINMARKETCAP": {
    "available": false,
    "reason": "Missing COINMARKETCAP_API_KEY environment variable"
  }
}
```

### API Key Best Practices

1. **Use Environment Variables**: Never hardcode API keys
2. **Rotate Regularly**: Change keys periodically for security
3. **Monitor Usage**: Track API key usage to avoid rate limits
4. **Use Multiple Keys**: Have backup keys for critical services
5. **Secure Storage**: Use secret managers for production (AWS Secrets Manager, etc.)

---

## 🔒 4. HTTPS Configuration

### Why It Matters
- **Security**: Encrypts all communication between client and server
- **Data Integrity**: Prevents tampering with requests/responses
- **Authentication**: Protects API keys and sensitive data
- **SEO**: Required for modern web applications
- **Trust**: Users expect HTTPS on production sites

### Setup Options

#### Option A: Vercel (Automatic HTTPS)
✅ **No configuration needed** - Vercel automatically provides HTTPS

#### Option B: Nginx with Let's Encrypt

1. **Install Certbot**:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. **Obtain Certificate**:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

3. **Auto-Renew**:
   ```bash
   sudo certbot renew --dry-run
   ```

#### Option C: Docker with Traefik

1. **docker-compose.yml**:
   ```yaml
   services:
     traefik:
       image: traefik:v2.10
       command:
         - --certificatesresolvers.myresolver.acme.tlschallenge=true
         - --certificatesresolvers.myresolver.acme.email=your@email.com
       ports:
         - "80:80"
         - "443:443"
   ```

### Enforce HTTPS in Next.js

```bash
# In .env.local
ENFORCE_HTTPS=true
```

### Security Headers (Automatically Added)

The system automatically adds these security headers:

- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-Content-Type-Options: nosniff` - Prevent MIME type sniffing
- `X-XSS-Protection: 1; mode=block` - Enable XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Control referrer info
- `Permissions-Policy` - Restrict browser features
- `Content-Security-Policy` - Prevent XSS attacks
- `Strict-Transport-Security` - Enforce HTTPS
- `Cross-Origin-Embedder-Policy: require-corp` - Prevent embedding
- `Cross-Origin-Opener-Policy: same-origin` - Prevent cross-origin windows
- `Cross-Origin-Resource-Policy: same-origin` - Prevent cross-origin resources

### Testing HTTPS Configuration

```bash
# Check if HTTPS is enforced
curl -I http://yourdomain.com
# Should redirect to HTTPS (301 or 308)

# Check security headers
curl -I https://yourdomain.com
# Should show all security headers

# Test in browser
# Open dev tools → Network tab → Check response headers
```

---

## 📊 5. Monitoring Setup

### Why It Matters
- **Proactive Issue Detection**: Catch problems before users do
- **Performance Tracking**: Identify slow endpoints and bottlenecks
- **Capacity Planning**: Understand resource usage patterns
- **SLA Compliance**: Ensure service level agreements are met
- **Debugging**: Quickly identify and resolve issues

### Built-in Monitoring Features

✅ **RPC Performance**: Latency, success rate, errors per provider
✅ **Cache Performance**: Hit rate, latency, size, evictions
✅ **API Performance**: Success rate, latency, errors per endpoint
✅ **Token Discovery**: Discovery time, tokens found, data sources
✅ **System Metrics**: Memory usage, CPU usage, uptime
✅ **Alert System**: Automatic alerts for issues

### Health Check Endpoint

```bash
# Check overall health
curl https://yourdomain.com/api/health

# Check specific components
curl https://yourdomain.com/api/health | jq '.rpc'
curl https://yourdomain.com/api/health | jq '.cache'
curl https://yourdomain.com/api/health | jq '.api'
```

### Monitoring Configuration

```bash
# Enable monitoring
MONITORING_ENABLED=true

# Monitoring interval (default: 60000ms = 1 minute)
MONITORING_INTERVAL=60000

# Maximum history size (default: 1000)
MONITORING_MAX_HISTORY=1000
```

### Alert Thresholds (Configurable)

```typescript
// In lib/monitoring.ts
alertThresholds: {
  rpcLatency: 5000,      // Alert if avg RPC latency > 5s
  cacheHitRate: 0.7,     // Alert if cache hit rate < 70%
  apiSuccessRate: 0.8,  // Alert if API success rate < 80%
  tokenDiscoveryTime: 10000, // Alert if discovery > 10s
}
```

### External Monitoring Integration

#### Prometheus + Grafana

1. **Add Prometheus endpoint**:
   ```typescript
   // app/api/metrics/route.ts
   import { getMonitoringMetrics } from "@/lib/monitoring";
   
   export async function GET() {
     const metrics = getMonitoringMetrics();
     // Convert to Prometheus format
     return new Response(prometheusMetrics, {
       headers: { "Content-Type": "text/plain" },
     });
   }
   ```

2. **Configure Prometheus**:
   ```yaml
   scrape_configs:
     - job_name: 'b20-scanner'
       scrape_interval: 15s
       static_configs:
         - targets: ['your-server:3000']
   ```

#### Sentry (Error Tracking)

1. **Install Sentry**:
   ```bash
   npm install @sentry/nextjs
   ```

2. **Configure**:
   ```bash
   SENTRY_DSN=your_sentry_dsn
   NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
   ```

#### Logging

1. **Winston Logger**:
   ```bash
   npm install winston winston-daily-rotate-file
   ```

2. **Configure**:
   ```typescript
   // lib/logger.ts
   import winston from "winston";
   import DailyRotateFile from "winston-daily-rotate-file";
   
   const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || "info",
     transports: [
       new winston.transports.Console(),
       new DailyRotateFile({
         filename: "logs/application-%DATE%.log",
         maxSize: "20m",
         maxFiles: "14d",
       }),
     ],
   });
   ```

### Monitoring Dashboard

Create a dashboard showing:
- **RPC Status**: Health, latency, success rate per provider
- **Cache Status**: Hit rate, size, evictions
- **API Status**: Success rate, latency per endpoint
- **Token Discovery**: Discovery time, tokens found, data sources
- **System Status**: Memory, CPU, uptime
- **Alerts**: Active alerts, resolved alerts

---

## 🎯 Quick Configuration Examples

### Minimal Production Configuration

```bash
# .env.local
NODE_ENV=production

# RPC (Required)
BASE_RPC_URL=https://mainnet.base.org,https://base-mainnet.public.blastapi.io

# Security
ENFORCE_HTTPS=true
RATE_LIMITING_ENABLED=true

# Monitoring
MONITORING_ENABLED=true
```

### Recommended Production Configuration

```bash
# .env.local
NODE_ENV=production
PORT=3000

# RPC (Multiple providers for redundancy)
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY,https://base-mainnet.infura.io/v3/YOUR_INFURA_KEY,https://mainnet.base.org

# Redis Cache (Upstash for serverless)
UPSTASH_REDIS_REST_URL=https://YOUR_INSTANCE.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN

# API Keys (For comprehensive market data)
BIRDEYE_API_KEY=your_birdeye_key
COINGECKO_API_KEY=your_coingecko_key
COINMARKETCAP_API_KEY=your_coinmarketcap_key

# Security
ENFORCE_HTTPS=true
API_KEY_PROTECTION_ENABLED=true
RATE_LIMITING_ENABLED=true
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
MONITORING_ENABLED=true
MONITORING_INTERVAL=60000
LOG_LEVEL=info

# Optional: Your own API keys
API_KEY=your_secure_api_key
B20_SCANNER_API_KEY=your_secure_api_key
```

### High-Performance Configuration

```bash
# .env.local
NODE_ENV=production

# Multiple RPC providers with load balancing
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY,https://base-mainnet.infura.io/v3/YOUR_INFURA_KEY,https://YOUR_QUICKNODE_ENDPOINT,https://base-mainnet.public.blastapi.io,https://mainnet.base.org

# Redis with longer TTLs
UPSTASH_REDIS_REST_URL=https://YOUR_INSTANCE.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN

# All API keys for maximum coverage
BIRDEYE_API_KEY=your_birdeye_key
COINGECKO_API_KEY=your_coingecko_key
COINMARKETCAP_API_KEY=your_coinmarketcap_key

# Strict security
ENFORCE_HTTPS=true
API_KEY_PROTECTION_ENABLED=true
RATE_LIMITING_ENABLED=true
RATE_LIMIT_WINDOW=30000
RATE_LIMIT_MAX_REQUESTS=200

# Comprehensive monitoring
MONITORING_ENABLED=true
MONITORING_INTERVAL=30000
LOG_LEVEL=debug

# Sentry for error tracking
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

---

## 📋 Implementation Checklist

### Phase 1: Basic Setup (1-2 hours)
- [ ] Create `.env.local` file
- [ ] Configure at least 2 RPC endpoints
- [ ] Enable HTTPS enforcement
- [ ] Enable basic monitoring
- [ ] Test locally with `npm run dev`

### Phase 2: Enhanced Setup (2-4 hours)
- [ ] Setup Redis cache (Upstash or self-hosted)
- [ ] Add API keys for market data
- [ ] Configure rate limiting
- [ ] Setup logging
- [ ] Test all endpoints

### Phase 3: Production Ready (1-2 days)
- [ ] Deploy to production (Vercel, Docker, etc.)
- [ ] Configure external monitoring (Prometheus, Sentry)
- [ ] Setup alerts and notifications
- [ ] Test failover scenarios
- [ ] Load test the application

### Phase 4: Optimization (Ongoing)
- [ ] Monitor performance metrics
- [ ] Optimize slow endpoints
- [ ] Add more RPC providers as needed
- [ ] Tune cache TTLs based on usage patterns
- [ ] Review and update security configuration

---

## 🚀 Deployment Commands

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy with production configuration
vercel --prod

# View logs
vercel logs
```

### Docker
```bash
# Build image
docker build -t b20-scanner .

# Run container
docker run -p 3000:3000 --env-file .env.local b20-scanner

# Docker Compose
docker-compose up -d

# View logs
docker logs b20-scanner-app
```

### Kubernetes
```bash
# Apply configuration
kubectl apply -f k8s/

# Check status
kubectl get pods

# View logs
kubectl logs deployment/b20-scanner
```

---

## 📊 Performance Expectations

### With Basic Configuration
| Metric | Expected Value |
|--------|----------------|
| Token Discovery Time | 2-5 seconds |
| Page Load Time | 3-6 seconds |
| RPC Latency | 500-2000ms |
| Cache Hit Rate | 50-70% |
| API Success Rate | 80-90% |

### With Recommended Configuration
| Metric | Expected Value |
|--------|----------------|
| Token Discovery Time | 1-2 seconds |
| Page Load Time | 2-4 seconds |
| RPC Latency | 200-1000ms |
| Cache Hit Rate | 70-90% |
| API Success Rate | 90-95% |

### With High-Performance Configuration
| Metric | Expected Value |
|--------|----------------|
| Token Discovery Time | <1 second |
| Page Load Time | 1-3 seconds |
| RPC Latency | 100-500ms |
| Cache Hit Rate | 80-95% |
| API Success Rate | 95-99% |

---

## 🔍 Troubleshooting Quick Reference

### Issue: No Tokens Displayed
**Solution**:
1. Check RPC configuration: `curl /api/health | jq '.rpc'`
2. Test factory endpoint: `curl /api/factory-tokens?limit=10`
3. Add more RPC endpoints

### Issue: Slow Performance
**Solution**:
1. Check cache hit rate: `curl /api/health | jq '.cache.hitRate'`
2. Add Redis cache
3. Add more RPC endpoints
4. Add API keys for market data

### Issue: Rate Limiting Errors
**Solution**:
1. Check rate limit status: `curl /api/health | jq '.rpc.providers'`
2. Add more RPC endpoints
3. Increase rate limit thresholds
4. Configure API key rotation

### Issue: API Key Errors
**Solution**:
1. Validate API keys: `curl /api/health | jq '.dataSources'`
2. Update expired keys
3. Fix configuration errors
4. Add missing API keys

### Issue: HTTPS Errors
**Solution**:
1. Verify HTTPS: `curl -I https://yourdomain.com`
2. Check security headers: `curl -I https://yourdomain.com`
3. Configure valid SSL certificates
4. Enforce HTTPS in configuration

---

## 🎓 Best Practices Summary

### Security
✅ Use HTTPS everywhere
✅ Keep API keys secret (environment variables)
✅ Validate all inputs
✅ Implement rate limiting
✅ Monitor for anomalies

### Performance
✅ Use multiple RPC endpoints
✅ Configure Redis cache
✅ Add API keys for market data
✅ Batch requests when possible
✅ Lazy load data

### Reliability
✅ Implement automatic failover
✅ Use multiple data sources
✅ Handle errors gracefully
✅ Monitor health
✅ Test failover scenarios

### Monitoring
✅ Enable built-in monitoring
✅ Setup external monitoring
✅ Configure alerts
✅ Review metrics regularly
✅ Optimize based on data

---

## 📚 Resources

- **Documentation**: [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)
- **Integration Guide**: [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)
- **API Documentation**: [DOCS_DATA_SOURCES.md](./DOCS_DATA_SOURCES.md)
- **Health Endpoint**: `/api/health`
- **Monitoring**: Built into the application

---

## 🎉 Conclusion

By implementing these production recommendations, your B20 Scanner will be:

✅ **Fast**: Sub-second token discovery with caching
✅ **Reliable**: Automatic failover with multiple RPCs and data sources
✅ **Secure**: HTTPS enforcement with comprehensive security headers
✅ **Scalable**: Ready to handle increased traffic
✅ **Observable**: Comprehensive monitoring for quick issue resolution
✅ **Maintainable**: Clean configuration with sensible defaults

**Your B20 Scanner is now production-ready!** 🚀

---

## 📞 Need Help?

1. **Check the health endpoint**: `/api/health`
2. **Review logs**: Application and server logs
3. **Consult documentation**: [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)
4. **Test individual components**: Use the provided test scripts
5. **Community support**: Join the Base community

---

*Last updated: July 22, 2026*
*Version: 2.0.0*
