# 🚀 B20 Scanner - Production Setup Guide

## Overview

This guide provides comprehensive instructions for deploying B20 Scanner to production with optimal performance, security, and reliability.

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Environment Configuration](#-environment-configuration)
3. [Multiple RPC Endpoints Setup](#-multiple-rpc-endpoints-setup)
4. [Redis Cache Configuration](#-redis-cache-configuration)
5. [API Keys Configuration](#-api-keys-configuration)
6. [HTTPS Configuration](#-https-configuration)
7. [Monitoring Setup](#-monitoring-setup)
8. [Security Configuration](#-security-configuration)
9. [Deployment Options](#-deployment-options)
10. [Performance Optimization](#-performance-optimization)
11. [Maintenance & Monitoring](#-maintenance--monitoring)
12. [Troubleshooting](#-troubleshooting)

---

## 📋 Prerequisites

### Required Tools
- Node.js 18+ (LTS recommended)
- npm or yarn
- Git
- Docker (optional, for containerized deployment)
- A code editor (VS Code recommended)

### Required Accounts
- [Vercel](https://vercel.com/) (recommended for hosting)
- [Upstash](https://upstash.com/) (for Redis cache)
- [Alchemy](https://www.alchemy.com/) or other RPC provider (recommended)
- [Birdeye.so](https://birdeye.so/) (optional, for market data)
- [CoinGecko](https://www.coingecko.com/) (optional, for market data)
- [CoinMarketCap](https://pro.coinmarketcap.com/) (optional, for market data)

---

## 🔧 Environment Configuration

### 1. Create Environment Files

Create a `.env.local` file in your project root:

```bash
# Copy the example file
cp .env.example .env.local
```

### 2. Essential Configuration

#### Basic Configuration
```bash
# Application
NODE_ENV=production
PORT=3000

# Base RPC (Required)
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY,https://base-mainnet.public.blastapi.io,https://mainnet.base.org
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

#### Redis Cache (Recommended)
```bash
# Upstash Redis (Serverless)
UPSTASH_REDIS_REST_URL=https://YOUR_INSTANCE_ID.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_REDIS_TOKEN

# OR Traditional Redis
REDIS_URL=redis://localhost:6379
```

#### API Keys (Recommended)
```bash
# Market Data APIs
BIRDEYE_API_KEY=your_birdeye_api_key
COINGECKO_API_KEY=your_coingecko_api_key
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key

# RPC Providers (if not using BASE_RPC_URL)
ALCHEMY_API_KEY=your_alchemy_api_key
INFURA_API_KEY=your_infura_api_key
QUICKNODE_API_KEY=your_quicknode_api_key
```

#### Security Configuration
```bash
# Security
ENFORCE_HTTPS=true
API_KEY_PROTECTION_ENABLED=true
RATE_LIMITING_ENABLED=true
MONITORING_ENABLED=true

# Optional: Your own API key for the scanner
API_KEY=your_secure_api_key
B20_SCANNER_API_KEY=your_secure_api_key
```

---

## 🌐 Multiple RPC Endpoints Setup

### Why Multiple RPCs?
- **Redundancy**: If one RPC fails, others can take over
- **Load Balancing**: Distribute requests across multiple providers
- **Rate Limit Avoidance**: Prevent hitting rate limits on a single provider
- **Performance**: Different providers may have different response times

### Recommended RPC Providers

#### Free Tier (Good for Development & Small Projects)
1. **Base Public RPC**
   ```
   https://mainnet.base.org
   ```

2. **BlastAPI** (Free, no signup required)
   ```
   https://base-mainnet.public.blastapi.io
   ```

3. **Ankr** (Free, no signup required)
   ```
   https://base-mainnet.rpc.ankr.com
   ```

4. **DRPC** (Free, no signup required)
   ```
   https://base.drpc.org
   ```

#### Paid Tier (Recommended for Production)
1. **Alchemy**
   - URL: `https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
   - Free tier: 300M compute units/month
   - Sign up: [https://www.alchemy.com/](https://www.alchemy.com/)

2. **Infura**
   - URL: `https://base-mainnet.infura.io/v3/YOUR_API_KEY`
   - Free tier: 100,000 requests/day
   - Sign up: [https://infura.io/](https://infura.io/)

3. **QuickNode**
   - URL: `https://YOUR_ENDPOINT.quiknode.pro/YOUR_API_KEY/`
   - Free tier available
   - Sign up: [https://www.quicknode.com/](https://www.quicknode.com/)

4. **Chainstack**
   - URL: `https://base-mainnet.core.chainstack.com/YOUR_API_KEY`
   - Free tier available
   - Sign up: [https://chainstack.com/](https://chainstack.com/)

### Configuration Example

```bash
# Multiple RPCs with automatic failover
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY,https://base-mainnet.public.blastapi.io,https://base-mainnet.rpc.ankr.com,https://mainnet.base.org
```

### RPC Configuration in Code

The system automatically:
1. **Load balances** requests across all configured RPCs
2. **Fails over** to the next RPC if one fails
3. **Tracks performance** and prefers faster RPCs
4. **Resets failed RPCs** after a cooldown period

---

## 🗃️ Redis Cache Configuration

### Why Redis Cache?
- **Survive server restarts**: Data persists across deployments
- **Share cache between instances**: Useful for serverless deployments
- **Reduce RPC calls**: Cache token metadata, market data, etc.
- **Improve performance**: Faster response times for cached data

### Option 1: Upstash Redis (Recommended for Vercel)

1. **Sign up for Upstash**: [https://upstash.com/](https://upstash.com/)
2. **Create a Redis database**
3. **Get your credentials**
4. **Configure in `.env.local`**:

```bash
UPSTASH_REDIS_REST_URL=https://YOUR_INSTANCE_ID.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_REDIS_TOKEN
```

### Option 2: Self-Hosted Redis

1. **Install Redis**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # macOS
   brew install redis
   
   # Docker
   docker run --name redis -p 6379:6379 -d redis
   ```

2. **Configure in `.env.local`**:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

3. **Optional: Redis with password**:
   ```bash
   REDIS_URL=redis://:password@localhost:6379
   ```

### Cache Configuration

The system caches different types of data with different TTLs:

| Data Type | TTL | Description |
|-----------|-----|-------------|
| Token Metadata | 5 minutes | Name, symbol, decimals, totalSupply |
| Market Data | 1 minute | Price, volume, market cap |
| Block Timestamps | 2 minutes | Block timestamp lookups |
| Factory Tokens | 5 minutes | Tokens from factory contract |
| RPC Metrics | 1 minute | RPC performance metrics |

### Cache Statistics

You can check cache performance at:
```bash
GET /api/health
```

Look for the `cache` section in the response.

---

## 🔑 API Keys Configuration

### Market Data API Keys

#### 1. Birdeye.so (Recommended)
- **Free tier**: 60,000 credits/month
- **Coverage**: Excellent for Base tokens
- **Sign up**: [https://birdeye.so/user/profile](https://birdeye.so/user/profile)
- **Configuration**:
  ```bash
  BIRDEYE_API_KEY=your_api_key_here
  ```

#### 2. CoinGecko
- **Free tier**: Available without key (rate limited)
- **Pro tier**: Higher rate limits
- **Sign up**: [https://www.coingecko.com/en/api/pricing](https://www.coingecko.com/en/api/pricing)
- **Configuration**:
  ```bash
  COINGECKO_API_KEY=your_api_key_here
  ```

#### 3. CoinMarketCap
- **Free tier**: 10,000 calls/month
- **Sign up**: [https://pro.coinmarketcap.com/signup](https://pro.coinmarketcap.com/signup)
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

### API Key Management

The system provides:
- **Automatic validation** of API keys on startup
- **Usage tracking** for each API key
- **Error monitoring** for failed requests
- **Recommendations** for missing or invalid keys

Check API key status:
```bash
GET /api/health
```

---

## 🔒 HTTPS Configuration

### Why HTTPS?
- **Security**: Encrypts all communication
- **Data integrity**: Prevents tampering
- **Authentication**: Protects API keys and sensitive data
- **SEO**: Required for modern web applications

### Option 1: Vercel (Automatic HTTPS)

Vercel automatically provides HTTPS for all deployments. No additional configuration needed.

### Option 2: Self-Hosted with Nginx

1. **Install Certbot** (Let's Encrypt):
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. **Obtain SSL Certificate**:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

3. **Nginx Configuration**:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       return 301 https://$host$request_uri;
   }
   
   server {
       listen 443 ssl;
       server_name yourdomain.com;
       
       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
       
       # SSL Configuration
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_prefer_server_ciphers on;
       ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
       ssl_session_timeout 1d;
       ssl_session_cache shared:SSL:50m;
       ssl_stapling on;
       ssl_stapling_verify on;
       
       # Proxy to Next.js
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Auto-renew certificates**:
   ```bash
   sudo certbot renew --dry-run
   ```

### Option 3: Docker with Traefik

1. **docker-compose.yml**:
   ```yaml
   version: '3'
   
   services:
     traefik:
       image: traefik:v2.10
       command:
         - --api.insecure=true
         - --providers.docker
         - --entrypoints.web.address=:80
         - --entrypoints.websecure.address=:443
         - --certificatesresolvers.myresolver.acme.tlschallenge=true
         - --certificatesresolvers.myresolver.acme.email=your@email.com
         - --certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json
       ports:
         - "80:80"
         - "443:443"
         - "8080:8080" # Dashboard
       volumes:
         - /var/run/docker.sock:/var/run/docker.sock
         - ./letsencrypt:/letsencrypt
       
     app:
       image: your-b20-scanner-image
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.app.rule=Host(`yourdomain.com`)"
         - "traefik.http.routers.app.entrypoints=websecure"
         - "traefik.http.routers.app.tls.certresolver=myresolver"
         - "traefik.http.services.app.loadbalancer.server.port=3000"
   ```

### Enforce HTTPS in Next.js

The system automatically enforces HTTPS in production. Configure in `.env.local`:

```bash
ENFORCE_HTTPS=true
```

---

## 📊 Monitoring Setup

### Built-in Monitoring

The system includes comprehensive monitoring out of the box:

1. **RPC Performance**: Tracks latency, success rate, and errors
2. **Cache Performance**: Tracks hit rate, latency, and usage
3. **API Performance**: Tracks success rate and latency
4. **Token Discovery**: Tracks discovery time and sources
5. **System Metrics**: Tracks memory usage and uptime

### Health Check Endpoint

```bash
GET /api/health
```

Returns:
- Overall health status
- Individual component health
- Performance metrics
- Active alerts
- Recommendations

### Monitoring Configuration

```bash
# Enable monitoring
MONITORING_ENABLED=true

# Monitoring interval (default: 60000ms = 1 minute)
MONITORING_INTERVAL=60000

# Maximum history size (default: 1000)
MONITORING_MAX_HISTORY=1000
```

### Alert Thresholds

Configure in `lib/monitoring.ts`:

```typescript
alertThresholds: {
  rpcLatency: 5000, // 5 seconds
  cacheHitRate: 0.7, // 70%
  apiSuccessRate: 0.8, // 80%
  tokenDiscoveryTime: 10000, // 10 seconds
}
```

### External Monitoring Integration

#### 1. Prometheus + Grafana

1. **Install Prometheus**:
   ```bash
   docker run -d -p 9090:9090 -v /path/to/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
   ```

2. **prometheus.yml**:
   ```yaml
   scrape_configs:
     - job_name: 'b20-scanner'
       scrape_interval: 15s
       static_configs:
         - targets: ['your-server-ip:3000']
   ```

3. **Install Grafana**:
   ```bash
   docker run -d -p 3000:3000 grafana/grafana
   ```

4. **Create a custom endpoint for Prometheus**:
   ```typescript
   // app/api/metrics/route.ts
   import { getMonitoringMetrics } from "@/lib/monitoring";
   
   export async function GET() {
     const metrics = getMonitoringMetrics();
     
     // Convert to Prometheus format
     let prometheusMetrics = "";
     
     // RPC Metrics
     prometheusMetrics += `# HELP b20_rpc_requests_total Total RPC requests\n`;
     prometheusMetrics += `# TYPE b20_rpc_requests_total counter\n`;
     prometheusMetrics += `b20_rpc_requests_total ${metrics.rpc.totalRequests}\n`;
     
     prometheusMetrics += `# HELP b20_rpc_successful_requests_total Successful RPC requests\n`;
     prometheusMetrics += `# TYPE b20_rpc_successful_requests_total counter\n`;
     prometheusMetrics += `b20_rpc_successful_requests_total ${metrics.rpc.successfulRequests}\n`;
     
     prometheusMetrics += `# HELP b20_rpc_latency_ms Average RPC latency in ms\n`;
     prometheusMetrics += `# TYPE b20_rpc_latency_ms gauge\n`;
     prometheusMetrics += `b20_rpc_latency_ms ${metrics.rpc.averageLatency}\n`;
     
     // Cache Metrics
     prometheusMetrics += `# HELP b20_cache_hits_total Cache hits\n`;
     prometheusMetrics += `# TYPE b20_cache_hits_total counter\n`;
     prometheusMetrics += `b20_cache_hits_total ${metrics.cache.hits}\n`;
     
     prometheusMetrics += `# HELP b20_cache_misses_total Cache misses\n`;
     prometheusMetrics += `# TYPE b20_cache_misses_total counter\n`;
     prometheusMetrics += `b20_cache_misses_total ${metrics.cache.misses}\n`;
     
     prometheusMetrics += `# HELP b20_cache_hit_rate Cache hit rate\n`;
     prometheusMetrics += `# TYPE b20_cache_hit_rate gauge\n`;
     prometheusMetrics += `b20_cache_hit_rate ${metrics.cache.hitRate}\n`;
     
     return new Response(prometheusMetrics, {
       headers: { "Content-Type": "text/plain" },
     });
   }
   ```

#### 2. Sentry (Error Tracking)

1. **Install Sentry SDK**:
   ```bash
   npm install @sentry/nextjs
   ```

2. **Configure Sentry**:
   ```typescript
   // lib/sentry.ts
   import * as Sentry from "@sentry/nextjs";
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     tracesSampleRate: 1.0,
     environment: process.env.NODE_ENV,
     release: process.env.npm_package_version,
   });
   
   export default Sentry;
   ```

3. **Add to `_app.tsx`**:
   ```typescript
   import { useEffect } from "react";
   import * as Sentry from "@sentry/nextjs";
   
   function MyApp({ Component, pageProps }: AppProps) {
     useEffect(() => {
       if (process.env.NODE_ENV === "production") {
         Sentry.captureException;
       }
     }, []);
     
     return <Component {...pageProps} />;
   }
   ```

4. **Configure in `.env.local`**:
   ```bash
   SENTRY_DSN=your_sentry_dsn
   NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
   ```

#### 3. Logging

1. **Winston Logger**:
   ```bash
   npm install winston winston-daily-rotate-file
   ```

2. **Logger Configuration**:
   ```typescript
   // lib/logger.ts
   import winston from "winston";
   import DailyRotateFile from "winston-daily-rotate-file";
   
   const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || "info",
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.json()
     ),
     transports: [
       new winston.transports.Console({
         format: winston.format.combine(
           winston.format.colorize(),
           winston.format.simple()
         ),
       }),
       new DailyRotateFile({
         filename: "logs/application-%DATE%.log",
         datePattern: "YYYY-MM-DD",
         maxSize: "20m",
         maxFiles: "14d",
       }),
     ],
     exceptionHandlers: [
       new DailyRotateFile({
         filename: "logs/exceptions-%DATE%.log",
         datePattern: "YYYY-MM-DD",
         maxSize: "20m",
         maxFiles: "14d",
       }),
     ],
     rejectionHandlers: [
       new DailyRotateFile({
         filename: "logs/rejections-%DATE%.log",
         datePattern: "YYYY-MM-DD",
         maxSize: "20m",
         maxFiles: "14d",
       }),
     ],
   });
   
   export default logger;
   ```

3. **Usage**:
   ```typescript
   import logger from "@/lib/logger";
   
   logger.info("Application started", { version: "1.0.0" });
   logger.error("Error occurred", { error: error.message, stack: error.stack });
   ```

---

## 🔐 Security Configuration

### Security Headers

The system automatically adds these security headers:
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-Content-Type-Options: nosniff` - Prevent MIME type sniffing
- `X-XSS-Protection: 1; mode=block` - Enable XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Control referrer information
- `Permissions-Policy` - Restrict browser features
- `Content-Security-Policy` - Prevent XSS attacks
- `Strict-Transport-Security` - Enforce HTTPS
- `Cross-Origin-Embedder-Policy: require-corp` - Prevent embedding
- `Cross-Origin-Opener-Policy: same-origin` - Prevent cross-origin window access
- `Cross-Origin-Resource-Policy: same-origin` - Prevent cross-origin resource loading

### Rate Limiting

Configure in `.env.local`:

```bash
RATE_LIMITING_ENABLED=true
RATE_LIMIT_WINDOW=60000  # 1 minute
RATE_LIMIT_MAX_REQUESTS=100  # requests per window
```

### API Key Protection

1. **Enable API Key Protection**:
   ```bash
   API_KEY_PROTECTION_ENABLED=true
   API_KEY_HEADER=X-API-Key
   ```

2. **Set Your API Keys**:
   ```bash
   API_KEY=your_secure_api_key
   B20_SCANNER_API_KEY=your_secure_api_key
   ```

3. **Protect Endpoints**:
   Add endpoints to `API_KEY_REQUIRED_PATHS` in `middleware.ts`:
   ```typescript
   const API_KEY_REQUIRED_PATHS = [
     "/api/private/*",
     "/api/admin/*",
   ];
   ```

### CORS Configuration

Configure in `.env.local` or in `lib/security.ts`:

```typescript
corsOrigins: [
  "http://localhost:3000",
  "https://yourdomain.com",
  "https://*.yourdomain.com",
],
corsMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
corsHeaders: ["Content-Type", "Authorization", "X-API-Key"],
corsCredentials: true,
corsMaxAge: 86400, // 24 hours
```

### Input Sanitization

Enabled by default. Configure in `.env.local`:

```bash
SANITIZE_INPUTS=true
```

---

## 🚀 Deployment Options

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Configure Environment Variables**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all required environment variables

4. **Configure Redis**:
   - Use Upstash Redis (recommended for Vercel)
   - Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

5. **Configure RPC Endpoints**:
   - Add multiple RPC URLs to `BASE_RPC_URL`

6. **Enable Monitoring**:
   - Set `MONITORING_ENABLED=true`

### Option 2: Docker

1. **Create Dockerfile**:
   ```dockerfile
   # Use official Node.js image
   FROM node:18-alpine
   
   # Set working directory
   WORKDIR /app
   
   # Copy package files
   COPY package*.json ./
   
   # Install dependencies
   RUN npm ci --only=production
   
   # Copy application files
   COPY . .
   
   # Build the application
   RUN npm run build
   
   # Expose port
   EXPOSE 3000
   
   # Set environment variables
   ENV NODE_ENV=production
   ENV PORT=3000
   
   # Start the application
   CMD ["npm", "start"]
   ```

2. **Create docker-compose.yml**:
   ```yaml
   version: '3.8'
   
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY},https://mainnet.base.org
         - UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}
         - UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}
         - BIRDEYE_API_KEY=${BIRDEYE_API_KEY}
         - ENFORCE_HTTPS=false  # HTTPS handled by reverse proxy
       restart: unless-stopped
       
     redis:
       image: redis:alpine
       ports:
         - "6379:6379"
       volumes:
         - redis_data:/data
       restart: unless-stopped
       
   volumes:
     redis_data:
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

### Option 3: Kubernetes

1. **Create deployment.yaml**:
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: b20-scanner
   spec:
     replicas: 2
     selector:
       matchLabels:
         app: b20-scanner
     template:
       metadata:
         labels:
           app: b20-scanner
       spec:
         containers:
         - name: b20-scanner
           image: your-registry/b20-scanner:latest
           ports:
           - containerPort: 3000
           env:
           - name: NODE_ENV
             value: "production"
           - name: BASE_RPC_URL
             value: "https://base-mainnet.g.alchemy.com/v2/YOUR_KEY,https://mainnet.base.org"
           - name: UPSTASH_REDIS_REST_URL
             valueFrom:
               secretKeyRef:
                 name: b20-scanner-secrets
                 key: upstash-redis-url
           - name: UPSTASH_REDIS_REST_TOKEN
             valueFrom:
               secretKeyRef:
                 name: b20-scanner-secrets
                 key: upstash-redis-token
           resources:
             requests:
               memory: "512Mi"
               cpu: "500m"
             limits:
               memory: "1Gi"
               cpu: "1"
   ```

2. **Create service.yaml**:
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: b20-scanner
   spec:
     selector:
       app: b20-scanner
     ports:
     - port: 80
       targetPort: 3000
     type: LoadBalancer
   ```

3. **Create ingress.yaml** (for HTTPS):
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: b20-scanner-ingress
     annotations:
       kubernetes.io/ingress.class: "nginx"
       cert-manager.io/cluster-issuer: "letsencrypt-prod"
   spec:
     tls:
     - hosts:
       - yourdomain.com
       secretName: b20-scanner-tls
     rules:
     - host: yourdomain.com
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: b20-scanner
               port:
                 number: 80
   ```

4. **Deploy**:
   ```bash
   kubectl apply -f deployment.yaml
   kubectl apply -f service.yaml
   kubectl apply -f ingress.yaml
   ```

### Option 4: Serverless (AWS Lambda, etc.)

The application is compatible with serverless deployments. Use the Vercel adapter or similar for other platforms.

---

## ⚡ Performance Optimization

### 1. Caching Strategies

#### Token Metadata Caching
- **TTL**: 5 minutes
- **Cache Key**: `meta:{address}`
- **Storage**: Redis + In-Memory

#### Market Data Caching
- **TTL**: 1 minute
- **Cache Key**: `mkt:{address}`
- **Storage**: Redis + In-Memory

#### Block Timestamp Caching
- **TTL**: 2 minutes
- **Cache Key**: `blk:{blockNumber}`
- **Storage**: Redis + In-Memory

### 2. RPC Optimization

#### Load Balancing
- Requests are automatically distributed across all configured RPCs
- Faster RPCs get more requests
- Failed RPCs are temporarily removed from rotation

#### Failover
- If an RPC fails, the system automatically tries the next one
- Failed RPCs are retried after a cooldown period

#### Connection Pooling
- Reuse RPC connections to reduce overhead
- Connection pooling is handled by ethers.js

### 3. Data Fetching Optimization

#### Batch Requests
- Use `/api/market/batch` for multiple tokens
- Reduces number of API calls
- More efficient than individual requests

#### Parallel Requests
- Market data requests are made in parallel
- Uses concurrency limits to avoid rate limits

#### Lazy Loading
- Load data on-demand rather than all at once
- Implement infinite scroll for token lists

### 4. Code Optimization

#### Bundle Optimization
- Use Next.js automatic code splitting
- Lazy load non-critical components
- Remove unused dependencies

#### Image Optimization
- Use Next.js Image component for automatic optimization
- Serve images in modern formats (WebP, AVIF)

#### Font Optimization
- Use Next.js Font component for automatic optimization
- Self-host fonts to avoid external requests

### 5. Database Optimization (if using)

#### Indexing
- Create indexes for frequently queried fields
- Use composite indexes for complex queries

#### Query Optimization
- Use pagination for large datasets
- Limit result sets
- Use projection to return only needed fields

---

## 🔧 Maintenance & Monitoring

### Daily Maintenance Tasks

1. **Check Health Status**:
   ```bash
   curl https://yourdomain.com/api/health
   ```

2. **Monitor Logs**:
   ```bash
   # Docker
   docker logs b20-scanner-app
   
   # Kubernetes
   kubectl logs deployment/b20-scanner
   
   # Vercel
   vercel logs
   ```

3. **Check API Key Usage**:
   - Monitor rate limits
   - Rotate keys if compromised
   - Update expired keys

4. **Update Dependencies**:
   ```bash
   npm outdated
   npm update
   ```

### Weekly Maintenance Tasks

1. **Review Monitoring Data**:
   - Check for performance degradation
   - Identify slow RPC providers
   - Monitor cache hit rates

2. **Test Failover**:
   - Temporarily disable primary RPC
   - Verify failover to secondary RPCs
   - Test Redis failover (if applicable)

3. **Backup Data**:
   - Backup Redis data
   - Backup application logs
   - Backup configuration files

### Monthly Maintenance Tasks

1. **Security Audit**:
   - Review security headers
   - Check for vulnerabilities in dependencies
   - Update API keys

2. **Performance Review**:
   - Analyze monitoring data
   - Identify bottlenecks
   - Optimize slow endpoints

3. **Capacity Planning**:
   - Review resource usage
   - Plan for scaling if needed
   - Upgrade resources if necessary

### Monitoring Dashboard

Create a monitoring dashboard with:
- **RPC Performance**: Latency, success rate, errors
- **Cache Performance**: Hit rate, latency, size
- **API Performance**: Success rate, latency, errors
- **Token Discovery**: Discovery time, tokens found, data sources
- **System Metrics**: Memory usage, CPU usage, uptime
- **Alerts**: Active alerts, resolved alerts

---

## 🐛 Troubleshooting

### Common Issues

#### 1. No Tokens Displayed

**Symptoms**: Empty token list, loading spinner continues indefinitely

**Troubleshooting Steps**:

1. **Check Health Endpoint**:
   ```bash
   curl https://yourdomain.com/api/health
   ```

2. **Test Factory Endpoint**:
   ```bash
   curl https://yourdomain.com/api/factory-tokens?limit=10
   ```

3. **Test Third-Party Endpoint**:
   ```bash
   curl https://yourdomain.com/api/thirdparty-tokens?limit=10
   ```

4. **Check RPC Configuration**:
   - Verify `BASE_RPC_URL` is configured
   - Test RPC endpoints manually

5. **Check Console Logs**:
   - Look for errors in browser console
   - Check server logs for RPC errors

**Solutions**:
- Configure valid RPC endpoints
- Add API keys for third-party data sources
- Check network connectivity

#### 2. Slow Performance

**Symptoms**: Long loading times, slow API responses

**Troubleshooting Steps**:

1. **Check RPC Latency**:
   ```bash
   curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/api/health
   ```

2. **Check Cache Hit Rate**:
   ```bash
   curl https://yourdomain.com/api/health | jq '.cache.hitRate'
   ```

3. **Check Rate Limits**:
   - Verify you're not hitting RPC rate limits
   - Check API key rate limits

4. **Profile Requests**:
   - Use browser dev tools to identify slow requests
   - Check server logs for slow queries

**Solutions**:
- Add more RPC endpoints
- Configure Redis cache
- Add API keys for market data
- Optimize slow endpoints

#### 3. Rate Limiting Errors

**Symptoms**: 429 Too Many Requests errors

**Troubleshooting Steps**:

1. **Check Rate Limit Status**:
   ```bash
   curl https://yourdomain.com/api/health | jq '.rpc'
   ```

2. **Check RPC Provider Limits**:
   - Verify you're not hitting provider rate limits
   - Check your RPC provider dashboard

3. **Check API Key Limits**:
   - Verify market data API keys are valid
   - Check API key usage statistics

**Solutions**:
- Add more RPC endpoints
- Increase rate limit thresholds
- Configure API key rotation
- Implement request queuing

#### 4. API Key Errors

**Symptoms**: 401 Unauthorized errors, missing market data

**Troubleshooting Steps**:

1. **Validate API Keys**:
   ```bash
   curl https://yourdomain.com/api/health | jq '.dataSources'
   ```

2. **Test Individual API Keys**:
   - Manually test each API key with the provider's API
   - Verify keys are not expired

3. **Check Environment Variables**:
   - Verify API keys are correctly configured
   - Check for typos in environment variable names

**Solutions**:
- Update expired API keys
- Fix configuration errors
- Add missing API keys

#### 5. HTTPS Errors

**Symptoms**: Mixed content warnings, insecure connection errors

**Troubleshooting Steps**:

1. **Verify HTTPS Configuration**:
   ```bash
   curl -v https://yourdomain.com
   ```

2. **Check Security Headers**:
   ```bash
   curl -I https://yourdomain.com
   ```

3. **Test in Browser**:
   - Open browser dev tools
   - Check Console and Network tabs for security warnings

**Solutions**:
- Configure valid SSL certificates
- Enforce HTTPS in Next.js configuration
- Fix mixed content issues

### Debug Mode

Enable debug mode for verbose logging:

```bash
DEBUG=true
LOG_LEVEL=debug
```

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Configure API keys |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Verify endpoint exists |
| 429 | Too Many Requests | Wait and retry, add more RPCs |
| 500 | Internal Server Error | Check server logs |
| 502 | Bad Gateway | Check RPC providers |
| 503 | Service Unavailable | Check server health |

---

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Ethers.js Documentation](https://docs.ethers.org/v5/)
- [Base Network Documentation](https://docs.base.org/)

---

## 🎯 Best Practices

### 1. Security Best Practices

1. **Keep API Keys Secret**:
   - Never commit API keys to version control
   - Use environment variables
   - Rotate keys regularly

2. **Use HTTPS Everywhere**:
   - Enforce HTTPS in production
   - Use HSTS headers
   - Avoid mixed content

3. **Validate All Inputs**:
   - Sanitize user inputs
   - Validate API parameters
   - Use type checking

4. **Implement Rate Limiting**:
   - Protect against DDoS attacks
   - Prevent abuse
   - Use different limits for different endpoints

5. **Monitor for Anomalies**:
   - Track failed login attempts
   - Monitor unusual request patterns
   - Set up alerts for suspicious activity

### 2. Performance Best Practices

1. **Use Caching**:
   - Cache frequently accessed data
   - Use appropriate TTLs
   - Implement cache invalidation

2. **Optimize RPC Usage**:
   - Use multiple RPC providers
   - Implement load balancing
   - Cache RPC responses

3. **Batch Requests**:
   - Use batch endpoints when possible
   - Reduce number of API calls
   - Implement request coalescing

4. **Lazy Load Data**:
   - Load data on-demand
   - Implement pagination
   - Use infinite scroll

5. **Monitor Performance**:
   - Track response times
   - Identify slow endpoints
   - Optimize bottlenecks

### 3. Reliability Best Practices

1. **Implement Fallbacks**:
   - Use multiple data sources
   - Implement graceful degradation
   - Provide fallback UIs

2. **Handle Errors Gracefully**:
   - Catch and log errors
   - Provide user-friendly error messages
   - Implement retry logic

3. **Use Circuit Breakers**:
   - Temporarily disable failing services
   - Implement automatic recovery
   - Provide fallback functionality

4. **Monitor Health**:
   - Track service health
   - Set up alerts for failures
   - Implement automatic recovery

5. **Test Failover**:
   - Regularly test failover scenarios
   - Verify backup systems work
   - Test disaster recovery procedures

---

## 📞 Support

For issues or questions:

1. **Check Documentation**: Review this guide and the codebase
2. **Check Logs**: Look at application and server logs
3. **Check Health Endpoint**: Use `/api/health` for status
4. **Community**: Join the Base community for help
5. **Issues**: Open an issue on GitHub if you find a bug

---

## 🎉 Conclusion

By following this production setup guide, you'll have a robust, secure, and high-performance B20 Scanner deployment with:

✅ **Multiple RPC endpoints** for redundancy and load balancing
✅ **Redis caching** for optimal performance
✅ **API keys** for comprehensive market data
✅ **HTTPS enforcement** for security
✅ **Comprehensive monitoring** for observability
✅ **Rate limiting** for protection against abuse
✅ **Automatic failover** for reliability

Your B20 Scanner will be production-ready with excellent performance, security, and reliability! 🚀
