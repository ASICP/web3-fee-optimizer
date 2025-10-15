# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Fee Optimizer is an AI-powered gas fee optimization system with intelligent transaction timing and L2 routing recommendations. The application provides 20-40% gas fee savings through real-time analysis of gas prices, DEX routes, and Layer-2 alternatives.

## Architecture

### Three-Tier Middleware Architecture

The codebase follows a **three-layer service architecture** designed for browser compatibility:

1. **API Orchestration Layer** (`client/src/services/middleware/api-orchestrator.ts`)
   - Centralizes all external API calls (gas APIs, DEX aggregators, L2 bridges)
   - Implements retry logic with exponential backoff (100ms, 200ms, 300ms)
   - 30-second response caching to reduce API load
   - Event-driven error reporting and monitoring
   - Parallel API calls with graceful failover
   - **Key classes**: `BaseAPIService` (abstract base), `BlocknativeGasService`, `InfuraGasService`, `OneInchDEXService`, `ParaSwapDEXService`, `LiFiL2Service`, `APIOrchestrator` (main coordinator)

2. **Business Logic Layer** (`client/src/services/fee-optimization.ts`)
   - Analyzes comprehensive quote data to generate optimization recommendations
   - **Decision logic**: Compares gas prices across providers → selects best DEX route → evaluates L2 alternatives (savings > $5) → evaluates "wait" strategy (savings > $2, confidence > 70%)
   - Returns one of three recommendations: `execute_now`, `wait`, or `use_l2`
   - **Key class**: `FeeOptimizationService` with event system for React integration

3. **React Integration Layer** (`client/src/hooks/useFeeOptimization.ts`)
   - React hook that wraps the FeeOptimizationService
   - Manages loading/error states and service health monitoring
   - Provides `analyzeSwap` function and real-time `analysis` results

### Key Service Initialization Pattern

The orchestrator uses a **singleton pattern** initialized at app startup:

```typescript
// In App.tsx:
useEffect(() => {
  initializeOrchestrator(mockMode);
}, [mockMode]);

// In orchestrator.ts:
const orchestratorInstance = new APIOrchestrator({
  blocknativeKey: import.meta.env.VITE_BLOCKNATIVE_API_KEY,
  infuraKey: import.meta.env.VITE_INFURA_API_KEY,
});
```

### Event System

All services implement a **custom browser-compatible event system** (replacement for Node.js EventEmitter):

```typescript
// Pattern used throughout:
private listeners: { [key: string]: Function[] } = {};

on(event: string, callback: Function) {
  if (!this.listeners[event]) this.listeners[event] = [];
  this.listeners[event].push(callback);
}

emit(event: string, data: any) {
  if (this.listeners[event]) {
    this.listeners[event].forEach(callback => callback(data));
  }
}
```

## Development Commands

### Running the Application

```bash
# Development (frontend on :5173, backend on :3000)
npm run dev

# Type checking
npm run check

# Production build (builds both frontend and backend)
npm run build

# Production start
npm start
```

### Database Operations

```bash
# Push schema changes to database
npm run db:push
```

The database uses Drizzle ORM with PostgreSQL (Neon). Schema should be defined in `server/db/schema.ts` (currently not implemented).

### Environment Variables

Required variables in `.env.local`:
- `VITE_BLOCKNATIVE_API_KEY` - Blocknative gas price API
- `VITE_INFURA_API_KEY` - Infura gas estimation API
- `DATABASE_URL` - PostgreSQL connection string (Neon)

## Project Structure

```
web3-fee-optimizer/
├── client/                              # Frontend React application
│   └── src/
│       ├── components/                  # React components (UI + SwapInterface)
│       ├── hooks/                       # Custom React hooks
│       │   └── useFeeOptimization.ts   # Main optimization hook
│       ├── services/                    # Business logic layer
│       │   ├── middleware/
│       │   │   └── api-orchestrator.ts # API coordination layer (859 lines)
│       │   ├── fee-optimization.ts     # Optimization analysis logic
│       │   └── orchestrator.ts         # Singleton initialization
│       ├── types/
│       │   └── api.types.ts            # Shared TypeScript interfaces
│       └── App.tsx                     # Main app entry point
├── server/                              # Express backend
│   └── index.ts                        # Health check + static file serving
├── shared/                              # Shared utilities (currently unused)
└── [config files]                       # Vite, Drizzle, TypeScript, Tailwind
```

## Important Implementation Details

### Browser Compatibility

All service code is **browser-compatible**:
- No Node.js `EventEmitter` (custom implementation instead)
- No Node.js `fs`, `path`, or other server modules in `client/` code
- Uses `fetch` API for HTTP requests
- Uses `import.meta.env` for environment variables (Vite convention)

### Type System

Key interfaces are defined in `client/src/types/api.types.ts` and duplicated in `api-orchestrator.ts`:
- `TradeRequest` - Swap parameters
- `GasPriceData` - Gas price data with forecast
- `DEXRoute` - DEX aggregator route
- `L2Option` - L2 bridge option
- `SwapAnalysis` - Final recommendation output

### Gas Price Forecasting

Gas forecast calculations assume:
- ETH price: $2000 (hardcoded, should be real-time)
- Block time: 12 seconds (Ethereum average)
- Forecast covers next 5 blocks (~1 minute)

### Caching Strategy

API responses are cached for 30 seconds with automatic cleanup:
- Cache key format: `${prefix}:${JSON.stringify(params)}`
- TTL: 30000ms
- Periodic cleanup runs every 30 seconds via `startCacheCleanup()`

### Error Handling

Services use **Promise.allSettled** for parallel calls:
```typescript
const results = await Promise.allSettled(
  this.gasServices.map(service => service.getCurrentGasPrices())
);

// Extract only successful results
const gasData = results
  .filter(result => result.status === 'fulfilled')
  .map(result => result.value);
```

This provides **graceful failover** - if Blocknative fails, Infura data is still returned.

### File Naming Conventions

Files prefixed with `ph-` or `ph2-` or `ph3-` are **placeholder/prototype files** from earlier iterations. The production files are:
- `api-orchestrator.ts` (not `ph2-api-orchestrator.ts`)
- `fee-optimization.ts` (not `ph2-fee-optimization.ts`, `ph3-fee-optimization.ts`)
- `useFeeOptimization.ts` (not `ph-useFeeOptimization.ts`)
- `SwapInterface.tsx` (not `ph-SwapInterface.tsx`)

## External API Integrations

### Gas Price APIs
- **Blocknative**: Real-time mempool monitoring, requires API key
- **Infura**: MetaMask's gas API, free tier available

### DEX Aggregators
- **1inch**: Aggregates 100+ DEXs, zero platform fees
- **ParaSwap**: Multi-chain support, good for large swaps

### L2 Bridges
- **LI.FI**: Aggregates 20+ bridges, supports all major L2s

Each service extends `BaseAPIService` which provides:
- Automatic retry (3 attempts with exponential backoff)
- Rate limiting protection
- Event emission (`success`, `error`)
- Abstract `isHealthy()` method

## Development Notes

### Mock Mode

The app supports mock mode for development without API keys:
```typescript
const [mockMode, setMockMode] = useState(true);
initializeOrchestrator(mockMode);
```

Mock data generators exist in `client/src/services/mock-data-generator.ts`.

### Vite Configuration

- **Root**: `client/` directory
- **Build output**: `dist/public/`
- **Path aliases**: `@` → `client/src`, `@shared` → `shared`
- **Dev server**: Port 5173 (default)

### Express Server

The Express server (`server/index.ts`) is minimal:
- Development: Returns JSON redirecting to Vite dev server
- Production: Serves static files from `dist/public/`
- Health check: `GET /api/health`

### Build Process

```bash
npm run build
```

This runs:
1. `vite build` - Builds React frontend to `dist/public/`
2. `esbuild server/index.ts` - Bundles Express server to `dist/index.js`

Output: ESM format, platform: node, external packages bundled
