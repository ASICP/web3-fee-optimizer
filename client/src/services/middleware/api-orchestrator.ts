// =============================================================================
// FILE: src/services/middleware/api-orchestrator.ts
// Web3 Fee Optimizer - Centralized API Orchestration Layer
// =============================================================================
//
// PURPOSE:
// This module orchestrates all external API calls to gas price services, DEX
// aggregators, and L2 bridges. It provides a unified interface for fetching
// comprehensive quote data with built-in retry logic, caching, and failover.
//
// ARCHITECTURE:
// - Browser-compatible (no Node.js dependencies)
// - Multi-provider redundancy (if one API fails, others continue)
// - Request caching (30-second TTL to reduce API load)
// - Automatic retry with exponential backoff
// - Event-driven error reporting
//
// =============================================================================

// ===== TYPE DEFINITIONS =====

/**
 * TradeRequest - Standardized format for swap requests
 */
export interface TradeRequest {
  fromToken: string;      // Source token contract address
  toToken: string;        // Destination token contract address
  amount: string;         // Amount in wei (smallest unit)
  fromChain: string;      // Source blockchain (e.g., 'ethereum')
  toChain?: string;       // Destination chain for L2 routing (optional)
  userAddress: string;    // User's wallet address
  slippage: number;       // Acceptable slippage percentage (e.g., 0.5 = 0.5%)
  priority: 'fast' | 'standard' | 'economy';  // Gas price priority level
}

/**
 * GasPriceData - Gas price information from a provider
 */
export interface GasPriceData {
  source: string;         // Provider name (e.g., 'Blocknative')
  timestamp: number;      // When data was fetched (Unix timestamp)
  currentGwei: number;    // Current gas price in gwei
  fast: number;           // Fast execution gas price
  standard: number;       // Standard execution gas price
  safe: number;           // Safe/slow execution gas price
  baseFee: number;        // EIP-1559 base fee
  priorityFee: number;    // EIP-1559 priority fee (tip)
  forecast: {
    nextBlock: number;          // Predicted next block gas price
    next5Blocks: number[];      // Predicted prices for next 5 blocks
    confidence: number;         // Forecast confidence (0-1)
  };
}

/**
 * DEXRoute - Route information from a DEX aggregator
 */
export interface DEXRoute {
  source: string;         // Aggregator name (e.g., '1inch')
  route: {
    fromToken: string;
    toToken: string;
    amountIn: string;     // Input amount
    amountOut: string;    // Expected output amount
    priceImpact: number;  // Price impact percentage
    gasEstimate: number;  // Estimated gas units required
    protocols: string[];  // DEX protocols used in route
  };
  fees: {
    platformFee: number;    // DEX platform fee
    networkFee: number;     // Network gas fee
    totalFeeUSD: number;    // Total estimated fee in USD
  };
}

/**
 * L2Option - Layer-2 routing alternative
 */
export interface L2Option {
  source: string;         // Bridge provider (e.g., 'LI.FI')
  fromChain: string;      // Source chain
  toChain: string;        // Destination L2 chain
  bridgeCost: number;     // Cost to bridge (USD)
  bridgeTime: number;     // Estimated bridge time (seconds)
  totalCostUSD: number;   // Total cost including swap (USD)
  savings: number;        // Savings vs L1 (USD)
}

/**
 * OptimizationResult - Final recommendation output
 */
export interface OptimizationResult {
  recommendation: 'execute_now' | 'wait' | 'use_l2';
  estimatedSavings: number;
  confidence: number;
  details: {
    currentCost: number;
    optimizedCost: number;
    waitTime?: number;
    l2Details?: L2Option;
  };
  transaction?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  };
}

// =============================================================================
// BASE API SERVICE CLASS
// =============================================================================

/**
 * BaseAPIService - Abstract base class for all API service integrations
 * 
 * FEATURES:
 * - Automatic retry with exponential backoff
 * - Rate limiting protection
 * - Event emission for monitoring
 * - Error handling and reporting
 * 
 * All API services (gas, DEX, L2) extend this class
 */
abstract class BaseAPIService {
  protected name: string;
  protected baseURL: string;
  protected apiKey?: string;
  protected rateLimitDelay: number = 100;     // Milliseconds between retries
  protected retryAttempts: number = 3;         // Max retry attempts
  private listeners: { [key: string]: Function[] } = {};  // Event listeners
  
  constructor(name: string, baseURL: string, apiKey?: string) {
    this.name = name;
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  // Simple event system (browser-compatible)
  protected emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Make an HTTP request with retry logic
   * 
   * RETRY STRATEGY:
   * - Attempt 1: Immediate
   * - Attempt 2: Wait 100ms
   * - Attempt 3: Wait 200ms
   * 
   * @param endpoint - API endpoint path
   * @param options - Fetch options (method, body, headers)
   * @returns Parsed JSON response
   * @throws Error if all retries fail
   */
  protected async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    let lastError: Error;
    
    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            ...options.headers,
          },
        });

        // Check HTTP status
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.emit('success', { service: this.name, endpoint, data });
        return data;
        
      } catch (error) {
        lastError = error as Error;
        this.emit('error', { service: this.name, endpoint, error, attempt });
        
        // Wait before retry (exponential backoff: 100ms, 200ms, 300ms...)
        if (attempt < this.retryAttempts) {
          await this.delay(this.rateLimitDelay * attempt);
        }
      }
    }
    
    // All retries exhausted
    throw new Error(`${this.name} API failed after ${this.retryAttempts} attempts: ${lastError!.message}`);
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check - must be implemented by subclasses
   * @returns true if service is operational
   */
  abstract isHealthy(): Promise<boolean>;
}

// =============================================================================
// GAS PRICE SERVICE IMPLEMENTATIONS
// =============================================================================

/**
 * BlocknativeGasService - Blocknative gas price API integration
 * 
 * PROVIDER INFO:
 * - Real-time mempool monitoring
 * - High accuracy gas predictions
 * - Requires API key
 * 
 * API DOCS: https://docs.blocknative.com/gas-platform
 */
class BlocknativeGasService extends BaseAPIService {
  constructor(apiKey: string) {
    super('Blocknative', 'https://api.blocknative.com/gasprices/blockprices', apiKey);
  }

  async getCurrentGasPrices(): Promise<GasPriceData> {
    const data = await this.makeRequest<any>('');
    
    // Transform Blocknative response to standard format
    return {
      source: this.name,
      timestamp: Date.now(),
      currentGwei: data.blockPrices[0]?.estimatedPrices[0]?.price || 0,
      fast: data.blockPrices[0]?.estimatedPrices[0]?.price || 0,
      standard: data.blockPrices[0]?.estimatedPrices[1]?.price || 0,
      safe: data.blockPrices[0]?.estimatedPrices[2]?.price || 0,
      baseFee: data.blockPrices[0]?.baseFeePerGas || 0,
      priorityFee: data.blockPrices[0]?.estimatedPrices[0]?.maxPriorityFeePerGas || 0,
      forecast: {
        nextBlock: data.blockPrices[1]?.estimatedPrices[1]?.price || 0,
        next5Blocks: data.blockPrices.slice(0, 5).map((block: any) => 
          block.estimatedPrices[1]?.price || 0
        ),
        confidence: data.confidence || 0.85,
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.makeRequest('');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * InfuraGasService - Infura gas price API integration
 * 
 * PROVIDER INFO:
 * - MetaMask's gas estimation API
 * - Free tier available
 * - Good for EIP-1559 estimates
 * 
 * API DOCS: https://docs.infura.io/networks/ethereum/how-to/query-gas-fees
 */
class InfuraGasService extends BaseAPIService {
  constructor(apiKey: string) {
    super('Infura', 'https://gas-api.metaswap.codefi.network/networks/1', apiKey);
  }

  async getCurrentGasPrices(): Promise<GasPriceData> {
    const data = await this.makeRequest<any>('/suggestedGasFees');
    
    return {
      source: this.name,
      timestamp: Date.now(),
      currentGwei: parseFloat(data.medium.suggestedMaxFeePerGas),
      fast: parseFloat(data.high.suggestedMaxFeePerGas),
      standard: parseFloat(data.medium.suggestedMaxFeePerGas),
      safe: parseFloat(data.low.suggestedMaxFeePerGas),
      baseFee: parseFloat(data.estimatedBaseFee),
      priorityFee: parseFloat(data.medium.suggestedMaxPriorityFeePerGas),
      forecast: {
        // Infura doesn't provide forecast, so we estimate a gradual decline
        nextBlock: parseFloat(data.medium.suggestedMaxFeePerGas) * 0.95,
        next5Blocks: [
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.95,
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.90,
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.88,
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.85,
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.82,
        ],
        confidence: 0.75,  // Lower confidence since it's estimated
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.makeRequest('/suggestedGasFees');
      return true;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// DEX AGGREGATOR SERVICE IMPLEMENTATIONS
// =============================================================================

/**
 * OneInchDEXService - 1inch aggregator API integration
 * 
 * PROVIDER INFO:
 * - Aggregates 100+ DEX protocols
 * - Zero platform fees
 * - Excellent price optimization
 * 
 * API DOCS: https://docs.1inch.io/docs/aggregation-protocol/api/swagger
 */
class OneInchDEXService extends BaseAPIService {
  constructor() {
    super('1inch', 'https://api.1inch.io/v5.0/1');
  }

  async getBestRoute(request: TradeRequest): Promise<DEXRoute> {
    const params = new URLSearchParams({
      fromTokenAddress: request.fromToken,
      toTokenAddress: request.toToken,
      amount: request.amount,
      fromAddress: request.userAddress,
      slippage: request.slippage.toString(),
      disableEstimate: 'false',
    });

    const data = await this.makeRequest<any>(`/swap?${params}`);
    
    return {
      source: this.name,
      route: {
        fromToken: request.fromToken,
        toToken: request.toToken,
        amountIn: request.amount,
        amountOut: data.toTokenAmount,
        priceImpact: parseFloat(data.priceImpact || '0'),
        gasEstimate: parseInt(data.estimatedGas || '0'),
        protocols: data.protocols?.[0]?.map((p: any) => p[0]?.name) || [],
      },
      fees: {
        platformFee: 0,  // 1inch doesn't charge platform fees
        networkFee: parseInt(data.estimatedGas || '0') * 20,  // Rough estimate
        totalFeeUSD: (parseInt(data.estimatedGas || '0') * 20 * 2000) / 1e9,
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.makeRequest('/healthcheck');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * ParaSwapDEXService - ParaSwap aggregator API integration
 * 
 * PROVIDER INFO:
 * - Multi-chain DEX aggregator
 * - Advanced routing algorithms
 * - Good for large swaps
 * 
 * API DOCS: https://developers.paraswap.network/api/get-rate
 */
class ParaSwapDEXService extends BaseAPIService {
  constructor() {
    super('ParaSwap', 'https://apiv5.paraswap.io');
  }

  async getBestRoute(request: TradeRequest): Promise<DEXRoute> {
    const priceParams = new URLSearchParams({
      srcToken: request.fromToken,
      destToken: request.toToken,
      amount: request.amount,
      network: '1',  // Ethereum mainnet
      userAddress: request.userAddress,
    });

    const priceData = await this.makeRequest<any>(`/prices?${priceParams}`);
    
    return {
      source: this.name,
      route: {
        fromToken: request.fromToken,
        toToken: request.toToken,
        amountIn: request.amount,
        amountOut: priceData.destAmount,
        priceImpact: parseFloat(priceData.priceImpact || '0'),
        gasEstimate: parseInt(priceData.gasCost || '0'),
        protocols: priceData.bestRoute?.[0]?.swaps?.map((s: any) => s.swapExchanges[0]?.exchange) || [],
      },
      fees: {
        platformFee: parseFloat(priceData.partnerFee || '0'),
        networkFee: parseInt(priceData.gasCost || '0'),
        totalFeeUSD: parseInt(priceData.gasCostUSD || '0'),
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check with common token pair
      await this.makeRequest('/prices?srcToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&destToken=0xA0b86a33E6441e1ba4ee5e45b1230E90&amount=1000000000000000000&network=1');
      return true;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// L2 ROUTING SERVICE IMPLEMENTATIONS
// =============================================================================

/**
 * LiFiL2Service - LI.FI cross-chain bridge aggregator
 * 
 * PROVIDER INFO:
 * - Aggregates 20+ bridges
 * - Supports all major L2s
 * - Optimal routing for cross-chain swaps
 * 
 * API DOCS: https://docs.li.fi/integrate-li.fi-js-sdk/overview
 */
class LiFiL2Service extends BaseAPIService {
  constructor() {
    super('LI.FI', 'https://li.fi/api/v1');
  }

  async getL2Options(request: TradeRequest): Promise<L2Option[]> {
    const routeRequest = {
      fromChain: request.fromChain,
      toChain: request.toChain || 'arbitrum',
      fromToken: request.fromToken,
      toToken: request.toToken,
      fromAmount: request.amount,
      fromAddress: request.userAddress,
      toAddress: request.userAddress,
    };

    const data = await this.makeRequest<any>('/quote', {
      method: 'POST',
      body: JSON.stringify(routeRequest),
    });

    return data.routes?.map((route: any) => ({
      source: this.name,
      fromChain: request.fromChain,
      toChain: route.toChain,
      bridgeCost: parseFloat(route.gasCostUSD || '0'),
      bridgeTime: route.estimatedExecutionDuration || 600,  // Default 10 minutes
      totalCostUSD: parseFloat(route.gasCostUSD || '0'),
      savings: parseFloat(route.savingsUSD || '0'),
    })) || [];
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.makeRequest('/status');
      return true;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// MAIN API ORCHESTRATOR CLASS
// =============================================================================

/**
 * APIOrchestrator - Central coordinator for all API services
 * 
 * RESPONSIBILITIES:
 * - Initialize and manage all API service instances
 * - Coordinate parallel API calls for comprehensive quotes
 * - Implement caching to reduce API load
 * - Handle service failures gracefully (failover)
 * - Emit events for monitoring and debugging
 * 
 * USAGE:
 * const orchestrator = new APIOrchestrator({ blocknativeKey, infuraKey });
 * const quote = await orchestrator.getComprehensiveQuote(tradeRequest);
 */
export class APIOrchestrator {
  // Service instances grouped by type
  private gasServices: BaseAPIService[];
  private dexServices: BaseAPIService[];
  private l2Services: BaseAPIService[];
  
  // Response cache to reduce API calls
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTimeout: number = 30 * 1000;  // 30 seconds TTL
  
  // Event listeners
  private listeners: { [key: string]: Function[] } = {};

  /**
   * Initialize orchestrator with API keys
   * @param config - API keys for external services
   */
  constructor(config: {
    blocknativeKey?: string;
    infuraKey?: string;
  }) {
    this.cache = new Map();
    
    // Initialize gas price services (only if API keys provided)
    this.gasServices = [
      ...(config.blocknativeKey ? [new BlocknativeGasService(config.blocknativeKey)] : []),
      ...(config.infuraKey ? [new InfuraGasService(config.infuraKey)] : []),
    ];

    // Initialize DEX aggregators (no API keys required)
    this.dexServices = [
      new OneInchDEXService(),
      new ParaSwapDEXService(),
    ];

    // Initialize L2 bridge services
    this.l2Services = [
      new LiFiL2Service(),
    ];

    // Set up event forwarding from services
    this.setupEventListeners();
  }

  // Event system (browser-compatible)
  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Forward service events to orchestrator level
   * Allows monitoring of individual service successes/failures
   */
  private setupEventListeners(): void {
    const allServices = [...this.gasServices, ...this.dexServices, ...this.l2Services];
    
    allServices.forEach(service => {
      service.on('error', (error) => {
        this.emit('serviceError', { service: service.constructor.name, error });
      });
      
      service.on('success', (data) => {
        this.emit('serviceSuccess', { service: service.constructor.name, data });
      });
    });
  }

  // =============================================================================
  // CACHING SYSTEM
  // =============================================================================

  /**
   * Generate cache key from prefix and parameters
   */
  private getCacheKey(prefix: string, params: any): string {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  /**
   * Get data from cache if not expired
   * @returns Cached data or null if expired/not found
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Store data in cache with current timestamp
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // =============================================================================
  // API ORCHESTRATION METHODS
  // =============================================================================

  /**
   * Get optimized gas price data from all providers
   * 
   * STRATEGY:
   * - Query all configured gas services in parallel
   * - Return all successful responses (failover if some fail)
   * - Cache results for 30 seconds
   * 
   * @returns Array of gas price data from multiple providers
   */
  async getOptimizedGasData(): Promise<GasPriceData[]> {
    const cacheKey = this.getCacheKey('gas', {});
    const cached = this.getFromCache<GasPriceData[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Call all gas services in parallel
    const results = await Promise.allSettled(
      this.gasServices.map(service => 
        (service as any).getCurrentGasPrices()
      )
    );

    // Extract successful results (ignore failures)
    const gasData = results
      .filter((result): result is PromiseFulfilledResult<GasPriceData> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    this.setCache(cacheKey, gasData);
    return gasData;
  }

  /**
   * Get best DEX routes from all aggregators
   * 
   * STRATEGY:
   * - Query all DEX aggregators in parallel
   * - Return all routes for comparison
   * - Cache by trade parameters
   * 
   * @param request - Trade parameters
   * @returns Array of routes from multiple DEX aggregators
   */
  async getBestDEXRoutes(request: TradeRequest): Promise<DEXRoute[]> {
    const cacheKey = this.getCacheKey('dex', request);
    const cached = this.getFromCache<DEXRoute[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const results = await Promise.allSettled(
      this.dexServices.map(service => 
        (service as any).getBestRoute(request)
      )
    );

    const routes = results
      .filter((result): result is PromiseFulfilledResult<DEXRoute> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    this.setCache(cacheKey, routes);
    return routes;
  }

  /**
   * Get L2 routing alternatives
   * 
   * NOTE: Only queries if toChain is specified in request
   * 
   * @param request - Trade parameters with toChain
   * @returns Array of L2 routing options
   */
  async getL2Alternatives(request: TradeRequest): Promise<L2Option[]> {
    // Skip L2 queries if no destination chain specified
    if (!request.toChain) {
      return [];
    }

    const cacheKey = this.getCacheKey('l2', request);
    const cached = this.getFromCache<L2Option[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const results = await Promise.allSettled(
      this.l2Services.map(service => 
        (service as any).getL2Options(request)
      )
    );

    // Flatten results (each service returns an array)
    const options = results
      .filter((result): result is PromiseFulfilledResult<L2Option[]> => 
        result.status === 'fulfilled'
      )
      .flatMap(result => result.value);

    this.setCache(cacheKey, options);
    return options;
  }

  /**
   * Get comprehensive quote from all services
   * 
   * This is the main entry point - calls all services in parallel
   * and returns a complete picture for optimization analysis.
   * 
   * @param request - Trade parameters
   * @returns Complete quote with gas, DEX routes, and L2 options
   */
  async getComprehensiveQuote(request: TradeRequest): Promise<{
    gasData: GasPriceData[];
    dexRoutes: DEXRoute[];
    l2Options: L2Option[];
    timestamp: number;
  }> {
    // Fetch all data in parallel for speed
    const [gasData, dexRoutes, l2Options] = await Promise.all([
      this.getOptimizedGasData(),
      this.getBestDEXRoutes(request),
      this.getL2Alternatives(request),
    ]);

    return {
      gasData,
      dexRoutes,
      l2Options,
      timestamp: Date.now(),
    };
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Check health status of all configured services
   * 
   * Useful for:
   * - Displaying service status in UI
   * - Diagnosing API issues
   * - Monitoring uptime
   * 
   * @returns Object mapping service names to health status
   * Example: { "Blocknative": true, "1inch": false, "LI.FI": true }
   */
  async checkServiceHealth(): Promise<{ [key: string]: boolean }> {
    const allServices = [...this.gasServices, ...this.dexServices, ...this.l2Services];
    
    const healthChecks = await Promise.allSettled(
      allServices.map(async service => ({
        name: service.constructor.name,
        healthy: await service.isHealthy(),
      }))
    );

    const health: { [key: string]: boolean } = {};
    
    healthChecks.forEach(result => {
      if (result.status === 'fulfilled') {
        health[result.value.name] = result.value.healthy;
      }
    });

    return health;
  }

  /**
   * Start periodic cache cleanup
   * Removes expired entries every 30 seconds to prevent memory leaks
   */
  startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.cache.delete(key);
        }
      }
    }, this.cacheTimeout);
  }

  /**
   * Graceful shutdown - cleanup resources
   */
  async shutdown(): void {
    this.listeners = {};
    this.cache.clear();
  }
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================
/*
// Initialize with API keys
const orchestrator = new APIOrchestrator({
  blocknativeKey: 'your-key-here',
  infuraKey: 'your-key-here'
});

// Start background cache cleanup
orchestrator.startCacheCleanup();

// Monitor events
orchestrator.on('serviceError', (error) => {
  console.error('Service error:', error);
});

// Get comprehensive quote
const quote = await orchestrator.getComprehensiveQuote({
  fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  toToken: '0xA0b86a33E6441e1ba4ee5e45b1230E90',
  amount: '1000000000000000000',
  fromChain: 'ethereum',
  userAddress: '0x...',
  slippage: 0.5,
  priority: 'standard'
});

console.log('Gas Data:', quote.gasData);
console.log('DEX Routes:', quote.dexRoutes);
console.log('L2 Options:', quote.l2Options);
*/